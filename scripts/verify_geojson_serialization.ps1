# ==============================================================================
# Precision AgriTech Platform - GeoJSON Serialization Verification Harness
# Task: BACK-204 / TODO-204
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host " AgriTech BACK-204: NetTopologySuite & GeoJSON Serialization Harness" -ForegroundColor Cyan
Write-Host "=====================================================================`n" -ForegroundColor Cyan

$port = 5188
$baseUrl = "http://127.0.0.1:$port"
$apiProcess = $null

try {
    # 1. Verify NuGet Packages and Project Compilation
    Write-Host "[1/5] Verifying NuGet packages and compiling backend..." -NoNewline
    $csprojContent = Get-Content "backend/AgriTech.Api.csproj" -Raw
    if (-not ($csprojContent -match 'NetTopologySuite\.IO\.GeoJSON4STJ')) {
        throw "NetTopologySuite.IO.GeoJSON4STJ is not referenced in backend/AgriTech.Api.csproj"
    }
    if (-not ($csprojContent -match 'Npgsql\.EntityFrameworkCore\.PostgreSQL\.NetTopologySuite')) {
        throw "Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite is not referenced in backend/AgriTech.Api.csproj"
    }

    $buildOutput = dotnet build --nologo -v q backend/AgriTech.Api.csproj 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed: $buildOutput"
    }
    Write-Host " [OK]" -ForegroundColor Green

    # 2. Start ASP.NET Core API on test port
    Write-Host "[2/5] Bootstrapping Web API on $baseUrl..." -NoNewline
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "dotnet"
    $startInfo.Arguments = "run --no-build --project backend/AgriTech.Api.csproj --urls $baseUrl"
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $apiProcess = New-Object System.Diagnostics.Process
    $apiProcess.StartInfo = $startInfo
    [void]$apiProcess.Start()

    # Wait for API readiness (up to 30 seconds)
    $isReady = $false
    $retryCount = 0
    $webClient = New-Object System.Net.WebClient
    while (-not $isReady -and $retryCount -lt 30) {
        Start-Sleep -Seconds 1
        $retryCount++
        try {
            $rawSample = $webClient.DownloadString("$baseUrl/api/v1/spatial/geojson/sample-feature")
            if ($rawSample -match '"type":\s*"Feature"') {
                $isReady = $true
            }
        } catch {
            # Still booting
        }
    }

    if (-not $isReady) {
        $stderr = $apiProcess.StandardError.ReadToEnd()
        $stdout = $apiProcess.StandardOutput.ReadToEnd()
        throw "API failed to start within timeout. StdErr: $stderr | StdOut: $stdout"
    }
    Write-Host " [OK] (Ready in $retryCount s)" -ForegroundColor Green

    # 3. Test Incoming GeoJSON Polygon Deserialization (Acceptance Criterion 1)
    Write-Host "[3/5] Testing incoming GeoJSON deserialization into NetTopologySuite.Geometries.Polygon..." -NoNewline
    $polygonPayload = @'
{
  "field_id": "b3000000-0000-0000-0000-000000000003",
  "name": "BACK-204 Acceptance Test Parcel",
  "crop_id": "b3000000-0000-0000-0000-000000000002",
  "soil_profile_id": "back203_loam",
  "planting_date": "2026-04-15",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [28.97412, 41.02511],
        [28.97650, 41.02515],
        [28.97630, 41.02340],
        [28.97390, 41.02335],
        [28.97412, 41.02511]
      ]
    ]
  }
}
'@

    $deserResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/spatial/geojson/deserialize-polygon" `
        -Method Post `
        -Body $polygonPayload `
        -ContentType "application/json"

    if (-not $deserResponse.is_valid) {
        throw "Deserialized geometry was marked invalid"
    }
    if ($deserResponse.geometry_type -ne "Polygon") {
        throw "Expected geometry_type 'Polygon', got: '$($deserResponse.geometry_type)'"
    }
    if ($deserResponse.srid -ne 4326) {
        throw "Expected SRID 4326, got: $($deserResponse.srid)"
    }
    if ($deserResponse.coordinate_count -ne 5) {
        throw "Expected 5 coordinates for closed 4-sided polygon, got: $($deserResponse.coordinate_count)"
    }
    Write-Host " [OK] (Type: Polygon, SRID: $($deserResponse.srid), Points: $($deserResponse.coordinate_count))" -ForegroundColor Green
    Write-Host "      Message: $($deserResponse.message)" -ForegroundColor Gray

    # 4. Test Outgoing RFC 7946 GeoJSON Feature Structure (Acceptance Criterion 2a)
    Write-Host "[4/5] Testing outgoing RFC 7946 GeoJSON Feature structure..." -NoNewline
    $featureResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/spatial/geojson/sample-feature" -Method Get

    if ($featureResponse.type -ne "Feature") {
        throw "Expected root type 'Feature', got: '$($featureResponse.type)'"
    }
    if ($null -eq $featureResponse.geometry -or $featureResponse.geometry.type -ne "Polygon") {
        throw "Feature missing valid Polygon geometry"
    }
    if ($null -eq $featureResponse.properties -or $featureResponse.properties.crop_name -ne "Durum Wheat") {
        throw "Feature properties missing or mismatched"
    }
    Write-Host " [OK] (Valid RFC 7946 Feature rendered)" -ForegroundColor Green
    Write-Host "      Properties: [name: '$($featureResponse.properties.name)', crop: '$($featureResponse.properties.crop_name)', area: $($featureResponse.properties.area_hectares) ha]" -ForegroundColor Gray

    # 5. Test Outgoing RFC 7946 GeoJSON FeatureCollection Structure (Acceptance Criterion 2b)
    Write-Host "[5/5] Testing outgoing RFC 7946 GeoJSON FeatureCollection structure..." -NoNewline
    $fcResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/spatial/geojson/sample-feature-collection" -Method Get

    if ($fcResponse.type -ne "FeatureCollection") {
        throw "Expected root type 'FeatureCollection', got: '$($fcResponse.type)'"
    }
    if ($null -eq $fcResponse.features -or $fcResponse.features.Count -ne 2) {
        throw "Expected FeatureCollection with 2 features, got: $($fcResponse.features.Count)"
    }
    foreach ($feat in $fcResponse.features) {
        if ($feat.type -ne "Feature" -or $null -eq $feat.geometry -or $null -eq $feat.properties) {
            throw "Invalid feature inside FeatureCollection"
        }
    }
    Write-Host " [OK] (Valid RFC 7946 FeatureCollection rendered with $($fcResponse.features.Count) features)" -ForegroundColor Green

    # Additional Bonus: Test Roundtrip Feature Echo
    Write-Host "      [Bonus] Testing roundtrip Feature echo..." -NoNewline
    $sampleFeatureRaw = $webClient.DownloadString("$baseUrl/api/v1/spatial/geojson/sample-feature")
    $echoResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/spatial/geojson/echo-feature" `
        -Method Post `
        -Body $sampleFeatureRaw `
        -ContentType "application/json"
    if ($echoResponse.type -ne "Feature" -or $echoResponse.properties.name -ne "Sample RFC 7946 Feature Parcel") {
        throw "Roundtrip Feature echo mismatch"
    }
    Write-Host " [OK] (Roundtrip echo verified without string conversion overhead)" -ForegroundColor Green

    Write-Host "`n=====================================================================" -ForegroundColor Green
    Write-Host " [PASS] ALL ACCEPTANCE CRITERIA SATISFIED FOR BACK-204" -ForegroundColor Green
    Write-Host "=====================================================================`n" -ForegroundColor Green

} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
    exit 1
} finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Write-Host "Shutting down background test API process..." -NoNewline
        try {
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        } catch {}
        Write-Host " [Cleaned Up]" -ForegroundColor Green
    }
}
