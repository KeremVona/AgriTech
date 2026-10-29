# Satellite NDVI Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Also follow the **ponytail** skill (full level): smallest complete change, no extra features, options or abstractions beyond what a task states.

**Goal:** A standalone `/satellite` page that plays a 12-month Sentinel-2 NDVI movie and chart for a saved parcel, backed by a new Python `satellite-service`.

**Architecture:** The frontend reads parcels from the existing .NET parcel API and POSTs the selected parcel's geometry to a new FastAPI service (port 8100). The service searches Earth Search STAC, reads small red/nir/scl windows from the image files (COGs), computes cloud-masked NDVI, and writes one PNG per clear pass plus a manifest to a disk cache. The page polls the job, cross-fades two Leaflet `ImageOverlay`s along a day slider, and draws an SVG NDVI chart.

**Tech Stack:**
- satellite-service: Python 3.11+, FastAPI, pydantic-settings, pystac-client, rasterio, numpy, pillow, shapely 2, pyproj, pytest.
- frontend: React 19, TypeScript, react-leaflet 5, Tailwind 4, `node:test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-10-28-satellite-ndvi-timeline-design.md`. **Read it fully before Task 1.** Every task implicitly includes the spec sections it names. When the plan and spec disagree, the spec wins; stop and report the conflict.

## Orchestration (main agent: read this first)

You are the **main agent**. You coordinate; subagents implement. Follow `superpowers:subagent-driven-development`:

- **Each task:** dispatch an implementer subagent, then a reviewer subagent that checks spec compliance and code quality, fix anything it finds, then move on.
- **What each implementer gets:** this file's header sections (Goal through Review Focus), its own task text, and the spec path.
- **Working directory:** everything happens in the worktree `F:\Okul\Graduation Project\Project\.claude\worktrees\satellite-ndvi`, on branch `feature/satellite-ndvi`. Never `cd` to the main checkout. Never switch branches.

**Lanes. Two lanes run in parallel and share no files:**

| Lane | Tasks (in order) | Touches |
|---|---|---|
| A: service | 1 → 2 → 3 → 4 → 5 → 6 | `satellite-service/**`, `docker-compose.yml` |
| B: frontend | 7 → 8 → 9 | `frontend/**` |
| Join | 10 (after both lanes finish) | `PROJECT_DETAILS/Reports/Satellite NDVI/**` |

