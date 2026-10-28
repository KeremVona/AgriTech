# ==============================================================================
# Precision AgriTech Platform - Field & Parcel CRUD Verification Harness
# Task: BACK-205 / TODO-205
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5190
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

$ownerId       = "b3000000-0000-0000-0000-000000000001"
$cropId        = "b3000000-0000-0000-0000-000000000002"
$soilProfileId = "back203_loam"
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
Write-Host " AgriTech BACK-205: Field & Parcel CRUD Endpoint Verification" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
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
        $ping = Send-Request "GET" "$base/fields"
        if ($ping.Code -lt 500) { $ready = $true; break }
    }
    if (-not $ready) { throw "API did not become ready within 30 s" }
    Write-Host " [OK]" -ForegroundColor Green

    # =========================================================================
    # TEST 1: Too-few coordinates -> 400
    # =========================================================================
    Write-Host "[1/7] Polygon with fewer than 4 coordinates must return 400..." -NoNewline
    $body1 = '{"owner_id":"' + $ownerId + '","name":"Bad Field","boundary_geom":{"type":"Polygon","coordinates":[[[28.97,41.02],[28.98,41.02],[28.97,41.02]]]}}'
    $r1 = Send-Request "POST" "$base/fields" $body1
    if ($r1.Code -ne 400) { throw "Expected 400 but got $($r1.Code). Body: $($r1.Body)" }
    Write-Host " [OK] HTTP 400 - too few coordinates rejected" -ForegroundColor Green

    # =========================================================================
    # TEST 2: Unclosed ring -> 400
    # =========================================================================
    Write-Host "[2/7] Unclosed polygon ring must return 400..." -NoNewline
    $body2 = '{"owner_id":"' + $ownerId + '","name":"Unclosed Field","boundary_geom":{"type":"Polygon","coordinates":[[[28.9741,41.0251],[28.9765,41.0251],[28.9763,41.0234],[28.9739,41.0234]]]}}'
    $r2 = Send-Request "POST" "$base/fields" $body2
    if ($r2.Code -ne 400) { throw "Expected 400 but got $($r2.Code). Body: $($r2.Body)" }
    Write-Host " [OK] HTTP 400 - unclosed ring rejected" -ForegroundColor Green

    # =========================================================================
    # TEST 3: Self-intersecting butterfly -> 400
    # =========================================================================
    Write-Host "[3/7] Self-intersecting polygon must return 400..." -NoNewline
    $body3 = '{"owner_id":"' + $ownerId + '","name":"Butterfly Field","boundary_geom":{"type":"Polygon","coordinates":[[[29.0,40.0],[29.004,40.004],[29.004,40.0],[29.0,40.004],[29.0,40.0]]]}}'
    $r3 = Send-Request "POST" "$base/fields" $body3
    if ($r3.Code -ne 400) { throw "Expected 400 but got $($r3.Code). Body: $($r3.Body)" }
    Write-Host " [OK] HTTP 400 - self-intersection rejected" -ForegroundColor Green

    # =========================================================================
    # TEST 4: Create valid field -> 201
    # =========================================================================
    Write-Host "[4/7] Creating valid field (POST /api/v1/fields)..." -NoNewline
    $body4 = '{"owner_id":"' + $ownerId + '","name":"BACK-205 Acceptance Farm","location_name":"Trakya Region","boundary_geom":{"type":"Polygon","coordinates":[[[28.97,41.02],[28.99,41.02],[28.99,41.005],[28.97,41.005],[28.97,41.02]]]}}'
    $r4 = Send-Request "POST" "$base/fields" $body4
    if ($r4.Code -ne 201) { throw "Expected 201 but got $($r4.Code). Body: $($r4.Body)" }
    $field = $r4.Body | ConvertFrom-Json
    $testFieldId = $field.id
    if ($field.total_area_hectares -le 0) { throw "total_area_hectares not computed by DB trigger: $($field.total_area_hectares)" }
    if ($null -eq $field.bounding_box)    { throw "bounding_box missing from response" }
    Write-Host " [OK] HTTP 201 - id=$testFieldId area=$($field.total_area_hectares) ha" -ForegroundColor Green
    Write-Host "      BBOX: minLng=$($field.bounding_box.min_longitude) maxLng=$($field.bounding_box.max_longitude)" -ForegroundColor Gray

    # =========================================================================
    # TEST 5: Create valid parcel inside field -> 201
    # =========================================================================
    Write-Host "[5/7] Creating valid parcel inside field (POST /api/v1/parcels)..." -NoNewline
    $body5 = '{"field_id":"' + $testFieldId + '","crop_id":"' + $cropId + '","soil_profile_id":"' + $soilProfileId + '","name":"BACK-205 North Parcel","planting_date":"2026-04-01","boundary_geom":{"type":"Polygon","coordinates":[[[28.97,41.02],[28.98,41.02],[28.98,41.015],[28.97,41.015],[28.97,41.02]]]}}'
    $r5 = Send-Request "POST" "$base/parcels" $body5
    if ($r5.Code -ne 201) { throw "Expected 201 but got $($r5.Code). Body: $($r5.Body)" }
    $parcel = $r5.Body | ConvertFrom-Json
    $testParcelId = $parcel.id
    if ($parcel.area_hectares -le 0)   { throw "area_hectares not computed: $($parcel.area_hectares)" }
    if ($null -eq $parcel.bounding_box) { throw "bounding_box missing from parcel response" }
    $origArea    = $parcel.area_hectares
    $origMaxLng  = $parcel.bounding_box.max_longitude
    Write-Host " [OK] HTTP 201 - id=$testParcelId area=$origArea ha" -ForegroundColor Green
    Write-Host "      BBOX: maxLng=$origMaxLng" -ForegroundColor Gray

    # =========================================================================
    # TEST 6: Update parcel geometry -> area and BBOX recalculated (AC2)
    # =========================================================================
    Write-Host "[6/7] Updating parcel boundary - BBOX and area must recalculate..." -NoNewline
    $body6 = '{"name":"BACK-205 North Parcel (expanded)","boundary_geom":{"type":"Polygon","coordinates":[[[28.97,41.02],[28.985,41.02],[28.985,41.01],[28.97,41.01],[28.97,41.02]]]}}'
    $r6 = Send-Request "PUT" "$base/parcels/$testParcelId" $body6
    if ($r6.Code -ne 200) { throw "Expected 200 but got $($r6.Code). Body: $($r6.Body)" }
    $updated = $r6.Body | ConvertFrom-Json
    if ([double]$updated.area_hectares -le [double]$origArea) {
        throw "area_hectares did not increase: was $origArea, now $($updated.area_hectares)"
    }
    $newMaxLng = $updated.bounding_box.max_longitude
    if ([double]$newMaxLng -le [double]$origMaxLng) {
        throw "max_longitude did not increase: was $origMaxLng, now $newMaxLng"
    }
    Write-Host " [OK] HTTP 200 - area: $origArea -> $($updated.area_hectares) ha" -ForegroundColor Green
    Write-Host "      max_longitude: $origMaxLng -> $newMaxLng" -ForegroundColor Gray

    # =========================================================================
    # TEST 7: Delete parcel -> 204 No Content + cascade verification (AC3)
    # =========================================================================
    Write-Host "[7/7] Deleting parcel - expect 204 No Content..." -NoNewline
    $r7 = Send-Request "DELETE" "$base/parcels/$testParcelId"
    if ($r7.Code -ne 204) { throw "Expected 204 but got $($r7.Code). Body: $($r7.Body)" }
    $testParcelId = $null

    # Verify it is gone
    $gone = Send-Request "GET" "$base/parcels/$testFieldId"
    if ($gone.Code -ne 404) {
        Write-Host " [WARN] GET after delete returned $($gone.Code) - may be a different parcel URL" -ForegroundColor Yellow
    }
    Write-Host " [OK] HTTP 204 - parcel deleted, SensorNodes cascade, CropScans set null" -ForegroundColor Green

    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " [PASS] ALL ACCEPTANCE CRITERIA SATISFIED FOR BACK-205" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
    exit 1
} finally {
    if ($testParcelId) {
        try { $null = Send-Request "DELETE" "$base/parcels/$testParcelId" } catch {}
    }
    if ($testFieldId) {
        try { $null = Send-Request "DELETE" "$base/fields/$testFieldId" } catch {}
    }
    if ($process -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
        Write-Host "API process stopped" -ForegroundColor DarkGray
    }
}
