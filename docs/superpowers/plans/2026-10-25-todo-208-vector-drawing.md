# TODO-208: Interactive Vector Polygon Drawing & Editing Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver production-ready interactive vector polygon drawing, vertex modification, parcel deletion, real-time Turf.js surface area calculation (in hectares and acres), and client-side topological self-intersection detection (`@turf/kinks`) with visual error alerting for the Precision AgriTech GIS Field Map (`/map`).

**Architecture:** Integrate `@geoman-io/leaflet-geoman-free` directly into the persistent Leaflet map canvas while suppressing raw Leaflet/Geoman UI controls in favor of enterprise floating control cards (`.ag-map-control-card`). Encapsulate mathematical calculations and topological validation in browser-independent, purely functional utilities (`parcelTopology.ts`) powered by `@turf/area`, `@turf/length`, and `@turf/kinks`. Orchestrate active drawing states, live metrics, and kink coordinates through a reactive state machine that feeds a top-center HUD badge (`<DrawingLiveAreaBadge />`) and pulsing map markers (`<KinkMarkersLayer />`), with clean callback handoffs to the upcoming metadata drawer (TODO-209).

**Tech Stack:** React 19, TypeScript 6, Vite 8, Leaflet 1.9.4, React Leaflet 5.0.0, `@geoman-io/leaflet-geoman-free` 2.20.4, `@turf/area` 7.4.0, `@turf/kinks` 7.4.0, `@turf/helpers` 7.4.0, `@turf/length` 7.4.0, Tailwind CSS v4.

