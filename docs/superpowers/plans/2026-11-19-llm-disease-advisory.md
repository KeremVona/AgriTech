# LLM-Generated Disease Advisory with PostgreSQL Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate Immediate Crop Action, Recommended Treatments, and Microclimate Risk on leaf scan verdicts using Google Gemini on cache miss, persisting each disease's advisory in PostgreSQL so repeat uploads of the same disease read from the database instead of calling the LLM again.

**Architecture:** `frontend` submits the uploaded leaf image to `ml-service` (`:8000/api/v1/classify-leaf`), which returns the `plant-ml` prediction along with a canonical `class_key` (e.g., `tomato/late_blight`) and static fallback advisory. For valid (`!requiresRescan`) verdicts, `frontend` calls a new `backend` endpoint (`POST /api/v1/advisories/resolve`), which looks up `class_key` in PostgreSQL (`disease_advisories` table); on a hit it returns the stored advisory immediately (`source: "database_cache"`), and on a miss it calls Gemini (`gemini-2.5-flash` structured JSON output), persists the record in PostgreSQL, and returns it (`source: "llm_generated"`). If `backend` or Gemini is unavailable, `frontend` falls back gracefully to `ml-service`'s built-in advisory (with the `chemical_treatments` vs `fungicide_treatments` field-mapping bug fixed).

**Tech Stack:** ASP.NET Core (.NET 10, EF Core + Npgsql/PostgreSQL), Google Gemini REST API (`generativelanguage.googleapis.com/v1beta`), Python/FastAPI (`ml-service`), React 19 + TypeScript + Vite (`frontend`), xUnit (`backend` unit tests), `pytest` (`ml-service`), Node `--experimental-strip-types` (`frontend` tests).

