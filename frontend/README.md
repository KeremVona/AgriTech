# AgriTech - Frontend Client

The frontend client for the **Precision AgriTech Platform**, built with **React**, **TypeScript**, **Vite**, and **pure Tailwind CSS v4**.

## Overview

The client application powers farm managers and field workers with interactive spatial tools:

- **GIS Field Map (Core)**: Full-viewport interactive spatial map powered by Leaflet and React Leaflet, displaying RFC 7946 GeoJSON parcel boundaries over satellite imagery and street cartography.
- **Disease Progression Studio**: WebGL/Canvas leaf disease progression cross-dissolve engine and epidemiological microclimate simulation.
- **3D Plant Anatomy Explorer**: Three.js / React Three Fiber interactive low-poly crop models with anatomical hotspot callouts.
- **Regional Risk Engine**: Türkiye 7-region / 81-province climate risk choropleth dashboard.

---

## GIS Field Map (`/map`)

Delivered in **TODO-207**, **TODO-208**, and **TODO-209**, the Field GIS Map provides responsive boundary visualization, interactive vector polygon drawing, and sliding metadata registration for farm parcels:

### Routes
- `/map` — Main interactive farm map canvas displaying all loaded field parcels.
- `/fields/:fieldId/parcels` — Scoped field route filtering the parcel collection to a specific field ID and auto-framing its spatial extent. Displays an honest empty state if the field has no matching parcels.
- `/field-map` — Backward-compatible route redirecting immediately to `/map`.

### Core Capabilities
- **React Leaflet 5 & Leaflet 1.9.4**: Single persistent `<MapContainer />` mounted on an isolated stacking surface (`isolation: isolate`) below a fixed 64px header.
- **Dual Basemap Providers**:
  - **Satellite (Default)**: Esri World Imagery (`maxNativeZoom: 19`, supported display zoom up to 22 via client-side overzooming).
  - **Streets**: OpenStreetMap standard tiles with full contributor attribution.
  - Active tile error detection with nonblocking retry and fallback provider switching.
- **Intelligent Viewport & Bounds Fitting**:
  - Converts GeoJSON `[longitude, latitude]` coordinates to Leaflet `[latitude, longitude]` bounds via `L.latLngBounds`.
  - Automatically frames parcel extents on initial load or extent change using 48px desktop padding and asymmetrical mobile safe padding.
  - Preserves user pan and zoom positions across basemap switches, window resizes, and identical data reloads.
  - `ResizeObserver` listener with `requestAnimationFrame` debouncing invokes `map.invalidateSize()` to eliminate gray tile gaps or layout artifacts.
- **Custom Frosted-Glass HUD Controls (SPEC-UI-008)**:
  - Top-Right: Segmented Satellite / Streets layer switch with active indicator.
  - Bottom-Right: Vertical zoom dock (+ / −) and parcel recenter button (disabled when no parcel bounds exist).
  - Bottom-Left: Live mouse cursor / touch center coordinates (`Lat, Lng`) with metric and imperial scale bars.
  - Top-Left: Fixed North compass indicator.
  - Bottom Safe Zone: 72px mobile margin (`calc(72px + env(safe-area-inset-bottom))`) prevents Leaflet attribution and HUD controls from colliding with mobile system gestures or navigation bars.
  - Accessible touch targets: All interactive controls satisfy the minimum 48 × 48 px mobile touch standard with visible focus rings.
- **Code Splitting**:
  - `FieldMapPage` is lazily loaded via `React.lazy()` in `App.tsx`, sequestering Leaflet, Geoman, and Turf.js into a dedicated chunk to keep the initial application bundle lean.

### Interactive Vector Polygon Drawing (TODO-208)
- **Geoman Drawing Engine & Custom Toolbar**:
  - Integrated via `@geoman-io/leaflet-geoman-free` with custom 40px touch-target controls docked at top-left (`z-[1000]`).
  - Controls:
    - `[Draw Polygon]` — Interactive polygon drawing with precision rubber-band guide line (`2px dashed #0F766E`) and vertex snapping (20px snap distance).
    - `[Edit Vertices]` — Move vertex nodes or click midpoints to reshape existing boundaries.
    - `[Drag Parcel]` — Translate entire parcel boundaries across the spatial canvas.
    - `[Delete Parcel]` — Direct removal mode with instant deletion feedback.
    - `[Cancel / Finish]` — Reset any active tool back to idle.
- **Precision Ag Styling & Custom Handles**:
  - High-visibility Bio-Teal stroke (`#0F766E`, 2px dashed during drawing, 2px solid rendered) with 14% translucent fill (`rgba(15, 118, 110, 0.14)`).
  - Main vertex handles: 10px circular nodes with `#0F766E` fill and white border; expand to 14px on hover/drag.
  - Midpoint handles: 6px circular nodes for inserting new vertices.
