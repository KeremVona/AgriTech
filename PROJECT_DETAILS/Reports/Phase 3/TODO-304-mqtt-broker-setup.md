# TODO-304 Completion Report: MQTT Broker Setup & Messaging Contract Configuration

**Status:** DONE  
**Task ID:** BACK-304 / TODO-304  
**Assignee:** DevOps / Backend Engineer  
**Phase:** Phase 3 — Telemetry Simulator & Dynamic FAO-56 Irrigation Engine  
**Branch:** `feat/backend-todo304-mqtt-broker-messaging`  

---

## 1. Executive Summary

Successfully deployed and hardened the **Eclipse Mosquitto 2.0** MQTT broker inside Docker Compose (`agritech_mqtt`) with mandatory username/password authentication (`allow_anonymous false`), least-privilege topic ACL enforcement (`acl.conf`), loopback-restricted host bindings (`127.0.0.1:1883`, `127.0.0.1:9001`), and a dedicated internal Docker bridge network (`agritech_internal`).

On the ASP.NET Core backend, integrated **MQTTnet 5.2.0.1603** via `MqttClientService` (`BackgroundService` + `IMqttClientService`) establishing a persistent MQTT v5.0 session (`CleanSession = false`, `SessionExpiryInterval = 86400s`) subscribed to wildcard topic `agri/telemetry/#` with exponential backoff + jitter auto-reconnect, strict system-boundary payload validation, and standardized Phase 3 topic/payload contracts ready for **TODO-305** and **TODO-306**.

---

## 2. Deliverables & Acceptance Criteria Matrix

| Deliverable / Criterion | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **`mosquitto.conf` & Docker Compose Security** | Authenticated access (`allow_anonymous false`), least-privilege topic ACL, loopback-restricted ports, and internal `agritech_internal` network | `docker compose up -d mosquitto` (`healthy`, zero warnings), anonymous rejected (`exit=5`), ACL negative tests (`NotAuthorized` / delivery blocked) | **PASSED** |
| **Standardized Topic Structure** | `agri/telemetry/{parcelId}` and `agri/actuator/{parcelId}/valve` + `agri/telemetry/#` wildcard | `MqttTopics` builders/parsers + `MqttMessagingContractTests` + `GET /api/v1/mqtt/topics` (`MqttTopicsContractDto`) | **PASSED** |
| **`MQTTnet` Integration + Auto-Reconnect** | ASP.NET Core hosted `MQTTnet` client with exponential backoff + jitter reconnection, subscribe-rejection recovery, and observer hook | `MqttClientService` + `FakeMqttClient` unit tests + `MqttBrokerIntegrationTests` | **PASSED** |
| **Acceptance Criterion 1** | Broker starts in Docker with port `1883` accessible internally (`healthy`) | `agritech_mqtt` Up `(healthy)` on `agritech_internal` and `127.0.0.1:1883` | **PASSED** |
| **Acceptance Criterion 2** | Backend establishes persistent subscription to wildcard topic `agri/telemetry/#` | `GET /api/v1/mqtt/status` (`isConnected=true`, `isPersistentSession=true`, `isSubscribedToTelemetry=true`, `subscribedTopic="agri/telemetry/#"`) + live simulator telemetry receipt (including QoS 1 offline queue replay) | **PASSED** |

---

## 3. Broker Security & Messaging Architecture

### 3.1 Role-Based Topic ACL (`docker/mosquitto/config/acl.conf`)
- **`agritech_backend`** (ASP.NET Core API — least-privilege):
  - `topic read agri/telemetry/#` — Persistent wildcard subscription to all parcel telemetry (read-only; cannot publish forged telemetry).
  - `topic readwrite agri/actuator/+/valve` — Publishes and observes valve actuation commands.
  - `topic readwrite agri/health/#` — Broker liveness probe.
- **`agritech_simulator`** (Virtual Soil Telemetry Simulator — TODO-305/306):
  - `topic write agri/telemetry/+` — Publishes per-parcel sensor telemetry packets (write-only; cannot eavesdrop on `agri/telemetry/#`).
  - `topic read agri/actuator/+/valve` — Subscribes to valve actuation commands for soil moisture rebound (read-only; cannot forge valve triggers).
- **Dynamic Startup Hardening (`docker/mosquitto/entrypoint.sh`):**
  - Validates `MQTT_BACKEND_USER` and `MQTT_SIMULATOR_USER` against `^[A-Za-z0-9._-]+$` and enforces distinctness.
  - Uses `umask 077` + `mosquitto_passwd -U /tmp/mosquitto_pwfile` (in-place hashing, preventing password exposure in `/proc/<pid>/cmdline`).
  - Dynamically renders `/tmp/mosquitto_acl.conf` from `/mosquitto/config/acl.conf` with configured usernames and strict `0600 mosquitto:mosquitto` ownership (eliminating world-readable warnings on Windows bind mounts).

