# Satellite NDVI Timeline — Design Spec

- **Date:** 2026-10-28
- **Branch:** `feature/satellite-ndvi` (worktree, based on `main` @ `9a5f077`)
- **Status:** Approved design, awaiting spec review
- **Inspiration:** Epic Fields (epicfields.app): Sentinel-2 NDVI "growth movie" per field.

---

## 1. Goal

Add a standalone **`/satellite`** page where a user picks one of the parcels already saved
through the Field Map and sees:

1. an **NDVI movie**: the last ~12 months of Sentinel-2 NDVI images laid over the parcel on the map, played with a slider and play/pause, cross-fading between satellite passes; and
2. an **NDVI chart**: the parcel's average NDVI over time, with cloud-skipped dates shown.

### Success criteria

- Picking a sample or live parcel starts processing. The first frames appear within ~30 s, and a full year finishes in a few minutes.
- Picking the same parcel again in the same week loads instantly from the cache.
- Cloudy passes are kept out of the movie and shown as gaps on the chart.
- The page works on phone width (stacked layout) and every state has a visible message.
- All new tests pass, `npm run build` and `npm run lint` pass, and a browser screenshot of a playing timeline exists.

### Out of scope (do NOT build)

- Crop water demand / Kc / ET₀ / Open-Meteo. NDVI values are not fed into the irrigation engine.
- AI or automatic field-boundary detection. Parcels come only from the existing parcel API.
- Date-range picker, other indices (EVI, NDWI…), export or download, user accounts.
- Any database table or .NET backend change.
- A persistent job queue (Redis, Celery…).

### Do NOT touch

`backend/**`, `ml-service/**`, `docker/postgres/**`, `frontend/src/components/FarmMap/**`,
`frontend/src/pages/FieldMapPage.tsx`, `frontend/src/services/farmMapService.ts`,
`frontend/src/utils/farmMapPage.ts`, `frontend/src/p2p-experimental/**`, and any ML folder.
Importing *from* the farm-map files is allowed. Editing them is not.

---

## 2. Architecture

```
/satellite page (React)
   │ 1. GET parcels  ──────────────►  .NET API  (existing, unchanged)
   │                                   GET /api/v1/spatial/geojson/parcels
   │ 2. POST parcel geometry  ─────►  satellite-service (NEW, FastAPI, port 8100)
   │ 3. poll job status  ◄─────────     │  search Earth Search STAC
   │ 4. GET frame PNGs  ◄──────────     │  read red / nir / scl windows (COG)
   │                                    │  NDVI + SCL cloud mask → PNG + stats
   ▼                                    ▼  cache on disk (docker volume)
Leaflet ImageOverlay ×2 + slider     cache/<job_id>/frames/*.png + manifest.json
```

Fixed decisions (do not revisit):

- The **frontend sends the geometry**. satellite-service never calls the .NET API or the database.
- Jobs are tracked **in memory** and results are stored **on disk**. A restart forgets running jobs, but finished results survive.
- The time window is the **365 days ending on the most recent Monday (UTC)**, so the cache key changes at most once a week.
- satellite-service is a **new top-level folder** that shares no code with `ml-service/`. It copies ml-service's layout conventions: `main.py`, `config.py` with pydantic-settings, `pytest.ini`, `tests/`, a `Dockerfile`, and `requirements.txt`.

---

## 3. satellite-service

### 3.1 Files

```
satellite-service/
  README.md            # how to run, env vars, endpoints
  Dockerfile           # python:3.11-slim, single stage is fine
  requirements.txt     # runtime deps
  requirements-dev.txt # -r requirements.txt + pytest, httpx
  pytest.ini           # testpaths = tests; markers: live
  config.py            # Settings (pydantic-settings)
  geometry.py          # validation, area, cache key, target grid
  ndvi.py              # pure array math: reflectance, NDVI, SCL mask, stats, colorize
  stac.py              # Earth Search search + per-day dedupe
  processor.py         # reads one scene → Frame or Skipped; runs a whole job
  jobs.py              # in-memory job registry + thread pool + manifest IO
  main.py              # FastAPI app, routes, CORS
  tests/
    test_geometry.py
    test_ndvi.py
    test_stac.py
    test_jobs_api.py
    test_live_smoke.py # @pytest.mark.live, skipped by default
```

