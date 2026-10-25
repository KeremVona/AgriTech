# TODO-207 Completion Report: Farm Map Core Implementation

**Status:** DONE  
**Task ID:** FRONT-207 / TODO-207  
**Assignee:** Senior Front-End Engineer & Frontend GIS Specialist  
**Phase:** Phase 2 — Spatial Foundation, GIS & Relational Data Layer  
**Branch:** `feat/frontend-todo207-farm-map-core`  
**Base Commit:** `b6be602`  
**Commit Range:** `28b1712..6235b63`  
**Spec References:** `design/SPATIAL_PARCEL_BOUNDARY_SPEC.md` (`SPEC-UI-008`), `PROJECT_DETAILS/Phase Plans/Phase 2.md` (TODO-207)  
**Foundations:** `design/FOUNDATIONS.md`, `design/MOTION_AND_INTERACTION.md`, `design/MOBILE_AND_OUTDOOR_SPEC.md`

---

## 1. Executive Summary

TODO-207 delivers the production-ready **Farm Map Core** module (`<FarmMapContainer />`) and interactive spatial workspace (`/map`), establishing the spatial visualization anchor of the Precision AgriTech Platform.

Built with **React Leaflet 5.0.0** and **Leaflet 1.9.4** on top of React 19, TypeScript 6, Vite 8, and Tailwind CSS v4, this feature renders field parcel boundaries compliant with RFC 7946 GeoJSON directly onto multi-layer cartographic and satellite imagery. It bridges the PostGIS spatial queries delivered in TODO-201–204 with a high-performance, responsive web GIS frontend.

### Key Capabilities Delivered:
1. **Interactive Spatial Map Engine (`<FarmMapContainer />`):** Mounts a single persistent Leaflet map instance on an isolated stacking context (`isolation: isolate`) below a 64px header, with zero canvas flickering or gray tile gaps.
2. **Dual Basemap Providers:** Seamless switching between **Esri World Imagery** (high-resolution satellite) and **OpenStreetMap** (standard cartography), retaining polygon vector overlays and viewport state across transitions.
3. **Automated Extent Framing:** Calculates geometric bounding boxes from WGS 84 (`EPSG:4326`) `[longitude, latitude]` coordinates and automatically frames parcels using Leaflet `[latitude, longitude]` bounds with safe desktop/mobile padding and reduced-motion animation guards.
4. **Resilient Data Sourcing & Offline Fallback:** A dedicated service layer supporting three modes (`auto`, `api`, `sample`) with a 5,000 ms timeout, `AbortController` cancellation, and graceful fallback to bundled fictional demonstration parcels upon backend availability failure (5xx, 404, network failure, or timeout).
5. **Frosted-Glass HUD Controls (SPEC-UI-008):** Custom segmented basemap control, bottom-right vertical zoom/recenter dock, bottom-left live cursor coordinate readout with dual metric/imperial scale bars, and a North compass. All interactive elements meet 48 × 48 px mobile touch targets with clear keyboard focus.
6. **Mobile Safe Zone & Layout:** Dedicated bottom safe margin (`calc(72px + env(safe-area-inset-bottom))`) prevents HUD elements and Leaflet provider attribution from colliding with mobile gesture bars, while an accessible 48px mobile refresh button guarantees full control across all viewports.
7. **Lazy Route Code-Splitting:** The map workspace is lazily loaded via `React.lazy()` in `App.tsx`, sequestering Leaflet and GIS dependencies into a dedicated ~171 kB chunk to keep the main application bundle fast.

---

## 2. Acceptance Criteria Mapping