### 3.2 Standardized Payloads (`backend/Messaging/MqttPayloads.cs`)
- `SensorTelemetryMessage` (`agri/telemetry/{parcelId}`): `node_id`, `parcel_id`, `timestamp` (`DateTimeOffset`), `soil_moisture_pct`, `soil_temperature_c`, `ambient_humidity_pct`, `battery_voltage`.
- `ValveActuationCommand` (`agri/actuator/{parcelId}/valve`): `event_id`, `parcel_id`, `action` (`VALVE_TRIGGER_OPEN` / `VALVE_TRIGGER_CLOSE`), `duration_seconds`, `target_volume_liters`, `reason`.

---

## 4. Code Review Audit & Hardening Fixes

An independent 5-axis `code-reviewer` audit was performed before commit. All Critical, Required, Optional, and Nit findings were resolved and verified:

1. **Critical — Auto-Reconnect Stall on `SubscribeAsync` Failure:** Updated `ExecuteAsync` to loop on `!_mqttClient.IsConnected || !_isSubscribedToTelemetry`, narrowed `TryConnectAndSubscribeAsync` short-circuit to `_mqttClient.IsConnected && _isSubscribedToTelemetry`, guarded post-subscribe state assignment against concurrent disconnect, and exposed `IsSubscribedToTelemetry = isConnected && _isSubscribedToTelemetry`. Verified via `FakeMqttClient` unit test (`ExecuteAsync_WhenSubscribeRejectedOnce_RetriesAndRecoversWithoutStalling`).
2. **Required — Least-Privilege ACL & Service Contract Alignment:** Removed `PublishTelemetryAsync` from `IMqttClientService` / `MqttClientService` so `agritech_backend` remains strictly read-only on `agri/telemetry/#` (simulators publish using `agritech_simulator`).
3. **Required — Dynamic Custom Username Templating & Cmdline Password Hygiene:** Upgraded `docker/mosquitto/entrypoint.sh` to validate custom `MQTT_BACKEND_USER` / `MQTT_SIMULATOR_USER`, render `/tmp/mosquitto_acl.conf` dynamically via `sed`, and hash passwords in-place using `umask 077` + `mosquitto_passwd -U`.
4. **Required — Graceful Shutdown & `Dispose()` Race Protection:** Added atomic `_isShuttingDown` and `_disposed` flags, `StopAsync` override, 5-second bounded disconnect timeout, safe `ObjectDisposedException` guard on `_reconnectSignal`, and idempotent double-`Dispose()` protection.
5. **Required — Strict System-Boundary Validation:** Required non-empty `parcel_id == topicParcelId` (rejecting `{}` and `Guid.Empty`), non-empty `node_id`, and non-default `DateTimeOffset` `timestamp` on telemetry ingress; validated `ValveActionConstants.IsValid`, `DurationSeconds >= 0`, and `TargetVolumeLiters >= 0` on valve publish.
6. **Required — Safe Diagnostics & OpenAPI Contract:** Replaced raw `ex.Message` in `MqttConnectionStatusDto.LastError` with categorized error codes (`CONNECTION_REJECTED:*`, `SUBSCRIPTION_REJECTED:*`, `CONNECTION_FAILED`, `DISCONNECTED:*`), redacted internal `Host`/`Port` outside Development in `MqttController`, and introduced typed `MqttTopicsContractDto`.
7. **Required — Integration Test Isolation & ACL Enforcement Coverage:** Tagged `MqttBrokerIntegrationTests` with `[Trait("Category", "Integration")]` and added `MosquittoBroker_EnforcesLeastPrivilegeAclRules` verifying both `NotAuthorized` publishes and delivery-time read blocking.
8. **Optional/Nit Hardening:** Used atomic `long` UTC ticks (`Interlocked.Read`/`Exchange`) for connection timestamps to prevent torn reads, zero-copy `Payload.FirstSpan` deserialization on single-segment messages, propagated `_stoppingToken` to telemetry handlers, set `SessionExpiryInterval = 0` when `CleanSession = true`, added `MqttOptions` startup validation (`ValidateOnStart()`), and hardened `verify_mqtt_broker.ps1` (env-var credentials, polling loop, `taskkill /T /F` process-tree cleanup).

---

## 5. Created and Modified Files

