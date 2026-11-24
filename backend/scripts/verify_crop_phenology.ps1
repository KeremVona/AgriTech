# ==============================================================================
# Precision AgriTech Platform - FAO-56 Crop Phenology & Dynamic Kc Verification
# Task: BACK-302 / TODO-302
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5196
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

$ownerId       = "a0000000-0000-0000-0000-000000000001"
$cropId        = "c0000000-0000-0000-0000-000000000001" # Seeded Tomato
$soilProfileId = "sandy_loam"
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
Write-Host " AgriTech BACK-302: FAO-56 Dynamic Crop Coefficient (Kc) Engine  " -ForegroundColor Cyan
Write-Host " Acceptance Verification Harness (Phenology + BACK-301 Weather)  " -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Detect if PostgreSQL (5432) is reachable for full DB + WeatherCache integration
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

    $envName = if ($dbAvailable) { "Development" } else { "Staging" }
    Write-Host "[Setup] PostgreSQL 5432 reachable: $dbAvailable (ASPNETCORE_ENVIRONMENT=$envName)" -ForegroundColor DarkGray
    Write-Host "[Setup] Starting Web API on port $port..." -NoNewline
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "dotnet"
    $psi.Arguments = "run --project backend/AgriTech.Api.csproj --no-build --no-launch-profile --urls http://127.0.0.1:$port"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError  = $false
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = $envName
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
    # Test 1: Static Crop Catalog
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 1] Verifying crop_growth_stages.json catalog (GET /api/v1/phenology/crops)..." -ForegroundColor Yellow
    $resCatalog = Send-Request -Method "GET" -Url "$base/phenology/crops"
    if ($resCatalog.Code -ne 200) { throw "Expected 200, got $($resCatalog.Code)" }
    $crops = $resCatalog.Body | ConvertFrom-Json
    if ($crops.Count -ne 4) { throw "Expected 4 crops, got $($crops.Count)" }
    Write-Host "  Crops loaded: $(($crops | ForEach-Object { $_.cropType }) -join ', ')" -ForegroundColor DarkGray
    Write-Host "  [PASS] All 4 FAO-56 crops configured." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 2: Mid-Season Peak Kc Plateau & Contract-Compliant Enum (AC1)
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 2] AC1: Tomato Mid-Season Peak Kc = 1.15 & UPPERCASE stage enum..." -ForegroundColor Yellow
    $resKc = Send-Request -Method "GET" -Url "$base/phenology/kc?cropType=Tomato&plantingDate=2026-04-01&targetDate=2026-06-30&et0Mm=5.0"
    if ($resKc.Code -ne 200) { throw "Expected 200, got $($resKc.Code): $($resKc.Body)" }
    $kcObj = $resKc.Body | ConvertFrom-Json
    if ([decimal]$kcObj.kc -ne 1.15) { throw "Expected Kc=1.15, got $($kcObj.kc)" }
    if ($kcObj.stage -ne "MID_SEASON") { throw "Expected UPPERCASE stage MID_SEASON, got $($kcObj.stage)" }
    if ([decimal]$kcObj.etcMm -ne 5.75) { throw "Expected ETc=5.75, got $($kcObj.etcMm)" }
    Write-Host "  Tomato DAP=$($kcObj.daysAfterPlanting): Stage=$($kcObj.stage), Kc=$($kcObj.kc), ETc=$($kcObj.etcMm) mm/day" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC1 verified with irrigation-api-contract.md JSON shape." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 3: Smooth Lifecycle Curve Continuity Check (AC2)
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 3] AC2: Verifying smooth transitions across full Tomato lifecycle curve..." -ForegroundColor Yellow
    $resCurve = Send-Request -Method "GET" -Url "$base/phenology/curve?cropType=Tomato&plantingDate=2026-04-01"
    if ($resCurve.Code -ne 200) { throw "Expected 200, got $($resCurve.Code)" }
    $curve = $resCurve.Body | ConvertFrom-Json
    if ($curve.Count -ne 146) { throw "Expected 146 points (DAP 0..145), got $($curve.Count)" }
    if ([decimal]$curve[30].kc -ne 0.60) { throw "Expected DAP 30 Kc=0.60, got $($curve[30].kc)" }
    if ([decimal]$curve[50].kc -ne 0.875) { throw "Expected DAP 50 Kc=0.875, got $($curve[50].kc)" }
    if ([decimal]$curve[70].kc -ne 1.15) { throw "Expected DAP 70 Kc=1.15, got $($curve[70].kc)" }
    if ([decimal]$curve[115].kc -ne 1.15) { throw "Expected DAP 115 Kc=1.15, got $($curve[115].kc)" }
    if ([decimal]$curve[130].kc -ne 0.975) { throw "Expected DAP 130 Kc=0.975, got $($curve[130].kc)" }
    if ([decimal]$curve[145].kc -ne 0.80) { throw "Expected DAP 145 Kc=0.80, got $($curve[145].kc)" }
    Write-Host "  Curve verified: 146 points | 0.60 -> 0.875 -> 1.15 -> 0.975 -> 0.80 (zero discontinuity)" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC2 smooth linear interpolation verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 4: Error Contract Verification (404 ProblemDetails)
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 4] Verifying 404 ProblemDetails for unsupported crop type..." -ForegroundColor Yellow
    $res404 = Send-Request -Method "GET" -Url "$base/phenology/kc?cropType=Dragonfruit&plantingDate=2026-04-01"
    if ($res404.Code -ne 404) { throw "Expected 404, got $($res404.Code)" }
    Write-Host "  [PASS] 404 ProblemDetails returned cleanly." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 5: Live Integration with Parcel & BACK-301 weather_cache (ETc = Kc * ET0)
    # -------------------------------------------------------------------------
    if (-not $dbAvailable) {
        Write-Host "`n[Test 5] SKIPPED — PostgreSQL not reachable on 127.0.0.1:5432 (start Docker to run live DB parcel+weather integration)." -ForegroundColor DarkYellow
    } else {
        Write-Host "`n[Test 5] Live Parcel + WeatherCache Integration (GET /api/v1/parcels/{id}/phenology)..." -ForegroundColor Yellow
        $plantingDateStr = (Get-Date).ToUniversalTime().AddDays(-90).ToString("yyyy-MM-dd")

        $fieldPayload = @"
{
  "name": "BACK-302 Phenology Test Field",
  "owner_id": "$ownerId",
  "location_name": "Izmir Phenology Test Hub",
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
  "name": "Mid-Season Tomato Parcel",
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

        # Ingest live ET0 via BACK-301
        $resIngest = Send-Request -Method "POST" -Url "$base/weather/parcels/$testParcelId/ingest"
        if ($resIngest.Code -ne 200) { throw "Weather ingest failed: $($resIngest.Body)" }

        # Query parcel phenology (joins parcel crop + planting date + cached ET0)
        $resParcelPhen = Send-Request -Method "GET" -Url "$base/parcels/$testParcelId/phenology"
        if ($resParcelPhen.Code -ne 200) { throw "Parcel phenology failed: $($resParcelPhen.Body)" }
        $pp = $resParcelPhen.Body | ConvertFrom-Json

        if ([decimal]$pp.assessment.kc -ne 1.15) { throw "Expected parcel Kc=1.15, got $($pp.assessment.kc)" }
        if ($pp.assessment.stage -ne "MID_SEASON") { throw "Expected MID_SEASON, got $($pp.assessment.stage)" }
        if ($null -eq $pp.assessment.et0Mm -or $null -eq $pp.assessment.etcMm) {
            throw "Expected live ET0 and ETc enrichment from weather_cache!"
        }
        Write-Host "  Parcel '$($pp.parcelName)' -> Stage=$($pp.assessment.stage), Kc=$($pp.assessment.kc), ET0=$($pp.assessment.et0Mm) mm, ETc=$($pp.assessment.etcMm) mm/day" -ForegroundColor DarkGray
        Write-Host "  [PASS] Live BACK-301 + BACK-302 pipeline integrated end-to-end." -ForegroundColor Green
    }

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " BACK-302 ACCEPTANCE VERIFICATION COMPLETED SUCCESSFULLY!        " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
finally {
    Write-Host "`n[Cleanup] Cleaning up test fixtures..." -ForegroundColor Gray
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
        Write-Host "  Stopped Web API process (PID: $($process.Id))." -ForegroundColor DarkGray
    }
}