- **Real-Time Geodesic Metrics HUD (`<DrawingLiveAreaBadge />`)**:
  - Docked at top-center (`top-4 left-1/2 -translate-x-1/2 z-[1000]`) with frosted-glass card styling.
  - Real-time Turf.js geodesic calculations on every vertex update:
    - `areaHa` (hectares to 2 decimal places), `acres` (acres to 2 decimal places), `vertexCount`, and `perimeterM` (perimeter in meters).
    - Format: `1.84 ha (4.55 acres) • 5 Vertices • Perimeter: 542m`.
- **Topological Kink Detection & Alerting**:
  - Powered by `@turf/kinks` to detect self-intersections (bowties / figure-8s) in real time before parcel completion.
  - On kink detection:
    - In-progress stroke and fill transition to high-visibility warning red (`#EF4444` stroke, 22% fill).
    - Pulsing 16px red warning markers (`<KinkMarkersLayer />`) appear at exact intersection coordinates.
    - Top-center HUD transitions to assertive warning alert: *"Self-intersecting polygon. Uncross boundary lines to complete parcel."*
    - Hard submission lockout: Self-intersecting polygons cannot be completed or saved until uncrossed.
- **Keyboard Accessibility**:
  - Global `[ESC]` key shortcut immediately aborts in-progress drawing, editing, dragging, or deletion and returns map state to idle.
- **Workspace State Management & TODO-209 Integration**:
  - Optimistic in-memory parcel merging into active GeoJSON collection with field-scoping preservation.
  - Temporary parcel IDs and canonical `ParcelMapProperties` stamping (`area_hectares`, `area_ha`, `field_id`).
  - Seamless handoff between vector drawing completion and metadata drawer presentation.

### Parcel Metadata Drawer & Agronomic Attributes (TODO-209)
- **Sliding Parcel Metadata Drawer (`<ParcelMetadataDrawer />`)**:
  - **Motion Engineering**: Apple fluid spring kinematics (`cubic-bezier(0.16, 1, 0.3, 1)` over 320ms duration).
  - **Responsive Shell**:
    - **Desktop (≥768px)**: Fixed right-docked sliding panel (`w-[440px]`, `z-[1201]`, `h-full`) with accessible header, close/back button, and scrollable content body.
    - **Mobile (<768px)**: Modal bottom sheet (`max-h-[88vh]`, `z-[1201]`, rounded top corners) with tactile grab handle (`w-36px h-4px`) and safe-area padding (`env(safe-area-inset-bottom)`).
  - **Backdrop Overlay**: Frosted dark backdrop (`z-[1200]`, `rgba(15, 23, 42, 0.45)`, `backdrop-blur(2px)`) with click-to-dismiss behavior.
  - **Accessibility & Focus**: Focus trapping within drawer dialog, auto-focus on parcel name field upon opening, and global `[ESC]` dismissal. Input fields enforce 16px minimum font size on mobile to prevent iOS Safari auto-zooming.
  - **Geometry Metrics Summary**: Live banner displaying computed area in hectares, acres, perimeter in meters, and vertex count.
  - **Form Controls & Domain Fields**:
    - **Parcel Name**: Required text input with real-time whitespace and length validation.
    - **Crop Selector (`<CropSelector />`)**: Visual radio card grid featuring 4 canonical crops (`Tomato`, `Corn`, `Potato`, `Apple`) with distinct emoji, botanical family badges (`Solanaceae`, `Poaceae`), and active palette borders.
    - **Soil Texture Profile (`<SoilSelector />`)**: 4 canonical soil textures (`Clay`, `Loam`, `Sandy Loam`, `Silt Loam`) displaying volumetric field capacity (θ_FC) and agronomic descriptions.
    - **Planting Date & DAP Badge**: Date picker with live calculation of Days After Planting (DAP) and phenological growth stage badge (`Pre-Planting`, `Early / Germination`, `Development Stage`, `Mid-Season / Flowering`, or `Late / Maturity`).
