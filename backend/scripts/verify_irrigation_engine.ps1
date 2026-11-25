# ==============================================================================
# Precision AgriTech Platform - FAO-56 Soil Water Balance & Actuation Verification
# Task: BACK-303 / TODO-303
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5197
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

$ownerId       = "a0000000-0000-0000-0000-000000000001"
$cropId        = "c0000000-0000-0000-0000-000000000001" # Seeded Tomato
$soilProfileId = "sandy_loam"                          # Seeded Sandy Loam (FC=0.220, WP=0.100, MAD=0.50)
$testFieldId   = $null
$testParcelId  = $null

function Send-Request {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Body = ""
    )
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = $Method
    $req.Accept = "application/json"
    if ($Body -ne "") {
        $req.ContentType = "application/json"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $req.ContentLength = $bytes.Length
        $s = $req.GetRequestStream()
        $s.Write($bytes, 0, $bytes.Length)
        $s.Close()
    }
    try {
        $resp = $req.GetResponse()
        try {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            try {
                return @{ Code = [int]$resp.StatusCode; Body = $reader.ReadToEnd() }
            } finally { $reader.Dispose() }
        } finally { $resp.Close() }
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $errResp = $_.Exception.Response
            try {
                $code = [int]$errResp.StatusCode
                $reader = New-Object System.IO.StreamReader($errResp.GetResponseStream())
                try {
                    return @{ Code = $code; Body = $reader.ReadToEnd() }
                } finally { $reader.Dispose() }
            } finally { $errResp.Close() }
        }
        throw
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " AgriTech BACK-303: Root-Zone Deficit & Actuation Trigger Engine " -ForegroundColor Cyan
Write-Host " Acceptance Verification Harness (FAO-56 Water Balance + DB)     " -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $dbAvailable = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect("127.0.0.1", 5432, $null, $null)
        if ($async.AsyncWaitHandle.WaitOne(1000, $false)) {
            $tcp.EndConnect($async)
            $dbAvailable = $true
        }
        $tcp.Close()
    } catch { }

    if (-not $dbAvailable) {
        Write-Host "[Info] PostgreSQL is not reachable on 127.0.0.1:5432." -ForegroundColor DarkYellow
        Write-Host "[Info] Start Docker (agritech_postgres) to run live database-backed BACK-303 endpoints." -ForegroundColor DarkYellow
        Write-Host "[Info] Running pure xUnit suite for IrrigationSchedulingEngine & IrrigationController instead..." -ForegroundColor Cyan
        dotnet test tests/AgriTech.Api.Tests --filter "FullyQualifiedName~Irrigation" --no-build
        if ($LASTEXITCODE -ne 0) { throw "xUnit Irrigation test suite failed." }
        exit 0
    }

    Write-Host "[Setup] Starting Web API on port $port..." -NoNewline
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "dotnet"
    $psi.Arguments = "run --project backend/AgriTech.Api.csproj --no-build --no-launch-profile --urls http://127.0.0.1:$port"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError  = $false
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Development"
    $psi.EnvironmentVariables["WeatherIngestion__Enabled"] = "false"

    $process = [System.Diagnostics.Process]::Start($psi)

    $ready = $false
    for ($i = 0; $i -lt 35; $i++) {
        Start-Sleep -Seconds 1
        try {
            $ping = Send-Request -Method "GET" -Url "$base/phenology/crops"
            if ($ping.Code -eq 200) {
                $ready = $true
                break
            }
        } catch { }
    }

    if (-not $ready) {
        throw "API failed to start on port $port within 35 seconds."
    }
    Write-Host " READY" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 1: AC1 — Simulated Rain Event (P > 5 mm) Reduces Depletion
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 1] AC1: Verifying rain event (P=13mm -> Peff=6mm) reduces root-zone depletion..." -ForegroundColor Yellow
    $rainPayload = @"
{
  "soilProfileId": "sandy_loam",
  "previousDepletionMm": 33.00,
  "etcMm": 5.00,
  "precipitationMm": 13.00,
  "irrigationMm": 0.00,
  "effectiveRootDepthM": 0.60,
  "areaHectares": 1.00,
  "irrigationEfficiency": 0.88,
  "systemFlowRateLpm": 500.00
}
"@
    $resRain = Send-Request -Method "POST" -Url "$base/irrigation/evaluate" -Body $rainPayload
    if ($resRain.Code -ne 200) { throw "Expected 200, got $($resRain.Code): $($resRain.Body)" }
    $rainJson = $resRain.Body | ConvertFrom-Json
    if ([decimal]$rainJson.effectivePrecipitationMm -ne 6.00 -or [decimal]$rainJson.depletionMm -ne 32.00 -or $rainJson.triggerIrrigation -ne $false) {
        throw "Rain balance mismatch: Peff=$($rainJson.effectivePrecipitationMm), Dr=$($rainJson.depletionMm), Trigger=$($rainJson.triggerIrrigation)"
    }
    Write-Host "  Dr,t = 33 + 5 - 6 = 32.00 mm (< RAW 36.00 mm) -> Trigger=False" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC1 verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 2: AC2 — Trigger at Dr >= RAW & Exact Refill Volume to 100% FC
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 2] AC2: Verifying trigger at Dr >= RAW & exact refill volume to 100% FC..." -ForegroundColor Yellow
    $dryPayload = @"
{
  "soilProfileId": "sandy_loam",
  "previousDepletionMm": 31.00,
  "etcMm": 5.00,
  "precipitationMm": 0.00,
  "irrigationMm": 0.00,
  "effectiveRootDepthM": 0.60,
  "areaHectares": 1.00,
  "irrigationEfficiency": 0.88,
  "systemFlowRateLpm": 500.00
}
"@
    $resDry = Send-Request -Method "POST" -Url "$base/irrigation/evaluate" -Body $dryPayload
    if ($resDry.Code -ne 200) { throw "Expected 200, got $($resDry.Code): $($resDry.Body)" }
    $dryJson = $resDry.Body | ConvertFrom-Json
    if ($dryJson.triggerIrrigation -ne $true -or [decimal]$dryJson.refillPlan.grossVolumeLiters -ne 409090.91 -or [decimal]$dryJson.refillPlan.postIrrigationDepletionMm -ne 0.00) {
        throw "Refill mismatch: $($resDry.Body)"
    }
    Write-Host "  Dr=36.00 mm >= RAW -> GrossVolume=409,090.91 L, PostDepletion=0.00 mm, PostVWC=$($dryJson.refillPlan.postIrrigationMoisturePct)%" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC2 verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 3: Live Parcel Evaluation, Automated Event Persistence & Water Budget
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 3] Live Parcel Scheduling, Idempotency & GET /water-budget contract..." -ForegroundColor Yellow
    $plantingDateStr = (Get-Date).ToUniversalTime().AddDays(-90).ToString("yyyy-MM-dd")

    $fieldPayload = @"
{
  "name": "BACK-303 Irrigation Test Field",
  "owner_id": "$ownerId",
  "location_name": "Izmir Irrigation Hub",
  "boundary_geom": {
    "type": "Polygon",
    "coordinates": [[[27.1350, 38.4150],[27.1450, 38.4150],[27.1450, 38.4250],[27.1350, 38.4250],[27.1350, 38.4150]]]
  }
}
"@
    $resField = Send-Request -Method "POST" -Url "$base/fields" -Body $fieldPayload
    if ($resField.Code -ne 201) { throw "Field create failed: $($resField.Body)" }
    $testFieldId = ($resField.Body | ConvertFrom-Json).id

    $parcelPayload = @"
{
  "field_id": "$testFieldId",
  "crop_id": "$cropId",
  "soil_profile_id": "$soilProfileId",
  "name": "BACK-303 Tomato Deficit Parcel",
  "planting_date": "$plantingDateStr",
  "boundary_geom": {
    "type": "Polygon",
    "coordinates": [[[27.1380, 38.4180],[27.1420, 38.4180],[27.1420, 38.4220],[27.1380, 38.4220],[27.1380, 38.4180]]]
  }
}
"@
    $resParcel = Send-Request -Method "POST" -Url "$base/parcels" -Body $parcelPayload
    if ($resParcel.Code -ne 201) { throw "Parcel create failed: $($resParcel.Body)" }
    $testParcelId = ($resParcel.Body | ConvertFrom-Json).id

    $evalBody = '{"previousDepletionMm": 33.0, "et0MmOverride": 5.0, "precipitationMmOverride": 0.0}'
    $resEval1 = Send-Request -Method "POST" -Url "$base/parcels/$testParcelId/irrigation/evaluate" -Body $evalBody
    if ($resEval1.Code -ne 200) { throw "Parcel evaluate failed: $($resEval1.Body)" }
    $eval1 = $resEval1.Body | ConvertFrom-Json
    if ($eval1.eventCreated -ne $true -or $eval1.scheduledEvent.triggerType -ne "AUTOMATED_DEFICIT" -or $eval1.scheduledEvent.status -ne "PENDING") {
        throw "Expected new PENDING AUTOMATED_DEFICIT event: $($resEval1.Body)"
    }

    # Re-evaluate immediately -> idempotency must prevent duplicate active event
    $resEval2 = Send-Request -Method "POST" -Url "$base/parcels/$testParcelId/irrigation/evaluate" -Body $evalBody
    if ($resEval2.Code -ne 200) { throw "Second parcel evaluate failed: $($resEval2.Body)" }
    $eval2 = $resEval2.Body | ConvertFrom-Json
    if ($eval2.eventCreated -ne $false -or $eval2.eventAlreadyActive -ne $true) {
        throw "Idempotency check failed: $($resEval2.Body)"
    }

    # Verify GET /api/v1/parcels/{id}/water-budget contract
    $resBudget = Send-Request -Method "GET" -Url "$base/parcels/$testParcelId/water-budget"
    if ($resBudget.Code -ne 200) { throw "Water budget failed: $($resBudget.Body)" }
    $budget = $resBudget.Body | ConvertFrom-Json
    if ([decimal]$budget.fieldCapacityPct -ne 22.0 -or [decimal]$budget.madFraction -ne 0.5) {
        throw "Water budget contract mismatch: $($resBudget.Body)"
    }

    Write-Host "  Scheduled Event ID=$($eval1.scheduledEvent.id) | Status=$($eval1.scheduledEvent.status) | Volume=$($eval1.scheduledEvent.waterVolumeLiters) L" -ForegroundColor DarkGray
    Write-Host "  WaterBudget -> FC=$($budget.fieldCapacityPct)%, WP=$($budget.wiltingPointPct)%, MAD=$($budget.madFraction)" -ForegroundColor DarkGray
    Write-Host "  [PASS] Live parcel scheduling, idempotency, and water-budget contract verified." -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " ALL BACK-303 ACCEPTANCE VERIFICATION TESTS PASSED!             " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
finally {
    if ($testParcelId) {
        try { Send-Request -Method "DELETE" -Url "$base/parcels/$testParcelId" | Out-Null } catch { }
    }
    if ($testFieldId) {
        $parsedGuid = [Guid]::Empty
        if ([Guid]::TryParse($testFieldId, [ref]$parsedGuid)) {
            try { docker exec agritech_postgres psql -U postgres -d agritech_db -c "DELETE FROM fields WHERE id = '$parsedGuid';" | Out-Null } catch { }
        }
    }
    if ($process -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
}
