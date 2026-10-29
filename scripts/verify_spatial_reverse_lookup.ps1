# ==============================================================================
# Precision AgriTech Platform - Spatial Reverse-Lookup & Geotag Verification Harness
# Task: BACK-206 / TODO-206
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5195
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

$ownerId          = "b3000000-0000-0000-0000-000000000001"
$cropId           = "b3000000-0000-0000-0000-000000000002"
$soilProfileId    = "back203_loam"
$diseaseId        = "b6000000-0000-0000-0000-000000000001"
$validInferenceId = "b6000000-0000-0000-0000-000000000002"

$testFieldId      = $null
$testParcelId     = $null
$createdScanIds   = [System.Collections.Generic.List[string]]::new()

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
Write-Host " AgriTech BACK-206: Spatial Reverse-Lookup & Geotag Ingestion Verification" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # --- Ensure Seed Prerequisites in Database ---
    Write-Host "[Setup] Checking baseline seed data in PostgreSQL..." -NoNewline
    $seedSql = @"
INSERT INTO users (id, email, full_name, role)
VALUES ('$ownerId', 'back206_test@agritech.local', 'BACK-206 Test Owner', 'FARMER')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crops (id, common_name, family)
VALUES ('$cropId', 'BACK-206 Test Corn', 'Poaceae')
ON CONFLICT (id) DO NOTHING;