- **Dynamic Crop Color Categorization (`CROP_PALETTES`)**:
  - Distinct agronomic color palettes mapped dynamically across vector polygon boundaries:
    - **Tomato**: `#10B981` (Emerald) — Stroke `#10B981`, Fill `rgba(16, 185, 129, 0.18)`
    - **Corn** (*Zea mays*): `#F59E0B` (Amber) — Stroke `#F59E0B`, Fill `rgba(245, 158, 11, 0.18)`
    - **Potato**: `#8B5CF6` (Purple) — Stroke `#8B5CF6`, Fill `rgba(139, 92, 246, 0.18)`
    - **Apple**: `#EC4899` (Rose/Pink) — Stroke `#EC4899`, Fill `rgba(236, 72, 153, 0.18)`
    - **Unassigned / Fallback**: `#0F766E` (Bio-Teal) — Stroke `#0F766E`, Fill `rgba(15, 118, 110, 0.18)`
  - **Selected Polygon State**: High-contrast 3px stroke with dedicated white/accent outline (`farm-map-parcel-selected`) to clearly distinguish the active parcel during inspection or editing.
- **Persistent Centroid Tooltip Micro-Badges (`<ParcelCentroidLabelsLayer />`)**:
  - **Polygon Centroid Mathematics**: Implements signed area center-of-mass formula (`calculatePolygonCentroid`) to accurately place labels at the true geometric center of arbitrary convex and concave polygon boundaries.
  - **Zoom Density Threshold**: Micro-badges automatically toggle density based on map zoom:
    - **Zoom ≥ 14**: Detailed micro-badges rendered at parcel centroids displaying crop emoji, crop name, parcel title, and computed area (e.g. `🍅 Tomato • North Field (1.45 ha)`).
    - **Zoom < 14**: Badges declutter or hide to avoid visual collisions when viewing regional or farm-wide extents.
  - **Synchronized Interaction**: Clicking a centroid badge selects the parcel and opens the `<ParcelMetadataDrawer />` in edit mode.
- **Spatial CRUD API & Offline Resilience (`farmMapService.ts`)**:
  - **Endpoints & Operations**:
    - `saveParcel` — Creates new parcel boundary with metadata (`POST /api/v1/parcels`).
    - `updateParcelMetadata` — Updates attributes and boundary of an existing parcel (`PUT /api/v1/parcels/:id`). Also called automatically when a saved parcel is reshaped or dragged; on failure the previous shape is restored.
    - `deleteParcelBoundary` — Deletes parcel boundary and metadata (`DELETE /api/v1/parcels/:id`), always after an explicit confirmation.
  - **Resilient Policy Matrix**:
    - Writes **never fall back**: in `auto` and `api` mode every create, update and delete goes to the live API, and any failure (network, timeout, HTTP error) is shown as an error notice with nothing saved.
    - Writes stay local only when the map is showing sample data — `sample` mode, or `auto` mode after loading fell back to the bundled parcels — and the notice says so (*"not sent to the server"*).

---

## Parcel Water Dashboard (`/parcels/:parcelId/irrigation`)

Delivered in **TODO-307**, **TODO-308** and **TODO-309** (Phase 3, Track C). One page per parcel answers three operator questions: how wet is the parcel and where is it heading, is it about to need water, and is the valve running. Design spec: [`docs/superpowers/specs/2026-11-20-phase3-irrigation-frontend-design.md`](../docs/superpowers/specs/2026-11-20-phase3-irrigation-frontend-design.md).

### Entry point
Open a saved parcel on the Field Map; the edit drawer shows **Open water dashboard**. The link carries display hints (`?name=…&crop=…&soil=…`) that are used before data loads and by sample mode; live data always wins. The route is lazy-loaded, so Recharts stays out of the landing and map chunks.

### Components (`src/components/Irrigation/`)
- `<DeficitGauge currentMoisture fieldCapacity wiltingPoint mad … />` — 240° SVG gauge of root-zone depletion as % of Readily Available Water. Zones: green `< 50 %`, yellow `50–100 %` (labelled *Irrigation soon* from 75 %), red `≥ 100 %`. Shows hours until the automatic trigger (API value, else a 24 h least-squares drying trend), a stale badge after 2 h, and a "Soil profile not set" state.
- `<ParcelTelemetryChart parcelId />` — Recharts dual-axis chart: soil VWC line (dashed forecast), ETc line, stacked effective-rain and irrigation bars, Drainage / Readily available / Stress bands with FC and MAD lines. 24 h (hourly), 7 d and 30 d (UTC days + 7-day forecast) windows; tooltips list exact values and flags such as `Valve opened: 45 min (Automatic)`.
- `<IrrigationControlCard parcelId />` — live valve badge (`Closed`, `Opening`, `Pumping: X L/min`, `Stopping`), countdown to cutoff, next automatic run, **Water now** dialog (15 / 30 / 45 / 60 min, estimated volume) and **Emergency stop** with confirmation. Optimistic updates with rollback; double clicks send one request; polls that were sent before a write settled are discarded.

All maths and state transitions live in tested pure modules: `models/waterBalanceModel.ts`, `models/telemetryChartModel.ts`, `models/valveControlModel.ts`, `services/irrigationSampleData.ts`, `services/irrigationService.ts`.

