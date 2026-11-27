# Phase 5 — Türkiye Regional Risk Map (Feature #3) — Design

Date: 2026-11-27 · Route: `/risk` · Replaces the earlier draft of `PROJECT_DETAILS/Phase Plans/Phase 5.md`

Source of truth: the TÜBİTAK 2209-A proposal (`../TUBITAK_2209A_Bolumler_Revize.md`), section 2.4 "Bölgesel Risk
Haritası", hypothesis H4, and work packages İP1 and İP3. Where this document and the proposal disagree, the proposal
wins and this document gets fixed.

## Intent

Farmers, extension staff and the graduation jury should be able to open one page and see, for one of six crops,
how exposed each of Türkiye's 81 provinces is to risk from **soil**, **climate** and **crop sensitivity** combined
into a single profile. Today this information sits in separate datasets and is rarely brought together for a
specific crop (proposal, section 1).

Phase 5 builds the working map and everything behind it. It is laid out so the proposal's research step (learning
the weights from data up to 2018 and validating them against TÜİK yield losses from 2019 onward, H4) can plug in
later during the TÜBİTAK period (Mar–Aug 2027) **without rework**.

## Decisions agreed in chat

| Topic | Decision |
|---|---|
| Direction | Follow the TÜBİTAK proposal. The old Phase 5 draft is dropped: no 7 macro-regions, no live 14-day forecasts, no MGM, no Redis, no hand-written fungal/drought/frost formulas, no advice text. |
| Coverage | Türkiye only: 81 provinces (il) × 6 crops (tomato, potato, corn, apple, grape, rice). |
| Risk families | Soil (SoilGrids 2.0 plus extra sources, see below), climate (ERA5-Land), crop sensitivity (a table built from the literature and reviewed by the advisor). |
| Scale | Each factor is turned into a 0–100 percentile, the factors are combined with weights, and the result is shown as low / medium / high. |
| Time | One score per province × crop × year, measured over each crop's **growing season**. The map opens on the latest complete year and has a year selector plus a "long-term average" view. |
| Percentile reference | Percentiles are ranked against a fixed pool of reference years that **ends in 2018**, so the H4 test years (2019+) never leak in. |
| Weights in Phase 5 | Starting weights come straight from the crop sensitivity table (`literature-v1`). Learning weights with NNLS and the H4 yield check are **out of scope**; they come in the TÜBİTAK period. |
| Missing soil factors | SoilGrids has no salinity, drainage or erosion. Salinity comes from FAO GSSmap; drainage is estimated from soil texture; erosion is estimated from slope. Estimated factors are labelled "estimated" everywhere. |
| Architecture | An offline **Python pipeline** computes every number and writes it to PostGIS. The **.NET API is read-only**. The frontend reads the API. |
| Page layout | Layout B: map plus an always-visible side panel (mockup agreed in the browser). |
| Task split | Every task is purely data pipeline, purely backend, purely frontend, or purely content (the crop table). No task mixes layers. Tasks are not assigned to people. |
| Advisor | The crop sensitivity table is reviewed by the team's advisor, as the proposal states. |

## Goals

1. A `/risk` page showing all 81 provinces coloured by risk level for a chosen crop and year, with a profile for any
   province that breaks the score into soil and climate factors.
2. A reproducible Python pipeline that turns public source data into province-level factor values, percentiles and
   scores, with every source version pinned.
3. A database layout and API that already support multiple weight sets, so learned weights can replace the literature
   weights by adding rows, not by changing code.
4. Meet the proposal's İP3 targets:
   - the 81-province map loads in **≤ 2 s** the first time;
   - a province/crop risk profile returns in **p95 ≤ 80 ms**;
   - **100%** of the accessibility checklist below is done.

## Non-goals

- Learning weights from data, computing yield loss, or the H4 Spearman validation (TÜBİTAK period).
- Live or forecast-based risk, nightly weather sync, push alerts.
- Farming advice text or AI-generated advice on this page.
- Any link to the leaf diagnosis feature (the proposal keeps the map independent of diagnosis).
- District (ilçe) level, or any country other than Türkiye.
- Editing the crop sensitivity table from the UI.

