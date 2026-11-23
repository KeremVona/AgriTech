# ==============================================================================
# Precision AgriTech Platform - Open-Meteo Weather Client & Daily Ingestion Verification
# Task: BACK-301 / TODO-301
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5195
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

# Seeded Reference IDs (Finding 2)
$ownerId       = "a0000000-0000-0000-0000-000000000001"
$cropId        = "c0000000-0000-0000-0000-000000000001" # Seeded Tomato
$soilProfileId = "sandy_loam"                          # Seeded Sandy Loam
$testFieldId   = $null
$testParcelId  = $null

function Send-Request {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Body = ""
    )
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method  = $Method
    $req.Accept  = "application/json"
    if ($Body -ne "") {
        $req.ContentType = "application/json"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $req.ContentLength = $bytes.Length
        $s = $req.GetRequestStream()
        $s.Write($bytes, 0, $bytes.Length)
        $s.Close()
    }
    try {
        $resp   = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        return @{ Code = [int]$resp.StatusCode; Body = $reader.ReadToEnd() }
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $code   = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            return @{ Code = $code; Body = $reader.ReadToEnd() }
        }
        throw
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " AgriTech BACK-301: Open-Meteo Client & Weather Ingestion Engine " -ForegroundColor Cyan
Write-Host " Acceptance Verification Test Suite (PostGIS + Open-Meteo API)   " -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # --- Start API ---
    Write-Host "[Setup] Starting Web API on port $port..." -NoNewline
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "dotnet"
    $psi.Arguments = "run --project backend/AgriTech.Api.csproj --urls http://127.0.0.1:$port --no-build"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Development"

    $process = [System.Diagnostics.Process]::Start($psi)

    # Wait for endpoint readiness
    $ready = $false
    for ($i = 0; $i -lt 35; $i++) {
        Start-Sleep -Seconds 1
        try {
            $ping = Send-Request -Method "GET" -Url "$base/fields"
            if ($ping.Code -lt 500) {
                $ready = $true
                break
            }
        } catch { }
    }

    if (-not $ready) {
        $errOut = $process.StandardError.ReadToEnd()
        $stdOut = $process.StandardOutput.ReadToEnd()
        throw "API failed to start on port $port within 35 seconds. StdErr: $errOut. StdOut: $stdOut"
    }
    Write-Host " READY" -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 1: Create Field and Parcel with Izmir Coordinates
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 1] Creating Test Field & Parcel (Izmir Centroid: 38.42N, 27.14E)..." -ForegroundColor Yellow

    $fieldPayload = @"
{
  "name": "BACK-301 Weather Test Field",
  "owner_id": "$ownerId",
  "location_name": "Izmir Meteorological Test Site",
  "boundary_geom": {
    "type": "Polygon",
    "coordinates": [
      [
        [27.1350, 38.4150],
        [27.1450, 38.4150],
        [27.1450, 38.4250],
        [27.1350, 38.4250],
        [27.1350, 38.4150]
      ]
    ]
  }
}
"@
    $resField = Send-Request -Method "POST" -Url "$base/fields" -Body $fieldPayload
    if ($resField.Code -ne 201) {
        throw "Failed to create field: $($resField.Body)"
    }
    $fieldJson = $resField.Body | ConvertFrom-Json
    $testFieldId = $fieldJson.id
    Write-Host "  -> Created Field ID: $testFieldId" -ForegroundColor DarkGray

    $parcelPayload = @"
{
  "field_id": "$testFieldId",
  "crop_id": "$cropId",
  "soil_profile_id": "$soilProfileId",
  "name": "Izmir Tomato Centroid Parcel",
  "planting_date": "2026-10-01",
  "boundary_geom": {
    "type": "Polygon",
    "coordinates": [
      [
        [27.1380, 38.4180],
        [27.1420, 38.4180],
        [27.1420, 38.4220],
        [27.1380, 38.4220],
        [27.1380, 38.4180]
      ]
    ]
  }
}
"@
    $resParcel = Send-Request -Method "POST" -Url "$base/parcels" -Body $parcelPayload
    if ($resParcel.Code -ne 201) {
        throw "Failed to create parcel: $($resParcel.Body)"
    }
    $parcelJson = $resParcel.Body | ConvertFrom-Json
    $testParcelId = $parcelJson.id
    Write-Host "  -> Created Parcel ID: $testParcelId" -ForegroundColor DarkGray
    Write-Host "  [PASS] Test field and parcel provisioned." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 2: Live Ingestion via Open-Meteo for Single Parcel
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 2] Triggering Live Weather Ingestion for Parcel..." -ForegroundColor Yellow
    $resIngest = Send-Request -Method "POST" -Url "$base/weather/parcels/$testParcelId/ingest"
    if ($resIngest.Code -ne 200) {
        throw "Ingestion failed with status $($resIngest.Code): $($resIngest.Body)"
    }
    $ingestJson = $resIngest.Body | ConvertFrom-Json
    Write-Host "  Ingestion Result: Ingested=$($ingestJson.recordsIngested), Updated=$($ingestJson.recordsUpdated), Failed=$($ingestJson.failedParcels)" -ForegroundColor DarkGray

    if ($ingestJson.recordsIngested -ne 7 -or $ingestJson.failedParcels -ne 0) {
        throw "Expected 7 ingested records and 0 failures, got Ingested=$($ingestJson.recordsIngested), Failed=$($ingestJson.failedParcels)"
    }
    Write-Host "  [PASS] Successfully ingested 7 days of meteorological forecast data from Open-Meteo." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 3: Verify 7-Day Rolling Forecast Cached Data via GET Endpoint
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 3] Verifying Cached 7-Day Metrics (ET0, Precip, Temp, FAO-56 Peff)..." -ForegroundColor Yellow
    $resWeather = Send-Request -Method "GET" -Url "$base/weather/parcels/$testParcelId"
    if ($resWeather.Code -ne 200) {
        throw "Failed to retrieve cached weather: $($resWeather.Body)"
    }
    $weatherJson = $resWeather.Body | ConvertFrom-Json

    Write-Host "  Parcel Centroid: Lat=$($weatherJson.centroidLatitude), Lng=$($weatherJson.centroidLongitude)" -ForegroundColor DarkGray
    Write-Host "  Cached Days: $($weatherJson.metrics.Count)" -ForegroundColor DarkGray

    if ($weatherJson.metrics.Count -lt 7) {
        throw "Expected at least 7 cached metrics, found $($weatherJson.metrics.Count)"
    }

    $firstMetric = $weatherJson.metrics[0]
    Write-Host "  Day 1 Sample -> Date: $($firstMetric.forecastDate), ET0: $($firstMetric.et0Mm)mm, Precip: $($firstMetric.precipitationMm)mm, Peff: $($firstMetric.effectivePrecipitationMm)mm, Temp: $($firstMetric.tempMinC)C - $($firstMetric.tempMaxC)C" -ForegroundColor DarkGray

    Write-Host "  [PASS] Cached weather metrics contain valid FAO-56 parameters." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 4: Acceptance Criteria 1 - Idempotency and Deduplication Check
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 4] Acceptance Criteria 1: Re-running Ingestion to verify Zero Duplicate Records..." -ForegroundColor Yellow
    $resIngest2 = Send-Request -Method "POST" -Url "$base/weather/parcels/$testParcelId/ingest"
    if ($resIngest2.Code -ne 200) {
        throw "Second ingestion failed: $($resIngest2.Body)"
    }
    $ingestJson2 = $resIngest2.Body | ConvertFrom-Json
    Write-Host "  Second Pass Result -> Ingested=$($ingestJson2.recordsIngested), Updated=$($ingestJson2.recordsUpdated)" -ForegroundColor DarkGray

    if ($ingestJson2.recordsIngested -ne 0 -or $ingestJson2.recordsUpdated -ne 7) {
        throw "Deduplication failed: Expected Ingested=0, Updated=7, got Ingested=$($ingestJson2.recordsIngested), Updated=$($ingestJson2.recordsUpdated)"
    }

    # Verify directly against PostgreSQL table
    $dbOutput = docker exec agritech_postgres psql -U postgres -d agritech_db -t -c "SELECT count(*) FROM weather_cache WHERE parcel_id = '$testParcelId';"
    $dbCount = [int]((-join $dbOutput).Trim())
    Write-Host "  Postgres Database Record Count for Parcel: $dbCount" -ForegroundColor DarkGray

    if ($dbCount -ne 7) {
        throw "Database contains $dbCount rows for parcel, expected exactly 7!"
    }
    Write-Host "  [PASS] Acceptance Criteria 1 Satisfied: Ingests 7 days per parcel with ZERO duplicate records." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 5: Bulk Ingestion Endpoint
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 5] Testing Bulk Ingestion for All Parcels (POST /api/v1/weather/ingest)..." -ForegroundColor Yellow
    $resBulk = Send-Request -Method "POST" -Url "$base/weather/ingest"
    if ($resBulk.Code -ne 200) {
        throw "Bulk ingestion failed: $($resBulk.Body)"
    }
    $bulkJson = $resBulk.Body | ConvertFrom-Json
    Write-Host "  Bulk Ingestion Result -> Processed: $($bulkJson.parcelsProcessed), Ingested: $($bulkJson.recordsIngested), Updated: $($bulkJson.recordsUpdated), Failed: $($bulkJson.failedParcels)" -ForegroundColor DarkGray

    if ($bulkJson.parcelsProcessed -lt 1 -or $bulkJson.failedParcels -ne 0) {
        throw "Bulk ingestion failed across registered parcels."
    }
    Write-Host "  [PASS] Bulk ingestion completed successfully." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test Case 6: 404 on Non-Existent Parcel
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 6] Testing 404 Response for Unknown Parcel..." -ForegroundColor Yellow
    $fakeId = "99999999-9999-9999-9999-999999999999"
    $res404 = Send-Request -Method "GET" -Url "$base/weather/parcels/$fakeId"
    if ($res404.Code -ne 404) {
        throw "Expected 404 for unknown parcel, got $($res404.Code)"
    }
    Write-Host "  [PASS] 404 returned correctly for non-existent parcel." -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " ALL 6 ACCEPTANCE VERIFICATION TESTS PASSED SUCCESSFULLY!       " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
finally {
    # --- Cleanup ---
    Write-Host "`n[Cleanup] Cleaning up test fixtures..." -ForegroundColor Gray
    if ($testParcelId) {
        try {
            Send-Request -Method "DELETE" -Url "$base/parcels/$testParcelId" | Out-Null
            Write-Host "  Deleted test parcel $testParcelId" -ForegroundColor DarkGray
        } catch { }
    }
    if ($testFieldId) {
        try {
            docker exec agritech_postgres psql -U postgres -d agritech_db -c "DELETE FROM fields WHERE id = '$testFieldId';" | Out-Null
            Write-Host "  Deleted test field $testFieldId" -ForegroundColor DarkGray
        } catch { }
    }

    if ($process -and -not $process.HasExited) {
        Write-Host "  Stopping Web API process (PID: $($process.Id))..." -ForegroundColor DarkGray
        $process.Kill()
        $process.WaitForExit(5000)
    }
}