Runtime dependencies: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`,
`pystac-client`, `rasterio`, `numpy`, `pillow`, `shapely>=2`, `pyproj`. Add nothing else.

### 3.2 Config (`config.py`, env vars, no prefix)

| Setting | Default | Meaning |
|---|---|---|
| `stac_url` | `https://earth-search.aws.element84.com/v1` | STAC API root |
| `stac_collection` | `sentinel-2-l2a` | Collection id |
| `cache_dir` | `cache` | Root of the on-disk cache |
| `max_area_ha` | `1000` | Largest parcel accepted |
| `scene_cloud_max` | `80` | Scene-level `eo:cloud_cover` prefilter (%) |
| `min_valid_fraction` | `0.5` | Frame enters the movie only at or above this |
| `workers` | `4` | Scenes processed in parallel per job |
| `window_days` | `365` | Length of the time window |
| `grid_buffer_m` | `20` | Buffer around the parcel bounding box |
| `cors_origins` | `["http://localhost:5173","http://localhost:3000"]` | CORS |

At import time, `main.py` sets these GDAL env defaults with `os.environ.setdefault`:
`AWS_NO_SIGN_REQUEST=YES`, `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR`,
`CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif`, `GDAL_HTTP_MAX_RETRY=2`.

### 3.3 HTTP contract (the frontend relies on this exactly)

All JSON uses snake_case and all dates are `YYYY-MM-DD` (UTC).

**`POST /api/v1/ndvi/jobs`**

Request:
```json
{ "geometry": { "type": "Polygon", "coordinates": [[[lon, lat], ...]] }, "parcel_id": "optional-string-or-null" }
```
- `geometry` must be a GeoJSON `Polygon` or `MultiPolygon` in lon/lat (EPSG:4326). It must be valid (`shapely.is_valid`), non-empty, and have a geodesic area ≤ `max_area_ha`. Otherwise the response is **422** with `{"detail": "<human readable reason>"}`.
- `parcel_id` is echoed back in the job status only. It is **not** part of the cache key.

Responses:
- **200** with the `JobStatus` when the job already exists in memory with status `queued`, `running` or `done`, or is `done` on disk (cache hit).
- **202** with the `JobStatus` when a new job was started. This includes re-running a job that was previously `failed`, or one whose cache folder has no `manifest.json` (an interrupted run).

**`GET /api/v1/ndvi/jobs/{job_id}`** → **200** `JobStatus`, or **404** `{"detail": "Unknown job"}` when the job is neither in memory nor on disk.

**`GET /api/v1/ndvi/frames/{job_id}/{date}.png`** → `image/png`.
- `job_id` must match `^[0-9a-f]{16}$` and `date` must match `^\d{4}-\d{2}-\d{2}$`. Anything else → **404**. This blocks path traversal; never join unchecked input into a path.
- Send `Cache-Control: public, max-age=604800`.

**`GET /health/live`** → `{"status": "ok"}`.

`JobStatus`:
```json
{
  "job_id": "3f9a0c1b2d4e5f60",
  "parcel_id": "abc" ,
  "status": "queued | running | done | failed",
  "window": { "start": "2025-10-27", "end": "2026-10-26" },
  "bounds": [[south, west], [north, east]],
  "progress": { "processed": 34, "total": 82 },
  "frames": [
    { "date": "2026-05-14", "scene_id": "S2B_35TPF_20260514_0_L2A",
      "mean_ndvi": 0.6123, "valid_fraction": 0.93,
      "png_url": "/api/v1/ndvi/frames/3f9a0c1b2d4e5f60/2026-05-14.png" }
  ],
  "skipped": [
    { "date": "2026-05-09", "scene_id": "S2A_35TPF_20260509_0_L2A",
      "reason": "cloudy | no_data | read_error", "valid_fraction": 0.12 }
  ],
  "error": null
}
```
- `frames` and `skipped` are always sorted by `date` ascending and grow while the job runs.
- `bounds` is set when the job is created; it is the target grid's extent (§3.5).
- `progress.total` is `null` until the STAC search returns.
- `valid_fraction` in `skipped` is `null` for `read_error`.
- `error` is a short message when `status == "failed"` (STAC search failure, for example) and otherwise `null`.
- `mean_ndvi` is rounded to 4 decimals and `valid_fraction` to 2.