## Anti-goals (a failure even if it technically works)

- The map implies cause ("this province lost yield because of X"). The proposal says the map makes no causal claim and
  the interface must say so.
- An estimated factor is shown as if it were measured.
- Test years (2019+) influence percentiles or weights.
- A layout that only works with a mouse, or that tells levels apart by colour alone.
- Using a data source whose licence forbids redistribution (the proposal promises Apache-2.0 code, CC BY 4.0 docs and a
  licence matrix).

## Data sources

Every source goes into the licence matrix and the pipeline manifest with its version and SHA-256. **Each licence must
be checked before use** (the notes below are what we expect, not verified facts).

| Purpose | Source | Notes |
|---|---|---|
| Province borders | geoBoundaries, Türkiye ADM1 | Expected CC BY 4.0. Chosen over GADM, whose licence does not allow redistribution. Must yield exactly 81 provinces, mapped to licence-plate codes 1–81. |
| Where farmland is | ESA WorldCover (cropland class) | Used to average soil and climate over farmland only, as the proposal says ("ekili alanlara göre"). Expected CC BY 4.0. |
| Soil properties | SoilGrids 2.0 | Texture (sand/silt/clay), organic carbon, pH, water retention. Topsoil-to-root-zone depth average (builder picks depths, documents them). |
| Soil salinity | FAO Global Soil Salinity Map (GSSmap) | Licence to check. |
| Slope (for erosion) | A public elevation model (e.g. Copernicus DEM GLO-90 or SRTM) | Builder picks one with a redistribution-friendly licence. |
| Climate | ERA5-Land (Copernicus Climate Data Store) | Daily or hourly 2 m temperature, dew point, precipitation, potential evaporation. Needs a free CDS account; the API key lives in a local env file and is never committed. |
| Where each crop is grown | TÜİK provincial crop production statistics | Planted area per province × crop × year. Also download yield in the same pass so the TÜBİTAK step can use it later (stored, not used in Phase 5). First available year to be confirmed (expected around 2004). TÜİK has no download API: the files are exported by hand from the TÜİK data portal and placed in a gitignored input folder. The pipeline README lists the exact tables and filters used, and the `presence` stage records each file's SHA-256 in the manifest. Only derived numbers go into the database. Check TÜİK's terms of use before publishing derived data. Grape and rice may be in different TÜİK tables or listed under other names (e.g. table grapes and wine grapes, paddy); the README records the mapping. |

**Years covered.**
- **Climate download:** ERA5-Land is downloaded from **1991** so SPEI can be calibrated on **1991–2018**. This
  baseline ends in 2018 so the test years never affect the calibration.
- **Scored years:** the years that have both a complete ERA5-Land growing season and TÜİK presence data, from the
  first TÜİK year onward.
- **Reference pool for percentiles:** scored years up to 2018.
- **`latestYear`:** the newest scored year. TÜİK publishes with a delay, so this is normally 1–2 years behind the
  current date; the 2024 in the examples is illustrative.

## Factors

Each factor has a code, a raw value with a unit, and a **direction**: `+1` means a higher raw value means more risk,
`-1` means a higher raw value means less risk.

### Soil (one value per province, does not change by year or crop)

| Code | Proposal item | Raw value | Direction | Estimated? |
|---|---|---|---|---|
| `SOIL_WATER_HOLDING` | water-holding capacity | available water capacity, mm in root zone, from SoilGrids water retention | -1 | no |
| `SOIL_DRAINAGE` | drainage | drainage class derived from texture (clay share, sand share) | -1 (better drainage = less risk) | **yes** |
| `SOIL_SALINITY` | salinity/alkalinity | GSSmap electrical conductivity | +1 | no |
| `SOIL_ALKALINITY` | salinity/alkalinity | SoilGrids pH (H₂O) | +1 above neutral (builder defines the transform, e.g. distance above pH 7) | no |
| `SOIL_EROSION` | erosion | slope-based erosion indicator from the elevation model | +1 | **yes** |
| `SOIL_ORGANIC_MATTER` | organic matter | SoilGrids soil organic carbon | -1 | no |