| Acceptance Criterion | Requirement | Implementation & Verification | Status |
| :--- | :--- | :--- | :--- |
| **AC 1: React Leaflet Map Engine** | Deliver `<FarmMapContainer />` using React Leaflet 5 and Leaflet 1.9.4 with React 19 compatibility. | Verified peer graph (`react-leaflet@5.0.0`, `leaflet@1.9.4`, `react@19.2.8`). Single persistent container prevents duplicate map crashes under React StrictMode. | **PASSED** |
| **AC 2: Satellite & Street Switching** | Provide satellite and street base layers with satellite selected by default; parcel overlays retained across switches. | Satellite uses Esri World Imagery (`maxNativeZoom: 19`, display zoom up to 22 via client overzooming); Street uses OpenStreetMap. Polygons and view state persist seamlessly across switches. | **PASSED** |
| **AC 3: Parcel Auto-Centering** | Center the map automatically on parcel boundaries using `L.latLngBounds` and `fitBounds`. | Implemented in `FarmMapViewport.tsx`. Derives Leaflet bounds from raw coordinate streams (handling holes and MultiPolygons); fits bounds on initial data or extent change; preserves user pan during re-renders. | **PASSED** |
| **AC 4: Clean Tile Rendering** | Render tiles without sizing flicker, gaps, or gray artifacts across resizing and orientation shifts. | Implemented via `ResizeObserver` with `requestAnimationFrame` debouncing and `map.invalidateSize({ pan: false, debounceMoveend: true })`. Verified across window resizes, hide/reveal, and route changes. | **PASSED** |
| **AC 5: Mobile & Responsive Layout** | Accommodate mobile (390px), tablet (768px), and widescreen (1440px) layouts with accessible controls. | Full height canvas (`calc(100dvh - 64px)`), 48px mobile touch targets, 72px bottom safe margin, non-obscuring header status, and responsive information menu tested across all viewports. | **PASSED** |
| **AC 6: Backend-Ready with Fallback** | Support live TODO-204 feed with explicit, honest fallback to sample data when backend is unavailable. | `farmMapService.ts` implements `auto`, `api`, and `sample` modes. 5s timeout + AbortController. Verified against live backend on port 5051, controlled failure mocks, and bundled fictional sample parcels. | **PASSED** |

---

## 3. Changes Made

### Files Created
- `frontend/src/types/farmMap.ts` — Type definitions for GeoJSON FeatureCollection, Parcel properties, bounding boxes, data sources, and GIS data modes (`auto | api | sample`).
- `frontend/src/utils/farmMapGeometry.ts` — Pure geometry parsing and bounding box calculator: validates RFC 7946 Polygon/MultiPolygon structures, normalizes properties, and converts WGS 84 `[lng, lat]` coordinates into Leaflet `[[lat, lng], [lat, lng]]` bounds without browser/Leaflet DOM dependencies.
- `frontend/src/data/sampleFarmMap.ts` — Bundled deterministic sample GeoJSON dataset containing two adjacent fictional parcels located in rural Türkiye (Aydın region) with UUID-format IDs and canonical metadata fields.
- `frontend/src/services/farmMapService.ts` — Resilient data access service with 5,000 ms timeout, `AbortController` cancellation, and policy-driven fallback on availability failures (HTTP 5xx, 404, network failure, timeout).
- `frontend/src/hooks/useFarmMapData.ts` — React lifecycle hook managing async request state, request-generation guards against race conditions, error state, and manual reload dispatching.
- `frontend/src/components/FarmMap/FarmMapContainer.tsx` — Main interactive map component rendering the persistent `MapContainer`, tile layers, vector parcel polygons, tile error notifications, and HUD controls.
- `frontend/src/components/FarmMap/FarmMapViewport.tsx` — Viewport lifecycle controller managing `map.fitBounds()`, `ResizeObserver` debouncing, and pan/zoom preservation.
- `frontend/src/components/FarmMap/FarmMapControls.tsx` — Custom frosted glass HUD controls (basemap segmented button, vertical zoom/recenter dock, coordinate and scale readouts, North compass).
- `frontend/src/components/FarmMap/farmMapPolicy.ts` — Pure helper module defining viewport framing bounds, coordinate formatting, and scale calculation algorithms.
- `frontend/src/components/FarmMap/farmMap.css` — Scoped map surface stylesheet: isolated stacking context, vh/dvh sizing, frosted glass glassmorphism tokens, 72px mobile safe zone, and 48px touch targets.
- `frontend/src/pages/FieldMapPage.tsx` — Lazily loaded field GIS workspace page composing the map container, navigation header, field dropdown selector, status announcements, and contextual menu.
- `frontend/src/pages/fieldMapPage.css` — Header, status notice, and mobile responsive layout styling for the field map page.
- `frontend/src/utils/farmMapPage.ts` — Environment variable resolution, field ID/name extraction, and field-scoped parcel filtering utilities.
- `frontend/.env.example` — Template and comprehensive documentation for frontend-local environment variables (`VITE_GIS_API_BASE_URL`, `VITE_GIS_PARCELS_PATH`, `VITE_GIS_DATA_MODE`).
- `frontend/scripts/test_farm_map_data.js` — Unit test suite verifying GeoJSON parsing, bounds computation, service fallback policies, timeout handling, and cancellation guards (78 tests).
- `frontend/scripts/test_farm_map_viewport.js` — Unit test suite verifying framing margins, coordinate formatting, and scale bar calculations.
- `frontend/scripts/test_farm_map_page.js` — Unit test suite verifying environment resolution, configuration errors, and field-scoping filters (11 tests).
- `PROJECT_DETAILS/Reports/Phase 2/TODO-207-farm-map-core.md` — Formal milestone completion report (this document).