### Data modes (`VITE_IRRIGATION_DATA_MODE`)
- **`auto` (Default)**: live API. Read-only views fall back to deterministic sample data on HTTP 404 / 5xx, network failure or a 5000 ms timeout, with a header notice and per-widget `Sample` tags. **Valve controls are disabled whenever the valve status is sample data** (*"Controls unavailable — live data unavailable"*); manual start/stop requests never fall back.
- **`api`**: strict live mode; each widget shows its own error with Retry.
- **`sample`**: offline demo; manual watering drives an in-memory valve simulator tagged `Simulated`.

Polling: water budget, valve status and the gauge's 24 h feed every `VITE_IRRIGATION_POLL_MS` (default 15000, min 5000); the chart every 60 s. Polling pauses while the tab is hidden and refreshes on return.

### Proposed backend contract (not yet implemented — TODO-301–306)
| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/v1/parcels/{id}/water-budget` | Soil constants, current moisture, hours until trigger, flow rate |
| `GET` | `/api/v1/parcels/{id}/telemetry?window=24h\|7d\|30d` | Chart points, soil constants, irrigation events |
| `GET` | `/api/v1/parcels/{id}/irrigation/status` | Valve state, active / next / last event, server time |
| `POST` | `/api/v1/parcels/{id}/irrigate-manual` | Body `{ "durationMinutes": 15\|30\|45\|60 }` → `202` event, `409` if a run is active |
| `POST` | `/api/v1/parcels/{id}/irrigation/{eventId}/abort` | Emergency stop → `200` event |

Full JSON shapes and error rules are in spec §6. Moisture values are percent; soil constants given as fractions (as stored in `soil_profiles`) are converted automatically.

---

## Environment Configuration

Configuration is managed via frontend-local environment files (e.g. `frontend/.env.local`). Copy the provided template to get started:

```powershell
cp frontend/.env.example frontend/.env.local
```

> **Note:** Vite runs from the `frontend/` directory and reads `frontend/.env.local`, **not** the root `.env`.

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_GIS_API_BASE_URL` | `http://localhost:5051` | GIS API base URL. Defaults to `VITE_API_BASE_URL` or the ASP.NET Core Kestrel port (`5051`). |
| `VITE_GIS_PARCELS_PATH` | `/api/v1/spatial/geojson/parcels` | Path to the parcel GeoJSON endpoint. Update this single path when TODO-205 field-scoped CRUD endpoints become available. |
| `VITE_GIS_DATA_MODE` | `auto` | Data loading policy: `auto`, `api`, or `sample`. |
| `VITE_IRRIGATION_DATA_MODE` | `auto` | Parcel Water Dashboard data policy: `auto`, `api`, or `sample` (see above). |
| `VITE_IRRIGATION_POLL_MS` | `15000` | Dashboard poll interval in ms (minimum 5000). |

### Data Modes (`VITE_GIS_DATA_MODE`)
- **`auto` (Default)**: Attempts to fetch live parcels from the backend. On availability failures (HTTP 5xx, HTTP 404, network error, or 5000ms timeout), gracefully falls back to bundled demonstration parcels with an explicit status banner (*"Sample data — live data unavailable"*) and a retry button. Hard errors (HTTP 401/403, 429, invalid contract) display an error banner without substituting sample data.
- **`api`**: Strict live API mode. Never substitutes sample data. Any network or server failure surfaces as an explicit error banner with a retry action.
- **`sample`**: Instant offline demonstration mode. Makes zero network calls to the backend API and immediately loads two fictional demonstration parcels located in rural Türkiye.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24 LTS recommended)
- `npm` (packaged with Node)

---

## Getting Started

### 1. Install Dependencies

```powershell
npm install
```

### 2. Start the Development Server

```powershell
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### 3. Build for Production

```powershell
npm run build
```

Build output will be placed in `dist/`.

---

## Testing & Quality Gates

The frontend employs unit test suites, static analysis, and type checking:

```powershell
# Run every frontend test suite (all test:* scripts, including the referenced-asset check)
npm test

# Run GIS Field Map test suite (217 tests: geometry, bounds, service policies, routing, drawing topology, HUD policies, metadata policies, styling tokens, drawer state, and spatial CRUD)
npm run test:map

# Run Parcel Water Dashboard suites (water balance, chart model, valve control, sample data, service/config/routes)
npm run test:irrigation

# Run static linter (oxlint)
npm run lint

# Run TypeScript compilation and Vite production build
npm run build

# Run nearby regression test suites
npm run test:diagnostics
npm run test:assembly
```