All soil values are farmland-weighted averages over each province.

### Climate (one value per province × crop × year, measured over that crop's growing season)

| Code | Proposal item | Starting definition (thresholds come from the crop table) | Direction |
|---|---|---|---|
| `CLIM_DROUGHT` | drought index (SPEI) | SPEI over the season window (e.g. SPEI-3 ending at season end), negated so drier = higher | +1 |
| `CLIM_HEAT` | extreme heat | days in season with Tmax ≥ crop heat threshold | +1 |
| `CLIM_FROST` | frost | days in the crop's frost-sensitive months with Tmin ≤ crop frost threshold | +1 |
| `CLIM_HEAVY_RAIN` | extreme rainfall | days in season with precipitation ≥ crop heavy-rain threshold | +1 |
| `CLIM_FUNGAL` | fungal disease suitability | days in season with long leaf wetness at mild temperature (e.g. ≥ 10 h with RH ≥ 90% and 15–25 °C) | +1 |

These are starting definitions. The exact thresholds and season months per crop live in the crop sensitivity table and
are part of the advisor's review. Climate values are farmland-weighted averages over the province's ERA5-Land cells.

### Crop sensitivity table

A versioned CSV in the pipeline repo, one row per crop × factor:

| Column | Meaning |
|---|---|
| `crop` | one of the 6 crops |
| `factor_code` | one of the 11 factor codes above |
| `weight` | starting weight, ≥ 0 (non-negative to match the later NNLS step) |
| `direction` | +1 / -1 (normally the factor's default; the table may override it for a crop) |
| `season_months` | growing-season months for climate factors, e.g. `4-9`; frost uses `frost_months` |
| `frost_months`, `heat_threshold_c`, `frost_threshold_c`, `heavy_rain_mm` | crop-specific thresholds (blank where not relevant) |
| `source` | citation for the weight and thresholds |
| `notes` | free text |

**Content (agreed):**
- Phase 5 fills this table with **real values from the literature**, not placeholders: all 6 crops × 11 factors, each
  with a citation.
- Typical sources: FAO crop guides and calendars (including FAO-56 for growing seasons), crop-specific agronomy
  references for heat/frost thresholds and salinity tolerance (e.g. FAO 29 / Maas–Hoffman salinity thresholds), and
  Turkish crop calendars for local season months.
- Where the literature gives a threshold but no weight, the starting weight is a documented judgement (e.g. rank the
  factors for that crop and turn the ranks into weights). The `notes` column says so.
- The table must be **reviewed by the advisor before the demo**.

Plus a table-level status: `draft` or `advisor_reviewed` (with review date). The map works with a draft table but shows
"Weights awaiting advisor review" until the status is `advisor_reviewed`.

## Scoring

For one weight set, crop `c`, province `p`, year `y`:

1. **Raw values.** Soil factors: raw value per province. Climate factors: raw value per province × crop × year.
2. **Percentiles.** For each factor, compute the empirical percentile (0–100) of the raw value against the **reference
   pool**:
   - climate factors: all province-years for that crop within the reference years (first available year … **2018**),
     restricted to provinces where the crop is grown;
   - soil factors: all 81 provinces (soil has no year).
   Values beyond the reference pool's range are clamped to 0 or 100.
3. **Risk percentile.** `r = percentile` if direction is +1, `r = 100 − percentile` if -1.
4. **Scores.** With weights `w` from the crop table:
   - `soil_score = Σ w·r / Σ w` over soil factors;
   - `climate_score = Σ w·r / Σ w` over climate factors;
   - `total_score = Σ w·r / Σ w` over all factors.
   Each factor's **contribution** to the total is `w·r / Σ w` (these add up to the total). The proposal's "crop
   sensitivity" family shows up as the weights, not as a third score.
5. **Level.** low < 33 ≤ medium < 67 ≤ high. These cut-offs are stored with the weight set so they can change later.
6. **Long-term average.** For each province × crop, average over the years the crop was grown there:
   - total, soil and climate scores: the mean of the yearly scores, with a level computed from that mean;
   - each factor's `rawValue`, `percentile`, `riskPercentile` and `contribution`: the mean of its yearly values
     (contributions still add up to the averaged total because everything is linear).
   Stored as rows with `year = NULL`. Climate avg rows have a `crop_id`; soil rows have neither crop nor year.
7. **Not grown.** Presence is decided **per year**. A province counts as growing a crop in year *y* if TÜİK reports
   a planted area of at least **10 ha** that year (a missing record counts as not grown). Only grown province-years
   are scored and enter the reference pool. A province that is not grown in the selected year shows as "Not grown
   here". A province that never grew the crop in any scored year has no long-term average either.
8. **Weight 0.** A weight of 0 means the factor does not apply to that crop. It is left out of that crop's scores and
   does not appear in the profile.

All of this runs in the pipeline. The API never recomputes scores.

## Database (owned by an EF Core migration; the pipeline only writes rows)

Follows existing conventions: snake_case tables and columns, `made_at timestamptz default now()`.

| Table | Columns |
|---|---|
| `provinces` | `id smallint` PK (plate code 1–81), `name_tr`, `slug` (ASCII, e.g. `sanliurfa`), `geom geometry(MultiPolygon,4326)` (full detail), `geom_simplified geometry(MultiPolygon,4326)` (for the map), `centroid geometry(Point,4326)` (`ST_PointOnSurface`), `made_at`. GiST index on `geom`. |
| `crops` (existing) | Add **Grape** (*Vitis vinifera*) and **Rice** (*Oryza sativa*) with fixed UUIDs in the same style as the existing seed. Add a nullable `slug` column (`tomato`, `potato`, `corn`, `apple`, `grape`, `rice`) used by the API. |
| `risk_weight_sets` | `id uuid` PK, `name` (unique, e.g. `literature-v1`), `method` (`LITERATURE` / `NNLS`), `reference_start_year`, `reference_end_year`, `level_low_max` (33), `level_medium_max` (67), `review_status` (`draft` / `advisor_reviewed`), `reviewed_at`, `is_active` (exactly one active), `made_at`. |
| `crop_risk_factors` | `weight_set_id` FK, `crop_id` FK, `factor_code`, `weight numeric`, `direction smallint`, `season_months`, `frost_months`, thresholds, `source text`, `notes`; PK (`weight_set_id`, `crop_id`, `factor_code`). |
| `province_crop_presence` | `province_id`, `crop_id`, `year`, `planted_area_ha`, `yield_kg_per_ha` (nullable, stored for the TÜBİTAK step); PK (`province_id`, `crop_id`, `year`). |
| `province_factor_values` | `province_id`, `crop_id` (NULL for soil), `year` (NULL for soil and for climate long-term averages), `factor_code`, `raw_value numeric`, `unit`, `is_estimated bool`, `source_name`; unique on (`province_id`, `crop_id`, `year`, `factor_code`) with NULLs treated as equal (`NULLS NOT DISTINCT`). Percentile and risk percentile are stored per weight set in the next table. |
| `province_factor_scores` | `weight_set_id`, `province_id`, `crop_id`, `year` (NULL = long-term average), `factor_code`, `percentile numeric(5,2)`, `risk_percentile numeric(5,2)`, `weight numeric`, `contribution numeric(5,2)`. |
| `province_risk_scores` | `weight_set_id`, `province_id`, `crop_id`, `year` (NULL = long-term average), `soil_score`, `climate_score`, `total_score` (all `numeric(5,2)`, 0–100), `level` (`LOW` / `MEDIUM` / `HIGH`). Index on (`weight_set_id`, `crop_id`, `year`). |
| `risk_pipeline_runs` | `id`, `started_at`, `finished_at`, `manifest jsonb` (source names, versions, SHA-256, pipeline git commit, for every stage whose output was loaded), `weight_set_id`. One row per `load` run; each `load` writes one weight set's scores together with the raw values it was computed from. The API treats the newest finished run as the data version (for `meta.pipelineRun` and cache invalidation). |

The migration also seeds a **small dev fixture** (a handful of provinces with simple squares as geometry, all 6 crops, 3
years, one draft weight set named `dev-fixture`) so the API can be built and tested before the pipeline has produced
real data.

**Where the real data lives.** Each developer runs the stack in the existing local Docker Postgres.
- **The `load` stage:** runs in one transaction. It deletes the fixture rows and any previous rows for the same
  weight set, inserts the new data, then marks that weight set active.
- **Sharing the data:** the full download and processing takes hours. After a successful run, the pipeline can write
  the risk tables to a compressed SQL dump. Teammates restore that dump instead of re-running the pipeline. Dumps are
  shared outside git; they are too large and contain derived TÜİK data.
- **Performance:** the 2 s and 80 ms targets are measured against a local database holding the real data.

## API (new `RiskController`, read-only, under `/api/v1/risk`)

All responses are JSON (camelCase, as in the existing controllers), compressed (gzip/brotli), and use the **active**
weight set unless `weightSet` is given. `crop` is a crop slug. `year` is an integer or `avg`; when left out it means
the latest year that has scores.

### `GET /api/v1/risk/meta`

```json
{
  "weightSet": { "name": "literature-v1", "method": "LITERATURE", "reviewStatus": "draft",
                 "referenceYears": [2004, 2018], "levels": { "lowMax": 33, "mediumMax": 67 } },
  "crops": [ { "slug": "apple", "name": "Apple" } ],
  "years": [2004, 2005, 2024],
  "latestYear": 2024,
  "factors": [ { "code": "SOIL_DRAINAGE", "family": "SOIL", "label": "Drainage", "unit": "class", "isEstimated": true } ],
  "pipelineRun": { "finishedAt": "2026-12-10T09:00:00Z" }
}
```

### `GET /api/v1/risk/provinces/geojson`

FeatureCollection of the 81 provinces using `geom_simplified`. Properties: `id`, `nameTr`, `slug`. No scores.
Long-lived cache (`Cache-Control: public, max-age=86400` plus an ETag). Target ≤ 1 MB compressed.

### `GET /api/v1/risk/map?crop=apple&year=2024`

```json
{
  "crop": "apple", "year": 2024, "weightSet": "literature-v1",
  "provinces": [
    { "id": 63, "totalScore": 91.2, "level": "HIGH" },
    { "id": 6,  "totalScore": null, "level": null, "notGrown": true }
  ]
}
```

Always 81 entries. About 3 KB.

### `GET /api/v1/risk/provinces/{id}/profile?crop=apple&year=2024`

```json
{
  "province": { "id": 42, "nameTr": "Konya" },
  "crop": "apple", "year": 2024, "weightSet": "literature-v1", "reviewStatus": "draft",
  "notGrown": false,
  "scores": { "total": 72.1, "soil": 58.4, "climate": 81.0, "level": "HIGH" },
  "factors": [
    { "code": "CLIM_DROUGHT", "family": "CLIMATE", "label": "Drought (SPEI)",
      "rawValue": 1.42, "unit": "-SPEI", "percentile": 88.0, "riskPercentile": 88.0,
      "weight": 0.22, "contribution": 19.4, "isEstimated": false, "source": "ERA5-Land" }
  ]
}
```

`factors` is sorted by `contribution`, largest first. Target **p95 ≤ 80 ms**.

### `GET /api/v1/risk/provinces/{id}/trend?crop=apple`

```json
{ "province": { "id": 42, "nameTr": "Konya" }, "crop": "apple",
  "points": [ { "year": 2004, "total": 51.0, "soil": 58.4, "climate": 47.2, "level": "MEDIUM" } ],
  "average": { "total": 60.3, "level": "MEDIUM" } }
```

### Errors

`400` for an unknown crop slug or a malformed year; `404` for an unknown province or a year without scores. Errors use
the same problem-details shape as the existing controllers.

### Caching

In-memory cache (`IMemoryCache` or output caching), keyed by weight set + parameters, cleared when a new
`risk_pipeline_runs` row appears (the builder chooses how: a short TTL or checking the latest run id). No Redis.

## Frontend: `/risk` page (layout B)

Same Notion-style look as the other pages (`ui-*` tokens, Inter, warm greys, teal accent) and the shared `AppHeader`.

**Layout (desktop):**
- Header bar with a new **"Risk map"** link, added to every page's header and to the landing page.
- Control row:
  - crop pills (6);
  - year select;
  - "Long-term avg" toggle;
  - legend: Low / Medium / High / Not grown.
- Body:
  - **left:** the Leaflet map, fitted to Türkiye's bounds, with no basemap tiles by default (the provinces are the
    whole picture, and it saves load time; the builder may add a light basemap if it stays inside the 2 s budget);
  - **right:** the side panel, about 340 px wide.