### Files Modified
- `frontend/package.json` — Added dependencies `leaflet@^1.9.4`, `react-leaflet@^5.0.0`, dev dependencies `@types/leaflet@^1.9.22`, `@types/geojson@^7946.0.16`, and script `test:map`.
- `frontend/package-lock.json` — Recorded resolved dependency tree and locked versions.
- `frontend/src/App.tsx` — Registered lazy routes for `/map` and `/fields/:fieldId/parcels`, plus redirect for `/field-map`.
- `frontend/src/components/LandingHero/Navbar.tsx` — Updated desktop and mobile Field GIS navigation links to point to `/map` using React Router `Link`.
- `frontend/README.md` — Documented GIS Field Map architecture, routes, environment configuration, tile providers, and verification scripts.

---

## 4. Implementation Details

### 4.1. Coordinate Reference Systems & Bounds Derivation
GeoJSON RFC 7946 specifies coordinates in order of **`[longitude, latitude]`** (X, Y) referenced to WGS 84 (`EPSG:4326`). Conversely, Leaflet's API expects coordinates in order of **`[latitude, longitude]`** (Y, X).

In `frontend/src/utils/farmMapGeometry.ts`:
- Parsing strictly enforces RFC 7946 compliance: verifies valid `Polygon` or `MultiPolygon` geometries, closed rings ($\ge 4$ points), and coordinate ranges ($-180 \le \text{lng} \le 180$, $-90 \le \text{lat} \le 90$).
- Bounding boxes are derived from the actual coordinate stream of all rings and parts, ignoring optional server-provided `bbox` headers:
  $$\text{minLat} = \min(y_i), \quad \text{minLng} = \min(x_i), \quad \text{maxLat} = \max(y_i), \quad \text{maxLng} = \max(x_i)$$
- Returns Leaflet-ready bounds `[[minLat, minLng], [maxLat, maxLng]]` or `null` for empty collections.
- This conversion is strictly isolated to utility boundaries; domain models and GeoJSON features retain standard RFC 7946 ordering.

### 4.2. Resilient Data Service & Policy Matrix
`farmMapService.ts` encapsulates network requests to the GIS endpoint with an `AbortController` and a strict 5,000 ms timeout window:

```
[Request Start]
       │
       ├── Timeout (5,000 ms) ───────────────► [Abort & Handle]
       │
       ├── HTTP 200 + Valid GeoJSON ─────────► [Live Data (source: 'api')]
       │
       ├── Availability Failure:
       │     - Network Error / Connection Refused
       │     - Timeout (5,000 ms)
       │     - HTTP 404 Not Found / 501 Not Implemented
       │     - HTTP 5xx Server Errors
       │        ├── mode: 'auto' ────────────► [Bundled Sample Data (source: 'sample', fallbackReason set)]
       │        └── mode: 'api'  ────────────► [Surface Error Banner (No Fallback)]
       │
       └── Hard Contract / Client Failure:
             - HTTP 400, 401, 403, 408, 409, 422, 429
             - Invalid JSON or Malformed GeoJSON Contract
                └── Any mode ────────────────► [Surface Error Banner (Never Fallback)]
```

When falling back in `auto` mode, the previous map state remains visible while retrying, preventing jarring screen flashes. Retrying replaces the collection atomically; live and sample parcels are never mixed.

### 4.3. React Leaflet Architecture & Persistent MapContainer
Under React 19 and React Leaflet 5:
- `MapContainer` props (`center`, `zoom`) are immutable after initial mounting. Attempting to update view properties directly on `MapContainer` causes silent failures or full canvas remounts.
- `FarmMapContainer.tsx` maintains a single persistent `MapContainer` wrapped in an isolated stacking context (`isolation: isolate`) to prevent Leaflet panes from covering application navigation.
- Child component `FarmMapViewport.tsx` leverages the `useMap()` hook:
  - Listens to container resizing via `ResizeObserver`, debounced with `requestAnimationFrame`.
  - Dispatches `map.invalidateSize({ pan: false, debounceMoveend: true })` only when positive dimensions are detected, completely preventing gray tile gaps during layout reflows or sidebar toggles.
  - Value-compares bounding boxes before invoking `map.fitBounds()`. User panning or zooming is strictly preserved across unrelated re-renders, basemap switches, or identical data reloads.