### 3.4 Job identity and cache (`geometry.py`, `jobs.py`)

- **Window:** `end` = the most recent Monday on or before today (UTC), and `start` = `end - window_days + 1`.
  Add the comment `# shortcut: weekly cache granularity, newest pass can be up to 7 days old; switch to incremental appends if fresher data is needed`.
- **job_id:** `sha256(canonical_wkb_hex + "|" + start + "|" + end).hexdigest()[:16]`, where `canonical = shapely.normalize(shapely.set_precision(geom, 1e-6))`.
- **Cache layout:** `cache/<job_id>/frames/<date>.png` plus `cache/<job_id>/manifest.json`.
  - `manifest.json` is the full `JobStatus` with `status: "done"`.
  - It is written **only when the job finishes**, atomically: write `manifest.json.tmp`, then `os.replace`.
- **Lookup order** for POST and GET: the in-memory registry first, then `manifest.json` on disk.
- The registry is a `dict[str, Job]` guarded by a `threading.Lock`.
  - Jobs run on a module-level `ThreadPoolExecutor`.
  - Inside a job, scenes are processed with `workers` threads.
  - A per-job lock protects appends to `frames` and `skipped`.
- **Testability:** jobs get the scene processor through dependency injection, the same pattern as `ml-service/plantml_engine.py`'s `predictor_factory`. API tests swap in a fake processor and never touch the network.

### 3.5 Processing pipeline (`stac.py`, `ndvi.py`, `processor.py`)

1. **Search.** Use `pystac_client.Client.open(stac_url).search(collections=[stac_collection], intersects=geometry, datetime=f"{start}/{end}", query={"eo:cloud_cover": {"lt": scene_cloud_max}})`.
2. **One scene per day.** Group items by UTC acquisition date and keep the item with the lowest `eo:cloud_cover`. Ties go to the lexicographically smallest `item.id`, so the result is deterministic.
3. **Target grid.** Built once per job:
   - Take the parcel bounding box in EPSG:4326, buffered by `grid_buffer_m`. Convert metres to degrees at the parcel's centroid latitude.
   - Pixel size is ~10 m: `dy = 10 / 111320` and `dx = 10 / (111320 * cos(lat))`.
   - `width = ceil((east - west) / dx)` and `height = ceil((north - south) / dy)`.
   - The affine transform is `from_origin(west, north, dx, dy)`.
   - `bounds = [[south, west], [north, east]]`, recomputed from the transform so it matches the pixels exactly.
4. **Read.** For each band asset (`red` = B04, `nir` = B08, `scl`), open it with `rasterio.open(asset.href)` and wrap it in `WarpedVRT(src, crs="EPSG:4326", transform=T, width=W, height=H, resampling=...)`.
   - Use `bilinear` for red and nir, and `nearest` for scl.
   - Read band 1 into an array of shape `(H, W)`. All three arrays are now pixel-aligned.
5. **Reflectance.** `refl = (dn - offset) / 10000`, where `offset` is 0 or 1000 according to the rule that Plan Task 1 confirms.
   - Starting hypothesis: if `item.properties.get("earthsearch:boa_offset_applied") is True`, then offset = 0.
   - Otherwise, if `processing:baseline >= "04.00"` (or `s2:processing_baseline`), then offset = 1000.
   - Otherwise offset = 0.
   - Task 1 must verify this against real data and record the result in a code comment that quotes the evidence.
   - DN = 0 is nodata.