- An always-visible note under the map: "Shows how risk factors line up, not what causes losses." (Turkish copy to
  follow the proposal's wording.)

**Map:**
- Polygons filled by level, using a light-to-dark warm scale (my call, so people with red-green colour blindness can
  still tell levels apart). "Not grown here" is a grey hatch.
- Hover shows a tooltip with the name, score and level.
- Click selects; the selected province gets a dark outline.
- Keyboard: provinces are reachable through the side-panel list (below). The map itself does not need to be
  tab-navigable.

**Side panel:**
- **No province selected:** a "Highest risk provinces" list for the chosen crop and year, all grown provinces ranked
  by score, with the top 10 shown and a "show all" option. Each row is a button that selects the province. Shows the
  "Weights awaiting advisor review" note when relevant.
- **Province selected:**
  - name and a back-to-list control;
  - three tiles: total with level badge, soil, climate;
  - "Biggest factors": a bar per factor (risk percentile) sorted by contribution, with estimated factors marked ◦
    and a source on hover/focus;
  - a trend chart over the years (Recharts) with the long-term average as a reference line.

**Phone (≤ 768 px):** the control row wraps or collapses into selects, the map goes on top at about 45% of the viewport
height, and the panel below it. No sideways page scroll at 375 px.

**State in the URL:** `/risk?crop=apple&year=2024&province=42` (`year=avg` for the long-term average). Defaults:
the first crop in `meta.crops` and `latestYear`. Invalid values fall back to the defaults without an error page.

**Data loading:**
- On page load, fetch `meta` and `provinces/geojson` (cached) once.
- On crop/year change, fetch only `map`.
- On province select, fetch `profile` and `trend`.

**Data mode** (`VITE_RISK_DATA_MODE`), the same pattern as the map and irrigation pages:
- `auto`: live, falling back to bundled sample fixtures with a visible "Sample data" notice;
- `api`: strict live;
- `sample`: no network.

Sample fixtures follow the API contracts above exactly. They use real province borders (a simplified copy of the
GeoJSON from the same source), and the sample scores are clearly fake.

**Accessibility checklist (all items must pass):**

1. Every control, list row and the back button can be reached and used with the keyboard; focus is always visible.
2. Levels are never shown by colour alone: the badge text says Low / Medium / High, and the legend has text labels.
3. Text and UI meet WCAG AA contrast (including text on the coloured tiles).
4. The map has an accessible name and a text alternative (the ranked list); the selected province is announced
   (`aria-live` on the panel heading).
5. The trend chart has a text summary (first year, last year, average) for screen readers.
6. Works at 200% zoom and at 375 px wide without loss of content.
7. Respects `prefers-reduced-motion` (no animated transitions).
8. Estimated factors are marked with text ("estimated"), not only with a symbol.

**Performance:** first load of the 81-province map ≤ 2 s. Measured on a production build (`vite build` + preview),
desktop Chrome, empty cache, backend running locally with real data. Record the number in the task report.

## Pipeline (`risk-pipeline/` at the repository root)

- Python 3.12+, managed with `uv` like `ml-service`. Libraries at the builder's choice (expected: xarray, rioxarray,
  rasterio, geopandas, shapely, numpy, pandas, psycopg, cdsapi).