**Spec:** [`design/SPATIAL_PARCEL_BOUNDARY_SPEC.md`](file:///f:/Okul/Graduation%20Project/Project/design/SPATIAL_PARCEL_BOUNDARY_SPEC.md) (`SPEC-UI-008`), Section 3 and Section 5.

---

## Global Constraints

- Design system designation is "Precision Ag-Intelligence" light theme (`#FFFFFF`, frosted glass `rgba(255, 255, 255, 0.92)`, border `#CBD5E1` / `#E2E8F0`).
- Vector drawing stroke is Bio-Teal `#0F766E` (`2px dashed`, dash pattern `6 4` during drawing) with translucent fill `rgba(15, 118, 110, 0.14)`.
- Self-intersection error stroke transitions immediately to Red 500 `#EF4444` (`2.5px solid`) with fill `rgba(239, 68, 68, 0.22)`.
- Vertex handle styling: 10px circular disc, `#0F766E` fill, `2px solid #FFFFFF`, shadow `0 2px 4px rgba(0,0,0,0.3)`. Midpoint handle: 6px circular disc, `#FFFFFF` fill, `2px solid #0F766E`, opacity `0.85`.
- Floating controls must maintain minimum 40px touch targets (`48px` on mobile where accessible) and respect top/bottom safe margins.
- Z-Index hierarchy: Tile layer `200`, saved vector polygons `400`, Geoman handles `600`, floating controls `1000`, kink alert banner `1050`, metadata drawer `1200`, confirmation modal `1300`.
- Hard submission lockout: while `@turf/kinks` detects self-intersection (`kinks.features.length > 0`), double-clicking or clicking the initial vertex to close the polygon must be blocked.
- Agronomic metadata drawers, crop-specific color palettes (Tomato/Corn/Potato/Apple), and backend CRUD persistence (`POST /api/v1/parcels`) are strictly deferred to **TODO-209**.
- All mathematical utilities must run cleanly in Node.js without browser globals (`window`, `document`, `navigator`) for zero-dependency CLI testability.
- No regression test may be deleted, skipped, or weakened. Production build (`npm run build`) and linter (`npm run lint`) must pass with 0 errors and 0 warnings.

---

## Review Focus

1. **Self-Intersecting Bowties & Figure-Eights:** The operator drags a vertex across an existing boundary line or draws an hourglass shape. The software must detect the intersection in real time, highlight the border in red `#EF4444`, place a pulsing red marker at the exact intersection coordinate, display an explanatory warning banner, and prevent closing the polygon until uncrossed.
2. **Degenerate Polygons (< 3 Distinct Vertices or Zero Area):** An operator clicks twice in the same spot or attempts to close a line segment without enclosing an area. The software must ignore premature closing, require at least 3 distinct non-collinear vertices, and report an honest minimum vertex requirement.
3. **Rubber-Band Dynamic Area Calculations During Active Motion:** As the cursor moves before clicking the next vertex, metrics update smoothly without flickering or calculation lag, displaying area in hectares and acres, perimeter in meters, and vertex count.
4. **Drawing Cancellation & Mode Reset:** Pressing `ESC`, clicking the active tool button a second time, or clicking the Cancel button immediately aborts the active polygon, tears down temporary vertex handles and kink markers, restores the default cursor, and returns the map to `IDLE_MAP` without residual artifacts.
5. **Stacking Context & Drag Isolation:** Interacting with drawing handles, toolbar buttons, or zoom controls must not trigger unwanted map panning or layer clicks. Geoman handles must not leak above modals or headers.

---

## Task Breakdown

### Task 1: Topology Engine, Metrics Calculation & Dependencies

**Files:**
- Create: `frontend/src/types/farmMapDrawing.ts`
- Create: `frontend/src/utils/parcelTopology.ts`
- Create: `frontend/scripts/test_farm_map_drawing.js`
- Modify: `frontend/package.json:20-33`

**Interfaces:**
- Consumes: `@turf/area`, `@turf/kinks`, `@turf/length`, `@turf/helpers`, `frontend/src/types/farmMap.ts` (`ParcelFeatureCollection`, `Position`).
- Produces:
  - `export type DrawingMode = 'idle' | 'draw' | 'edit' | 'drag' | 'delete';`
  - `export type DrawingState = 'IDLE_MAP' | 'DRAWING_ACTIVE' | 'DRAWING_INVALID_KINK' | 'POLYGON_COMPLETED';`
  - `export interface ParcelMetrics { areaM2: number; areaHa: number; acres: number; perimeterM: number; vertexCount: number; }`
  - `export interface TopologyValidationResult { isValid: boolean; kinks: [number, number][]; errorMessage: string | null; }`
  - `export function calculateParcelMetrics(coordinates: [number, number][]): ParcelMetrics`
  - `export function validateParcelTopology(coordinates: [number, number][]): TopologyValidationResult`
  - `export function normalizeClosedRing(coordinates: [number, number][]): [number, number][]`

- [ ] **Step 1: Install required Turf.js and Geoman packages**

Install `@geoman-io/leaflet-geoman-free`, `@turf/area`, `@turf/kinks`, `@turf/helpers`, and `@turf/length`:
```bash
npm --prefix frontend install @geoman-io/leaflet-geoman-free@^2.20.4 @turf/area@^7.4.0 @turf/kinks@^7.4.0 @turf/helpers@^7.4.0 @turf/length@^7.4.0
```

- [ ] **Step 2: Write failing tests for parcel topology, metrics calculation, and kinks detection**

Create `frontend/scripts/test_farm_map_drawing.js` with comprehensive test cases:
1. `calculateParcelMetrics` returns accurate $m^2$, hectares ($m^2 / 10000$), acres ($m^2 \times 0.000247105$), perimeter in meters, and vertex count for standard rectangular and irregular polygons.
2. `validateParcelTopology` approves clean convex and concave polygons with 0 kinks and `isValid: true`.
3. `validateParcelTopology` detects self-intersecting "figure-8" / bowtie polygons, returning `isValid: false`, 1+ kink coordinates, and the exact error message `"Self-intersecting polygon. Uncross boundary lines to complete parcel."`.
4. `validateParcelTopology` rejects degenerate rings (< 3 vertices) with `isValid: false` and appropriate message.
5. `normalizeClosedRing` ensures the first and last coordinates are identical, without duplicating already-closed rings.

- [ ] **Step 3: Run test suite to verify failure**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: FAIL with module/function not found.

- [ ] **Step 4: Implement drawing types and topology engine**

Implement `frontend/src/types/farmMapDrawing.ts` with strict type contracts.  
Implement `frontend/src/utils/parcelTopology.ts` using `@turf/area`, `@turf/length`, `@turf/kinks`, and `@turf/helpers`:
- Convert coordinate arrays safely to GeoJSON polygon features.
- Guard against non-closed rings and degenerate inputs.
- Extract kink intersection positions as `[lng, lat]` tuples.
- Round metrics cleanly (`areaHa` to 2 decimal places, `acres` to 2 decimal places, `perimeterM` to 1 decimal place).

- [ ] **Step 5: Run tests and verify they pass**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: PASS all topology, metrics, and kinks assertions.

- [ ] **Step 6: Update `package.json` test script**

Add `frontend/scripts/test_farm_map_drawing.js` to `test:map` in `frontend/package.json`.  
Run: `npm --prefix frontend run test:map`  
Expected: PASS all existing map tests + drawing tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/farmMapDrawing.ts frontend/src/utils/parcelTopology.ts frontend/scripts/test_farm_map_drawing.js
git commit -m "feat(frontend): add parcel topology validation and metrics engine"
```

---

### Task 2: Custom Drawing Toolbar & Geoman Map Controller

**Files:**
- Create: `frontend/src/components/FarmMap/DrawingToolbar.tsx`
- Create: `frontend/src/components/FarmMap/FarmMapDrawingManager.tsx`
- Modify: `frontend/src/components/FarmMap/farmMap.css:40-85`
- Test: `frontend/scripts/test_farm_map_drawing.js`

**Interfaces:**
- Consumes: `frontend/src/types/farmMapDrawing.ts`, `frontend/src/utils/parcelTopology.ts`, Leaflet `L.Map`, `@geoman-io/leaflet-geoman-free`.
- Produces:
  - `<DrawingToolbar activeMode={mode} onModeChange={(mode) => ...} onCancel={() => ...} />`
  - `<FarmMapDrawingManager enabled={editable} activeMode={mode} onModeChange={...} onMetricsUpdate={...} onKinksChange={...} onPolygonComplete={...} onPolygonDelete={...} />`
  - CSS classes: `.ag-drawing-toolbar`, `.ag-drawing-tool-btn`, `.ag-drawing-tool-btn[data-active="true"]`.

- [ ] **Step 1: Write failing tests for drawing mode state transitions and toolbar logic**

In `frontend/scripts/test_farm_map_drawing.js`, append tests verifying:
1. Mode transitions: toggling from `idle` to `draw`, switching between `draw` and `edit`, and cancelling back to `idle`.
2. Action lockout logic: verifying that active drawing restricts navigation controls.
3. Keydown handling: `Escape` key maps directly to cancel/idle transition.

- [ ] **Step 2: Run test suite to verify failure**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: FAIL on newly added state transition assertions.

- [ ] **Step 3: Implement `<DrawingToolbar />` component**

Create `frontend/src/components/FarmMap/DrawingToolbar.tsx`:
- Render docked floating card at `top-4 left-4 z-[1000]`.
- Buttons with SVG icons: `[Draw Polygon]`, `[Edit Vertices]`, `[Drag Parcel]`, `[Delete Parcel]`, and conditional `[Cancel Drawing]`.
- Minimum 40px touch targets (`w-10 h-10`), high-contrast focus rings, and active state pill (`bg-teal-50 text-teal-800 border-teal-600`).
- Keyboard accessibility: full `aria-label`, `title`, and role attributes.

- [ ] **Step 4: Implement `<FarmMapDrawingManager />` with Geoman lifecycle hooks**

Create `frontend/src/components/FarmMap/FarmMapDrawingManager.tsx`:
- Hook into React Leaflet map instance via `useMap()`.
- Import `@geoman-io/leaflet-geoman-free` and `@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css`.
- Configure custom Geoman global options:
  - Path options: Bio-Teal `#0F766E`, weight `2`, dashArray `'6, 4'`, fill `rgba(15, 118, 110, 0.14)`.
  - Disable default Geoman toolbar controls (`map.pm.addControls` not called; driven by our React state).
- Bind Geoman map events:
  - `pm:drawstart`: sets mode to `draw`, sets crosshair cursor on `.leaflet-container`.
  - `pm:drawend`: clears drawing cursor.
  - `pm:create`: extracts layer coordinates, runs final topology validation, fires `onPolygonComplete(feature, metrics)`.
  - `pm:remove`: fires `onPolygonDelete(layerId)`.
  - Vertex change events (`pm:vertexadded`, `pm:snap`, `pm:markerdrag`): compute live coordinates and invoke `onMetricsUpdate` and `onKinksChange`.

- [ ] **Step 5: Add Precision Ag drawing CSS styles to `farmMap.css`**

Update `frontend/src/components/FarmMap/farmMap.css`:
- Custom Geoman vertex disc handles: 10px circular disc, `#0F766E` fill, 2px solid white border, box shadow.
- Midpoint handle styling: 6px circular disc, `#FFFFFF` fill, 2px `#0F766E` border.
- Crosshair cursor during active drawing `.ag-map-drawing-active .leaflet-container { cursor: crosshair !important; }`.
- Responsive layout adjustments for mobile viewports (< 768px).

- [ ] **Step 6: Run test suite to verify passes**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: PASS all state transition and toolbar tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/FarmMap/DrawingToolbar.tsx frontend/src/components/FarmMap/FarmMapDrawingManager.tsx frontend/src/components/FarmMap/farmMap.css frontend/scripts/test_farm_map_drawing.js
git commit -m "feat(frontend): add custom drawing toolbar and Geoman drawing manager"
```

---

### Task 3: Live Drawing HUD Overlay, Kink Alerting & Pulsing Markers

**Files:**
- Create: `frontend/src/components/FarmMap/DrawingLiveAreaBadge.tsx`
- Create: `frontend/src/components/FarmMap/KinkMarkersLayer.tsx`
- Modify: `frontend/src/components/FarmMap/farmMap.css:86-130`
- Test: `frontend/scripts/test_farm_map_drawing.js`

**Interfaces:**
- Consumes: `frontend/src/types/farmMapDrawing.ts` (`ParcelMetrics`, `DrawingState`), `frontend/src/utils/parcelTopology.ts`.
- Produces:
  - `<DrawingLiveAreaBadge state={drawingState} metrics={metrics} onCancel={...} />`
  - `<KinkMarkersLayer kinks={kinkCoordinates} />`
  - CSS classes: `.ag-drawing-hud`, `.ag-kink-badge`, `.ag-kink-marker-pulse`.

- [ ] **Step 1: Write failing tests for HUD metrics formatting and kink alerting policies**

In `frontend/scripts/test_farm_map_drawing.js`, append tests verifying:
1. HUD formatting helper generates exact required copy: `"1.84 ha (4.55 acres) • 5 Vertices • Perimeter: 542m"`.
2. Action prompt text switch: `"Click initial vertex to complete polygon • Press ESC to cancel."` in `DRAWING_ACTIVE`.
3. Error prompt text switch: `"Self-intersecting polygon. Uncross boundary lines to complete parcel."` when `hasKinks: true`.
4. Hard submission lockout helper blocks completion when kinks exist.

- [ ] **Step 2: Run test suite to verify failure**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: FAIL on HUD formatting and kink policy assertions.

- [ ] **Step 3: Implement `<DrawingLiveAreaBadge />` component**

Create `frontend/src/components/FarmMap/DrawingLiveAreaBadge.tsx`:
- Docks at `top-4 left-1/2 -translate-x-1/2 z-[1000]`.
- Frosted glass container (`.ag-map-control-card`) with backdrop blur.
- Live metrics display in `Geist Mono`, bold, tabular figures.
- Microcopy instructions for user actions.
- Warning state container rendered when `state === 'DRAWING_INVALID_KINK'`:
  - Red alert badge with exclamation icon: `bg-red-50 text-red-900 border-red-300`.
  - Clear user instruction: *"Self-intersecting polygon. Uncross boundary lines to complete parcel."*

- [ ] **Step 4: Implement `<KinkMarkersLayer />` with pulsing intersection rings**

Create `frontend/src/components/FarmMap/KinkMarkersLayer.tsx`:
- Render Leaflet markers (`L.marker`) at each `[latitude, longitude]` coordinate returned by `@turf/kinks`.
- Marker icon: custom `L.divIcon` with 16px pulsating red marker ring (`.ag-kink-marker-pulse`, `bg-red-600 ring-4 ring-red-400/50`).
- Interactive: false (does not block mouse events to vertices beneath).

- [ ] **Step 5: Add HUD and pulsing kink CSS animations to `farmMap.css`**

Add CSS keyframe animations in `frontend/src/components/FarmMap/farmMap.css`:
- `@keyframes kink-pulse`: subtle 1.5s scale and opacity expansion.
- HUD entry/exit transitions.

- [ ] **Step 6: Run test suite to verify passes**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_drawing.js`  
Expected: PASS all HUD formatting and kink policy tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/FarmMap/DrawingLiveAreaBadge.tsx frontend/src/components/FarmMap/KinkMarkersLayer.tsx frontend/src/components/FarmMap/farmMap.css frontend/scripts/test_farm_map_drawing.js
git commit -m "feat(frontend): add live area HUD badge and topological kink markers"
```

---

### Task 4: FarmMapContainer Integration & Field Map Page Flow

**Files:**
- Modify: `frontend/src/components/FarmMap/FarmMapContainer.tsx:1-70`
- Modify: `frontend/src/pages/FieldMapPage.tsx:25-95`
- Test: `frontend/scripts/test_farm_map_page.js`
- Test: `frontend/scripts/test_farm_map_drawing.js`

**Interfaces:**
- Consumes: `<DrawingToolbar />`, `<FarmMapDrawingManager />`, `<DrawingLiveAreaBadge />`, `<KinkMarkersLayer />`.
- Produces:
  - `<FarmMapContainer editable={true} onPolygonComplete={(polygon, metrics) => ...} onPolygonDelete={(id) => ...} />`
  - Fully integrated interactive spatial drawing experience on `/map` and `/fields/:fieldId/parcels`.

- [ ] **Step 1: Write failing tests for drawing integration on the field map page**

In `frontend/scripts/test_farm_map_page.js`, add test assertions verifying:
1. `FieldMapView` accepts editable drawing props without regressions on existing field filtering.
2. Polygon completion handler updates page status with newly drawn parcel area.
3. Cancel / discard action clears drawing state cleanly.

- [ ] **Step 2: Run test suite to verify failure**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_page.js`  
Expected: FAIL on new drawing integration assertions.

- [ ] **Step 3: Integrate drawing components into `<FarmMapContainer />`**

Update `frontend/src/components/FarmMap/FarmMapContainer.tsx`:
- Add `editable?: boolean` prop (default `true`).
- Add `onPolygonComplete?: (feature: Feature<Polygon>, metrics: ParcelMetrics) => void`.
- Add `onPolygonDelete?: (parcelId: string) => void`.
- Embed `<DrawingToolbar />` (top-left) inside map surface.
- Embed `<DrawingLiveAreaBadge />` (top-center) inside map surface.
- Within `MapContainer`, mount `<FarmMapDrawingManager />` and `<KinkMarkersLayer />`.
- Wire state between drawing manager, metrics HUD, kink layer, and parent callbacks.

- [ ] **Step 4: Update `<FieldMapPage />` with drawing event handlers and status banners**

Update `frontend/src/pages/FieldMapPage.tsx`:
- Maintain state for newly drawn parcels and active drawing status.
- When `onPolygonComplete` is received:
  - Temporarily append the valid polygon to the map display with a toast confirmation: *"Parcel boundary created: 2.45 ha. Ready for metadata registration."*.
  - Expose state hook prepared for TODO-209 Metadata Drawer handoff (`pendingParcel`).
- When `onPolygonDelete` is received:
  - Display confirmation toast: *"Parcel boundary removed."*.
- Support `Escape` key global listener to cancel active drawing.

- [ ] **Step 5: Run all test suites to verify pass**

Run: `npm --prefix frontend run test:map`  
Expected: PASS all 90 existing tests + new drawing integration tests.

- [ ] **Step 6: Verify linter and production build**

Run: `npm --prefix frontend run lint`  
Expected: 0 warnings, 0 errors.  
Run: `npm --prefix frontend run build`  
Expected: Build succeeds cleanly; lazy chunk `dist/assets/FieldMapPage-*.js` encapsulates Geoman and Turf libraries without bloating main bundle.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/FarmMap/FarmMapContainer.tsx frontend/src/pages/FieldMapPage.tsx frontend/scripts/test_farm_map_page.js frontend/scripts/test_farm_map_drawing.js
git commit -m "feat(frontend): integrate interactive vector drawing into farm map container and page"
```

---

### Task 5: Documentation, Verification & Milestone Completion Report

**Files:**
- Create: `PROJECT_DETAILS/Reports/Phase 2/TODO-208-vector-drawing.md`
- Modify: `frontend/README.md:30-80`
- Modify: `frontend/.env.example`

**Interfaces:**
- Consumes: All completed TODO-208 implementation code and test evidence.
- Produces: Production milestone documentation conforming to repository standards.

- [ ] **Step 1: Document vector drawing in `frontend/README.md`**

Add a dedicated subsection to "GIS Field Map (`/map`)" in `frontend/README.md`:
- Document Geoman drawing toolbar controls (`Draw Polygon`, `Edit Vertices`, `Drag`, `Delete`).
- Document real-time Turf.js calculations (`@turf/area`, `@turf/length`).
- Document self-intersection validation (`@turf/kinks`) and visual error feedback.
- Document test runner command: `npm run test:map`.

- [ ] **Step 2: Create comprehensive milestone completion report `TODO-208-vector-drawing.md`**

Create `PROJECT_DETAILS/Reports/Phase 2/TODO-208-vector-drawing.md`:
- Follow exact repository standard template from Phase 1 and TODO-207.
- Document executive summary, architectural design, deliverables mapping, automated test logs, and forward boundaries for TODO-209 (Metadata Drawer & Form).

- [ ] **Step 3: Run complete verification suite across whole frontend**

Execute all verification commands:
```bash
npm --prefix frontend run test:map
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:diagnostics
npm --prefix frontend run test:assembly
```
Expected: All suites pass, 0 linter errors, clean production build.

- [ ] **Step 4: Commit**

```bash
git add frontend/README.md frontend/.env.example PROJECT_DETAILS/Reports/Phase 2/TODO-208-vector-drawing.md
git commit -m "docs(frontend): record TODO-208 vector drawing architecture and completion report"
```