### Created
- `docker/mosquitto/config/acl.conf` — Least-privilege Mosquitto topic ACL template for `agritech_backend` and `agritech_simulator`.
- `docker/mosquitto/entrypoint.sh` — Startup script validating usernames, in-place hashing credentials (`mosquitto_passwd -U`), and rendering `0600` ACL/password files before execing Mosquitto.
- `.gitattributes` — Forces LF line endings on `docker/**/*.sh` for cross-platform Windows/Linux Docker compatibility.
- `backend/Configuration/MqttOptions.cs` — Strongly-typed configuration options (`Host`, `Port`, `ClientId`, `Username`, `Password`, `CleanSession`, `SessionExpiryIntervalSeconds`, reconnect backoff settings).
- `backend/Messaging/MqttTopics.cs` — Canonical topic builders (`TelemetryForParcel`, `ValveActuatorForParcel`) and strict GUID parsers rejecting wildcards/extra segments.
- `backend/Messaging/MqttPayloads.cs` — Standardized Phase 3 JSON contracts (`ValveActionConstants`, `SensorTelemetryMessage`, `ValveActuationCommand`, `TelemetryMessageEnvelope`, `MqttMessageSerializer`).
- `backend/Services/IMqttClientService.cs` — Least-privilege backend service interface, `MqttConnectionStatusDto`, and observer registration hook for TODO-306.
- `backend/Services/MqttClientService.cs` — Hosted `MQTTnet` v5 client with persistent session (`CleanSession = false`), QoS 1 wildcard subscription to `agri/telemetry/#`, exponential backoff + jitter auto-reconnect loop, subscribe-rejection recovery, strict payload validation, handler error isolation, and race-free shutdown/dispose.
- `backend/Controllers/MqttController.cs` — Diagnostic endpoints `GET /api/v1/mqtt/status` (with non-Development host/port redaction) and `GET /api/v1/mqtt/topics` (`MqttTopicsContractDto`).
- `tests/AgriTech.Api.Tests/MqttMessagingContractTests.cs` — Unit tests covering topics, payload serialization, backoff math, persistent/clean options, boundary/spoof validation, handler isolation, `FakeMqttClient` subscribe-rejection recovery + safe shutdown, and controller redaction.
- `tests/AgriTech.Api.Tests/MqttBrokerIntegrationTests.cs` — `[Trait("Category", "Integration")]` live tests against Docker Mosquitto verifying anonymous rejection, least-privilege ACL enforcement, persistent wildcard subscription, simulator-to-backend telemetry receipt, and backend-to-simulator valve command dispatch.
- `backend/scripts/verify_mqtt_broker.ps1` — 5-stage live acceptance verification harness.
- `PROJECT_DETAILS/Reports/Phase 3/TODO-304-mqtt-broker-setup.md` — This completion report.

### Modified
- `docker/mosquitto/config/mosquitto.conf` — Hardened with `allow_anonymous false`, password/ACL files, persistent client sessions (`7d`), queued message limits, `max_keepalive 120`, and UTC timestamps.
- `docker-compose.yml` — Added `agritech_internal` network, loopback-only host bindings (`127.0.0.1:1883`/`9001`), env-driven credentials, custom entrypoint mount, and authenticated healthcheck.
- `.env.example` — Added `MQTT_*` container credentials and documented ASP.NET Core `Mqtt__*` override keys.
- `backend/AgriTech.Api.csproj` — Added `MQTTnet` (`5.2.0.1603`).
- `backend/Program.cs` — Registered `MqttOptions` with `ValidateOnStart()`, `MqttClientService` singleton (`IMqttClientService`), and hosted service lifecycle.
- `backend/appsettings.json` & `backend/appsettings.Development.json` — Added `Mqtt` configuration block (empty password in base `appsettings.json`, local dev password in `appsettings.Development.json`).

---

## 6. Verification Results

```text
dotnet test tests/AgriTech.Api.Tests --no-restore
Başarılı! - Başarısız: 0, Başarılı: 151, Atlanan: 0, Toplam: 151, Süre: 4 s

dotnet test tests/AgriTech.Api.AdvisoryTests
Başarılı! - Başarısız: 0, Başarılı: 14, Atlanan: 0, Toplam: 14, Süre: 3 s

powershell -ExecutionPolicy Bypass -File backend/scripts/verify_mqtt_broker.ps1
[Test 1] Container agritech_mqtt health: healthy [PASS]
[Test 2] Anonymous client rejected (exit=5: not authorised) [PASS]
[Test 3] Connected as 'agritech-backend-api' -> Persistent=True, Topic=agri/telemetry/# [PASS]
[Test 4] Backend MessagesReceivedCount incremented: 2 -> 3 [PASS]
[Test 5] Standardized topic taxonomy verified [PASS]
ALL 5 BACK-304 ACCEPTANCE VERIFICATION TESTS PASSED!
```