6. **NDVI.** `(nir - red) / (nir + red)` as float32. Pixels where `nir + red <= 0`, or where either input is nodata, become NaN.
7. **Mask.**
   - `inside` = the parcel polygon rasterized onto the grid (`rasterio.features.geometry_mask(..., invert=True, all_touched=False)`).
   - `valid` = `inside & isin(scl, {4,5,6,7}) & isfinite(ndvi)`.
   - `valid_fraction = valid.sum() / inside.sum()`.
   - If `inside.sum() == 0` (parcel smaller than one pixel), rasterize again with `all_touched=True`.
8. **Classify the scene.**
   - If every pixel inside is nodata (DN 0), it is `skipped` with reason `no_data`.
   - If `valid_fraction < min_valid_fraction`, it is `skipped` with reason `cloudy`.
   - Otherwise it is a **frame** with `mean_ndvi = nanmean(ndvi[valid])`.
   - Any exception while reading is retried once, then the scene is `skipped` with reason `read_error`. One bad scene never fails the job.
9. **Colorize** (frames only). Produce an RGBA `uint8` image of shape `(H, W, 4)`.
   - Interpolate linearly between the stops below, clamping outside −0.2…0.9.
   - Alpha is 255 where `valid` and 0 everywhere else.
   - Save with Pillow as `frames/<date>.png`.

**NDVI color stops (shared constant, copied identically into the frontend legend):**

| NDVI | Hex |
|---|---|
| −0.2 | `#8c510a` |
| 0.1 | `#d8b365` |
| 0.3 | `#f6e8c3` |
| 0.5 | `#a6d96a` |
| 0.7 | `#1a9641` |
| 0.9 | `#00441b` |

### 3.6 Docker

