# TODO-302 Completion Report: FAO-56 Dynamic Crop Coefficient ($K_c$) Calculator

**Status:** DONE  
**Task ID:** BACK-302 / TODO-302  
**Assignee:** Backend / Agronomy Lead  
**Phase:** Phase 3 — Telemetry Simulator & Dynamic FAO-56 Irrigation Engine  
**Branch:** `feat/backend-todo302-crop-phenology-kc`  

---

## 1. Executive Summary

Successfully implemented the FAO-56 Penman-Monteith phenological development stage engine (**BACK-302 / TODO-302**). The engine models crop water demand across the four canonical FAO-56 growth stages (**Initial**, **Development**, **Mid-Season**, and **Late-Season**) using static agronomic parameters loaded from `backend/Configuration/crop_growth_stages.json` for **Tomato**, **Corn**, **Potato**, and **Apple** (including perennial multi-year leaf-out cycling).

The service (`CropPhenologyService`) provides exact piecewise-linear $K_c(t)$ interpolation with guaranteed continuity across every transition boundary ($L_{\text{ini}} \to L_{\text{dev}} \to L_{\text{mid}} \to L_{\text{late}}$), dynamic effective rooting depth $Z_r(t)$ interpolation for upcoming **TODO-303** (TAW/RAW root-zone depletion), and crop evapotranspiration computation ($ET_c = K_c(t) \times ET_0$). REST endpoints are exposed via `PhenologyController` adhering strictly to `PROJECT_DETAILS/Reports/Phase 3/irrigation-api-contract.md` (camelCase JSON, exact UPPERCASE enum strings, ISO-8601 UTC timestamps, and RFC 7807 `ProblemDetails` error responses).

---

## 2. Deliverables & Acceptance Criteria Matrix

| Deliverable / Criterion | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Static Config `crop_growth_stages.json`** | Define Initial, Development, Mid-Season, Late-Season day lengths and $K_c$ values for Tomato, Corn, Potato, Apple | Loaded, validated at startup, and verified in `CropPhenologyServiceTests` & `GET /api/v1/phenology/crops` | **PASSED** |
| **Service `CropPhenologyService`** | Expose `CalculateCurrentKc(cropType, plantingDate, targetDate)` plus derived $ET_c$, $Z_r$, and lifecycle curve helpers | Registered as thread-safe Singleton in DI; verified across 72 service unit tests | **PASSED** |
| **Comprehensive Unit Test Suite** | Validate $K_c$ interpolation across every transition point in the crop lifecycle | 82 new xUnit tests (`CropPhenologyServiceTests.cs` + `PhenologyControllerTests.cs`) | **PASSED** |
| **Acceptance Criterion 1** | Mid-season crops resolve to their peak $K_c$ plateau (Tomato = `1.15`, Potato = `1.15`, Corn = `1.20`, Apple = `0.95`) | Verified across start, midpoint, and end of mid-season for all 4 crops | **PASSED** |
| **Acceptance Criterion 2** | Linear transitions $L_{\text{ini}} \to L_{\text{mid}}$ and $L_{\text{mid}} \to L_{\text{late}}$ compute smoothly with no stepped discontinuity | Verified every single consecutive day $d \to d+1$ across the entire lifecycle of all 4 crops against exact theoretical slopes | **PASSED** |

---

## 3. Agronomic Math Model & Configured Constants

### 3.1 Piecewise-Linear $K_c(t)$ Equation

Given $\text{DAP} = t - t_{\text{plant}}$ (or the seasonal cycle day since annual budbreak anniversary for perennial orchards):

| Stage | Enum Wire Value | Domain | $K_c(\text{DAP})$ Formula |
| :--- | :--- | :--- | :--- |
| **Pre-Planting** | `PRE_PLANTING` | $\text{DAP} < 0$ | $K_{c,\text{ini}}$ (bare soil evaporation baseline) |
| **Initial** ($L_{\text{ini}}$) | `INITIAL` | $0 \le \text{DAP} < L_{\text{ini}}$ | $K_{c,\text{ini}}$ |
| **Development** ($L_{\text{dev}}$) | `DEVELOPMENT` | $L_{\text{ini}} \le \text{DAP} < L_{\text{ini}} + L_{\text{dev}}$ | $K_{c,\text{ini}} + \left(\frac{\text{DAP} - L_{\text{ini}}}{L_{\text{dev}}}\right)(K_{c,\text{mid}} - K_{c,\text{ini}})$ |
| **Mid-Season** ($L_{\text{mid}}$) | `MID_SEASON` | $L_{\text{prev}} \le \text{DAP} < L_{\text{prev}} + L_{\text{mid}}$ | $K_{c,\text{mid}}$ |
| **Late-Season** ($L_{\text{late}}$) | `LATE_SEASON` | $L_{\text{prev}} \le \text{DAP} \le \text{Harvest}$ | $K_{c,\text{mid}} - \left(\frac{\text{DAP} - L_{\text{prev}}}{L_{\text{late}}}\right)(K_{c,\text{mid}} - K_{c,\text{end}})$ |
| **Post-Harvest / Dormant** | `POST_HARVEST` | $\text{DAP} > \text{Harvest}$ | $K_{c,\text{end}}$ (clamped smoothly) |