- **Stages, each a separate command that can run on its own:**
  1. `boundaries`;
  2. `cropland`;
  3. `presence` (TÜİK);
  4. `soil`;
  5. `climate`;
  6. `score`;
  7. `load`.
- Intermediate outputs are written to `risk-pipeline/data/` as Parquet or GeoJSON files (gitignored); large raw
  downloads go to a cache folder that is also gitignored.
- **Manifest:** every run writes the source names, versions/dates, SHA-256 of downloaded files and the git commit into
  `risk_pipeline_runs.manifest`.
- **Weights:** the `score` stage takes a weight-set name and reads the crop sensitivity CSV. In the TÜBİTAK period an
  NNLS stage will produce a new weight set (`nnls-v1`) and reuse `score` and `load` unchanged.
- **Tests (pytest):**
  - scoring math on small hand-made fixtures: percentile, direction flip, weighted averages, levels, clamping,
    not-grown;
  - a check that no year after 2018 enters the reference pool;
  - boundary checks: 81 provinces, all `ST_IsValid`, plate codes 1–81 unique.
- **Runtime:** the climate download is large and can take hours the first time; that is acceptable for an offline
  job. Re-running `score` + `load` must take minutes.

## Handoffs between tasks

| From | To | Contract |
|---|---|---|
| Crop table task | Pipeline | `crop_sensitivity.csv` in the format above |
| Backend schema task | Pipeline, API task | The tables above (EF migration) |
| Pipeline | API | Rows in those tables |
| API task | Frontend | The JSON contracts above; the frontend's sample fixtures must match them |

