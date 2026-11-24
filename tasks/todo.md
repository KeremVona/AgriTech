# BACK-301 / TODO-301: Open-Meteo Weather Client & Daily Ingestion Job

## Current Status: DONE
**Assignee:** Backend Engineer  
**Phase:** Phase 3 — Telemetry Simulator & Dynamic FAO-56 Irrigation Engine  
**Task ID:** BACK-301 / TODO-301  
**Branch:** `feat/backend-todo301-open-meteo-weather-client`  
**Report:** `PROJECT_DETAILS/Reports/Phase 3/TODO-301-open-meteo-weather-client.md`

---

### Deliverables & Acceptance Verification

- [x] **Typed HTTP Client `OpenMeteoClient` consuming `/v1/forecast`**
  - [x] Configured with parameters: `et0_fao_evapotranspiration`, `precipitation_sum`, `temperature_2m_max`, `temperature_2m_min`, `relative_humidity_2m_mean`, `shortwave_radiation_sum`, `wind_speed_10m_max`.
  - [x] Deserializes 7-day rolling forecast into strongly-typed DTOs (`OpenMeteoForecastResponse`, `OpenMeteoDailyDataDto`).
  - [x] Invariant coordinate formatting (`CultureInfo.InvariantCulture`) and range validation (-90 to 90, -180 to 180).

- [x] **Polly Resilience Policy**
  - [x] Rate-limiting resilience (HTTP 429 Too Many Requests) and transient HTTP server errors (5xx, 408).
  - [x] Exponential backoff with randomized jitter to eliminate thundering herd spikes.
  - [x] Automatically retries up to 3 times before logging a critical error on exhausted network/service failures.

- [x] **Scheduled Task & Daily Ingestion Job (`IHostedService`)**
  - [x] Implemented `WeatherIngestionBackgroundService` inheriting `BackgroundService` using `PeriodicTimer`.
  - [x] Reads parcel centroids via PostGIS geometry centroids (`BoundaryGeom.Centroid.Y`, `BoundaryGeom.Centroid.X`).
  - [x] Calculates FAO-56 effective precipitation $P_{\text{eff}} = \max(0, (P - 5) \times 0.75)$.
  - [x] Idempotent upsert logic writing entries to `weather_cache` table matching unique constraint `uq_weather_parcel_date`.

- [x] **Acceptance Criteria Verification**
  - [x] **Acceptance Criteria 1:** System ingests and caches 7 days of forecast data per parcel without duplicating records (Verified in integration tests and PowerShell harness: DB row count strictly equals 7 on repeated passes).
  - [x] **Acceptance Criteria 2:** API network failure automatically retries up to 3 times before logging a critical error (Verified in Polly unit tests).

- [x] **Automated Test Suites & End-to-End Verification**
  - [x] 18 xUnit unit and integration tests passing (`dotnet test tests/AgriTech.Api.Tests`).
  - [x] Live end-to-end PowerShell harness `scripts/verify_open_meteo_client.ps1` passing all 6 tests.
  - [x] Backward compatibility preserved: `scripts/verify_field_parcel_crud.ps1` passing all 7 tests.
