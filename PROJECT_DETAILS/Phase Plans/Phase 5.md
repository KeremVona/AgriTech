## Phase 5: Türkiye Regional Risk Map (Feature #3)

Phase 5 builds the province-level risk map promised in the TÜBİTAK 2209-A proposal (section 2.4, İP1, İP3). For each of
Türkiye's **81 provinces** and **6 crops** (tomato, potato, corn, apple, grape, rice), three risk families are combined
into one profile:

- **Soil:** SoilGrids 2.0, FAO GSSmap, and slope from an elevation model.
- **Climate:** ERA5-Land.
- **Crop sensitivity:** a literature-based table reviewed by the advisor.

Each factor is turned into a 0–100 percentile, the factors are combined with weights, and the result is shown as
low / medium / high on the new `/risk` page. Scores exist per province × crop × year, measured over each crop's
growing season.

**Full design (read this first):**
[`docs/superpowers/specs/2026-11-27-phase5-regional-risk-map-design.md`](../../docs/superpowers/specs/2026-11-27-phase5-regional-risk-map-design.md).
It holds the factor list, scoring rules, database tables, API contracts, page layout and the accessibility checklist.
The TODOs below refer to it as **"the spec"**.

**Out of scope for Phase 5:** learning weights from data (NNLS), computing yield loss, and the H4 validation against
TÜİK yields. These come in the TÜBİTAK period (Mar–Aug 2027) and plug into the pipeline as a new weight set.

**Targets from the proposal (İP3):**
- the 81-province map loads in ≤ 2 s the first time;
- a province risk profile returns in p95 ≤ 80 ms;
- the accessibility checklist is 100% done.

### How the work is split

Every TODO belongs to exactly **one layer**: Content, Data pipeline, Backend or Frontend. No TODO mixes layers. TODOs
are not assigned to people. Pick any TODO whose dependencies are done.

The layers talk to each other only through these contracts, all defined in the spec:

| From | To | Contract |
|---|---|---|
| Content (TODO-501) | Pipeline | `crop_sensitivity.csv` |
| Backend (TODO-507) | Pipeline + API | Database tables (EF migration) |
| Pipeline (TODO-506) | API | Rows in those tables |
| Backend (TODO-508) | Frontend | JSON API contracts |

Thanks to the dev fixture in TODO-507 and the sample data in TODO-509, the Content, Pipeline, Backend and Frontend
tracks can all start on day one.

Branch names follow `GIT_CHANGES.md`: `feat/data-5xx-…` for Content and Pipeline, `feat/api-5xx-…` for Backend,
`feat/web-5xx-…` for Frontend. Every TODO finishes with a report per `Task Completion.md`.

---

### Track A: Content

#### TODO-501: Crop Sensitivity Table (literature-based, advisor-reviewed)

- **Layer:** Content
- **Depends on:** nothing
- **Description:** Fill the crop sensitivity table with **real values from the literature** for all 6 crops × 11
  factor codes, in the CSV format defined in the spec (section "Crop sensitivity table").
- **Deliverables:**
  - `risk-pipeline/config/crop_sensitivity.csv`, one row per crop × factor, with:
    - weight (≥ 0; 0 means "does not apply");
    - direction;
    - growing-season months and frost months;
    - heat, frost and heavy-rain thresholds where relevant;
    - a source citation for every value;
    - notes where a weight is a documented judgement rather than a published number.
  - `risk-pipeline/config/CROP_SENSITIVITY_SOURCES.md`: the full reference list and a short justification of each
    crop's weights.
  - Table status recorded (`draft` → `advisor_reviewed` with the review date) after the advisor signs off.
- **Acceptance Criteria:**
  - 66 rows (6 × 11), no blank weights or directions, and every row has a citation.
  - Season months are consistent with Turkish growing calendars.
  - The advisor has reviewed the table, and the status is `advisor_reviewed` before the demo.

---

### Track B: Data Pipeline (Python, `risk-pipeline/`)

#### TODO-502: Pipeline Scaffold, Province Boundaries & Source Manifest

