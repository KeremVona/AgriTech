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

Delivered in **TODO-207** and **TODO-208**, the Field GIS Map provides responsive boundary visualization and interactive vector polygon drawing for farm parcels:

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
- **Workspace State Management & TODO-209 Readiness**:
  - Optimistic in-memory parcel merging into active GeoJSON collection with field-scoping preservation.
  - Temporary parcel IDs and canonical `ParcelMapProperties` stamping (`area_hectares`, `area_ha`, `field_id`).
  - Clean handoff boundary for TODO-209 metadata registration (sliding drawer, crop taxonomy, and backend persistence).

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
# Run GIS Field Map test suite (126 tests: geometry, bounds, service policies, routing, drawing topology, HUD policies)
npm run test:map

# Run static linter (oxlint)
npm run lint

# Run TypeScript compilation and Vite production build
npm run build

# Run nearby regression test suites
npm run test:diagnostics
npm run test:assembly
```