### 3.2 Crop Constants (`backend/Configuration/crop_growth_stages.json`)

Sourced from **FAO Irrigation and Drainage Paper No. 56 (Allen et al., 1998)** Tables 11, 12, and 22, matched to the seeded UUIDs in `20261112212907_SeedReferenceData.cs`:

| Crop | Seeded UUID | Cycle Type | $L_{\text{ini}} / L_{\text{dev}} / L_{\text{mid}} / L_{\text{late}}$ (days) | Total Days | $K_{c,\text{ini}} \to K_{c,\text{mid}} \to K_{c,\text{end}}$ | Max $Z_r$ (m) | Default MAD ($p$) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Tomato** | `c0000000-0000-0000-0000-000000000001` | Annual | `30 / 40 / 45 / 30` | 145 | `0.60 → 1.15 → 0.80` | 0.60 | 0.40 |
| **Corn** | `c0000000-0000-0000-0000-000000000002` | Annual | `20 / 35 / 40 / 30` | 125 | `0.30 → 1.20 → 0.35` | 1.00 | 0.55 |
| **Potato** | `c0000000-0000-0000-0000-000000000003` | Annual | `25 / 30 / 45 / 30` | 130 | `0.50 → 1.15 → 0.75` | 0.60 | 0.35 |
| **Apple** | `c0000000-0000-0000-0000-000000000004` | Perennial | `20 / 70 / 120 / 60` | 270 | `0.45 → 0.95 → 0.70` | 1.50 | 0.50 |

### 3.3 Alignment with `irrigation-api-contract.md`

- JSON serialization strictly uses **camelCase** properties.
- `PhenologicalStage` enum uses `[JsonStringEnumMemberName(...)]` to emit exact **UPPERCASE** strings (`PRE_PLANTING`, `INITIAL`, `DEVELOPMENT`, `MID_SEASON`, `LATE_SEASON`, `POST_HARVEST`).
- Timestamps use ISO-8601 UTC format.
- Error responses use ASP.NET Core `Problem(...)` (`ProblemDetails` with `title`, `detail`, `status`).
- The five frontend irrigation endpoints (`/water-budget`, `/telemetry`, `/irrigation/status`, `/irrigate-manual`, `/irrigation/{eventId}/abort`) remain intentionally unstubbed so the frontend's `auto` mode continues falling back cleanly until **TODO-303–306** implement soil water balance, telemetry persistence, and MQTT actuation.

---

## 4. Created and Modified Files

### Created
- `backend/Configuration/crop_growth_stages.json` — Static FAO-56 stage lengths, $K_c$ values, `rootDepthRatioStart`/`rootDepthRatioEnd` bounds, and MAD defaults for Tomato, Corn, Potato, and Apple.
- `backend/Configuration/CropGrowthStagesConfig.cs` — Immutable (`init`-only) strongly-typed JSON schema models and `CropPhenologyOptions`.
- `backend/Models/DTOs/PhenologyDtos.cs` — Contract-compliant DTOs and UPPERCASE-serialized `PhenologicalStage` enum.
- `backend/Services/ICropPhenologyService.cs` — Service interface defining `CalculateCurrentKc`, `AssessCropPhenology`, `CalculateCropEvapotranspiration`, `CalculateEffectiveRootDepthMeters`, and `GenerateLifecycleCurve`.
- `backend/Services/CropPhenologyService.cs` — Thread-safe FAO-56 phenology engine with startup continuity/monotonicity validation, overflow/date-bound guards, perennial leap-year-safe anniversary cycling, and unified smooth piecewise-linear interpolation.
- `backend/Services/IParcelPhenologyQueryService.cs` & `backend/Services/ParcelPhenologyQueryService.cs` — Scoped query service projecting lightweight scalar columns (omitting PostGIS `BoundaryGeom`) to join `parcels`, `crops`, and BACK-301 `weather_cache`.
- `backend/Controllers/PhenologyController.cs` — REST endpoints (`/api/v1/phenology/crops`, `/api/v1/phenology/kc`, `/api/v1/phenology/curve`, and `/api/v1/parcels/{parcelId}/phenology`).
- `tests/AgriTech.Api.Tests/CropPhenologyServiceTests.cs` — 72 unit test cases validating config loading, peak plateaus, every transition boundary, day-by-day smoothness, perennial multi-year/leap-day/year-9999 cycling, $ET_c$, $Z_r$, overflow protection, and config invariant guards.
- `tests/AgriTech.Api.Tests/PhenologyControllerTests.cs` — 10 controller unit tests covering all endpoints including all 4 `GetParcelPhenology` scenarios, production `ConfigureGeoJsonOptions` serialization, ProblemDetails payloads, camelCase JSON, and UPPERCASE enum strings.
- `backend/scripts/verify_crop_phenology.ps1` — Live HTTP acceptance verification harness (gracefully detects PostgreSQL availability for optional DB+WeatherCache integration test).
- `PROJECT_DETAILS/Reports/Phase 3/TODO-302-crop-phenology-kc-calculator.md` — This completion report.

