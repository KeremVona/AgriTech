**Precision AgriTech Field Operations & Crop Health Platform**. Rather than treating irrigation and disease detection as isolated tasks, the system treats a farm as a collection of zoned spatial parcels where environmental telemetry, automated watering decisions, and localized visual crop inspections feed into one single spatial map.

Here is a comprehensive breakdown of how to architect, design, and deliver this as a capstone project.

### Core System Concept

The platform operates around a **Field-Zone hierarchy**:

1. **Zoned Telemetry & Irrigation Engine:** Each field parcel has virtual IoT sensors (soil moisture, temperature, humidity) and real-time open-source weather telemetry (evapotranspiration, precipitation forecasts). An automated scheduler determines daily water needs and issues valve trigger commands.
2. **Vision-Based Crop Health Scanner:** Field workers take or upload photos of plant foliage directly tied to a specific parcel or GPS coordinate. A computer vision service identifies disease/stress class and severity.
3. **Unified Spatial Map (GIS):** An interactive farm map overlays sensor status, automated irrigation valve states, and disease outbreak heatmaps, giving the farm manager complete situational awareness.

### End-to-End System Architecture

```
[ Field Workers / Mobile Web ]     [ Farm Admin / Desktop Dashboard ]
             \                                    /
              \                                  /
         [ Client App: Responsive Web / PWA (Leaflet/Mapbox) ]
                                 |
                                 v
                       [ API Gateway / Backend ]
                                 |
      +--------------------------+--------------------------+
      |                          |                          |
[ Weather APIs ]        [ Irrigation Engine ]       [ Computer Vision Service ]
- Open-Meteo            - FAO-56 Penman-Monteith    - PlantVillage / Custom CNN
- Evapotranspiration    - Water Deficit Logic       - Ingestion & Inference
- Rain Forecasts        - Simulated MQTT Broker     - Severity Scoring
      |                          |                          |
      +--------------------------+--------------------------+
                                 |
                                 v
                     [ Relational Database + GIS ]
                 - PostGIS / PostgreSQL or SQL Spatial
                 - Parcels, Telemetry Logs, Scans
```

### Functional Modules & Technical Specifications

**1. Spatial Parcel & Boundary Management**

- **GeoJSON Field Boundaries:** Allow users to draw polygons on an interactive satellite base layer (Leaflet or Mapbox GL) to define parcels, crop types (e.g., tomatoes, wheat, corn), and soil profiles (sandy loam, clay).
- **Coordinate Tagging:** Every sensor log and image upload is associated with both a `(latitude, longitude)` coordinate and an enclosing `parcel_id`.

**2. Dynamic Irrigation Engine**

- **The Math Model (Simplified FAO-56):** Instead of relying solely on raw soil moisture percentages, calculate crop water needs via reference evapotranspiration ($ET_0$) and crop coefficients ($K_c$):
  $$ET_c = K_c \times ET_0$$
  The daily irrigation requirement is derived by balancing effective rainfall ($P_{eff}$), soil moisture deficit, and $ET_c$.
- **Open-Source Weather Integration:** Ingest live forecast and historical solar radiation/precipitation data via free APIs like **Open-Meteo**.
- **Simulated IoT Pipeline:** Run a lightweight background service that publishes simulated moisture/temperature drops over time via an MQTT broker or background worker queue. When soil moisture drops below the threshold (Management Allowed Depletion), the engine generates an automated watering schedule or dispatches simulated valve actuation events.

**3. Crop Disease Vision Pipeline**

- **Dataset:** Use the widely benchmarked **PlantVillage dataset** (or New Plant Diseases dataset on Kaggle), which covers 38+ classes of healthy and diseased leaves across multiple crops (blight, rust, powdery mildew, etc.).
- **Model Pipeline:**
  - Train or fine-tune a lightweight CNN architecture (e.g., **MobileNetV3**, **EfficientNet-B0**, or **ResNet-18**) using PyTorch or TensorFlow.
  - Export the trained model to **ONNX** or deploy it behind a FastAPI endpoint for low-latency inference.
- **Metadata Attachment:** Each diagnosis records predicted class, confidence percentage, timestamp, geotagged location, and parcel ID.

**4. Outbreak Hotspot & Spatial Risk Layer**

- When disease scans pass a confidence threshold (e.g., $>80\%$), plot them as point clusters on the field map.
- Calculate disease clustering density to flag high-risk zones, giving farm operators clear visual warnings before blight spreads across adjacent parcels.

### Core Data Schema (Relational / Spatial)

