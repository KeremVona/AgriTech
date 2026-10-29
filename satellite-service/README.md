# Satellite NDVI Timeline Service (`satellite-service`)

Standalone FastAPI microservice that computes multi-temporal Sentinel-2 NDVI timelines and generates cloud-masked, colorized NDVI overlay frames for agricultural field parcels.

---

## Getting Started

### Prerequisites
- Python 3.11–3.14 (system Python 3.14 tested with official wheels for `rasterio`, `shapely`, `pyproj`).

### Installation
From the `satellite-service` directory:

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1
# or Linux/macOS: source .venv/bin/activate

# Install development & runtime dependencies
pip install -r requirements-dev.txt
```

### Running the Service

```bash
# Start local development server on port 8100
python -m uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

### Running Tests

```bash
# Run unit & offline tests (skips live network tests by default)
pytest

# Run including live Earth Search network tests
pytest -m live
```

---

## Configuration & Environment Variables

The service loads configuration via `pydantic-settings` from environment variables or a `.env` file (no prefix).

| Variable | Default | Description |
|---|---|---|
| `STAC_URL` | `https://earth-search.aws.element84.com/v1` | Element 84 Earth Search STAC API endpoint |
| `STAC_COLLECTION` | `sentinel-2-l2a` | STAC collection identifier |
| `CACHE_DIR` | `cache` | Directory path for on-disk tile and manifest cache |
| `MAX_AREA_HA` | `1000` | Maximum allowable parcel area in hectares |
| `SCENE_CLOUD_MAX` | `80` | Scene-level `eo:cloud_cover` prefilter threshold (%) |
| `MIN_VALID_FRACTION` | `0.5` | Minimum cloud-free pixel ratio for a scene to become a timeline frame |
| `WORKERS` | `4` | Number of worker threads for parallel scene processing per job |
| `WINDOW_DAYS` | `365` | Length of the analysis timeline window (in days) |
| `GRID_BUFFER_M` | `20` | Spatial buffer around the parcel bounding box in metres |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | Allowed CORS origins (JSON array or list) |

### GDAL Runtime Environment Defaults
Configured automatically at module import in `main.py` before `rasterio` imports:
- `AWS_NO_SIGN_REQUEST=YES` (public AWS S3 COG access without AWS credentials)
- `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR` (avoids unnecessary S3 bucket listing)
- `CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif` (restricts curl VSI handler to GeoTIFFs)
- `GDAL_HTTP_MAX_RETRY=2` (retries on transient HTTP network errors)

---

## API Endpoints

- `GET /health/live`: Liveness check. Returns `{"status": "ok"}`.
- `POST /api/v1/ndvi/jobs`: Submits parcel geometry for NDVI timeline processing.
- `GET /api/v1/ndvi/jobs/{job_id}`: Retrieves job status, progress, frames, and cloud-skipped passes.
- `GET /api/v1/ndvi/frames/{job_id}/{date}.png`: Retrieves generated NDVI RGBA PNG overlay frame for a given date.

---

## Data notes

### Sentinel-2 L2A BOA Reflectance Offset Rule

In January 2022, ESA introduced Processing Baseline `04.00` for Sentinel-2 Level-2A products, adding a radiometric offset (+1000 DN) to prevent negative surface reflectance values over dark targets. In Element 84's Earth Search STAC catalog, Cloud-Optimized GeoTIFFs (COGs) are processed so that offsets are often removed at publication time, tracked by the `earthsearch:boa_offset_applied` metadata property.

Surface reflectance is computed as:
$$\text{refl} = \frac{\text{DN} - \text{offset}}{10000}$$

#### 3-Branch Rule
1. **Branch 1 (`earthsearch:boa_offset_applied is True`):**
   Element 84 has already removed the radiometric offset in the COG asset.
   $$\text{offset} = 0$$
2. **Branch 2 (`earthsearch:boa_offset_applied is not True` AND (`s2:processing_baseline` or `processing:baseline`) $\ge \text{"04.00"}$):**
   The scene uses ESA processing baseline 04.00 or higher and has not had the BOA offset removed by Element 84.
   $$\text{offset} = 1000$$
3. **Branch 3 (All other scenes, i.e., baseline $< \text{"04.00"}$):**
   Pre-2022 legacy products (e.g., baseline `02.xx` or `03.xx`) were produced before ESA added the radiometric offset.
   $$\text{offset} = 0$$