Because of the dev fixture in the migration and the sample fixtures in the frontend, the pipeline, backend and
frontend tracks can all start at the same time.

## Left to the builder

- Exact SoilGrids depths, the drainage-from-texture rule, the slope-to-erosion rule, the alkalinity transform, and the
  SPEI time scale. Each must be written down in the pipeline README with its reasoning.
- Simplification tolerance for `geom_simplified` (must keep all 81 provinces valid and meet the 1 MB target).
- Cache invalidation mechanism in the API.
- Component and file names on the frontend, following existing folders (`components/RiskMap/`, `pages/RiskMapPage.tsx`,
  `services/riskService.ts`, `types/risk.ts` are suggested).
- Whether to show a light basemap under the provinces.

## Calls made without explicit agreement (please check)

- Score levels at 33 / 67, stored on the weight set.
- Provinces where a crop isn't grown (per TÜİK, at least 10 ha in that year) get no score for that year and show as
  "Not grown here".
- ERA5-Land downloaded from 1991; SPEI calibrated on 1991–2018.
- TÜİK files are exported by hand (there is no API); their SHA-256 goes in the manifest.
- Long-term average for factors = mean of yearly values.
- A weight of 0 means "does not apply" and hides the factor for that crop.
- Real data lives in each developer's local Docker database and is shared as a SQL dump outside git.
- TÜİK yield is downloaded and stored now (unused) so the TÜBİTAK step doesn't need another collection pass.
- Long-term average = mean of yearly scores over all available years.
- Map has no basemap by default.
- Warm light-to-dark colour scale instead of green/amber/red.
- "Risk map" link added to the header and the landing page.
- The map works before advisor review, with a visible "awaiting advisor review" note.