- **Layer:** Data pipeline
- **Depends on:** nothing
- **Description:** Set up `risk-pipeline/` (Python 3.12+, `uv`, pytest) with one command per stage. Implement the
  `boundaries` stage and the source manifest.
- **Deliverables:**
  - **Project:**
    - project layout, `pyproject.toml` and `README.md` (how to run each stage, the env file for the CDS key, the
      gitignored data/cache folders);
    - a licence matrix in the README for every source listed in the spec, each licence checked.
  - **`boundaries` stage:**
    - downloads geoBoundaries Türkiye ADM1;
    - maps the provinces to plate codes 1–81, `name_tr` and `slug`;
    - writes full and simplified geometries (simplified ≤ 1 MB gzipped as GeoJSON) and `ST_PointOnSurface`
      centroids.
  - **Manifest helper:** records each source's name, version/date, SHA-256 and the git commit, for later loading into
    `risk_pipeline_runs`.
- **Acceptance Criteria:**
  - Exactly 81 provinces, unique plate codes 1–81, and all geometries valid (full and simplified).
  - No gaps or overlaps introduced by simplification.
  - pytest covers the province checks.

#### TODO-503: Farmland Mask & TÜİK Crop Presence

- **Layer:** Data pipeline
- **Depends on:** TODO-502
- **Description:** Implement the `cropland` and `presence` stages.
- **Deliverables:**
  - **`cropland` stage:** an ESA WorldCover cropland mask clipped to Türkiye, plus per-province farmland weights used
    to average soil and climate values.
  - **`presence` stage:**
    - reads hand-exported TÜİK files (README lists the exact tables, filters and the crop-name mapping, e.g. table vs.
      wine grapes, paddy rice);
    - outputs planted area and yield per province × crop × year;
    - records the file hashes in the manifest.
  - **Presence rule:** a province grows a crop in a year if the planted area is ≥ 10 ha that year; a missing record
    counts as not grown.
- **Acceptance Criteria:**
  - Every province has a farmland weight. Any province with almost no farmland is listed in the README.
  - The presence table covers all 81 provinces × 6 crops × all TÜİK years, with no silent gaps (missing records are
    explicit).
  - The first and last TÜİK years are confirmed and written in the README.

#### TODO-504: Soil Layer

- **Layer:** Data pipeline
- **Depends on:** TODO-503
- **Description:** Implement the `soil` stage, producing the 6 soil factor values per province (spec, section
  "Factors → Soil").
- **Deliverables:**
  - **Sources:** SoilGrids 2.0 (water retention, texture, organic carbon, pH), FAO GSSmap (salinity) and an
    elevation model (slope).
  - **Estimated factors:** the drainage-from-texture rule and the slope-to-erosion rule, both written down in the
    README with their reasoning. Both factors are flagged `is_estimated`.
  - **Output:** farmland-weighted province averages with units.
- **Acceptance Criteria:**
  - 81 × 6 values, no nulls, and the units are documented.
  - A sanity check against known patterns is reported (e.g. salinity higher in the Konya closed basin and Harran
    plain; organic matter higher on the Black Sea coast).

#### TODO-505: Climate Layer (ERA5-Land)

- **Layer:** Data pipeline
- **Depends on:** TODO-501 (season months and thresholds), TODO-503
- **Description:** Implement the `climate` stage, producing the 5 climate factor values per province × crop × year
  over each crop's growing season (spec, section "Factors → Climate").
- **Deliverables:**
  - **Download:** ERA5-Land through the CDS API from **1991**, resumable and cached (the first run may take hours).
  - **Factors:**
    - SPEI calibrated on **1991–2018 only**;
    - heat, frost, heavy-rain and fungal-suitability day counts using the thresholds from the crop table.
  - **Output:** farmland-weighted province values per crop × year.
- **Acceptance Criteria:**
  - Values exist for every province × crop × year that has a complete growing season.
  - A test proves the SPEI calibration uses no data after 2018.
  - Spot checks are reported for known extreme years (e.g. the 2021 drought in Central and Southeast Anatolia shows
    high drought values).

#### TODO-506: Scoring, Database Load & Data Dump