#### Empirical Evidence from Data Spike (Point: 32.601, 38.001 - Konya Plain)
A data spike was conducted querying Earth Search STAC `sentinel-2-l2a` over point $(32.601^\circ\text{E}, 38.001^\circ\text{N})$ across 2021 and 2023:

1. **July 2021 Scene:**
   - **Item ID:** `S2B_36SVH_20210730_1_L2A`
   - **Datetime:** `2021-07-30T08:49:36Z`
   - **Properties:** `earthsearch:boa_offset_applied: True`, `s2:processing_baseline: "05.00"`, `eo:cloud_cover: 0.016%`
   - **Assets:**
     - RED: `.../36/S/VH/2021/7/S2B_36SVH_20210730_1_L2A/B04.tif`
     - NIR: `.../36/S/VH/2021/7/S2B_36SVH_20210730_1_L2A/B08.tif`
     - SCL: `.../36/S/VH/2021/7/S2B_36SVH_20210730_1_L2A/SCL.tif`
   - **Raw DNs:** RED median = 1810.0, NIR median = 2744.0
   - **Offset 0:** median RED refl = 0.1810, median NIR refl = 0.2744, median NDVI = **0.1992**
   - **Offset 1000:** median RED refl = 0.0810, median NIR refl = 0.1744, median NDVI = **0.3601**

2. **July 2023 Scene:**
   - **Item ID:** `S2B_36SVH_20230720_0_L2A`
   - **Datetime:** `2023-07-20T08:49:40Z`
   - **Properties:** `earthsearch:boa_offset_applied: True`, `s2:processing_baseline: "05.09"`, `eo:cloud_cover: 0.013%`
   - **Assets:**
     - RED: `.../36/S/VH/2023/7/S2B_36SVH_20230720_0_L2A/B04.tif`
     - NIR: `.../36/S/VH/2023/7/S2B_36SVH_20230720_0_L2A/B08.tif`
     - SCL: `.../36/S/VH/2023/7/S2B_36SVH_20230720_0_L2A/SCL.tif`
   - **Raw DNs:** RED median = 1593.0, NIR median = 2555.0
   - **Offset 0:** median RED refl = 0.1593, median NIR refl = 0.2555, median NDVI = **0.2198**
   - **Offset 1000:** median RED refl = 0.0593, median NIR refl = 0.1555, median NDVI = **0.4278**

3. **Comparison with Unreprocessed Baseline 03.01 Scene (2021-08-29):**
   - **Item ID:** `S2B_36SVH_20210829_0_L2A` (original baseline `03.01`, `earthsearch:boa_offset_applied: False`)
   - **Raw DNs:** RED median = 1875.0, NIR median = 2672.0
   - **Offset 0:** median RED refl = 0.1875, median NIR refl = 0.2672, median NDVI = **0.1730**

The empirical values confirm that when `earthsearch:boa_offset_applied is True`, the COG pixel values directly represent physical surface reflectance scaled by 10000 (reflectance $\approx 0.16 - 0.27$, dry post-harvest soil). Using $\text{offset}=0$ aligns 2023 NDVI ($0.2198$) with 2021 NDVI ($0.1992$ and $0.1730$). Subtracting 1000 from these assets produces an unphysical red reflectance of $0.059$ and artificially inflates NDVI to $>0.42$.

### Land Cover Verification of Sample Farm Parcels
The sample parcels defined in `frontend/src/data/sampleFarmMap.ts` span coordinates:
- Latitude: $38.000^\circ\text{N}$ to $38.002^\circ\text{N}$
- Longitude: $32.600^\circ\text{E}$ to $32.604^\circ\text{E}$ (rural Konya plain, Türkiye)

Analysis of multi-temporal Sentinel-2 imagery confirms:
1. **Spring Phenology (Peak Vegetative Growth):** On `2023-05-16` (`S2A_36SVH_20230516_0_L2A`), SCL scene classification identifies vegetation (class 4) across the parcel area, with NDVI peaking at **0.6283** (median **0.3520**).
2. **Summer Phenology (Post-Harvest Dry Stubble / Bare Soil):** In July/August 2021 and 2023, SCL classifies the area as bare soil (class 5) and dry vegetation with median NDVI dropping to **~0.20 - 0.22**.
3. **Conclusion:** The sample parcels lie squarely on active winter cereal cropland following the typical central Anatolian rainfed/irrigated wheat phenological cycle.