- `satellite-service/Dockerfile`: base `python:3.11-slim`; `pip install -r requirements.txt` (the rasterio wheels bundle GDAL, so there's no apt GDAL); `EXPOSE 8100`; command `uvicorn main:app --host 0.0.0.0 --port 8100`.
- Add a `satellite-service` entry to `docker-compose.yml`:
  - build `./satellite-service`, port `8100:8100`;
  - named volume `satellite_cache` (name `agritech_satellite_cache`) mounted at `/app/cache`;
  - the `CORS_ORIGINS` env var in the same format as ml-service;
  - a healthcheck on `/health/live`;
  - no `depends_on`.

---

## 4. Frontend

### 4.1 Files

```
frontend/src/types/satellite.ts                      # TS types mirroring §3.3 exactly
frontend/src/services/satelliteService.ts            # createNdviJob, getNdviJob, frameUrl
frontend/src/utils/satelliteTimeline.ts              # pure helpers (tested)
frontend/src/hooks/useNdviJob.ts                     # polling hook built on ndviJobReducer
frontend/src/components/SatelliteTimeline/ParcelList.tsx
frontend/src/components/SatelliteTimeline/SatelliteMap.tsx
frontend/src/components/SatelliteTimeline/TimelinePlayer.tsx
frontend/src/components/SatelliteTimeline/NdviChart.tsx
frontend/src/components/SatelliteTimeline/NdviLegend.tsx
frontend/src/pages/SatellitePage.tsx
frontend/scripts/fixtures/ndvi_job_done.json         # a realistic done JobStatus (≥ 6 frames, ≥ 2 skipped)
frontend/scripts/test_satellite_timeline.js          # node:test, run with --experimental-strip-types
```

Edits to existing files (the only ones allowed):
- `frontend/src/App.tsx`: add a lazy `SatellitePage` with `Suspense`, copying the `FieldMapPage` pattern, at `path="/satellite"`.
- `frontend/src/components/LandingHero/Navbar.tsx`: add a `Link to="/satellite"` with the label **"Satellite NDVI"** right after the "Field GIS" link, using the same classes.
- `frontend/package.json`: add `"test:satellite": "node --experimental-strip-types scripts/test_satellite_timeline.js"`.
- `docker-compose.yml`: see §3.6.

No new npm dependencies. Use `react-leaflet` (already installed) for the map and plain SVG for the chart.

### 4.2 Config

- `VITE_SATELLITE_URL`, defaulting to `http://localhost:8100`. Resolve it the same way `diagnosticsService.ts` resolves `VITE_ML_URL`.
- Parcels: call `resolveFarmMapConfig({...import.meta.env VITE_GIS_* / VITE_API_BASE_URL...})` and `loadParcelMapData({ apiBaseUrl, parcelsPath, mode })`, exactly as `FieldMapPage.tsx` does. This gives sample-data fallback for free when the API is down.

### 4.3 Pure helpers (`utils/satelliteTimeline.ts`)

All functions are pure and covered by `test_satellite_timeline.js`:

- `NDVI_COLOR_STOPS`: the §3.5 table as `[value, hex][]`.
- `toDayNumber(date: string): number` (days since epoch, UTC) and `fromDayNumber(n): string`.
- `frameBlendAt(frames, day)` → `{ before: Frame | null, after: Frame | null, alpha: number }`.
  - `alpha` ∈ [0, 1] is the opacity of `after`.
  - On a frame's exact day: `before` is that frame, `after` is null, and `alpha` is 0.
  - Before the first frame or after the last, clamp to that frame.
  - With 0 frames, both are null.
- `nearestFrame(frames, day)`: used for the date / NDVI / cloud-free label.
- `chartScales(frames, skipped, width, height, padding)` → functions `x(day)` and `y(ndvi)`.
  - The y domain is fixed at [−0.2, 0.9], matching the colors.
  - The x domain is `[window.start, window.end]`.
- `ndviJobReducer(state, action)`: the polling state machine.
  - States: `idle | starting | polling | done | failed | error`.
  - Actions: `select(parcelId)`, `started(status)`, `polled(status)`, `requestFailed(message, kind: 'offline' | 'invalid' | 'other')`, `reset`.
  - A `polled` or `started` action whose `job_id` doesn't match the current job is **ignored**. This is what stops a stale poll from an earlier parcel from overwriting the new one.

### 4.4 Behaviour

**Layout**
- At ≥ 768 px: the parcel list is a left column, the map fills the centre, and the timeline panel (player, legend, chart) sits below the map.
- Below 768 px: all three stack vertically.
- Use the existing Tailwind `ag-*` tokens (see `index.css` and `FieldMapPage`). The base map uses the same Esri World Imagery URL as `FarmMapContainer.tsx`, copied, not imported.

**Parcel list**
- Each row shows name, crop name and area (ha, 2 decimals). Selecting a row, or clicking a parcel polygon on the map, selects it and fits the map to it.
- If the parcel API failed and sample data is shown, display the existing fallback reason, the same way the Field Map does.

**Job**
- On select, call `createNdviJob(geometry, parcelId)`.
- Then poll `getNdviJob` every **2 s** while the status is `queued` or `running`. Stop at `done` or `failed`, on unmount, and when another parcel is selected (use `AbortController`).
- Preload each new frame PNG with `new Image()` as soon as it appears in `frames`.

**Movie**
- Two react-leaflet `ImageOverlay`s using the job's `bounds`, showing `before` (opacity `1 - alpha`) and `after` (opacity `alpha`).
- The slider (`<input type="range">`) covers `toDayNumber(frames[0].date)` to `toDayNumber(frames.at(-1).date)` in day steps. It is disabled until there is at least 1 frame.
- Play/pause advances 1 day every 50 ms and stops at the end. Pressing play at the end restarts from the beginning.
- ← / → move to the previous or next frame date.
- The label reads `<date> · NDVI 0.61 · 93% cloud-free` (from `nearestFrame`).

**Chart**
- An SVG line through the frames' `mean_ndvi`, with a dot per frame and grey ticks on the x axis for `skipped` dates.
- A vertical cursor line follows the slider, and clicking the chart sets the slider to the clicked day.
- Include `role="img"` with an `aria-label`, and a visually hidden `<table>` listing date / NDVI / cloud-free for screen readers.

**Legend**
- A horizontal gradient built from `NDVI_COLOR_STOPS`, labelled −0.2, 0.3 and 0.9.

**States (each one shows text in the timeline panel)**

| State | Message |
|---|---|
| idle | "Pick a parcel to see its satellite timeline." |
| starting / polling | "Processing satellite passes… 34 / 82" (or "Searching satellite archive…" while `total` is null); frames playable as they arrive |
| done with 0 frames | "No cloud-free passes in the last 12 months." |
| failed | the job's `error` plus a **Retry** button (re-POSTs) |
| 422 | the response's `detail` (e.g. parcel too large) |
| offline | "Satellite service is offline." The parcel list and map still work |

---

## 5. Testing

**satellite-service** (`pytest`). The default run uses no network and must pass:
- `test_geometry.py`:
  - rejects non-polygon types, invalid (self-intersecting) and empty geometry, and areas over the limit;
  - gives the same `job_id` for the same geometry with reordered or rotated rings and for coordinates that differ below 1e-6;
  - gives a different `job_id` for a different window;
  - computes the window as the most recent Monday (including when today is Monday).
- `test_ndvi.py`:
  - reflectance with offset 0 and 1000;
  - NDVI on known values;
  - `nir+red=0` → NaN;
  - SCL valid classes;
  - `valid_fraction`, and the `all_touched` fallback for tiny parcels;
  - classification (no_data / cloudy / frame at exactly 0.5);
  - colorize end points and clamping, with transparent alpha for invalid pixels.
- `test_stac.py`: per-day dedupe (lowest cloud cover, deterministic tie-break), using in-memory fake items.
- `test_jobs_api.py` (FastAPI `TestClient`, fake processor, `tmp_path` cache dir):
  - 202 then 200 for the same geometry, and progress growing;
  - `done` writes `manifest.json`;
  - a restart (new registry) still returns 200 from disk;
  - unknown job → 404, bad geometry → 422;
  - a failed search → `failed` with `error`, and re-POST → 202;
  - frame route path-traversal attempts → 404.
- `test_live_smoke.py`, marked `live` and run only with `pytest -m live`: one real Earth Search search plus processing of 1 scene for a small agricultural polygon; asserts a PNG was written and that `mean_ndvi` lies in [−0.2, 1].

**frontend:**
- `npm run test:satellite` covers `frameBlendAt` edges (0, 1 and many frames; exact day; between frames; before and after the range), `nearestFrame`, `chartScales`, `toDayNumber` round-trips, and every `ndviJobReducer` transition, including ignoring a stale job_id. It uses `scripts/fixtures/ndvi_job_done.json`.
- `npm run build` and `npm run lint` must pass. The existing `npm run test:map` must still pass, which proves the farm map is untouched.

**End-to-end (browser):**
- Run satellite-service locally (`uvicorn main:app --port 8100`) and the frontend (`npm run dev`).
- Open `/satellite`, select a parcel, watch the progress count rise and frames appear, then press play.
- Capture a screenshot of a playing timeline plus the chart.
- Test at 375 px width too.

---

## 6. Risks and known limits

- **10 m pixels.** A 1 ha parcel is ~100 pixels, so small parcels look blocky. This is expected and shown honestly.
- **NDVI saturates** at full canopy (above ~0.8). This is a property of NDVI, not a bug.
- **Earth Search availability or latency** controls the first-load time. Cached loads don't depend on it.
- **Sample parcels.** If the parcel API is down, the sample parcels must lie on real farmland for the imagery to be meaningful. Check `frontend/src/data/sampleFarmMap.ts` coordinates during Task 1, and record the result in the completion report. Do not edit that file.
- **Overlay projection.** PNGs are on a lon/lat grid, while Leaflet draws in Web Mercator and stretches `ImageOverlay` linearly. At parcel scale (≤ ~3 km) the distortion is well under one pixel, so this is accepted.
- **Offset rule.** If it's wrong, NDVI values come out biased. Plan Task 1 settles it with evidence before any pipeline code relies on it.