- **Layer:** Data pipeline
- **Depends on:** TODO-501, TODO-504, TODO-505, TODO-507 (tables must exist)
- **Description:** Implement the `score` and `load` stages exactly as the spec's "Scoring" section describes.
- **Deliverables:**
  - **`score` stage** (takes a weight-set name, e.g. `literature-v1`):
    - percentiles against the reference pool (grown province-years up to 2018), with clamping and direction flips;
    - soil, climate and total scores, factor contributions and levels (33/67);
    - long-term averages;
    - not-grown handling.
  - **`load` stage:**
    - writes `provinces`, `province_crop_presence`, `province_factor_values`, `province_factor_scores`,
      `province_risk_scores`, `crop_risk_factors`, `risk_weight_sets` and a `risk_pipeline_runs` row with the
      manifest;
    - runs in one transaction, removes the dev fixture and older rows for the same weight set, then activates the
      weight set.
  - **`dump` command:** writes the risk tables to a compressed SQL file for teammates (shared outside git).
- **Acceptance Criteria:**
  - Unit tests on small hand-made fixtures cover:
    - percentile and direction;
    - weighted averages;
    - contributions summing to the total;
    - level cut-offs;
    - clamping;
    - weight 0;
    - not-grown;
    - long-term averages;
    - **no year after 2018 in the reference pool**.
  - Re-running `score` + `load` takes minutes, not hours.
  - After `load`, the API (TODO-508) serves real data with no code change.

---

### Track C: Backend (ASP.NET Core)

#### TODO-507: Risk Schema, EF Migration & Dev Fixture

- **Layer:** Backend
- **Depends on:** nothing
- **Description:** Add the tables from the spec's "Database" section as EF Core entities and a migration, following
  existing conventions (snake_case, `made_at`).
- **Deliverables:**
  - Entities and migration for `provinces`, `risk_weight_sets`, `crop_risk_factors`, `province_crop_presence`,
    `province_factor_values`, `province_factor_scores`, `province_risk_scores` and `risk_pipeline_runs`, with the
    indexes listed in the spec.
  - Changes to `crops`: a `slug` column, plus new seed rows for **Grape** and **Rice** with fixed UUIDs in the
    existing seed style.
  - A **dev fixture** seeded by the migration: a few provinces with simple square geometry, all 6 crops, 3 years, and
    one draft weight set `dev-fixture`.
  - A `verify_risk_schema.ps1` script in `backend/scripts/`, matching the existing verify scripts.
- **Acceptance Criteria:**
  - The migration applies cleanly on a fresh `docker compose up` database and rolls back cleanly.
  - Exactly one active weight set is enforced.
  - Existing tests still pass.

#### TODO-508: Regional Risk API

- **Layer:** Backend
- **Depends on:** TODO-507
- **Description:** Build the read-only `RiskController` with the five endpoints and the exact JSON contracts from the
  spec's "API" section.
- **Deliverables:**
  - `GET /api/v1/risk/meta`, `/provinces/geojson`, `/map`, `/provinces/{id}/profile` and `/provinces/{id}/trend`.
  - Parameter rules:
    - `crop` is a slug;
    - `year` is an integer or `avg`;
    - a missing year means the latest year;
    - the optional `weightSet` defaults to the active set.
  - Error responses: 400 and 404 as the spec describes, in the existing problem-details shape.
  - Caching and transport:
    - response compression;
    - long cache plus an ETag on the GeoJSON;
    - an in-memory cache keyed by weight set and parameters, invalidated when a newer `risk_pipeline_runs` row
      exists. No Redis.
  - xUnit tests in `tests/AgriTech.Api.Tests` for every endpoint, including not-grown entries, `year=avg` and the
    error cases.
- **Acceptance Criteria:**
  - Responses match the spec's JSON examples field for field.
  - `/map` always returns 81 entries.
  - Profile `factors` are sorted by contribution, and their contributions add up to the total (±0.1).
  - With real data loaded: profile **p95 ≤ 80 ms** and GeoJSON ≤ 1 MB compressed, measured and written in the report.

---

### Track D: Frontend (React, `/risk`)

#### TODO-509: Risk Page Shell, Data Service & Sample Data