| **Table**           | **Key Attributes**                                                              | **Description**                                           |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `fields`            | `id, name, boundary_polygon (GeoJSON/Geometry), area_hectares, made_at`         | Farm property and polygon boundaries.                     |
| `parcels`           | `id, field_id, crop_type, planting_date, soil_type, kc_factor`                  | Individual management zones within a field.               |
| `sensor_telemetry`  | `id, parcel_id, timestamp, soil_moisture_pct, soil_temp, battery_level`         | Time-series sensor log from physical or simulated probes. |
| `weather_cache`     | `id, parcel_id, date, et0, precipitation_mm, temp_max, temp_min`                | Ingested daily environmental variables.                   |
| `irrigation_events` | `id, parcel_id, scheduled_start, duration_minutes, status, water_volume_liters` | Automated or manual watering valve logs.                  |
| `crop_scans`        | `id, parcel_id, image_url, detected_disease, confidence, geom_point, notes`     | Field inspection photos and inference results.            |

### Suggested Technology Stack

- **Frontend:** React with TypeScript, Redux Toolkit, Vanilla Tailwind CSS with no postcss, and Leaflet (`react-leaflet`) or Mapbox GL for interactive polygon drawing and layer switching.
- **Backend:**
  - ASP.NET Core (.NET 10) with EF Core and NetTopologySuite for spatial data handling.
  - Background worker (e.g., Hangfire or HostedService) to run the irrigation scheduling loops and mock sensor streams.
- **Machine Learning / Vision Service:** Python (FastAPI, PyTorch/TensorFlow, OpenCV) containerized separately via Docker.
- **Database:** PostgreSQL with the **PostGIS** extension (optimal for spatial containment queries like `ST_Contains`).

### Detailed Development Roadmap

#### Phase 1: Machine Learning & Disease Progression Slider Engine

_Focus: Computer Vision inference endpoint and image morphing logic._

- **Dataset Preparation:** Filter the **PlantVillage** dataset down to 4 major agricultural staples (e.g., Tomato, Potato, Corn, Apple) across healthy and severe disease states (e.g., Tomato Early Blight, Late Blight, Bacterial Spot).
- **Model Training & Export:** Fine-tune a lightweight CNN (such as `MobileNetV3` or `EfficientNet-B0`) using PyTorch; export weights to `.onnx` for sub-100ms CPU inference.
- **FastAPI Service:** Expose `/api/v1/classify-leaf` accepting multipart image uploads, returning `disease_name`, `confidence`, and `recommended_treatment`.
- **Feature #1 (Disease Progression Slider Engine):**
  - **Asset Curation:** For each supported plant disease, curate a pair (or 3-4 stage sequence) of aligned leaf images: `Stage 0 (Healthy)` $\to$ `Stage 1 (Initial Lesions)` $\to$ `Stage 2 (Severe Necrosis)`.
  - **Frontend Interactive Slider:** Implement an HTML5 Canvas / WebGL image blender. As the user slides from 0% to 100%, perform continuous cross-dissolve with localized contrast masking (revealing chlorosis and necrotic spot textures progressively), accompanied by informative tooltips indicating what biological symptoms appear at each threshold.

#### Phase 2: Spatial Foundation, GIS & Relational Data Layer

_Focus: PostGIS schema, spatial parcel boundaries, and farm management._

- **Spatial Database Setup:** Initialize PostgreSQL with the `postgis` extension.
- **Database Modeling:**
  - `farms` & `parcels`: Store boundary geometry as `GEOMETRY(Polygon, 4326)`, along with crop type, soil type (sandy loam, clay, etc.), and planting date.
  - `sensor_nodes`: Associated with specific parcels, tracking latitude/longitude (`GEOMETRY(Point, 4326)`).
  - `crop_scans`: Store uploaded inspection photos, classification results, timestamps, and geolocation points.
- **Spatial Polygon Editor (Frontend):**
  - Integrate **Leaflet** with `leaflet-geoman` or `leaflet-draw` on top of high-resolution satellite tiles (e.g., Esri World Imagery).
  - Allow users to draw, edit, and delete farm parcel polygons, automatically calculating surface area in hectares/acres.
- **Containment Queries:** Implement spatial endpoints using `ST_Contains(parcel.geom, ST_SetSRID(ST_Point(lng, lat), 4326))` so any GPS-tagged photo or sensor node automatically links to the correct parcel without manual assignment.

#### Phase 3: Telemetry Simulator & Dynamic FAO-56 Irrigation Engine

_Focus: Automated watering mathematics, weather ingestion, and simulated sensor streams._