**Spec:** User requirements + [AI_LEAF_DIAGNOSTICS_SPEC.md](file:///f:/Okul/Graduation%20Project/Project/PROJECT_DETAILS/Design/AI_LEAF_DIAGNOSTICS_SPEC.md)

## Global Constraints

- **API Key Security:** The Gemini API key (`Gemini:ApiKey` / `GEMINI_API_KEY`) MUST reside exclusively on `backend/` configuration / environment / `dotnet user-secrets`—never in `frontend/` or committed to Git.
- **No Unapproved Edits to `plant-ml`:** Do not modify external `F:\Okul\Plant Machine Learning` files or leak `plant-ml` weights/configs into Git.
- **Cache-First Guarantee:** Once an advisory for a canonical `class_key` (e.g. `tomato/late_blight`) is saved in `disease_advisories`, subsequent lookups for that `class_key` MUST return the database row without making any outbound HTTP call to Gemini.
- **Graceful Degradation:** If `backend` (`:5051`) is unreachable, `GEMINI_API_KEY` is unconfigured, or Gemini returns a 4xx/5xx/malformed payload, leaf classification on `/diagnostics` MUST still succeed using `ml-service`'s structured advisory fallback rather than failing the scan.
- **Branch Discipline:** Implement on `feat/llm-disease-advisory`, keep it separate on `origin` for teammate review, and do not open a PR until instructed.

## Review Focus

1. **Concurrent Cache-Miss Race Condition:** Two simultaneous uploads of `tomato/late_blight` both miss the cache and call Gemini; the second `INSERT` hits the unique constraint on `class_key` (`23505` / `DbUpdateException`)—controller must catch the conflict, re-query the winning row, and return `200 OK` (`database_cache`) instead of `500`.
2. **Low-Confidence & Healthy Leaf Handling:** Low-confidence / unsupported scans (`requiresRescan: true`) MUST NOT trigger `POST /api/v1/advisories/resolve` (no wasted LLM calls on blurred/non-leaf photos), and healthy classes (`tomato/healthy`, etc.) must produce appropriate preventative/monitoring guidance with empty or non-chemical treatment arrays rather than fabricated fungicides.
3. **Gemini Malformed / Markdown-Fenced JSON or Timeout:** Even with `responseMimeType: "application/json"`, network timeouts or malformed JSON from Gemini must throw a typed `LlmAdvisoryUnavailableException` mapped cleanly to `503 Service Unavailable`, allowing `frontend` to fall back cleanly.
4. **Frontend Crop & Field Mapping Gaps:** Today `diagnosticsService.ts` reads `advisory.fungicide_treatments` (always `undefined` because `ml-service` emits `chemical_treatments`) and `normalizeCropSpecies` collapses `Grape`, `Rice`, and `Cassava` into `'Tomato'`. Both must be fixed alongside the `backend` advisory integration.
5. **Case / Alias Normalization on `class_key`:** `class_key` lookups must normalize casing/whitespace (e.g. `"Tomato/Late_Blight"` or `"tomato/late_blight"` → `"tomato/late_blight"`) so cache keys never fragment.

---

### Task 1: Backend Entity, DbContext Mapping & EF Core Migration (`disease_advisories`)

**Files:**
- Create: `backend/Models/DiseaseAdvisory.cs`
- Create: `backend/Models/DTOs/AdvisoryDtos.cs`
- Modify: `backend/Data/AgriTechDbContext.cs`
- Create (via `dotnet ef`): `backend/Data/Migrations/<timestamp>_AddDiseaseAdvisoriesCache.cs` (+ `.Designer.cs` + `AgriTechDbContextModelSnapshot.cs`)

**Interfaces:**
- Produces `AgriTech.Api.Models.DiseaseAdvisory` (`Id`, `ClassKey`, `Crop`, `Condition`, `ScientificName`, `Severity`, `ImmediateAction`, `RecommendedTreatmentsJson`, `MicroclimateRisk`, `LlmModel`, `CreatedAt`, `UpdatedAt`)
- Produces `ResolveAdvisoryRequest`, `AdvisoryResponseDto` (`ClassKey`, `Crop`, `Condition`, `ScientificName`, `ImmediateAction`, `RecommendedTreatments`, `MicroclimateRisk`, `Source`, `LlmModel`, `CachedAt`)

- [ ] **Step 1: Define `DiseaseAdvisory` entity and advisory DTOs**

Create `backend/Models/DiseaseAdvisory.cs` with snake_case JSON/DB conventions matching existing models (`Parcel`, `Crop`), and `backend/Models/DTOs/AdvisoryDtos.cs` with `[JsonPropertyName(...)]` snake_case fields (`class_key`, `crop`, `condition`, `scientific_name`, `severity_index`, `immediate_action`, `recommended_treatments`, `microclimate_risk`, `source`, `llm_model`, `cached_at`, `force_refresh`).

- [ ] **Step 2: Register `DbSet<DiseaseAdvisory>` and table configuration in `AgriTechDbContext.cs`**

Map to table `disease_advisories` with unique index `ix_disease_advisories_class_key` on `class_key` (`varchar(120)`), `recommended_treatments` stored as `jsonb`, and `created_at` / `updated_at` timestamps defaulting to `now()`.

- [ ] **Step 3: Generate EF Core migration and verify build**

Run:
```powershell
cd backend
dotnet ef migrations add AddDiseaseAdvisoriesCache
dotnet build
```
Expected: Migration created cleanly and `dotnet build` succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/Models/DiseaseAdvisory.cs backend/Models/DTOs/AdvisoryDtos.cs backend/Data/
git commit -m "feat(api): add disease_advisories cache entity and EF migration"
```

---

### Task 2: Gemini LLM Client Service & Unit Tests (`backend/`)

**Files:**
- Create: `backend/Services/IGeminiAdvisoryClient.cs`
- Create: `backend/Services/GeminiAdvisoryClient.cs`
- Modify: `backend/appsettings.json` (add empty `Gemini` config structure with `Model = "gemini-2.5-flash"`, `ApiKey = ""`)
- Modify: `backend/Program.cs` (register `HttpClient<IGeminiAdvisoryClient, GeminiAdvisoryClient>`)
- Create: `backend/AgriTech.Api.Tests/AgriTech.Api.Tests.csproj` & `backend/AgriTech.Api.Tests/GeminiAdvisoryClientTests.cs`
- Modify: `backend/AgriTech.slnx` (include test project)

**Interfaces:**
- Consumes: `ResolveAdvisoryRequest`
- Produces:
  ```csharp
  public record GeneratedAdvisoryPayload(
      string ImmediateAction,
      IReadOnlyList<string> RecommendedTreatments,
      string MicroclimateRisk,
      string ModelName);

  public interface IGeminiAdvisoryClient
  {
      Task<GeneratedAdvisoryPayload> GenerateAdvisoryAsync(
          ResolveAdvisoryRequest request,
          CancellationToken cancellationToken = default);
  }
  ```

- [ ] **Step 1: Scaffold `backend/AgriTech.Api.Tests/` xUnit project and write failing unit tests in `GeminiAdvisoryClientTests.cs`**

Tests to write (using a fake `HttpMessageHandler`—no real network):
1. `GenerateAdvisoryAsync_ParsesValidStructuredGeminiJson` — asserts request URI hits `models/gemini-2.5-flash:generateContent`, parses `candidates[0].content.parts[0].text` JSON into `ImmediateAction`, `RecommendedTreatments` (non-empty list), and `MicroclimateRisk`.
2. `GenerateAdvisoryAsync_ThrowsWhenApiKeyMissing` — empty `ApiKey` throws `LlmAdvisoryUnavailableException` without sending an HTTP request.
3. `GenerateAdvisoryAsync_ThrowsOnHttpErrorOrMalformedJson` — 429/500 response or non-JSON text throws `LlmAdvisoryUnavailableException`.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/AgriTech.Api.Tests/AgriTech.Api.Tests.csproj`
Expected: FAIL (`IGeminiAdvisoryClient` / `GeminiAdvisoryClient` not yet implemented).

- [ ] **Step 3: Implement `IGeminiAdvisoryClient` and `GeminiAdvisoryClient` and wire DI in `Program.cs`**

Use `IHttpClientFactory` (`HttpClient`), read `Gemini:ApiKey` (falling back to `Environment.GetEnvironmentVariable("GEMINI_API_KEY")`), send `generationConfig.responseMimeType = "application/json"` with explicit `responseSchema` requiring `immediate_action` (string), `recommended_treatments` (array of strings), and `microclimate_risk` (string), with a 15-second timeout. Configure `Gemini` section in `appsettings.json` (no secret values) and `x-goog-api-key` header (so API key never appears in URL logs).

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test backend/AgriTech.Api.Tests/AgriTech.Api.Tests.csproj --filter GeminiAdvisoryClientTests`
Expected: 3 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(api): add GeminiAdvisoryClient with structured JSON schema and unit tests"
```

---

### Task 3: `AdvisoriesController` (Cache-First DB Lookup + LLM Fill) & Tests (`backend/`)

**Files:**
- Create: `backend/Controllers/AdvisoriesController.cs`
- Create: `backend/AgriTech.Api.Tests/AdvisoriesControllerTests.cs`
- Create: `backend/scripts/verify_advisories_cache.ps1`

**Interfaces:**
- Consumes: `AgriTechDbContext`, `IGeminiAdvisoryClient`
- Produces HTTP endpoints:
  - `GET /api/v1/advisories/{**classKey}` → `200 OK` (`AdvisoryResponseDto`) or `404 Not Found`
  - `POST /api/v1/advisories/resolve` → `200 OK` (`AdvisoryResponseDto` with `source: "database_cache"` or `"llm_generated"`), `400 Bad Request` (missing `class_key` / `crop` / `condition`), `503 Service Unavailable` (LLM unavailable on cache miss)
  - `DELETE /api/v1/advisories/{**classKey}` → `204 No Content` or `404 Not Found` (allows clearing a cached entry to regenerate)

- [ ] **Step 1: Write failing unit tests in `AdvisoriesControllerTests.cs`**

Using EF Core InMemory (`Microsoft.EntityFrameworkCore.InMemory`) + fake `IGeminiAdvisoryClient`:
1. `ResolveAdvisory_CacheHit_ReturnsDatabaseRecordWithoutCallingLlm` — pre-seed `tomato/late_blight`; call `ResolveAdvisory`; assert `source == "database_cache"` and fake LLM call count == `0`.
2. `ResolveAdvisory_CacheMiss_CallsLlmPersistsAndReturnsGenerated` — empty DB; call `ResolveAdvisory` for `tomato/late_blight`; assert `source == "llm_generated"`, fake LLM call count == `1`, and row exists in `disease_advisories`; call a second time and assert `source == "database_cache"` and LLM call count stays `1`.
3. `ResolveAdvisory_NormalizesClassKeyCasingAndWhitespace` — `" Tomato/Late_Blight "` hits `"tomato/late_blight"`.
4. `ResolveAdvisory_WhenLlmUnavailableOnMiss_Returns503` — fake LLM throws `LlmAdvisoryUnavailableException`; assert `503` ProblemDetails and nothing persisted.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/AgriTech.Api.Tests/AgriTech.Api.Tests.csproj --filter AdvisoriesControllerTests`
Expected: FAIL (`AdvisoriesController` does not exist).

- [ ] **Step 3: Implement `AdvisoriesController` + `verify_advisories_cache.ps1`**

Normalize `class_key` via `Trim().ToLowerInvariant()`. Handle concurrent insert unique-constraint races (`DbUpdateException` / `PostgresException.SqlState == "23505"`) by detaching the failed entity and re-reading the committed row from PostgreSQL as `database_cache`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `dotnet test backend/AgriTech.slnx`
Expected: All `GeminiAdvisoryClientTests` and `AdvisoriesControllerTests` pass.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(api): add cache-first AdvisoriesController and unit tests"
```

---

### Task 4: Expose Canonical `class_key` in `ml-service` Response

**Files:**
- Modify: `ml-service/plantml_engine.py:90-112`
- Modify: `ml-service/schemas.py:121-146`
- Modify: `ml-service/main.py:303-373`
- Modify: `ml-service/tests/test_classify_leaf.py`

**Interfaces:**
- Produces `ClassifyLeafResponse.class_key: Optional[str]` (e.g. `"tomato/late_blight"`, derived from `advisory._normalize_key(top_label)` or `pred.class_name`).

- [ ] **Step 1: Add failing test in `ml-service/tests/test_classify_leaf.py`**

Assert `POST /api/v1/classify-leaf` response JSON includes `class_key` matching canonical `crop/disease` format (e.g. `"tomato/late_blight"`).

- [ ] **Step 2: Run pytest to verify it fails**

Run: `cd ml-service && & "F:\Okul\Plant Machine Learning\.venv\Scripts\python.exe" -m pytest tests/test_classify_leaf.py -q`
Expected: FAIL (`KeyError: 'class_key'`).

- [ ] **Step 3: Add `class_key` to `PlantmlEngine.run()`, `ClassifyLeafResponse`, and `classify_leaf` route**

- [ ] **Step 4: Run full `ml-service` pytest suite**

Run: `cd ml-service && & "F:\Okul\Plant Machine Learning\.venv\Scripts\python.exe" -m pytest -q`
Expected: All tests pass (108+ passed).

- [ ] **Step 5: Commit**

```bash
git add ml-service/
git commit -m "feat(ml): include canonical class_key in classify-leaf response"
```

---

### Task 5: Frontend Advisory Resolution, Bug Fixes & Verdict UI Source Badge

**Files:**
- Modify: `frontend/src/types/diagnostics.ts`
- Modify: `frontend/src/services/diagnosticsService.ts`
- Modify: `frontend/src/components/Diagnostics/DiagnosticVerdictCard.tsx`
- Modify: `frontend/src/pages/LeafDiagnosticsPage.tsx`
- Modify: `frontend/.env.example`
- Modify: `frontend/scripts/test_diagnostics_validation.js`

**Interfaces:**
- Consumes `POST ${VITE_API_BASE_URL}/api/v1/advisories/resolve`
- Updates `CropSpecies` to support all 7 `plant-ml` crops (`'Tomato' | 'Potato' | 'Corn' | 'Apple' | 'Grape' | 'Rice' | 'Cassava'`)
- Adds `advisorySource?: 'database_cache' | 'llm_generated' | 'knowledge_base' | 'sample'` and `advisoryModel?: string` on `AgronomicAdvisory` / `DiagnosticPrediction`

- [ ] **Step 1: Write failing tests in `frontend/scripts/test_diagnostics_validation.js`**

Tests to add:
1. `normalizeCropSpecies` maps `grape`, `rice`, `cassava` accurately (not collapsing to `'Tomato'`).
2. `mapMlAdvisoryToFrontend` extracts `chemical_treatments` (`product`, `dosage`, `type`) + `biological_controls` + `cultural_controls` when `fungicide_treatments` is absent.
3. `resolveBackendAdvisory` calls `POST /api/v1/advisories/resolve` and prefers backend `database_cache` / `llm_generated` advisory over fallback; when `fetch` fails or returns `503`, gracefully falls back to mapped `ml-service` advisory without throwing.

- [ ] **Step 2: Run `npm run test:diagnostics` to verify failure**

Run: `cd frontend && npm run test:diagnostics`
Expected: FAIL.

- [ ] **Step 3: Implement fixes & backend advisory resolution in `types/diagnostics.ts`, `diagnosticsService.ts`, `DiagnosticVerdictCard.tsx`, and `LeafDiagnosticsPage.tsx`**

- Fix `normalizeCropSpecies()` for all 7 crops.
- Respect `ml-service` `requires_rescan` without forcing `0.60–0.70` `plant-ml` `"ok"` responses into rescan (align `LOW_CONFIDENCE_THRESHOLD` or check `data.requires_rescan === true` when `model_version` starts with `plantml`).
- Implement `mapMlAdvisoryToFrontend` and `resolveBackendAdvisory` (with 15s timeout so first-time Gemini generation has room to finish, falling back cleanly to `ml-service` advisory on error/timeout).
- Render a small badge in `DiagnosticVerdictCard.tsx` showing whether the recommendation came from **Database Cache**, **Gemini AI**, or **Local Knowledge Base**.

- [ ] **Step 4: Run full frontend verification (`lint`, `build`, `test:diagnostics`, `test:map`, etc.)**

Run: `cd frontend && npm run lint && npm run build && npm run test:diagnostics && npm run test:map`
Expected: 0 lint errors/warnings, clean build, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(web): wire Gemini + DB cached disease advisories and fix treatment mapping"
```

---

### Task 6: Teammate Architecture & Feature Report + Final Branch Push (No PR)

**Files:**
- Create: `PROJECT_DETAILS/Reports/Phase 1/LLM-disease-advisory-report.md`

- [ ] **Step 1: Write detailed report markdown for backend teammate review**

Document: architecture flow, new `disease_advisories` schema/migration, Gemini REST integration & config (`Gemini:ApiKey` / `GEMINI_API_KEY` setup instructions without committing secrets), endpoints (`GET`, `POST /resolve`, `DELETE`), concurrency/error handling, `ml-service` `class_key` addition, `frontend` bug fixes, and exact test/verification commands executed with results.

- [ ] **Step 2: Commit report and push `feat/llm-disease-advisory` to `origin` (do NOT create a PR)**

```bash
git add "PROJECT_DETAILS/Reports/Phase 1/LLM-disease-advisory-report.md"
git commit -m "docs(phase1): add LLM disease advisory cache implementation report"
git push -u origin feat/llm-disease-advisory
```

---

## Self-Review Check
- **Spec coverage:** Covers Gemini API integration (`Task 2`), PostgreSQL caching keyed by crop/disease (`Task 1 & 3`), immediate action + recommended treatments + microclimate risk populated without repeat LLM calls (`Task 3 & 5`), frontend placeholder/field-mapping fix (`Task 5`), teammate markdown report (`Task 6`), separate GitHub branch without PR (`Task 6`).
- **Type consistency:** `class_key`, `immediate_action`, `recommended_treatments`, `microclimate_risk`, `source` (`"database_cache" | "llm_generated"`) match across `AdvisoryDtos.cs`, `AdvisoriesController.cs`, `diagnosticsService.ts`, and `DiagnosticVerdictCard.tsx`.
- **Review Focus tests:** Concurrency conflict (`23505`), low-confidence skip, Gemini failure fallback, 7-crop mapping, and `class_key` normalization all have explicit test cases.