- Within a lane, tasks run strictly in order. Each lane has at most one implementer running at a time.
- **Commits:** subagents stage **explicit paths only** (`git add <files>`, never `git add -A` or `git add .`). If `git commit` fails with `index.lock`, wait 5 s and retry, up to 5 times.
- **Do NOT:** push, open a PR, merge, rebase, edit files on the spec's "Do NOT touch" list, add dependencies beyond the spec's lists, or build anything in the spec's "Out of scope".
- **When blocked** (a test can't pass without breaking the spec, a network outage, a missing tool): mark the task `BLOCKED` with what you tried, and continue the other lane. Do not invent workarounds that change the contract in spec §3.3.
- **After Task 10:** stop. The human's director model (Opus) reviews the branch before anything is merged.

**Shell:** Git Bash on Windows. The Python venv binary is `satellite-service/.venv/Scripts/python` (on Linux/macOS: `.venv/bin/python`). Below, `PY` means that path.

## Global Constraints

- Service port **8100**. Frontend env var **`VITE_SATELLITE_URL`**, default **`http://localhost:8100`**.
- STAC: **`https://earth-search.aws.element84.com/v1`**, collection **`sentinel-2-l2a`**, assets **`red`, `nir`, `scl`**.
- Limits: `max_area_ha = 1000`, `scene_cloud_max = 80`, `min_valid_fraction = 0.5`, `workers = 4`, `window_days = 365`, `grid_buffer_m = 20`, pixel ≈ **10 m**.
- SCL valid classes: **{4, 5, 6, 7}**.
- NDVI color stops (identical in service and frontend): `-0.2 #8c510a`, `0.1 #d8b365`, `0.3 #f6e8c3`, `0.5 #a6d96a`, `0.7 #1a9641`, `0.9 #00441b`.
- `job_id` = first **16 hex** chars of sha256 (spec §3.4). The window ends on the **most recent Monday (UTC)**.
- Poll interval **2 s**. Playback **1 day / 50 ms**.
- Runtime Python deps, exactly: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `pystac-client`, `rasterio`, `numpy`, `pillow`, `shapely>=2`, `pyproj`. Dev deps: `pytest`, `httpx`.
- **No new npm dependencies.**
- Frontend edits to existing files are limited to `App.tsx`, `components/LandingHero/Navbar.tsx` and `package.json`. Nothing under `components/FarmMap/` changes.
- One spec deviation is decided here: pydantic response models live in **`satellite-service/schemas.py`**, mirroring `ml-service/schemas.py`.

## Review Focus

These are inputs the spec implies but its test list doesn't pin down. Each now has a test in the owning task:

1. **Two POSTs for the same parcel at the same moment** (a double-click). Expected: one job. Both responses carry the same `job_id`, and the processor runs once per scene. → Task 5 `test_concurrent_posts_create_one_job`.
2. **Scenes finishing out of order** in the thread pool. Expected: `frames` and `skipped` are still sorted by date in every status response. → Task 5 `test_frames_sorted_when_completed_out_of_order`.
3. **The service restarted mid-job**, leaving PNGs but no `manifest.json`. Expected: re-POST returns 202, reprocesses, and ends `done`, with no error from the existing files. → Task 5 `test_interrupted_run_is_restarted`.
4. **MultiPolygon parcels.** The parcel API type allows them. Expected: accepted, area summed, mask covers every part. → Task 2 `test_multipolygon_accepted_and_area_summed`, Task 3 `test_inside_mask_multipolygon`.
5. **Timezone or DST shifting day math** in the browser. Expected: `toDayNumber`/`fromDayNumber` are pure UTC and round-trip across DST change dates. → Task 7 `day numbers round-trip across DST dates`.

---

## Task 1: Service scaffold, health route, and data spike

**Files:**
- Create: `satellite-service/requirements.txt`, `satellite-service/requirements-dev.txt`, `satellite-service/pytest.ini`, `satellite-service/.gitignore`, `satellite-service/config.py`, `satellite-service/main.py`, `satellite-service/README.md`
- Test: `satellite-service/tests/test_health.py`

**Interfaces:**
- Produces:
  - `config.Settings` (pydantic-settings, every field and default from spec §3.2) and the module-level `settings = Settings()`.
  - `main.create_app(registry=None, today=None) -> FastAPI` (Task 5 fills in the registry; for now it only mounts health and CORS) and the module-level `app = create_app()`.
  - README section **"Data notes"**, which records the offset rule that Task 3 implements.

- [ ] **Step 1: Create the venv and install deps**

```bash
cd satellite-service && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
```
- `requirements.txt` holds the runtime deps from Global Constraints, unpinned except `pydantic>=2` and `shapely>=2`.
- `requirements-dev.txt` is `-r requirements.txt`, then `pytest`, then `httpx`.
- `.gitignore` contains `.venv/`, `cache/`, `__pycache__/`, `.pytest_cache/`.
- Expected: the install succeeds. If `rasterio` has no wheel for the local Python, create the venv with a Python version that has one (3.11–3.13) and note it in the README.

- [ ] **Step 2: Write the failing test** `tests/test_health.py`

```python
def test_health_live():
    client = TestClient(create_app())
    r = client.get("/health/live")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
```
- `pytest.ini`: `testpaths = tests`, plus `markers = live: hits the real Earth Search network`, plus `addopts = -m "not live"`.

- [ ] **Step 3: Run it and confirm it fails.** `PY -m pytest -q`. Expected: ImportError or collection error.

- [ ] **Step 4: Implement `config.py` and `main.py`.**
  - `main.py` sets the four GDAL env defaults from spec §3.2 with `os.environ.setdefault` **before** any rasterio import.
  - It adds CORS from `settings.cors_origins` and the route `GET /health/live`.

- [ ] **Step 5: Run it and confirm it passes.** `PY -m pytest -q`. Expected: `1 passed`.

- [ ] **Step 6: Data spike (throwaway; do not commit the script).** Write a scratch script **outside the repo**, in your temp dir. It must:
  1. Search `sentinel-2-l2a` for one low-cloud scene over point **(32.601, 38.001)** in July 2021, and one in July 2023. That point is the sample parcel's area on the Konya plain, from `frontend/src/data/sampleFarmMap.ts`.
  2. Print each item's `id`, `earthsearch:boa_offset_applied`, `s2:processing_baseline` and `processing:baseline` (whichever exist), and the `red`/`nir`/`scl` hrefs.
  3. Read a ~200 m window of `red` and `nir` around the point, then print the median DN and the median NDVI computed with offset 0 and with offset 1000.
  - Decide the rule: whichever offset makes the 2023 values consistent with 2021 for the same land cover, and with what the item properties claim.

- [ ] **Step 7: Record the findings** in a `## Data notes` section of `satellite-service/README.md`. Include:
  - the rule, written as a 3-branch function in words;
  - the evidence (item IDs, property values, median NDVIs);
  - whether the sample parcels fall on cropland. Look at the 2023 `visual` asset or NDVI; the spec §6 risk asks for this.
  - The README also lists how to run it (`PY -m uvicorn main:app --port 8100`), how to run the tests, and the env vars.

- [ ] **Step 8: Commit**

```bash
git add satellite-service/requirements.txt satellite-service/requirements-dev.txt satellite-service/pytest.ini satellite-service/.gitignore satellite-service/config.py satellite-service/main.py satellite-service/README.md satellite-service/tests/test_health.py
git commit -m "feat(satellite): scaffold service with health route and data notes"
```

---

## Task 2: Geometry validation, window, job id, target grid

**Files:**
- Create: `satellite-service/geometry.py`
- Test: `satellite-service/tests/test_geometry.py`

**Interfaces:**
- Consumes: `config.settings`.
- Produces:
  - `class GeometryError(ValueError)`
  - `parse_parcel_geometry(geojson: dict, max_area_ha: float) -> shapely.geometry.base.BaseGeometry`. Raises `GeometryError` with a human-readable message.
  - `geodesic_area_ha(geom) -> float`
  - `time_window(today: datetime.date, window_days: int) -> tuple[date, date]`
  - `job_id_for(geom, start: date, end: date) -> str`
  - `@dataclass(frozen=True) class TargetGrid: transform: affine.Affine; width: int; height: int; bounds: list[list[float]]`. `bounds` is `[[south, west], [north, east]]`.
  - `target_grid(geom, buffer_m: float, pixel_m: float = 10.0) -> TargetGrid`

- [ ] **Step 1: Write the failing tests**

```python
SQUARE = {"type": "Polygon", "coordinates": [[[32.6, 38.0], [32.602, 38.0], [32.602, 38.002], [32.6, 38.002], [32.6, 38.0]]]}

def test_rejects_non_polygon():            # Point, LineString → GeometryError
def test_rejects_self_intersecting():       # bow-tie polygon → GeometryError, message mentions "invalid"
def test_rejects_empty():                   # {"type":"Polygon","coordinates":[]} → GeometryError
def test_rejects_over_area_limit():         # ~0.05° square (~2000 ha) with max_area_ha=1000 → GeometryError, message mentions "1000"
def test_square_area():                     # geodesic_area_ha(SQUARE) ≈ 3.85 ha (abs tol 0.1)
def test_multipolygon_accepted_and_area_summed():  # two disjoint SQUARE-sized parts → area ≈ 2 × single
def test_job_id_stable_under_ring_rotation_and_jitter():
    # same SQUARE with ring rotated by one vertex and coordinates +4e-7 → identical job_id; len == 16, all hex
def test_job_id_changes_with_window():
def test_window_ends_on_most_recent_monday():
    assert time_window(date(2026, 10, 28), 365) == (date(2025, 10, 27), date(2026, 10, 26))   # Wednesday
    assert time_window(date(2026, 10, 26), 365) == (date(2025, 10, 27), date(2026, 10, 26))   # Monday itself
def test_target_grid_covers_buffered_bbox():
    g = target_grid(shape(SQUARE), buffer_m=20)
    # bounds south < 38.0 - 0.00017 and north > 38.002 + 0.00017; width, height in 20..30;
    # transform.a > 0, transform.e < 0; bounds recomputed from transform (north == transform.f)
```

- [ ] **Step 2: Run them and confirm they fail.** `PY -m pytest tests/test_geometry.py -q`. Expected: ImportError.

- [ ] **Step 3: Implement `geometry.py`.**
  - Parsing: `shapely.geometry.shape`. The type must be in `{"Polygon", "MultiPolygon"}`, and `is_empty`/`is_valid` are checked.
  - Area: `pyproj.Geod(ellps="WGS84").geometry_area_perimeter(geom)[0]`, taking the absolute value ÷ 10 000.
  - Canonical form and window: exactly as in spec §3.4. The window includes the `# shortcut:` comment from the spec.
  - Grid: built as in spec §3.5 step 3, using `rasterio.transform.from_origin`.

- [ ] **Step 4: Run them and confirm they pass.** Expected: all pass.

- [ ] **Step 5: Commit** `geometry.py` and `tests/test_geometry.py` with the message `feat(satellite): geometry validation, window, job id, grid`.

---

## Task 3: NDVI math, cloud mask, classification, colorize

**Files:**
- Create: `satellite-service/ndvi.py`
- Test: `satellite-service/tests/test_ndvi.py`

**Interfaces:**
- Consumes: `geometry.TargetGrid`, and the offset rule from the README "Data notes" written in Task 1.
- Produces:
  - `SCL_VALID: frozenset[int] = frozenset({4, 5, 6, 7})`
  - `NDVI_COLOR_STOPS: list[tuple[float, str]]` (the Global Constraints values)
  - `boa_offset(properties: dict) -> int`, returning 0 or 1000 per the Data notes rule
  - `reflectance(dn: np.ndarray, offset: int) -> np.ndarray`: float32, NaN where `dn == 0`
  - `compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray`: float32, NaN where either input is NaN or `red + nir <= 0`
  - `inside_mask(geom, grid: TargetGrid) -> np.ndarray` (bool, `(H, W)`), with the `all_touched=True` fallback when the first pass is empty
  - `@dataclass class SceneStats: valid: np.ndarray; valid_fraction: float; mean_ndvi: float | None; all_nodata: bool`
  - `scene_stats(ndvi: np.ndarray, scl: np.ndarray, inside: np.ndarray) -> SceneStats`. `all_nodata` means no finite NDVI inside.
  - `classify(stats: SceneStats, min_valid_fraction: float) -> Literal["frame", "cloudy", "no_data"]`
  - `colorize(ndvi: np.ndarray, valid: np.ndarray) -> np.ndarray`: uint8 `(H, W, 4)`

- [ ] **Step 1: Write the failing tests**

```python
def test_boa_offset_branches():          # one assert per branch of the Data-notes rule (3 property dicts)
def test_reflectance_offsets():
    assert reflectance(np.array([2000]), 0)[0] == pytest.approx(0.2)
    assert reflectance(np.array([2000]), 1000)[0] == pytest.approx(0.1)
    assert np.isnan(reflectance(np.array([0]), 1000)[0])
def test_ndvi_known_values():            # red .1, nir .5 → 0.6667 (abs 1e-4)
def test_ndvi_zero_sum_is_nan():         # red 0, nir 0 → NaN; red NaN → NaN
def test_scene_stats_valid_classes():    # 4x4 inside-all, scl = [4,5,6,7 | 8,9,3,10 | ...]; only {4,5,6,7} counted; valid_fraction exact
def test_inside_mask_tiny_parcel_falls_back_to_all_touched():   # parcel 3 m × 3 m → mask.sum() >= 1
def test_inside_mask_multipolygon():     # two parts far apart in one grid → both regions True, gap False
def test_classify_boundaries():
    # all_nodata → "no_data"; valid_fraction 0.49 → "cloudy"; exactly 0.5 → "frame"
def test_colorize_endpoints_and_alpha():
    # ndvi -0.5 → rgb of #8c510a (clamped); 0.9 and 1.2 → #00441b; 0.3 → #f6e8c3; invalid pixel alpha 0; valid alpha 255; dtype uint8
```

- [ ] **Step 2: Run them and confirm they fail.** Expected: ImportError.

- [ ] **Step 3: Implement `ndvi.py`.**
  - Mask: `rasterio.features.geometry_mask([geom], out_shape=(grid.height, grid.width), transform=grid.transform, invert=True)`.
  - Colorize: `np.interp` per channel over the stop values.
  - `boa_offset` gets a comment quoting the Task 1 evidence (item IDs and values).

- [ ] **Step 4: Run them and confirm they pass.**

- [ ] **Step 5: Commit** `ndvi.py` and `tests/test_ndvi.py` with the message `feat(satellite): ndvi math, scl mask, colorize`.

---

## Task 4: STAC search, per-day dedupe, scene processor, live smoke test

**Files:**
- Create: `satellite-service/schemas.py`, `satellite-service/stac.py`, `satellite-service/processor.py`
- Test: `satellite-service/tests/test_stac.py`, `satellite-service/tests/test_live_smoke.py`

**Interfaces:**
- Consumes: `geometry.*`, `ndvi.*`, `config.settings`.
- Produces:
  - `schemas.Frame(BaseModel)`: `date: str, scene_id: str, mean_ndvi: float, valid_fraction: float, png_url: str`
  - `schemas.Skipped(BaseModel)`: `date: str, scene_id: str, reason: Literal["cloudy","no_data","read_error"], valid_fraction: float | None`
  - `schemas.Progress(BaseModel)`: `processed: int, total: int | None`
  - `schemas.Window(BaseModel)`: `start: str, end: str`
  - `schemas.JobStatus(BaseModel)`: every field in spec §3.3, using the models above
  - `schemas.JobRequest(BaseModel)`: `geometry: dict, parcel_id: str | None = None`
  - `stac.search_items(geom, start: date, end: date) -> list[pystac.Item]` (network)
  - `stac.one_per_day(items: Iterable) -> list`. It needs only `.id`, `.datetime` and `.properties["eo:cloud_cover"]`, and returns items sorted by date ascending.
  - `processor.process_scene(item, geom, grid: TargetGrid, frames_dir: Path, job_id: str) -> Frame | Skipped`

- [ ] **Step 1: Write the failing tests** `tests/test_stac.py`, using `types.SimpleNamespace` fake items

```python
def test_one_per_day_keeps_lowest_cloud():       # two items same UTC date, cloud 30 and 10 → the 10 one
def test_one_per_day_tie_breaks_on_id():         # same date, same cloud → lexicographically smaller id
def test_one_per_day_sorted_and_uses_utc_date(): # item at 2026-05-14T23:30Z and 2026-05-15T00:10Z → two dates, ascending
```

- [ ] **Step 2: Run them and confirm they fail.** Expected: ImportError.

- [ ] **Step 3: Implement `schemas.py`, `stac.py` and `processor.py`.**
  - `search_items` uses the exact `search(...)` call from spec §3.5 step 1, followed by `list(search.items())`.
  - `process_scene`, for one item:
    - read the three bands with `WarpedVRT` onto `grid`, as in spec §3.5 step 4 (helper `_read_band(href, grid, resampling) -> np.ndarray`);
    - compute `reflectance` (via `boa_offset(item.properties)`), then `compute_ndvi`, `inside_mask`, `scene_stats` and `classify`;
    - for a frame: `colorize`, then save to `frames_dir / f"{date}.png"`;
    - set `png_url = f"/api/v1/ndvi/frames/{job_id}/{date}.png"`;
    - round `mean_ndvi` to 4 decimals and `valid_fraction` to 2.
  - Any exception while reading or computing is retried once. A second failure gives `Skipped(reason="read_error", valid_fraction=None)`; log it at WARNING.

- [ ] **Step 4: Run them and confirm they pass.** `PY -m pytest -q`. Expected: all non-live tests pass.

- [ ] **Step 5: Write `tests/test_live_smoke.py`** (`@pytest.mark.live`).
  - Use the polygon `[[32.6,38.0],[32.602,38.0],[32.602,38.002],[32.6,38.002],[32.6,38.0]]` (a sample parcel on the Konya plain) and the window 2023-07-01 to 2023-07-31: `search_items` → `one_per_day` → `process_scene` on the first item with `eo:cloud_cover < 20`, writing into `tmp_path`.
  - Assert the result is a `Frame`, the PNG exists, `-0.2 <= mean_ndvi <= 1`, and `0.5 <= valid_fraction <= 1`.

- [ ] **Step 6: Run the live test.** `PY -m pytest -m live -q`. Expected: `1 passed`. If the network is down, mark the step BLOCKED in the report; don't fake it.

- [ ] **Step 7: Commit** the five files with the message `feat(satellite): stac search, dedupe, scene processor`.

---

## Task 5: Job registry and HTTP API

**Files:**
- Create: `satellite-service/jobs.py`
- Modify: `satellite-service/main.py`
- Test: `satellite-service/tests/test_jobs_api.py`

**Interfaces:**
- Consumes:
  - `schemas.*`, `geometry.parse_parcel_geometry / time_window / job_id_for / target_grid`, and `config.settings`;
  - `stac.search_items` + `stac.one_per_day`, and `processor.process_scene` (default wiring only).
- Produces:
  - `jobs.SearchFn = Callable[[BaseGeometry, date, date], list]`, which must return deduped items.
  - `jobs.ProcessFn = Callable[[Any, BaseGeometry, TargetGrid, Path, str], Frame | Skipped]`
  - `jobs.JobRegistry(cache_dir: Path, search: SearchFn, process: ProcessFn, workers: int)`, with:
    - `.submit(geom, parcel_id: str | None, start: date, end: date, grid: TargetGrid) -> tuple[JobStatus, bool]`, where the bool is True if a new run started;
    - `.get(job_id: str) -> JobStatus | None`;
    - `.frame_path(job_id: str, date: str) -> Path | None`, which returns None unless both regexes from spec §3.3 match and the file exists.
  - `main.create_app(registry: JobRegistry | None = None, today: Callable[[], date] | None = None) -> FastAPI`. The default registry uses the real search (`one_per_day(search_items(...))`) and `process_scene`.

- [ ] **Step 1: Write the failing tests**
  - Build `create_app(registry=JobRegistry(tmp_path, fake_search, fake_process, workers=4), today=lambda: date(2026, 10, 28))`.
  - `fake_search` returns N `SimpleNamespace` items with dates. `fake_process` returns a `Frame` or `Skipped` based on the item and writes a 1×1 PNG for frames.
  - Helper: `wait_done(client, job_id, timeout=5)` polls GET until the status is in `{done, failed}`.

```python
def test_post_202_then_200_same_job():          # 1st POST 202, 2nd POST 200, same job_id; window == {"start":"2025-10-27","end":"2026-10-26"}
def test_progress_grows_and_done_writes_manifest():  # fake_process sleeps 0.05 s; observe processed increase; final done; manifest.json exists; frames sorted
def test_cache_hit_after_restart():             # finish job, build a NEW registry on same tmp_path → POST returns 200 status done, GET returns 200
def test_unknown_job_404():
def test_bad_geometry_422():                    # LineString → 422 with "detail"
def test_search_failure_marks_failed_and_retry_restarts():  # fake_search raises → status failed, error non-empty; swap to working search; re-POST → 202
def test_frame_route_rejects_traversal():       # GET /api/v1/ndvi/frames/..%2F..%2Fsecret/2026-01-01.png and /frames/<job>/../../x.png → 404
def test_frame_route_serves_png():              # status 200, content-type image/png, Cache-Control contains max-age=604800
def test_concurrent_posts_create_one_job():     # 8 threads POST same geometry simultaneously → 1 distinct job_id, fake_process call count == N items
def test_frames_sorted_when_completed_out_of_order():  # fake_process sleeps longer for earlier dates → every polled status has frames sorted by date
def test_interrupted_run_is_restarted():        # pre-create tmp_path/<job_id>/frames/2026-05-14.png with no manifest → POST 202 → done
```

- [ ] **Step 2: Run them and confirm they fail.** Expected: ImportError or 404s.

- [ ] **Step 3: Implement `jobs.py`.**
  - **Registry:** a `dict[str, _Job]` guarded by one `threading.Lock`. `submit` holds the lock while it looks up and inserts, which is what makes concurrent POSTs collapse into one job.
  - **Executors:** an outer `ThreadPoolExecutor` runs jobs; each job runs scenes on an inner pool with `workers` threads.
  - **Status snapshot:** a per-job lock guards appends. `JobStatus` snapshots sort `frames` and `skipped` by date.
  - **Lookup order:** memory first, then `manifest.json`. A memory job with status `failed`, or a folder with no manifest, counts as a new run: `frames_dir.mkdir(parents=True, exist_ok=True)` and existing PNGs get overwritten.
  - **Manifest write:** `manifest.json.tmp` then `os.replace`, only on `done`.
  - **Search failure:** status `failed`, `error = f"Satellite search failed: {exc}"`.

- [ ] **Step 4: Wire the routes in `main.py`.**
  - `POST /api/v1/ndvi/jobs`: parse with `parse_parcel_geometry`, mapping `GeometryError` to 422 `{"detail": str(e)}`. Then `time_window(today(), settings.window_days)` → `target_grid` → `registry.submit`. Return 202 if a new run started, otherwise 200.
  - `GET /api/v1/ndvi/jobs/{job_id}`: 200 or 404 `{"detail": "Unknown job"}`.
  - `GET /api/v1/ndvi/frames/{job_id}/{date}.png`: `FileResponse(path, media_type="image/png", headers={"Cache-Control": "public, max-age=604800"})`, or 404.

- [ ] **Step 5: Run the full suite and confirm it passes.** `PY -m pytest -q`. Expected: all pass, live skipped.

- [ ] **Step 6: Manual check.** Run `PY -m uvicorn main:app --port 8100`, POST the SQUARE geometry with curl, poll until `done`, then open one `png_url` in the browser. Expected: a green or brown PNG with a transparent outside.

- [ ] **Step 7: Commit** `jobs.py`, `main.py` and `tests/test_jobs_api.py` with the message `feat(satellite): job registry and ndvi api`.

---

## Task 6: Docker image and compose entry

**Files:**
- Create: `satellite-service/Dockerfile`, `satellite-service/.dockerignore` (`.venv`, `cache`, `tests`, `__pycache__`)
- Modify: `docker-compose.yml` (append a service and a volume only; do not reorder or edit the other services)

**Interfaces:**
- Consumes: `main:app`.
- Produces: compose service `satellite-service` on `8100:8100`, volume `satellite_cache` (name `agritech_satellite_cache`) mounted at `/app/cache`.

- [ ] **Step 1: Write the Dockerfile and compose entry** as in spec §3.6. The healthcheck copies ml-service's `python -c urllib...` form, against `http://localhost:8100/health/live`. `CORS_ORIGINS` uses the same value as ml-service.

- [ ] **Step 2: Build it.** `docker compose build satellite-service`. Expected: success.

- [ ] **Step 3: Run it.** `docker compose up -d satellite-service`, then `curl http://localhost:8100/health/live`. Expected: `{"status":"ok"}`, and `docker compose ps` shows it healthy. If Docker isn't available, mark these two steps BLOCKED and continue.

- [ ] **Step 4: Commit** the two new files and `docker-compose.yml` with the message `feat(satellite): docker image and compose service`.

---

## Task 7: Frontend types, pure timeline helpers, fixture, tests

**Files:**
- Create: `frontend/src/types/satellite.ts`, `frontend/src/utils/satelliteTimeline.ts`, `frontend/scripts/fixtures/ndvi_job_done.json`, `frontend/scripts/test_satellite_timeline.js`
- Modify: `frontend/package.json` (add the `test:satellite` script from spec §4.1 only)

**Interfaces:**
- Produces, in `types/satellite.ts`, types that mirror spec §3.3 field for field:
  - `NdviFrame`, `NdviSkipped`, `NdviJobStatus`, and `NdviJobPhaseStatus = 'queued' | 'running' | 'done' | 'failed'`
  - `SatelliteErrorKind = 'offline' | 'invalid' | 'other'`
  - the state type:

```ts
export type NdviJobState =
  | { phase: 'idle' }
  | { phase: 'starting'; parcelId: string }
  | { phase: 'polling' | 'done' | 'failed'; parcelId: string; job: NdviJobStatus }
  | { phase: 'error'; parcelId: string; kind: SatelliteErrorKind; message: string };
export type NdviJobAction =
  | { type: 'select'; parcelId: string }
  | { type: 'started'; parcelId: string; status: NdviJobStatus }
  | { type: 'polled'; parcelId: string; status: NdviJobStatus }
  | { type: 'requestFailed'; parcelId: string; kind: SatelliteErrorKind; message: string }
  | { type: 'reset' };
```
- Produces, in `utils/satelliteTimeline.ts`:
  - `NDVI_COLOR_STOPS: ReadonlyArray<readonly [number, string]>`
  - `toDayNumber(date: string): number` and `fromDayNumber(day: number): string`
  - `frameBlendAt(frames: NdviFrame[], day: number): { before: NdviFrame | null; after: NdviFrame | null; alpha: number }`
  - `nearestFrame(frames: NdviFrame[], day: number): NdviFrame | null`
  - `chartScales(window: { start: string; end: string }, width: number, height: number, padding: number): { x: (day: number) => number; y: (ndvi: number) => number; dayAt: (px: number) => number }`. The y domain is fixed at [-0.2, 0.9]; `dayAt` is the inverse of `x`, rounded to a whole day.
  - `ndviJobReducer(state: NdviJobState, action: NdviJobAction): NdviJobState`

- [ ] **Step 1: Write the fixture.** A `done` `NdviJobStatus` with 8 frames across 2025-11 to 2026-10, 3 skipped (one of each reason), realistic `mean_ndvi`, and bounds around the sample parcel at (32.6, 38.0).

- [ ] **Step 2: Write the failing tests** in `test_satellite_timeline.js`, using the style of `scripts/test_farm_map_page.js` (`node:test` plus `assert/strict`, importing `../src/utils/satelliteTimeline.ts`).

```js
test('day numbers round-trip across DST dates')        // '2026-03-29','2026-10-25','2024-02-29' → fromDayNumber(toDayNumber(d)) === d; consecutive dates differ by exactly 1
test('frameBlendAt with no frames')                    // {before:null, after:null, alpha:0}
test('frameBlendAt with one frame clamps everywhere')  // any day → before === that frame, after null, alpha 0
test('frameBlendAt exact frame day')                   // before = frame, after = null, alpha 0
test('frameBlendAt between frames')                    // frames d0, d0+10; day d0+4 → before d0, after d0+10, alpha 0.4
test('frameBlendAt outside range clamps')              // before first → first frame; after last → last frame; alpha 0
test('nearestFrame picks closest, ties to earlier')
test('chartScales maps domain to padded range and dayAt inverts x')  // y(-0.2) == height-padding, y(0.9) == padding
test('reducer: select → starting; started → polling/done/failed by status')
test('reducer ignores started/polled for another parcel or job')     // started/polled with a parcelId ≠ current, or polled with job_id ≠ current job → same state object returned
test('reducer: requestFailed for current parcel → error; for other parcel ignored')
test('reducer: reset → idle')
```

- [ ] **Step 3: Run them and confirm they fail.** `cd frontend && npm install && npm run test:satellite`. Expected: an import failure.

- [ ] **Step 4: Implement `types/satellite.ts` and `utils/satelliteTimeline.ts`.** Day math uses `Date.UTC` and `toISOString().slice(0, 10)` only; never local-time `Date` getters. The reducer returns the **same state object** for ignored actions.

- [ ] **Step 5: Run them and confirm they pass.** `npm run test:satellite`. Expected: all pass.

- [ ] **Step 6: Commit** the four new files and `frontend/package.json` (plus `package-lock.json` only if `npm install` changed it) with the message `feat(satellite-web): timeline helpers, types, reducer`.

---

## Task 8: Satellite service client and polling hook

**Files:**
- Create: `frontend/src/services/satelliteService.ts`, `frontend/src/hooks/useNdviJob.ts`
- Test: extend `frontend/scripts/test_satellite_timeline.js`

**Interfaces:**
- Consumes: `types/satellite.ts`, `ndviJobReducer`.
- Produces:
  - `SATELLITE_URL: string`, resolved like `VITE_ML_URL` in `services/diagnosticsService.ts:11-13`, defaulting to `'http://localhost:8100'`.
  - `class SatelliteRequestError extends Error { kind: SatelliteErrorKind }`
  - `createNdviJob(opts: { geometry: Polygon | MultiPolygon; parcelId: string; signal?: AbortSignal; baseUrl?: string; fetchImpl?: typeof fetch }): Promise<NdviJobStatus>`
  - `getNdviJob(opts: { jobId: string; signal?: AbortSignal; baseUrl?: string; fetchImpl?: typeof fetch }): Promise<NdviJobStatus>`
  - `frameUrl(pngUrl: string, baseUrl?: string): string`, which joins with exactly one `/`.
  - `useNdviJob(parcel: { id: string; geometry: Polygon | MultiPolygon } | null): { state: NdviJobState; retry: () => void }`

- [ ] **Step 1: Write the failing tests** using a fake `fetchImpl`

```js
test('createNdviJob posts geometry and parcel_id as JSON')   // method POST, url `${base}/api/v1/ndvi/jobs`, body {geometry, parcel_id}
test('createNdviJob maps 422 to invalid with detail message')
test('network failure maps to offline')                        // fetchImpl rejects TypeError → kind 'offline'
test('500 maps to other')
test('frameUrl joins base and path with one slash')            // 'http://x:8100/' + '/api/...' → 'http://x:8100/api/...'
```

- [ ] **Step 2: Run them and confirm they fail.** `npm run test:satellite`. Expected: an import failure.

- [ ] **Step 3: Implement `satelliteService.ts`.** A 422 body's `detail` becomes the message. Abort errors are re-thrown untouched, so callers can ignore them.

- [ ] **Step 4: Implement `useNdviJob.ts`.** No unit test: it's covered by the reducer tests plus the Task 10 browser check.
  - Use `useReducer(ndviJobReducer)`.
  - On a parcel change: dispatch `select`, then create the job.
  - While the phase is `polling`, `setTimeout` 2000 ms → `getNdviJob` → `polled`.
  - An `AbortController` per parcel is aborted on change or unmount.
  - `retry` re-runs create for the current parcel.
  - Preload each new frame with `new Image().src = frameUrl(...)`.

- [ ] **Step 5: Run the checks.** `npm run test:satellite && npm run lint`. Expected: both pass.

- [ ] **Step 6: Commit** the three files with the message `feat(satellite-web): service client and polling hook`.

---

## Task 9: Satellite page, components, route, navbar link

**Files:**
- Create: `frontend/src/components/SatelliteTimeline/{ParcelList,SatelliteMap,TimelinePlayer,NdviChart,NdviLegend}.tsx`, `frontend/src/pages/SatellitePage.tsx`
- Modify: `frontend/src/App.tsx` (lazy route), `frontend/src/components/LandingHero/Navbar.tsx` (one link)

**Interfaces:**
- Consumes:
  - `resolveFarmMapConfig` (`utils/farmMapPage.ts`) and `loadParcelMapData` (`services/farmMapService.ts`), import only;
  - `ParcelFeatureCollection` (`types/farmMap.ts`);
  - Task 7 helpers and Task 8 `useNdviJob` + `frameUrl`.
- Produces (component props):
  - `ParcelList({ parcels: ParcelFeatureCollection['features']; selectedId: string | null; onSelect: (id: string) => void })`
  - `SatelliteMap({ parcels; selectedId; onSelect; overlay: { bounds: [[number, number], [number, number]]; before: { url: string; opacity: number } | null; after: { url: string; opacity: number } | null } | null })`
  - `TimelinePlayer({ frames: NdviFrame[]; day: number | null; onDayChange: (day: number) => void })`
  - `NdviChart({ job: NdviJobStatus; day: number | null; onDayChange: (day: number) => void })`
  - `NdviLegend()`
  - `SatellitePage()`, a named export like `FieldMapPage`

- [ ] **Step 1: Build the components and the page** to spec §4.4. Exact copy:
  - the five state messages in the spec table;
  - the label format `<date> · NDVI 0.61 · 93% cloud-free`;
  - the navbar label `Satellite NDVI`.

  Notes:
  - The page loads parcels once with `loadParcelMapData({ apiBaseUrl, parcelsPath, mode, signal })`, exactly as `FieldMapPage` configures it. If `fallbackReason` is set, show it.
  - Skip features whose geometry is null. Fall back to `"Unnamed parcel"` when `name` is empty.
  - When frames first arrive, the day starts at the last frame's day.
  - The map fits the selected parcel with `map.fitBounds` via a small `useMap` child component.
  - Use `ImageOverlay` with `opacity`, and keep both overlays mounted so changes don't flicker.

- [ ] **Step 2: Wire the route and the link.** Add the lazy `SatellitePage` + `Suspense` route at `/satellite`, matching the existing `FieldMapPage` pattern in `App.tsx`. Add the navbar `Link` right after "Field GIS", with identical classes.

- [ ] **Step 3: Run the checks.** `npm run build && npm run lint && npm run test:satellite && npm run test:map`. Expected: all pass. `test:map` passing proves the farm map is unaffected.

- [ ] **Step 4: Smoke test without the service.** Run `npm run dev` and open `/satellite` with satellite-service stopped. Expected: parcels are listed, and selecting one shows "Satellite service is offline." No console errors other than the failed fetch.

- [ ] **Step 5: Commit** the new files, `App.tsx` and `Navbar.tsx` with the message `feat(satellite-web): satellite ndvi page`.

---

## Task 10: End-to-end check and completion report (join)

**Files:**
- Create: `PROJECT_DETAILS/Reports/Satellite NDVI/SAT-NDVI-completion.md`, `PROJECT_DETAILS/Reports/Satellite NDVI/screenshots/*.png`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run every check fresh and record the outputs.**
  - Service: `PY -m pytest -q` and `PY -m pytest -m live -q`.
  - Frontend: `npm run build`, `npm run lint`, `npm run test:satellite`, `npm run test:map`.

- [ ] **Step 2: Browser end-to-end.**
  - Start the service (`PY -m uvicorn main:app --port 8100`) and `npm run dev`. Open `/satellite` and select a parcel.
  - Confirm the progress count rises and frames appear before the job is done. Wait for `done`, press play, click the chart, and use the arrow keys.
  - Select the same parcel again and confirm it loads instantly (cache).
  - Switch parcels mid-job and confirm no frames from the old parcel appear.
  - Screenshots: desktop playing, the chart with its cursor, and 375 px width. Save them under `screenshots/`.

- [ ] **Step 3: Write the completion report** following `PROJECT_DETAILS/Phase Plans/Task Completion.md`. Include:
  - status; files created or modified; the test commands with their pass counts;
  - the Task 1 data findings (offset rule plus evidence, sample parcels on cropland or not);
  - each Review Focus item with its test name;
  - anything BLOCKED, and known limits (spec §6).

- [ ] **Step 4: Commit** the report and screenshots with the message `docs(satellite): completion report`.

- [ ] **Step 5: Stop.** Do not push, open a PR or merge. Report to the human: the branch name, the commit list (`git log --oneline main..HEAD`), and the report path.
