# ==============================================================================
# Precision AgriTech Platform - Eclipse Mosquitto MQTT Broker & Client Verification
# Task: BACK-304 / TODO-304
# ==============================================================================

$ErrorActionPreference = "Stop"
$port    = 5198
$base    = "http://127.0.0.1:$port/api/v1"
$process = $null

$simUser = if ($env:MQTT_SIMULATOR_USER) { $env:MQTT_SIMULATOR_USER } else { "agritech_simulator" }
$simPass = if ($env:MQTT_SIMULATOR_PASSWORD) { $env:MQTT_SIMULATOR_PASSWORD } else { "agritech_simulator_dev_pwd" }

function Send-Request {
    param(
        [string]$Method,
        [string]$Url
    )
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = $Method
    $req.Accept = "application/json"
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
Write-Host " AgriTech BACK-304: Mosquitto Broker & MQTTnet Client Verification" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # -------------------------------------------------------------------------
    # Test 1: AC1 — Docker Mosquitto Container Running & Healthy on Port 1883
    # -------------------------------------------------------------------------
    Write-Host "[Test 1] AC1: Verifying agritech_mqtt container is healthy on internal port 1883..." -ForegroundColor Yellow
    $health = (docker inspect --format "{{.State.Health.Status}}" agritech_mqtt 2>&1).Trim()
    if ($health -ne "healthy") {
        throw "agritech_mqtt container is not healthy (status: $health). Run 'docker compose up -d mosquitto'."
    }
    Write-Host "  Container agritech_mqtt health: $health" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC1 verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 2: Security — Anonymous Access Must Be Rejected
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 2] Verifying anonymous publish is rejected (allow_anonymous false)..." -ForegroundColor Yellow
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $anonOut = docker exec agritech_mqtt mosquitto_pub -h 127.0.0.1 -p 1883 -t "agri/telemetry/00000000-0000-0000-0000-000000000001" -m "{}" 2>&1
    $anonExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    if ($anonExit -eq 0) {
        throw "SECURITY FAILURE: Anonymous client was allowed to publish!"
    }
    Write-Host "  Anonymous client rejected as expected (exit=$anonExit): $($anonOut | Select-Object -First 1)" -ForegroundColor DarkGray
    Write-Host "  [PASS] Broker authentication enforced." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 3: AC2 — ASP.NET Core Backend Persistent Wildcard Subscription
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 3] AC2: Starting Web API on port $port & verifying persistent agri/telemetry/# subscription..." -ForegroundColor Yellow
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

    $connected = $false
    $statusObj = $null
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $res = Send-Request -Method "GET" -Url "$base/mqtt/status"
            if ($res.Code -eq 200) {
                $statusObj = $res.Body | ConvertFrom-Json
                if ($statusObj.isConnected -eq $true -and $statusObj.isSubscribedToTelemetry -eq $true) {
                    $connected = $true
                    break
                }
            }
        } catch { }
    }

    if (-not $connected) {
        throw "Backend did not connect and subscribe to agri/telemetry/# within 30s. Last status: $($statusObj | ConvertTo-Json -Compress)"
    }

    if ($statusObj.subscribedTopic -ne "agri/telemetry/#" -or $statusObj.isPersistentSession -ne $true) {
        throw "Unexpected subscription status: $($statusObj | ConvertTo-Json -Compress)"
    }
    Write-Host "  Connected as '$($statusObj.clientId)' -> Persistent=$($statusObj.isPersistentSession), Topic=$($statusObj.subscribedTopic)" -ForegroundColor DarkGray
    Write-Host "  [PASS] AC2 persistent wildcard subscription verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 4: End-to-End Live Telemetry Delivery Over Mosquitto
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 4] Publishing live telemetry packet as $simUser and confirming backend receipt..." -ForegroundColor Yellow
    $beforeCount = [int]$statusObj.messagesReceivedCount
    $testParcelId = "8d3e9f4a-7b2c-4e89-a1d2-9c3f5e7b1a0d"
    $payload = "{`"node_id`":`"sim-node-verify-01`",`"parcel_id`":`"$testParcelId`",`"timestamp`":`"2026-11-26T00:00:00Z`",`"soil_moisture_pct`":24.3,`"soil_temperature_c`":19.8,`"ambient_humidity_pct`":52.1,`"battery_voltage`":3.94}"

    $payload | docker exec -i agritech_mqtt mosquitto_pub -h 127.0.0.1 -p 1883 -u $simUser -P $simPass -t "agri/telemetry/$testParcelId" -q 1 -s
    if ($LASTEXITCODE -ne 0) {
        throw "Simulator publish failed with exit code $LASTEXITCODE"
    }

    $received = $false
    $afterObj = $null
    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Milliseconds 200
        $afterRes = Send-Request -Method "GET" -Url "$base/mqtt/status"
        $afterObj = $afterRes.Body | ConvertFrom-Json
        if ([int]$afterObj.messagesReceivedCount -gt $beforeCount) {
            $received = $true
            break
        }
    }

    if (-not $received) {
        throw "Backend did not receive telemetry packet within 5s! Count stayed at $($afterObj.messagesReceivedCount)."
    }
    Write-Host "  Backend MessagesReceivedCount incremented: $beforeCount -> $($afterObj.messagesReceivedCount)" -ForegroundColor DarkGray
    Write-Host "  [PASS] End-to-end authenticated telemetry delivery verified." -ForegroundColor Green

    # -------------------------------------------------------------------------
    # Test 5: Standardized Topic Contract Endpoint
    # -------------------------------------------------------------------------
    Write-Host "`n[Test 5] Verifying GET /api/v1/mqtt/topics contract..." -ForegroundColor Yellow
    $topicsRes = Send-Request -Method "GET" -Url "$base/mqtt/topics"
    if ($topicsRes.Code -ne 200) { throw "Expected 200, got $($topicsRes.Code)" }
    $topics = $topicsRes.Body | ConvertFrom-Json
    if ($topics.telemetryWildcard -ne "agri/telemetry/#" -or $topics.actuatorValveTemplate -ne "agri/actuator/{parcelId}/valve") {
        throw "Topic contract mismatch: $($topicsRes.Body)"
    }
    Write-Host "  [PASS] Standardized topic taxonomy verified." -ForegroundColor Green

    Write-Host "`n=================================================================" -ForegroundColor Green
    Write-Host " ALL 5 BACK-304 ACCEPTANCE VERIFICATION TESTS PASSED!           " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
}
finally {
    if ($process -and -not $process.HasExited) {
        try {
            $prevPref = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            & taskkill /T /F /PID $process.Id 2>&1 | Out-Null
            $ErrorActionPreference = $prevPref
        } catch {
            try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch { }
        }
        Write-Host "`n[Cleanup] Stopped Web API process tree (PID: $($process.Id))." -ForegroundColor DarkGray
    }
}