### 4.4. Tile Layer Configuration & Native Zoom Clamping
Both basemap providers are configured to support high-zoom inspection of agricultural parcel details:
- **Esri World Imagery:**
  - Tile URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  - Attribution: `Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`
  - Clamped via `maxNativeZoom: 19`, with `maxZoom: 22` shared between `MapContainer` and `TileLayer`. This enables client-side overzooming of high-resolution satellite imagery up to zoom level 22 without triggering 404 tile errors.
- **OpenStreetMap:**
  - Tile URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Attribution: `© OpenStreetMap contributors`
  - Native zoom limit 19.
- **Tile Error Resilience:** Tile load errors are intercepted nonblockingly; an accessible warning card is displayed with an instant action to switch to OpenStreetMap street tiles or retry loading.

### 4.5. Frosted-Glass HUD Controls & Mobile Ergonomics (SPEC-UI-008)
Per `design/SPATIAL_PARCEL_BOUNDARY_SPEC.md` section 2.2:
- Controls are housed in high-contrast frosted glass cards (`rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(12px)`) with solid fallbacks for mobile browsers.
- **Top-Right:** Segmented Satellite / Streets switch with active styling and keyboard navigation.
- **Bottom-Right:** Docked vertical Zoom In (+), Zoom Out (−), and Recenter buttons. The Recenter button is automatically disabled when no parcel bounds exist.
- **Bottom-Left:** Telemetry HUD displaying live pointer coordinates (`Lat, Lng` to 4 decimal places) with touch-center fallback, accompanied by synchronized metric (meters/km) and imperial (feet/miles) scale bars.
- **Top-Left:** 32px fixed North compass rose.
- **Safe Area Insets:** Leaflet attribution and HUD panels respect a 72px mobile bottom margin (`calc(72px + env(safe-area-inset-bottom))`), preventing overlap with mobile home bars or bottom navigation sheets. All touch targets strictly respect the 48 × 48 px accessibility requirement.

### 4.6. Lazy Code Splitting & Performance
To keep initial load time optimal:
- `FieldMapPage` is dynamically imported in `App.tsx` via `React.lazy(() => import('./pages/FieldMapPage'))`.
- Leaflet, React Leaflet, and the parcel mapping styles are bundled into a dedicated chunk:
  - `dist/assets/FieldMapPage-*.js`: ~171.39 kB (gzip: ~50.95 kB)
  - `dist/assets/FieldMapPage-*.css`: ~24.90 kB (gzip: ~8.53 kB)
- Initial application load for users navigating to home or diagnostics remains unaffected by GIS dependencies.

---

## 5. Test Verification Evidence

### 5.1. Automated GIS Map Test Suite (`npm run test:map`)
All 90 automated tests pass cleanly across data parsing, viewport calculations, and routing/scoping helpers:

```
> frontend@0.0.0 test:map
> node --experimental-strip-types scripts/test_farm_map_data.js && node --experimental-strip-types scripts/test_farm_map_viewport.js && node --experimental-strip-types scripts/test_farm_map_page.js

PASS converts longitude/latitude extents to Leaflet latitude/longitude bounds
PASS includes zero and negative coordinates
PASS preserves holes without changing polygon extents
PASS combines all parcels and every MultiPolygon component
PASS accepts an empty collection and returns no bounds
PASS ignores optional server bbox when framing coordinates
PASS fills absent metadata with null and uses an honest unnamed label
PASS preserves canonical snake_case metadata and zero area without inventing values
PASS uses feature-level string and numeric IDs as fallback
PASS prefers properties.id over feature-level ID
PASS does not mutate the input while normalizing metadata
PASS accepts valid altitude positions and WGS84 boundary coordinates
PASS rejects null collection
PASS rejects wrong collection type
PASS rejects missing features
PASS rejects nonarray features
PASS rejects null feature
PASS rejects non-Feature item
PASS rejects null geometry
PASS rejects point geometry
PASS rejects missing parcel ID
PASS rejects blank parcel ID
PASS rejects invalid properties
PASS rejects nonstring parcel name
PASS rejects invalid field metadata
PASS rejects invalid area metadata
PASS rejects nonfinite area
PASS rejects missing coordinates
PASS rejects empty polygon
PASS rejects empty ring
PASS rejects too-short ring
PASS rejects unclosed ring
PASS rejects flat polygon nesting
PASS rejects extra polygon nesting
PASS rejects null position
PASS rejects one-dimensional position
PASS rejects nonnumeric position
PASS rejects NaN longitude
PASS rejects infinite latitude
PASS rejects nonfinite altitude
PASS rejects longitude above 180
PASS rejects longitude below -180
PASS rejects latitude above 90
PASS rejects latitude below -90
PASS rejects invalid hole
PASS rejects empty MultiPolygon
PASS rejects empty MultiPolygon component
PASS rejects missing MultiPolygon nesting
PASS rejects malformed later MultiPolygon component
PASS loads live parcels and canonical metadata from the configured endpoint
PASS keeps successful empty data live in auto mode
PASS sample mode makes no request and returns two adjacent fictional parcels
PASS auto falls back for availability HTTP 404
PASS api mode rejects HTTP 404 without sample fallback
PASS auto falls back for availability HTTP 500
PASS api mode rejects HTTP 500 without sample fallback
PASS auto falls back for availability HTTP 501
PASS api mode rejects HTTP 501 without sample fallback
PASS auto falls back for availability HTTP 503
PASS api mode rejects HTTP 503 without sample fallback
PASS auto falls back for availability HTTP 599
PASS api mode rejects HTTP 599 without sample fallback
PASS auto rejects hard HTTP 400
PASS auto rejects hard HTTP 401
PASS auto rejects hard HTTP 403
PASS auto rejects hard HTTP 408
PASS auto rejects hard HTTP 409
PASS auto rejects hard HTTP 422
PASS auto rejects hard HTTP 429
PASS network failure falls back only in auto mode with an explicit reason
PASS invalid JSON and malformed contracts stay errors
PASS unexpected non-5xx HTTP statuses do not enable fallback
PASS sample results cannot mutate subsequent loads
PASS retry replaces sample parcels atomically with recovered live data
PASS timeout ends even an uncooperative fetch at 5000ms and cleans resources
PASS caller cancellation never produces samples and removes its listener
PASS successful and rejected requests remove caller listeners
PASS timeouts cover stalled response bodies and caller abort still cancels silently
All 78 farm map data tests passed.
PASS farm map framing, coordinate and scale policies
✔ uses the actual backend launch port and live parcel endpoint by default (1.1979ms)
✔ GIS base overrides the existing API base without changing it (0.1606ms)
✔ uses the existing API base when no GIS override is configured (0.1089ms)
✔ accepts each explicit data mode (0.1439ms)
✔ rejects unknown and empty data modes as configuration errors (0.1774ms)
✔ malformed API bases and paths are configuration errors, not sample fallback (0.1339ms)
✔ field selector deduplicates the loaded collection and excludes missing field IDs (0.2808ms)
✔ field selector uses an honest fallback name and a later available name (0.3385ms)
✔ all fields retains every loaded parcel including parcels with no field ID (0.1809ms)
✔ scoped routes include matching parcels only and never mutate loaded data (1.0945ms)
✔ unknown field and empty loaded collections remain empty (0.1326ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9.5038
```

### 5.2. Static Linter (`npm run lint`)
Executed `oxlint` across all 95 files:
```
> frontend@0.0.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 46ms on 95 files with 116 rules using 16 threads.
```

### 5.3. Production Build & Bundle Output (`npm run build`)
`tsc -b && vite build` compiled TypeScript with zero errors and generated optimized chunks:
```
dist/index.html                          1.37 kB │ gzip:   0.75 kB
dist/assets/FieldMapPage-DPy2rKzN.css   24.90 kB │ gzip:   8.53 kB
dist/assets/index-BHZiwqcg.css         111.96 kB │ gzip:  17.38 kB
dist/assets/FieldMapPage-DcqbF3HK.js   171.39 kB │ gzip:  50.95 kB
dist/assets/index-DkVRiQDE.js          514.95 kB │ gzip: 146.43 kB
```

### 5.4. Regression Verification
Executed existing module suites to confirm zero collateral regressions:
- **`npm run test:diagnostics`**: 8/8 test suites pass cleanly.
- **`npm run test:assembly`**: 4/4 production studio assembly suites pass cleanly.

---

## 6. Browser Verification Evidence across Viewports

Browser verification was conducted across real browser viewports using both the live backend and controlled test sessions:

| Viewport | Dimensions | Elements & Behaviors Verified | Evidence / Observations |
| :--- | :--- | :--- | :--- |
| **Desktop Widescreen** | 1440 × 900 | Header (64px), Map Canvas (836px), Navigation links, Field Dropdown, Basemap switcher, Zoom/Recenter dock, Cursor coordinates, Scale bars, Leaflet attribution. | Zero outer window scroll (`scrollWidth = 1440`). Satellite rendered 30 Esri tiles; switching to Streets loaded 18 OSM tiles with parcel vectors retained. User pan (`mapPane -80px`) preserved across basemap toggles. Recenter button restored bounds accurately. |
| **Tablet Portrait** | 768 × 1024 | Responsive header, Field selector dropdown, Top-right segmented control, Bottom-right zoom dock, Coordinate HUD, Scale bars. | Clean reflow. HUD elements docked with 20px padding; controls remained accessible with zero overlap. |
| **Mobile Standard** | 390 × 844 | Fixed 64px header, 48px refresh icon button, compact status heading, 780px map canvas, bottom controls above 72px safe zone. | No horizontal overflow (`scrollWidth = 390`). The 48px mobile refresh button is prominently accessible. Bottom HUD sits safely above mobile system gesture bar. Parallels and polygons rendered clearly without text occlusion. |
| **Mobile Compact** | 320 × 568 | Compact view, 200% browser zoom stress check. | Canvas reflowed without layout breaking or clipped interactive controls. |

### Additional Interactive States Verified:
1. **Basemap Switching:** Toggling between Satellite and Streets preserves polygon overlays and exact zoom/pan center.
2. **Field Scoping:** Selecting a field updates the route to `/fields/:fieldId/parcels` and reframes bounds to only that field's parcels. Selecting "All fields" restores `/map`.
3. **Empty Collection:** A valid GeoJSON FeatureCollection with zero features displays an honest notification (*"The live collection is empty. No sample records have been substituted."*) and centers on default coordinates `[39, 35]` (rural Türkiye center).
4. **Backend Availability Failure:** Simulating an HTTP 500 error triggers the fallback banner (*"Sample data — live data unavailable"*) with fictional demonstration parcels loaded and the "Retry live data" button enabled.
5. **Recovery from Fallback:** Clicking "Retry live data" after restoring the API seamlessly swaps sample parcels for live data without remounting the map canvas.

---

## 7. Backend Integration Verification Status

Verification confirmed active connectivity with the backend spatial service:
- **Endpoint:** `GET http://localhost:5051/api/v1/spatial/geojson/parcels`
- **Status:** HTTP 200 OK
- **Payload:** RFC 7946 `FeatureCollection` containing live parcel records (`"QA North Parcel"`, `"QA South Parcel"`) with valid WGS 84 polygon coordinates and properties (`id`, `name`, `field_id`, `field_name`, `crop_name`, `area_hectares`).
- **Configuration Alignment:** Noted that ASP.NET Core Kestrel boots on port **5051** in development (`backend/Properties/launchSettings.json`), whereas legacy root templates advertised port 5000. `frontend/.env.example` documents `VITE_GIS_API_BASE_URL=http://localhost:5051` to ensure seamless out-of-the-box local development.

---

## 8. Deferred Work & Forward Integration Boundaries

Per Phase 2 roadmap and SPEC-UI-008 specifications, the following capabilities are explicitly reserved for subsequent tasks:

1. **TODO-205 (Field & Parcel CRUD Management):**
   - Backend controllers for field-level parcel creation, updates, and deletion.
   - Frontend path update: Changing `VITE_GIS_PARCELS_PATH` in `frontend/.env.local` to point to `/api/v1/fields/{fieldId}/parcels` once available.
2. **TODO-206 (Spatial Reverse-Lookup):**
   - Point-in-polygon queries (`/api/v1/spatial/lookup/point`) for GPS click coordinates.
3. **TODO-208 (Interactive Parcel Drawing & Validation):**
   - Integration of Leaflet-Geoman (`@geoman-io/leaflet-geoman-free`) for polygon drawing, edge snapping, vertex editing, and deletion.
   - Client-side topological validation using Turf.js (`@turf/turf`): area calculation, self-intersection (kink) detection, and coordinate precision checks.
4. **TODO-209 (Agronomic Parcel Metadata & Styling):**
   - Crop-specific boundary stroke and fill color tokens (e.g. Wheat, Tomato, Corn, Vineyards).
   - Permanent parcel label overlays with area callouts (hectares).
   - Slide-over metadata inspector drawer for editing parcel attributes, soil profiles, and planting records.