INSERT INTO soil_profiles (id, name, field_capacity_pct, wilting_point_pct, saturation_pct, hydraulic_conductivity)
VALUES ('$soilProfileId', 'Test Loam', 0.28, 0.14, 0.45, 12.5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO diseases (id, crop_id, common_name, pathogen_type, risk_level, general_description)
VALUES ('$diseaseId', '$cropId', 'Northern Leaf Blight', 'FUNGAL', 'HIGH', 'Test disease for BACK-206 scan inference')
ON CONFLICT (id) DO NOTHING;

INSERT INTO model_inferences (id, predicted_disease_id, model_version, confidence_score, class_probabilities, inference_time_ms)
VALUES ('$validInferenceId', '$diseaseId', 'plantml-v1.2', 0.9420, '{"healthy": 0.02, "northern_leaf_blight": 0.942, "gray_leaf_spot": 0.038}'::jsonb, 42)
ON CONFLICT (id) DO NOTHING;
"@
    $seedSql | docker exec -i agritech_postgres psql -U postgres -d agritech_db -q
    Write-Host " [OK]" -ForegroundColor Green

    # --- Start API ---
    Write-Host "[Setup] Starting Web API on port $port..." -NoNewline
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "dotnet"
    $psi.Arguments = "run --no-build --project backend/AgriTech.Api.csproj --urls http://127.0.0.1:$port"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.UseShellExecute  = $false
    $psi.CreateNoWindow   = $true
    $process = [System.Diagnostics.Process]::Start($psi)

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $ping = Send-Request "GET" "$base/fields"
            if ($ping.Code -lt 500) { $ready = $true; break }
        } catch {}
    }
    if (-not $ready) { throw "API did not become ready within 30 s" }
    Write-Host " [OK]" -ForegroundColor Green

    # --- Setup Field and Parcel for Spatial Testing ---
    Write-Host "[Setup] Creating managed Field & Parcel for spatial testing..." -NoNewline
    $fieldBody = '{"owner_id":"' + $ownerId + '","name":"BACK-206 Spatial Test Farm","location_name":"Thrace District","boundary_geom":{"type":"Polygon","coordinates":[[[28.97,41.02],[28.99,41.02],[28.99,41.005],[28.97,41.005],[28.97,41.02]]]}}'
    $rField = Send-Request "POST" "$base/fields" $fieldBody
    if ($rField.Code -ne 201) { throw "Failed to create field: $($rField.Code) $($rField.Body)" }
    $testFieldId = ($rField.Body | ConvertFrom-Json).id

    $parcelBody = '{"field_id":"' + $testFieldId + '","crop_id":"' + $cropId + '","soil_profile_id":"' + $soilProfileId + '","name":"BACK-206 Central Zone","planting_date":"2026-05-01","boundary_geom":{"type":"Polygon","coordinates":[[[28.972,41.018],[28.985,41.018],[28.985,41.010],[28.972,41.010],[28.972,41.018]]]}}'
    $rParcel = Send-Request "POST" "$base/parcels" $parcelBody
    if ($rParcel.Code -ne 201) { throw "Failed to create parcel: $($rParcel.Code) $($rParcel.Body)" }
    $testParcelId = ($rParcel.Body | ConvertFrom-Json).id
    Write-Host " [OK] Field=$testFieldId, Parcel=$testParcelId" -ForegroundColor Green

    # =========================================================================
    # TEST 1: Coordinate Inside Parcel (POST /api/v1/spatial/locate-coordinate) -> 200 OK
    # =========================================================================
    Write-Host "[1/7] Testing coordinate inside parcel (POST /api/v1/spatial/locate-coordinate)..." -NoNewline
    $body1 = '{"latitude": 41.0140, "longitude": 28.9780}'
    $r1 = Send-Request "POST" "$base/spatial/locate-coordinate" $body1
    if ($r1.Code -ne 200) { throw "Expected 200 OK but got $($r1.Code). Body: $($r1.Body)" }
    $p1 = $r1.Body | ConvertFrom-Json
    if ($p1.id -ne $testParcelId) { throw "Resolved parcel ID ($($p1.id)) does not match expected ($testParcelId)" }
    if ($p1.name -ne "BACK-206 Central Zone") { throw "Resolved parcel name ($($p1.name)) does not match" }
    if ($p1.crop_name -notlike "*Corn*") { throw "Resolved crop name ($($p1.crop_name)) does not match expected Corn crop" }
    if ($null -eq $p1.bounding_box) { throw "Bounding box missing from parcel metadata" }
    if ($null -eq $p1.boundary_geom) { throw "Boundary geometry missing from parcel metadata" }
    Write-Host " [OK] HTTP 200 - Parcel '$($p1.name)' (ID=$($p1.id)) resolved with full metadata" -ForegroundColor Green
    Write-Host "      Crop: $($p1.crop_name) | Field: $($p1.field_name) | Area: $($p1.area_hectares) ha" -ForegroundColor Gray

    # =========================================================================
    # TEST 2: Coordinate Outside Any Managed Parcel -> 404 Not Found
    # =========================================================================
    Write-Host "[2/7] Testing coordinate outside any managed parcel -> expect 404 Not Found..." -NoNewline
    $body2 = '{"latitude": 39.9200, "longitude": 32.8500}' # Ankara coordinates
    $r2 = Send-Request "POST" "$base/spatial/locate-coordinate" $body2
    if ($r2.Code -ne 404) { throw "Expected 404 Not Found but got $($r2.Code). Body: $($r2.Body)" }
    $p2 = $r2.Body | ConvertFrom-Json
    if ($p2.detail -notlike "*outside managed parcels*" -and $p2.detail -notlike "*No managed agricultural parcel encloses*") {
        throw "Unexpected 404 response detail: $($p2.detail)"
    }
    Write-Host " [OK] HTTP 404 - Rejected cleanly without unhandled exceptions" -ForegroundColor Green

    # =========================================================================
    # TEST 3: Out-of-Range Coordinate Validation -> 400 Bad Request
    # =========================================================================
    Write-Host "[3/7] Testing out-of-range latitude/longitude validation -> expect 400..." -NoNewline
    $body3 = '{"latitude": 95.0000, "longitude": 28.9780}'
    $r3 = Send-Request "POST" "$base/spatial/locate-coordinate" $body3
    if ($r3.Code -ne 400) { throw "Expected 400 Bad Request but got $($r3.Code). Body: $($r3.Body)" }
    Write-Host " [OK] HTTP 400 - Latitude > 90.0 properly rejected by validation" -ForegroundColor Green

    # =========================================================================
    # TEST 4: Crop Scan Ingestion Inside Parcel -> Auto-Populates parcel_id -> 201 Created
    # =========================================================================
    Write-Host "[4/7] Ingesting scan with coordinates INSIDE parcel (POST /api/v1/scans)..." -NoNewline
    $body4 = '{
        "latitude": 41.0140,
        "longitude": 28.9780,
        "image_url": "https://storage.agritech.local/scans/2026/10/leaf_nlb_01.jpg",
        "inference_id": "' + $validInferenceId + '",
        "uploaded_by_user_id": "' + $ownerId + '",
        "gps_accuracy_meters": 1.25,
        "detection_source": "EXIF_GPS",
        "field_notes": "Slight chlorotic lesions observed on lower canopy"
    }'
    $r4 = Send-Request "POST" "$base/scans" $body4
    if ($r4.Code -ne 201) { throw "Expected 201 Created but got $($r4.Code). Body: $($r4.Body)" }
    $scan4 = $r4.Body | ConvertFrom-Json
    $createdScanIds.Add($scan4.id)
    if ($scan4.parcel_id -ne $testParcelId) {
        throw "parcel_id was not auto-populated! Expected '$testParcelId' but got '$($scan4.parcel_id)'"
    }
    if ($scan4.parcel_name -ne "BACK-206 Central Zone") { throw "Auto-populated parcel_name mismatch: $($scan4.parcel_name)" }
    if ($scan4.crop_name -notlike "*Corn*") { throw "Auto-populated crop_name mismatch: $($scan4.crop_name)" }
    Write-Host " [OK] HTTP 201 - Scan saved with auto-populated parcel_id: $($scan4.parcel_id)" -ForegroundColor Green
    Write-Host "      Context: Parcel='$($scan4.parcel_name)', Crop='$($scan4.crop_name)', Field='$($scan4.field_name)'" -ForegroundColor Gray

    # =========================================================================
    # TEST 5: Crop Scan Ingestion Outside Any Parcel -> parcel_id = NULL -> 201 Created
    # =========================================================================
    Write-Host "[5/7] Ingesting scan with coordinates OUTSIDE managed parcel -> expect parcel_id = NULL..." -NoNewline
    $body5 = '{
        "latitude": 39.9200,
        "longitude": 32.8500,
        "image_url": "https://storage.agritech.local/scans/2026/10/leaf_wild_02.jpg",
        "inference_id": "' + $validInferenceId + '",
        "detection_source": "MANUAL_PIN",
        "field_notes": "Roadside wild sample outside production zone"
    }'
    $r5 = Send-Request "POST" "$base/scans" $body5
    if ($r5.Code -ne 201) { throw "Expected 201 Created but got $($r5.Code). Body: $($r5.Body)" }
    $scan5 = $r5.Body | ConvertFrom-Json
    $createdScanIds.Add($scan5.id)
    if ($null -ne $scan5.parcel_id) {
        throw "Expected parcel_id = NULL for coordinate outside parcel, but got '$($scan5.parcel_id)'"
    }
    Write-Host " [OK] HTTP 201 - Ingested successfully with parcel_id = NULL (no unhandled exception)" -ForegroundColor Green

    # =========================================================================
    # TEST 6: Ingestion with Invalid Model Inference ID -> 400 Bad Request
    # =========================================================================
    Write-Host "[6/7] Ingesting scan with non-existent inference_id -> expect 400 Bad Request..." -NoNewline
    $badInferenceId = "c0000000-0000-0000-0000-000000000000"
    $body6 = '{
        "latitude": 41.0140,
        "longitude": 28.9780,
        "image_url": "https://storage.agritech.local/scans/2026/10/bad_inference.jpg",
        "inference_id": "' + $badInferenceId + '"
    }'
    $r6 = Send-Request "POST" "$base/scans" $body6
    if ($r6.Code -ne 400) { throw "Expected 400 Bad Request but got $($r6.Code). Body: $($r6.Body)" }
    Write-Host " [OK] HTTP 400 - Foreign key integrity enforced before persistence" -ForegroundColor Green

    # =========================================================================
    # TEST 7: Retrieve Persisted Scan (GET /api/v1/scans/{id})
    # =========================================================================
    Write-Host "[7/7] Retrieving persisted scan by ID (GET /api/v1/scans/{id})..." -NoNewline
    $targetScanId = $scan4.id
    $r7 = Send-Request "GET" "$base/scans/$targetScanId"
    if ($r7.Code -ne 200) { throw "Expected 200 OK but got $($r7.Code). Body: $($r7.Body)" }
    $fetched = $r7.Body | ConvertFrom-Json
    if ($fetched.id -ne $targetScanId) { throw "Scan ID mismatch" }
    if ($fetched.parcel_id -ne $testParcelId) { throw "Parcel ID mismatch on retrieval" }
    if ([Math]::Round([double]$fetched.latitude, 4) -ne 41.0140) { throw "Latitude mismatch on retrieval" }
    if ([Math]::Round([double]$fetched.longitude, 4) -ne 28.9780) { throw "Longitude mismatch on retrieval" }
    Write-Host " [OK] HTTP 200 - Scan retrieved with verified coordinates (41.014, 28.978) and parcel_id" -ForegroundColor Green

    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " [PASS] ALL 7 ACCEPTANCE CRITERIA SATISFIED FOR BACK-206" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
    exit 1
} finally {
    Write-Host "[Teardown] Cleaning up test entities..." -NoNewline
    foreach ($sId in $createdScanIds) {
        try { docker exec agritech_postgres psql -U postgres -d agritech_db -c "DELETE FROM crop_scans WHERE id = '$sId';" -q } catch {}
    }
    if ($testParcelId) {
        try { $null = Send-Request "DELETE" "$base/parcels/$testParcelId" } catch {}
    }
    if ($testFieldId) {
        try { $null = Send-Request "DELETE" "$base/fields/$testFieldId" } catch {}
    }
    if ($process -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
        Write-Host " [OK]" -ForegroundColor Green
        Write-Host "API process stopped." -ForegroundColor DarkGray
    }
}
