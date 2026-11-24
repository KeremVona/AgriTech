# LLM-Generated Disease Advisory & PostgreSQL Cache — Feature Report

**Branch:** `feat/llm-disease-advisory`  
**Status:** Ready for teammate review (not merged to `main`, no PR opened yet)

---

## 1. Overview & Motivation

When a user uploads a leaf image on `/diagnostics`, the platform now populates **Immediate Crop Action**, **Recommended Treatments**, and **Microclimate Risk** using **Google Gemini (`gemini-2.5-flash`)** on first encounter of a disease, and caches the structured advisory in **PostgreSQL (`disease_advisories`)** keyed by canonical `class_key` (e.g., `tomato/late_blight`).

Because the platform classifies a bounded set of 33 crop/disease classes across 7 crops (`plant-ml`), subsequent uploads for any already-cached `class_key` read directly from PostgreSQL without calling Gemini again.

### End-to-End Flow

```text
[Frontend /diagnostics]
   │
   ├── 1. POST /api/v1/classify-leaf (image) ──► [ml-service :8000]
   │                                              └── returns prediction, class_key,
   │                                                  requires_rescan, fallback advisory
   │
   └── 2. (if !requiresRescan)
          POST /api/v1/advisories/resolve ────► [backend :5051]
             { class_key, crop, condition, ... }
                ├── Cache HIT  (PostgreSQL `disease_advisories`) ──► return source="database_cache" (0 LLM calls)
                └── Cache MISS ──► Gemini API (`gemini-2.5-flash`)
                                      └── persist row in `disease_advisories`
                                      └── return source="llm_generated"
             (if backend/LLM unavailable ──► frontend falls back to ml-service knowledge base)
```

---

## 2. Backend Changes (For Backend Lead Review)

### 2.1 Database Schema & Migration
- **Entity:** `backend/Models/DiseaseAdvisory.cs`
- **DTOs:** `backend/Models/DTOs/AdvisoryDtos.cs` (`ResolveAdvisoryRequest`, `AdvisoryResponseDto`)
- **DbContext:** `backend/Data/AgriTechDbContext.cs` (`DbSet<DiseaseAdvisory>`)
- **Migration:** `backend/Data/Migrations/20261119183848_AddDiseaseAdvisoriesCache.cs`

Table `disease_advisories`:
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Default `uuid_generate_v4()` |
| `class_key` | `varchar(120)` | **Unique index** `ix_disease_advisories_class_key` (normalized lowercase `crop/disease`) |
| `crop` | `varchar(80)` | Crop display name |
| `condition` | `varchar(120)` | Disease/condition display name |
| `scientific_name` | `varchar(120)` | Nullable |
| `severity` | `varchar(40)` | Severity label |
| `immediate_action` | `text` | Immediate field action text |
| `recommended_treatments` | `jsonb` | JSON array of treatment strings |
| `microclimate_risk` | `text` | Temperature / RH / leaf-wetness risk summary |
| `llm_model` | `varchar(80)` | e.g. `gemini-2.5-flash` |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |

> Because `Program.cs` runs `db.Database.Migrate()` on startup in Development, restarting the backend automatically creates `disease_advisories` in `agritech_db`.

### 2.2 Gemini Client (`backend/Services/`)
- **Files:** `backend/Services/IGeminiAdvisoryClient.cs`, `backend/Services/GeminiAdvisoryClient.cs`
- **Registration:** `backend/Program.cs` (`AddHttpClient<IGeminiAdvisoryClient, GeminiAdvisoryClient>` with 15s timeout, bound to `GeminiOptions` from `appsettings.json` `"Gemini"` section).
- **API Key Resolution & Security:**
  - Reads `Gemini:ApiKey` from `IConfiguration` (user-secrets / local config) or falls back to the `GEMINI_API_KEY` environment variable.
  - Sends the key via the `x-goog-api-key` HTTP header (never in query strings or frontend code).
  - `appsettings.json` contains `"ApiKey": ""` (no secrets committed).
- **Prompt & Output Hardening:**
  - Separates instructions (`systemInstruction`) from classification metadata (`contents` JSON).
  - Requests structured JSON via `generationConfig.responseMimeType = "application/json"` with explicit `responseSchema` (`immediate_action`, `recommended_treatments[]`, `microclimate_risk`) and `thinkingConfig.thinkingBudget = 0` for low latency.
  - Distinguishes caller cancellation (`cancellationToken`) from HTTP timeouts/errors, disposes `HttpResponseMessage`, and maps upstream/parse failures to `LlmAdvisoryUnavailableException`.