- **Layer:** Frontend
- **Depends on:** nothing (works against sample data; switches to the live API once TODO-508 is done)
- **Description:** Create the `/risk` route in layout B (map + always-visible side panel), the data service and the
  page state.
- **Deliverables:**
  - **Route and page:** the `/risk` route and page, in the Notion-style look with the shared `AppHeader`.
  - **Navigation:** a "Risk map" link added to the header and to the landing page.
  - **Controls:** crop pills, year select, "Long-term avg" toggle, and a legend (Low / Medium / High / Not grown).
  - **URL state:** `?crop=&year=&province=` (`year=avg` for the long-term average), with safe fallbacks for invalid
    values.
  - **Data service:** typed for the spec's API contracts. It loads `meta` and the GeoJSON once, `map` when the crop or
    year changes, and `profile` + `trend` when a province is selected.
  - **Data mode `VITE_RISK_DATA_MODE`** (`auto` / `api` / `sample`), the same pattern as the map and irrigation pages,
    with a visible "Sample data" notice and the setting documented in `.env.example`.
  - **Sample fixtures:** they match the API contracts exactly and use real simplified province borders. The scores
    are clearly fake.
  - The always-visible no-causation note.
  - Tests in `frontend/scripts/` (wired into `npm test`) for URL-state parsing, the data-mode fallback, and checking
    the fixtures against the contract types.
- **Acceptance Criteria:**
  - The page works fully in `sample` mode with no backend.
  - Changing the crop or year fetches only `map`.
  - Invalid URL values fall back to the defaults with no error page.
  - `npm run lint`, `npm run build` and `npm test` pass.

#### TODO-510: Choropleth Map Layer

- **Layer:** Frontend
- **Depends on:** TODO-509
- **Description:** Draw the 81 provinces on a Leaflet map inside the page from TODO-509.
- **Deliverables:**
  - **Map setup:** fits Türkiye's bounds, with no basemap by default.
  - **Fills:** polygons filled by level on the warm light-to-dark scale; "Not grown here" as a grey hatch.
  - **Hover:** a tooltip with the name, score and level.
  - **Click:** selects the province and draws a dark outline (selection is shared with the side panel and the URL).
  - **Accessibility:** the map has an accessible name, and the ranked list in the panel serves as its text
    alternative.
- **Acceptance Criteria:**
  - Switching crop or year recolours the map without reloading the geometry.
  - **First load of the map ≤ 2 s:** production build, desktop Chrome, empty cache, local backend with real data;
    write the number in the report.
  - No dropped frames while hovering.

#### TODO-511: Side Panel, Province Profile & Mobile Layout

- **Layer:** Frontend
- **Depends on:** TODO-509
- **Description:** Build the side panel's two states, the phone layout, and complete the accessibility checklist.
- **Deliverables:**
  - **No province selected:**
    - a "Highest risk provinces" list: grown provinces ranked by score, top 10 with "show all";
    - every row is a keyboard-usable button that selects the province;
    - an "awaiting advisor review" note shown while the weight set is in draft.
  - **Province selected:**
    - name and a back-to-list control;
    - tiles for total (with level badge), soil and climate;
    - "Biggest factors" bars sorted by contribution, with estimated factors marked with the text "estimated" and the
      source shown on hover/focus;
    - a Recharts trend chart over the years, with the long-term average as a reference line and a text summary for
      screen readers.
  - **Phone (≤ 768 px):** the map on top at about 45% of the viewport height, the panel below, and the controls
    collapsed. No sideways scroll at 375 px.
- **Acceptance Criteria:**
  - **All 8 items of the spec's accessibility checklist pass.** List each one in the report with how it was checked.
  - Selecting a province shows its profile within 150 ms of the data arriving.
  - The layout works at 375 px and at 200% zoom.

---

### Dependency overview

```
TODO-501 (content) ─────────────┐
TODO-502 → TODO-503 → TODO-504 ─┤
                    └→ TODO-505 ┴→ TODO-506 ← TODO-507 → TODO-508
TODO-509 → TODO-510, TODO-511          (switch to live API when TODO-508 is done)
```

TODO-505 also needs TODO-501 (season months and thresholds).