- **Weather Ingestion Pipeline:** Integrate the free **Open-Meteo API** to fetch daily reference evapotranspiration ($ET_0$), solar radiation, relative humidity, and precipitation forecasts per parcel centroid.
- **FAO-56 Water Deficit Algorithm:**
  1. Calculate crop evapotranspiration:

     $$ET_c = K_c \times ET_0$$

     where $K_c$ is dynamically determined by the crop's current growth stage (Initial, Mid-season, Late-season).

  2. Maintain a daily root-zone soil water balance:

     $$D_{\text{end}} = D_{\text{start}} + ET_c - P_{\text{eff}} - I$$

     _(where $P_{\text{eff}}$ is effective rainfall, and $I$ is irrigation applied).\_

- **Background Telemetry Simulator:**
  - Build a scheduled background worker that ticks every simulated hour.
  - Decay virtual soil moisture percentages according to $ET_c$ and soil drainage parameters.
  - If simulated soil moisture dips below the Management Allowed Depletion (MAD) threshold, dispatch a simulated `VALVE_TRIGGER_OPEN` event, update the database, and record irrigation volume.

#### Phase 4: Interactive 3D Plant Anatomy Explorer (Feature #2)

_Focus: WebGL integration, interactive inspection, and educational labeling._

- **3D Asset Pipeline:**
  - Source free, optimized Low-Poly / Medium-Poly plant models in `.gltf` / `.glb` format from platforms like Sketchfab or Poly Pizza (e.g., Tomato Plant, Corn Stalk, Grapevine).
  - Compress assets using Draco compression or gltf-pipeline to keep model bundle sizes under 3–5 MB for rapid web loading.
- **3D Viewer Component:**
  - Build an interactive viewer using **Three.js** or **React Three Fiber (`@react-three/fiber` / `@react-three/drei`)**.
  - Features: Orbit controls (rotate, zoom, pan), studio lighting presets, and bounding box auto-centering.
- **Hotspot & Symptom Annotation:**
  - Place interactive 3D HTML / SVG pins (raycasted to model mesh vertices) on specific plant regions: **Leaf blade**, **Stem/Stalk**, and **Root collar**.
  - Clicking a pin opens an inspection card demonstrating how common diseases manifest in that specific anatomical area (e.g., click tomato lower stem $\to$ show _Fusarium wilt_ vascular browning).

#### Phase 5: Türkiye Regional Crop Climate Risk Engine (Feature #3)

_Focus: Macro-agricultural risk modeling, regional GeoJSON visualization, and interactive dashboards._

- **Spatial Boundary Data:** Procure or compile a clean GeoJSON dataset representing Türkiye's 7 agricultural/geographic regions (Marmara, Ege, Akdeniz, İç Anadolu, Karadeniz, Doğu Anadolu, Güneydoğu Anadolu) or down to provincial (81 İl) boundaries.
- **Macro Risk Scoring Model:**
  - Fetch regional weather parameters via Open-Meteo / Turkish State Meteorological Service (MGM) data feeds (precipitation anomalies, temperature deviations, consecutive dry days, humidity).
  - Formulate risk index formulas ($0 - 100\%$):
    - **Fungal Disease Risk Index (e.g., Karadeniz / Marmara):** High relative humidity ($>80\%$) + sustained moderate temperatures ($18\text{--}24^\circ\text{C}$) $\to$ High Mildew/Blight vulnerability.
    - **Drought / Heat Stress Index (e.g., Güneydoğu / İç Anadolu):** Extended consecutive dry days ($>25\text{ days}$) + high temperatures ($>35^\circ\text{C}$) $\to$ High irrigation strain.
    - **Frost Risk Index (e.g., Doğu Anadolu / İç Anadolu):** Sudden unseasonal temperature drops ($<0^\circ\text{C}$) during spring bud burst.
- **Choropleth Interactive Map:**
  - Render an interactive Türkiye map layer with dynamic color fills (Green = Low Risk, Amber = Moderate, Red = Severe).
  - Allow clicking any region to reveal a breakdown: active crop vulnerabilities, prevailing weather anomaly percentages, and preventative agronomic advisories.

#### Phase 6: Full Integration, Telemetry Dashboard & Mobile Polish

_Focus: End-to-end user workflows, unified dashboard, and presentation hardening._

- **Unified Farm Dashboard:**
  - Overlay active sensor statuses, real-time valve actuation logs, and disease outbreak point clusters directly on the parcel map.
  - Provide time-series charts (via Chart.js or Recharts) showing the 14-day history of soil moisture vs. automated irrigation events vs. rainfall.
- **Field Inspection Flow (PWA / Mobile Web):**
  - Support in-field photo capture directly from mobile browsers.
  - Read client EXIF/device GPS metadata or click-to-pin on the parcel map, submit to the ML endpoint, and immediately drop an infection marker on the farm view.
- **Demonstration Fixtures:**
  - Prepare a "Demo Trigger" panel allowing you to force sensor moisture drops, inject sudden disease alerts, or simulate extreme weather during your final project evaluation.