### 2.3 API Endpoints (`backend/Controllers/AdvisoriesController.cs`)
- **`POST /api/v1/advisories/resolve`**
  - Validates `class_key` against `^[a-z0-9_]+/[a-z0-9_]+$` (`400 Bad Request` if invalid).
  - Checks `disease_advisories` first (`AsNoTracking`). On hit (when `force_refresh` is `false`), returns `200 OK` with `source: "database_cache"` and makes zero Gemini requests.
  - On miss, calls `IGeminiAdvisoryClient`, persists the row, and returns `200 OK` with `source: "llm_generated"` (or `503 Service Unavailable` if Gemini is unavailable/unconfigured).
  - Handles concurrent cache-miss race conditions by catching `DbUpdateException` on `PostgresErrorCodes.UniqueViolation` (`23505`), detaching the entity, and returning the committed row (`source: "database_cache"`).
- **`GET /api/v1/advisories/{**classKey}`** — Inspects a cached entry (`200` / `404` / `400`).
- **`DELETE /api/v1/advisories/{**classKey}`** — Removes a cached entry so it can be regenerated on next scan (`204` / `404` / `400`).

### 2.4 Backend Tests & Verification Script
- **Unit test project (new):** originally `backend/AgriTech.Api.Tests/`; now `tests/AgriTech.Api.AdvisoryTests/` next to the TODO-301 tests (listed in `backend/AgriTech.slnx`; the `DefaultItemExcludes` entry in `AgriTech.Api.csproj` was removed with the move):
  - `GeminiAdvisoryClientTests.cs`: Valid JSON parsing, missing API key, HTTP 429/malformed/missing-field errors, healthy empty treatments + markdown fence stripping, caller cancellation propagation.
  - `AdvisoriesControllerTests.cs`: Cache hit (0 LLM calls), cache miss -> DB persist -> second call hits cache, `class_key` casing/whitespace normalization, 503 on LLM failure, invalid `class_key` 400, `force_refresh` update, and `GET`/`DELETE` behavior.
- **Live smoke script:** `backend/scripts/verify_advisories_cache.ps1` (calls `/api/v1/advisories/resolve` twice and asserts the second call returns `source = "database_cache"`).

---

## 3. ML Service & Frontend Changes

### 3.1 `ml-service/`
- `plantml_engine.py`, `advisory.py`, `schemas.py`, `main.py`, `tests/test_classify_leaf.py`:
  - Exposed canonical `class_key` (e.g., `"tomato/late_blight"`) on `ClassifyLeafResponse`.

### 3.2 `frontend/`
- `src/types/diagnostics.ts`, `src/services/diagnosticsService.ts`, `src/components/Diagnostics/DiagnosticVerdictCard.tsx`, `src/pages/LeafDiagnosticsPage.tsx`, `scripts/test_diagnostics_validation.js`:
  - Wired `resolveBackendAdvisory()` for confident classifications (`!requiresRescan`), keeping low-confidence scans off the LLM endpoint.
  - **Fixed pre-existing fallback bug:** `diagnosticsService.ts` previously read `advisory.fungicide_treatments` (which `ml-service` never sent, since it returns `chemical_treatments`, `biological_controls`, and `cultural_controls`), causing Recommended Treatments to render empty. Added `mapMlAdvisoryToFrontend()` so fallback advisories populate treatments properly.
  - **Fixed crop & healthy-leaf bugs:** Expanded `CropSpecies` and `normalizeCropSpecies()` to support all 7 `plant-ml` crops (`Tomato`, `Potato`, `Corn`, `Apple`, `Grape`, `Rice`, `Cassava`), respected `plant-ml` calibrated thresholds, and avoided showing `"Plant Pathogen"` on healthy (`Tier 0`) leaves.
  - Added a source badge in `DiagnosticVerdictCard.tsx` (`DB Cached Advice`, `Gemini AI Advice`, `Knowledge Base`, or `Sample Preset`).

---

## 4. Local Configuration to Run Live

Set the Gemini API key in `backend/` user-secrets (recommended) or environment before starting `AgriTech.Api`:

```powershell
cd backend
dotnet user-secrets init
dotnet user-secrets set "Gemini:ApiKey" "<YOUR_GEMINI_API_KEY>"
dotnet run --project AgriTech.Api.csproj
```

Or via environment variable:
```powershell
$env:GEMINI_API_KEY = "<YOUR_GEMINI_API_KEY>"
```

---

## 5. Verification Results

Executed after the final code-review fixes:
- **Backend (`dotnet test backend/AgriTech.slnx -c Release`):** **14 passed, 0 failed** (note: `-c Release` was used because a local `Debug` instance of `AgriTech.Api.exe` was running and locked `bin/Debug/net10.0/AgriTech.Api.exe`).
- **ML Service (`pytest -q` via `F:\Okul\Plant Machine Learning\.venv\Scripts\python.exe`):** **107 passed, 0 failed**.
- **Frontend:**
  - `npm run lint` (`oxlint`): **0 warnings, 0 errors** (97 files).
  - `npm run build` (`tsc -b && vite build`): **passed** in 424ms.
  - `npm run test:diagnostics`: **passed** (all 9 sections).