### Modified
- `backend/AgriTech.Api.csproj` — Added `<Content Update="Configuration\crop_growth_stages.json">` with `PreserveNewest` copy rules and `<InternalsVisibleTo Include="AgriTech.Api.Tests" />`.
- `backend/Program.cs` — Registered `CropPhenologyOptions`, `ICropPhenologyService` (Singleton), and `IParcelPhenologyQueryService` (Scoped).
- `backend/appsettings.json` — Added `"CropPhenology": { "ConfigFilePath": "Configuration/crop_growth_stages.json" }`.

---

## 5. Code Review Audit & Hardening Fixes

Submitted to `code-reviewer` subagent prior to commit; all required and optional findings were resolved:
1. **Immutable Singleton Config Models:** Converted all `CropGrowthStagesConfig` classes to `sealed` with `init`-only setters and `IReadOnlyList<CropGrowthProfile>` so consumers cannot mutate shared singleton state.
2. **Scoped Parcel Query Service & Zero Over-fetching:** Extracted parcel + `weather_cache` lookup into `IParcelPhenologyQueryService` projecting only scalar columns (skipping PostGIS `BoundaryGeom`), enabling full unit test coverage for `GetParcelPhenology`.
3. **Explicit `rootDepthRatioStart` / `rootDepthRatioEnd` & Full Startup Validation:** Eliminated unused `rootDepthRatio` fields on transition stages, added null checks for all 4 sub-stages, and validated `(0, 1]` range & boundary continuity on root depth ratios.
4. **Input & Overflow Protection:** Added nullable `[FromQuery] string? cropType = null` so missing query parameters reliably emit RFC 7807 `ProblemDetails` with `detail`, added `MaxValidEt0Mm = 100.0m` to prevent `decimal` multiplication `OverflowException`, added `MaxCropTypeLength = 80`, and guarded `DateOnly.MaxValue` (year 9999) in perennial anniversary resolution.

---

## 6. Verification Results

### 6.1 Automated xUnit Suites
```text
dotnet test tests/AgriTech.Api.Tests --filter "FullyQualifiedName!~IntegrationTests"
Başarılı! - Başarısız: 0, Başarılı: 104, Atlanan: 0, Toplam: 104, Süre: 2 s - AgriTech.Api.Tests.dll (net10.0)

dotnet test tests/AgriTech.Api.AdvisoryTests
Başarılı! - Başarısız: 0, Başarılı: 14, Atlanan: 0, Toplam: 14, Süre: 4 s - AgriTech.Api.AdvisoryTests.dll (net10.0)
```
*(Note: The 2 existing `WeatherIngestionServiceIntegrationTests` from BACK-301 require a running PostgreSQL container on `127.0.0.1:5432`; Docker Desktop was not running during this verification run.)*

### 6.2 Live HTTP Verification Harness (`backend/scripts/verify_crop_phenology.ps1`)
```text
[Setup] PostgreSQL 5432 reachable: False (ASPNETCORE_ENVIRONMENT=Staging)
[Setup] Starting Web API on port 5196... READY
[Test 1] Verifying crop_growth_stages.json catalog -> Crops loaded: Tomato, Corn, Potato, Apple [PASS]
[Test 2] AC1: Tomato Mid-Season Peak Kc = 1.15 & UPPERCASE stage enum -> Stage=MID_SEASON, Kc=1.15, ETc=5.75 mm/day [PASS]
[Test 3] AC2: Verifying smooth transitions across full Tomato lifecycle curve -> 146 points | 0.60 -> 0.875 -> 1.15 -> 0.975 -> 0.80 [PASS]
[Test 4] Verifying 404 ProblemDetails for unsupported crop type [PASS]
[Test 5] SKIPPED — PostgreSQL not reachable on 127.0.0.1:5432
```

---

## 7. Unrelated Pre-Existing Issue Noted (Out of Scope)

- **`backend/Models/DTOs/ParcelDtos.cs` (Line 101):** `UpdateParcelRequest.KcCurrent` currently carries `[Range(0.01, 1.00)]`. Under FAO-56, mid-season $K_c$ routinely exceeds `1.00` (e.g., Tomato = `1.15`, Potato = `1.15`, Corn = `1.20`). The PostgreSQL column `parcels.kc_current` is `NUMERIC(3, 2)` (supports up to `9.99`). This validation attribute should be widened (e.g., `[Range(0.01, 2.00)]`) in a follow-up or during TODO-303 when parcel $K_c$ updates are wired into the irrigation engine.
