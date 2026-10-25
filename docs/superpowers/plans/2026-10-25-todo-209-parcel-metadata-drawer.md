# TODO-209: Parcel Management Drawer & Metadata Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Parcel Management Drawer and dynamic metadata styling (`SPEC-UI-008`), enabling agricultural operators to record crop parameters, soil profiles, and planting schedules with auto-calculated Days After Planting (DAP), dynamic crop-colored vector polygons, persistent centroid tooltip labels, and resilient spatial CRUD API integration.

**Architecture:** A sliding responsive drawer (`<ParcelMetadataDrawer />`) docks on desktop (440px right panel with Apple spring physics) or slides up on mobile as a bottom sheet. Vector polygons dynamically paint standardized crop color palettes (`Tomato: #10B981`, `Corn: #F59E0B`, `Potato: #8B5CF6`, `Apple: #EC4899`). Micro-badges render persistent geometric centroid labels (`Zoom >= 14`). A resilient spatial CRUD service (`farmMapService.ts`) coordinates `POST/PUT/DELETE /api/v1/parcels` with seamless client-side optimistic fallback in `auto` and `sample` modes.

**Tech Stack:** React 19, TypeScript, React-Leaflet 5, Leaflet 1.9, Turf.js (`@turf/area`, `@turf/helpers`, `@turf/length`), Tailwind CSS v4, Node.js test runner (`--experimental-strip-types`).

**Spec:** `design/SPATIAL_PARCEL_BOUNDARY_SPEC.md` (`SPEC-UI-008`, Sections 4, 5, 6, 7) and `PROJECT_DETAILS/Phase Plans/Phase 2.md` (TODO-209).

---

## Global Constraints

- **Drawer Width & Placement:** Fixed docked panel on desktop ($\ge 1024\text{px}$) with `w-[440px]`, `top-0 right-0 h-full`, `z-index: 1200`, `shadow-modal` (`0 20px 40px -8px rgba(15, 23, 42, 0.18)`), and left border `1px solid #E2E8F0`.
- **Desktop Spring Physics:** `transform: translateX(100%)` to `translateX(0%)` with `transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1)`.
- **Mobile Bottom Sheet:** Fixed bottom sheet ($< 768\text{px}$) with `bottom-0 left-0 right-0 max-h-[88vh] rounded-t-2xl z-[1200]`, centered 36x4px grab pill (`bg-slate-300 rounded-full`), bottom padding `calc(20px + env(safe-area-inset-bottom))`.
- **Form Controls:**
  - Parcel Name / Code: Required string, input height 42px (desktop) / 48px (mobile), font size $\ge 16\text{px}$ on mobile.
  - Crop Type: Dropdown with 4 canonical options:
    - Tomato (`🍅`, *Solanum lycopersicum*, `Solanaceae`, stroke `#10B981`, fill `rgba(16, 185, 129, 0.18)`, selected `#047857`)
    - Corn (Maize) (`🌽`, *Zea mays*, `Poaceae`, stroke `#F59E0B`, fill `rgba(245, 158, 11, 0.18)`, selected `#B45309`)
    - Potato (`🥔`, *Solanum tuberosum*, `Solanaceae`, stroke `#8B5CF6`, fill `rgba(139, 92, 246, 0.18)`, selected `#6D28D9`)
    - Apple (`🍏`, *Malus domestica*, `Rosaceae`, stroke `#EC4899`, fill `rgba(236, 72, 153, 0.18)`, selected `#BE185D`)
  - Soil Profile: Dropdown with 4 canonical options:
    - Sand ($\theta_{\text{FC}} = 0.12$, low water retention, rapid drainage)
    - Sandy Loam ($\theta_{\text{FC}} = 0.22$, recommended agronomic balance, optimal drainage)
    - Silt ($\theta_{\text{FC}} = 0.31$, high moisture retention, medium aeration)
    - Clay ($\theta_{\text{FC}} = 0.38$, very high retention, heavy compaction risk)
  - Planting Date: `YYYY-MM-DD` input paired with dynamic DAP calculation badge (`DAP: {days} Days ({stage})`).
- **Centroid Tooltip Labels:** Persistent micro-badges injected at geometric centroid (`L.divIcon`, `z-index: 500`), visible at `Zoom >= 14`, collapsing to mini-dot badges at `Zoom < 14`.
- **Strict Z-Index Hierarchy:** Base tiles `200`, Saved Polygons `400`, Centroid Tooltips `500`, Geoman Handles `600`, Map HUD Controls `1000`, Kink Alerts `1050`, Metadata Drawer `1200`, Modal Dialogs `1300`.
- **Headless Testing Constraint:** All pure policies, DAP math, validation, and centroid calculations MUST live in pure `.ts` modules testable by Node `--experimental-strip-types` without DOM dependencies.

---

## Review Focus

1. **Planting Date in the Future or Extreme Past:** If an operator selects tomorrow or a date 10 years ago, DAP calculation must return negative days ("Pre-Planting") or cap cleanly without `NaN` or application crashes.
2. **Missing or Malformed Crop/Soil Properties on Loaded Parcels:** Existing parcels from legacy or partial GeoJSON might lack `crop_name` or `soil_profile_name`; polygon styling and centroid micro-badges must gracefully render fallback tokens (`#0F766E`, "Unassigned") without throwing runtime null pointer exceptions.
3. **Double-Save or Rapid Form Submission Race:** Clicking "Save Parcel Boundary" multiple times before network completion must disable the button, show loading state, and reject duplicate API requests.
4. **Centroid Placement for Complex/Concave U-Shaped Polygons:** For horseshoe or irregular multipoint parcels where arithmetic mean might fall outside or near boundary edges, centroid math must calculate stable 2D polygon center of mass.
5. **Offline/Network Failure Resilience:** In `auto` and `sample` modes, if `POST /api/v1/parcels` returns 404, 500, or network offline, the application must optimistically persist the new parcel to client state with an informative feedback notice rather than dropping drawn work.

---

### Task 1: Domain Models, Pure Metadata Policies & Centroid Calculator

**Files:**
- Create: `frontend/src/types/parcelMetadata.ts`
- Create: `frontend/src/utils/parcelMetadataPolicy.ts`
- Create: `frontend/src/utils/parcelCentroid.ts`
- Test: `frontend/scripts/test_parcel_metadata.js`

**Interfaces:**
- Consumes: `ParcelMetrics` from `frontend/src/types/farmMapDrawing.ts`, `ParcelMapProperties` from `frontend/src/types/farmMap.ts`.
- Produces:
  - Types: `CropCategory`, `SoilType`, `CropPalette`, `CropDefinition`, `SoilDefinition`, `ParcelFormData`, `DapCalculation`, `ParcelCentroid`.
  - Constants: `CROP_PALETTES: Record<CropCategory, CropPalette>`, `CROPS: CropDefinition[]`, `SOILS: SoilDefinition[]`.
  - Functions:
    - `calculateDap(plantingDate: string, referenceDate?: Date): DapCalculation`
    - `validateParcelForm(data: Partial<ParcelFormData>): { isValid: boolean; errors: Partial<Record<keyof ParcelFormData, string>> }`
    - `resolveCropPalette(cropIdentifier?: string | null): CropPalette`
    - `calculatePolygonCentroid(coordinates: [number, number][] | [number, number][][]): ParcelCentroid`
    - `buildParcelCreatePayload(data: ParcelFormData, geometry: GeoJSON.Polygon, areaHa: number): object`

- [ ] **Step 1: Write the failing test**

Create `frontend/scripts/test_parcel_metadata.js` asserting:
1. `calculateDap`:
   - Future date (`2026-06-01` vs `2026-05-27`) -> `{ days: -5, stage: 'Pre-Planting', formatted: 'Upcoming (In 5 days)' }`.
   - 10 days ago -> `{ days: 10, stage: 'Early / Germination', formatted: 'DAP: 10 Days (Early / Germination)' }`.
   - 42 days ago -> `{ days: 42, stage: 'Development Stage', formatted: 'DAP: 42 Days (Development Stage)' }`.
   - 75 days ago -> `{ days: 75, stage: 'Mid-Season / Flowering', formatted: 'DAP: 75 Days (Mid-Season / Flowering)' }`.
   - 120 days ago -> `{ days: 120, stage: 'Late / Maturity', formatted: 'DAP: 120 Days (Late / Maturity)' }`.
   - Invalid/empty date string returns `{ days: 0, stage: 'Unknown', formatted: 'Date required' }`.
2. `resolveCropPalette`:
   - 'Tomato' -> stroke `#10B981`, fill `rgba(16, 185, 129, 0.18)`, selected `#047857`.
   - 'Corn' or 'Zea mays' -> stroke `#F59E0B`, fill `rgba(245, 158, 11, 0.18)`, selected `#B45309`.
   - 'Potato' -> stroke `#8B5CF6`, fill `rgba(139, 92, 246, 0.18)`, selected `#6D28D9`.
   - 'Apple' -> stroke `#EC4899`, fill `rgba(236, 72, 153, 0.18)`, selected `#BE185D`.
   - null/undefined/unknown -> fallback stroke `#0F766E`, fill `rgba(15, 118, 110, 0.18)`.
3. `validateParcelForm`:
   - Valid data returns `{ isValid: true, errors: {} }`.
   - Blank name returns error `'Parcel name is required'`.
   - Invalid crop returns error `'Please select a valid crop'`.
   - Invalid soil returns error `'Please select a valid soil profile'`.
   - Invalid planting date returns error `'Please provide a valid planting date'`.
4. `calculatePolygonCentroid`:
   - Symmetrical rectangle `[[27.14, 38.42], [27.16, 38.42], [27.16, 38.44], [27.14, 38.44], [27.14, 38.42]]` -> `{ lng: 27.15, lat: 38.43 }`.
   - Triangle centroid computation matches signed-area center of mass.
   - Degenerate collinear or single-vertex coordinate safely falls back to coordinate mean.
5. `buildParcelCreatePayload`:
   - Produces RFC 7946 GeoJSON compliant parcel creation DTO with `field_id`, `name`, `crop_id`, `crop_name`, `soil_profile_id`, `soil_profile_name`, `planting_date`, `area_hectares`, and `geometry`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_metadata.js`
Expected: FAIL with module not found or missing exports.

- [ ] **Step 3: Implement domain types, metadata policy and centroid calculator**

1. Create `frontend/src/types/parcelMetadata.ts`:
   - Export interfaces `CropCategory`, `SoilType`, `CropPalette`, `CropDefinition`, `SoilDefinition`, `ParcelFormData`, `DapCalculation`, `ParcelCentroid`.
2. Create `frontend/src/utils/parcelMetadataPolicy.ts`:
   - Export `CROP_PALETTES`, `CROPS`, `SOILS`.
   - Implement `calculateDap(plantingDate, referenceDate)`.
   - Implement `validateParcelForm(data)`.
   - Implement `resolveCropPalette(cropIdentifier)`.
   - Implement `buildParcelCreatePayload(data, geometry, areaHa)`.
3. Create `frontend/src/utils/parcelCentroid.ts`:
   - Implement `calculatePolygonCentroid(coordinates)` using standard 2D polygon signed area and centroid formulas:
     $A = \frac{1}{2}\sum_{i=0}^{n-1}(x_i y_{i+1} - x_{i+1} y_i)$
     $C_x = \frac{1}{6A}\sum_{i=0}^{n-1}(x_i + x_{i+1})(x_i y_{i+1} - x_{i+1} y_i)$
     $C_y = \frac{1}{6A}\sum_{i=0}^{n-1}(y_i + y_{i+1})(x_i y_{i+1} - x_{i+1} y_i)$
   - Handle GeoJSON coordinate tuples `[lng, lat]`, unclosed rings, and zero-area fallbacks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_metadata.js`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/parcelMetadata.ts frontend/src/utils/parcelMetadataPolicy.ts frontend/src/utils/parcelCentroid.ts frontend/scripts/test_parcel_metadata.js
git commit -m "feat(map): add parcel metadata policy, domain types and centroid calculator"
```

---

### Task 2: Dynamic Crop-Colored Vector Polygon Styling & Persistent Centroid Tooltips

**Files:**
- Create: `frontend/src/components/FarmMap/ParcelCentroidLabelsLayer.tsx`
- Modify: `frontend/src/components/FarmMap/FarmMapContainer.tsx`
- Modify: `frontend/src/components/FarmMap/farmMap.css`
- Test: `frontend/scripts/test_parcel_styling.js`

**Interfaces:**
- Consumes:
  - `CROP_PALETTES`, `resolveCropPalette` from `frontend/src/utils/parcelMetadataPolicy.ts`.
  - `calculatePolygonCentroid` from `frontend/src/utils/parcelCentroid.ts`.
  - `ParcelFeatureCollection` from `frontend/src/types/farmMap.ts`.
- Produces:
  - `<ParcelCentroidLabelsLayer collection={collection} />` rendering Leaflet `divIcon` badges at polygon centroids with zoom-dependent density.
  - Enhanced `<FarmMapContainer />` accepting `selectedParcelId?: string | number | null`, `onParcelSelect?: (feature: GeoJSON.Feature<GeoJSON.Polygon>) => void`, applying dynamic crop styling and selected outline halo (`#047857` / `#B45309` / `#6D28D9` / `#BE185D`).

- [ ] **Step 1: Write the failing test**

Create `frontend/scripts/test_parcel_styling.js` verifying:
1. Feature styling resolver maps `properties.crop_name` ("Potato") to stroke `#8B5CF6`, fill `rgba(139, 92, 246, 0.18)`.
2. Selected state increases stroke weight to 3px and applies selected stroke hex.
3. Feature styling resolver handles features with null or unassigned properties gracefully with default Bio-Teal tokens.
4. Centroid extractor accurately pairs each feature in a `FeatureCollection` with its `{ lat, lng, name, crop, areaHa, soil }` data structure.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_styling.js`
Expected: FAIL with missing file or functions.

- [ ] **Step 3: Implement dynamic parcel styling and centroid tooltip layer**

1. Create `frontend/src/components/FarmMap/ParcelCentroidLabelsLayer.tsx`:
   - Uses `useMap()` to listen to `zoomend` events.
   - For each polygon in `collection`, computes centroid via `calculatePolygonCentroid`.
   - If `zoom >= 14`, renders `L.divIcon` with class `ag-parcel-tooltip`:
     - Crop color circle indicator dot (`w-2 h-2 rounded-full`).
     - Title: `{name} • {cropName}`.
     - Subtitle: `{areaHa.toFixed(2)} ha • {soilName}`.
   - If `zoom < 14`, renders collapsed mini-dot marker (`ag-parcel-dot-badge`).
   - Disables Leaflet click/mouse propagation so clicking label doesn't trigger unintended map canvas drags.
2. Modify `frontend/src/components/FarmMap/FarmMapContainer.tsx`:
   - Update `ParcelLayer` to compute dynamic styles per feature based on `resolveCropPalette(feature.properties?.crop_name)`.
   - Add hover stroke enhancement and selected outline halo styling when `selectedParcelId === feature.id || selectedParcelId === feature.properties?.id`.
   - Attach Leaflet `onEachFeature` click listener to invoke `onParcelSelect(feature)`.
   - Embed `<ParcelCentroidLabelsLayer collection={collection} />` into map layers.
3. Add CSS styling to `frontend/src/components/FarmMap/farmMap.css`:
   - `.ag-parcel-tooltip`: background `rgba(255, 255, 255, 0.94)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(203, 213, 225, 0.8)`, `box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08)`, `padding: 4px 8px`, `border-radius: 6px`.
   - `.ag-parcel-dot-badge`: `w-2.5 h-2.5 rounded-full border border-white shadow-sm`.
   - Layer z-index enforcement: `.ag-parcel-tooltip` in Leaflet pane `z-index: 500`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_styling.js && npm --prefix frontend run test:map`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FarmMap/ParcelCentroidLabelsLayer.tsx frontend/src/components/FarmMap/FarmMapContainer.tsx frontend/src/components/FarmMap/farmMap.css frontend/scripts/test_parcel_styling.js
git commit -m "feat(map): add dynamic crop parcel styling and persistent centroid tooltip labels"
```

---

### Task 3: Sliding Metadata Drawer Component (`<ParcelMetadataDrawer />`)

**Files:**
- Create: `frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx`
- Create: `frontend/src/components/FarmMap/CropSelector.tsx`
- Create: `frontend/src/components/FarmMap/SoilSelector.tsx`
- Create: `frontend/src/components/FarmMap/farmMapDrawer.css`
- Test: `frontend/scripts/test_parcel_drawer.js`

**Interfaces:**
- Consumes:
  - `ParcelFormData`, `CropCategory`, `SoilType` from `frontend/src/types/parcelMetadata.ts`.
  - `CROPS`, `SOILS`, `CROP_PALETTES`, `calculateDap`, `validateParcelForm` from `frontend/src/utils/parcelMetadataPolicy.ts`.
  - `ParcelMetrics` from `frontend/src/types/farmMapDrawing.ts`.
- Produces:
  - `<ParcelMetadataDrawer />`:
    - Props:
      - `isOpen: boolean`
      - `mode: 'create' | 'edit'`
      - `initialData?: Partial<ParcelFormData> | null`
      - `metrics?: ParcelMetrics | null`
      - `onSave: (data: ParcelFormData) => Promise<void> | void`
      - `onDiscard: () => void`
      - `onDelete?: () => Promise<void> | void`
      - `isSaving?: boolean`
    - Keyboard: Dismisses on `Escape` key, traps focus, exposes accessible labels.

- [ ] **Step 1: Write the failing test**

Create `frontend/scripts/test_parcel_drawer.js` asserting:
1. Drawer initial data population:
   - When given existing parcel properties (`{ name: 'North Potato', crop_name: 'Potato', soil_profile_name: 'Sandy Loam', planting_date: '2026-04-15' }`), correctly pre-fills form fields.
   - When given empty initial data in `'create'` mode, provides sensible defaults (`crop: 'Tomato'`, `soil: 'Sandy Loam'`, `plantingDate: today`).
2. Area Summary calculations:
   - Converts `ParcelMetrics` into formatted strings: `2.45 ha (6.05 acres)`, `Perimeter: 624 m`, `Vertices: 5`.
3. Validation and submission gate:
   - Blocks save callback when validation errors exist, returning error messages.
   - Emits valid `ParcelFormData` on confirmed save.
4. Crop selector catalog integrity:
   - All 4 canonical crops (`Tomato`, `Corn`, `Potato`, `Apple`) have associated emoji, botanical family, and stroke color.
5. Soil selector catalog integrity:
   - All 4 canonical soils (`Sand`, `Sandy Loam`, `Silt`, `Clay`) have $\theta_{\text{FC}}$ and description.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_drawer.js`
Expected: FAIL with missing file.

- [ ] **Step 3: Implement Drawer and Selectors**

1. Create `frontend/src/components/FarmMap/CropSelector.tsx`:
   - Renders 4 canonical crop cards/options with emoji (`🍅`, `🌽`, `🥔`, `🍏`), common name, scientific & botanical family text, and color swatch preview.
2. Create `frontend/src/components/FarmMap/SoilSelector.tsx`:
   - Renders 4 canonical soil options with field capacity $\theta_{\text{FC}}$ badge and agronomic drainage notes.
3. Create `frontend/src/components/FarmMap/farmMapDrawer.css`:
   - Desktop docking: `fixed top-0 right-0 h-full w-[440px] z-[1200]`, Apple spring `cubic-bezier(0.16, 1, 0.3, 1) 320ms`.
   - Mobile sheet: `fixed bottom-0 left-0 right-0 max-h-[88vh] rounded-t-2xl z-[1200]`, 36x4px pill grab bar.
   - Live Crop Palette preview bar styling.
4. Create `frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx`:
   - Header with `[<-] Parcel Setup` and close `[ X ]` button.
   - Area Summary banner displaying hectares, acres, perimeter in meters, and vertex count.
   - Form fields:
     - Parcel Name input (with error text).
     - `<CropSelector />`.
     - `<SoilSelector />`.
     - Planting Date picker + dynamic DAP badge (`DAP: {days} Days ({stage})`).
     - Crop Palette Preview (`Stroke: #... | Fill: 18%`).
   - Action footer:
     - Primary button: `[ Save Parcel Boundary ]` (Bio-Teal `#0F766E`, disabled while saving, loading spinner).
     - Secondary button: `[ Discard Boundary ]`.
     - Delete button in `'edit'` mode (`[ Delete Parcel ]`).
   - Handles `Escape` key and outside click / backdrop dismiss.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types frontend/scripts/test_parcel_drawer.js`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FarmMap/CropSelector.tsx frontend/src/components/FarmMap/SoilSelector.tsx frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx frontend/src/components/FarmMap/farmMapDrawer.css frontend/scripts/test_parcel_drawer.js
git commit -m "feat(map): implement sliding parcel metadata drawer component and selectors"
```

---

### Task 4: Spatial CRUD Service, API Integration & Field Map Page Flow

**Files:**
- Modify: `frontend/src/services/farmMapService.ts`
- Modify: `frontend/src/utils/farmMapPage.ts`
- Modify: `frontend/src/pages/FieldMapPage.tsx`
- Test: `frontend/scripts/test_farm_map_crud.js`

**Interfaces:**
- Consumes:
  - `buildParcelCreatePayload` from `frontend/src/utils/parcelMetadataPolicy.ts`.
  - `<ParcelMetadataDrawer />` from `frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx`.
  - `FarmMapContainer` from `frontend/src/components/FarmMap/FarmMapContainer.tsx`.
- Produces:
  - Extended `farmMapService.ts` with `saveParcel`, `updateParcelMetadata`, `deleteParcelBoundary` supporting `auto`, `api`, and `sample` modes.
  - Complete Field Map UI State Machine:
    1. Polygon drawn -> auto-opens drawer in `'create'` mode.
    2. Polygon clicked -> opens drawer in `'edit'` mode.
    3. Save -> persists parcel, updates map with crop color, displays success toast.
    4. Discard -> dismisses drawer and clears pending vector.
    5. Delete -> removes parcel and displays info toast.

- [ ] **Step 1: Write the failing test**

Create `frontend/scripts/test_farm_map_crud.js` verifying:
1. `saveParcel`:
   - In `api` mode, sends `POST /api/v1/parcels` with JSON headers and handles 200/201 response.
   - In `auto` mode with offline/404 API, falls back cleanly to client optimistic parcel feature without crashing.
   - In `sample` mode, saves locally into state immediately.
2. `updateParcelMetadata`:
   - Updates `crop_name`, `soil_profile_name`, `planting_date`, and `name` on the target feature.
3. `deleteParcelBoundary`:
   - Removes parcel from active collection.
4. `mergeDrawnParcels` and `removeDrawnParcel`:
   - Properly reconciles created and edited parcels in the collection.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_crud.js`
Expected: FAIL with functions not exported.

- [ ] **Step 3: Implement CRUD service methods and wire FieldMapPage**

1. Update `frontend/src/services/farmMapService.ts`:
   - Implement `saveParcel(options: { apiBaseUrl: string; parcelsPath: string; mode: GisDataMode; parcel: ParcelFormData; geometry: GeoJSON.Polygon; areaHa: number; fieldId?: string | null })`.
   - Implement `updateParcelMetadata(options: { apiBaseUrl: string; parcelsPath: string; mode: GisDataMode; parcelId: string; data: ParcelFormData })`.
   - Implement `deleteParcelBoundary(options: { apiBaseUrl: string; parcelsPath: string; mode: GisDataMode; parcelId: string })`.
   - Ensure resilient fallback: in `auto` and `sample` modes, optimistic client state updates succeed seamlessly even when backend is offline or unreachable.
2. Update `frontend/src/utils/farmMapPage.ts`:
   - Add helper `updateParcelInCollection(collection, parcelId, data)`.
   - Update `formatParcelFeedback` to handle registration and update feedback messages.
3. Update `frontend/src/pages/FieldMapPage.tsx`:
   - Manage state:
     - `isDrawerOpen: boolean`
     - `drawerMode: 'create' | 'edit'`
     - `selectedParcel: GeoJSON.Feature<GeoJSON.Polygon> | null`
     - `pendingParcel: { feature: GeoJSON.Feature<GeoJSON.Polygon>; metrics: ParcelMetrics } | null`
     - `isSaving: boolean`
   - On `handlePolygonComplete`:
     - Opens drawer in `'create'` mode with `pendingParcel`.
   - On `handleParcelSelect`:
     - Opens drawer in `'edit'` mode with selected parcel.
   - On `handleDrawerSave(formData)`:
     - Calls `farmMapService.saveParcel` (or `updateParcelMetadata`).
     - Merges confirmed parcel into active collection.
     - Closes drawer and displays success toast.
   - On `handleDrawerDiscard`:
     - If pending parcel was being created, remove drawing vector.
     - Close drawer.
   - On `handleDrawerDelete`:
     - Calls `farmMapService.deleteParcelBoundary`.
     - Removes parcel from collection and displays removal toast.
     - Close drawer.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types frontend/scripts/test_farm_map_crud.js && npm --prefix frontend run test:map`
Expected: PASS all tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/farmMapService.ts frontend/src/utils/farmMapPage.ts frontend/src/pages/FieldMapPage.tsx frontend/scripts/test_farm_map_crud.js
git commit -m "feat(map): wire spatial CRUD service, drawer state machine and FieldMapPage flow"
```

---

### Task 5: Documentation, Verification & Milestone Completion Report

**Files:**
- Modify: `frontend/package.json` (add new test scripts to `test:map`)
- Modify: `frontend/README.md`
- Create: `PROJECT_DETAILS/Reports/Phase 2/TODO-209-parcel-drawer.md`

**Interfaces:**
- Consumes: All deliverables from Tasks 1-4.
- Produces:
  - Updated `test:map` suite covering metadata policies, centroid math, drawer logic, and CRUD operations.
  - Comprehensive milestone report `TODO-209-parcel-drawer.md`.
  - Verified production build and linting.

- [ ] **Step 1: Update package.json test scripts**

Modify `frontend/package.json`:
- Update `"test:map"` to include `scripts/test_parcel_metadata.js`, `scripts/test_parcel_styling.js`, `scripts/test_parcel_drawer.js`, and `scripts/test_farm_map_crud.js`.

- [ ] **Step 2: Run complete test and linting verification**

Run:
```bash
npm --prefix frontend run test:map
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:diagnostics
npm --prefix frontend run test:assembly
dotnet build backend/AgriTech.Api.csproj
```
Expected: All suites PASS with 0 errors and 0 warnings.

- [ ] **Step 3: Document features in frontend README and create Phase 2 milestone report**

1. Update `frontend/README.md` with TODO-209 documentation:
   - Parcel Metadata Drawer (`<ParcelMetadataDrawer />`).
   - Dynamic Crop Color Categorization (`CROP_PALETTES`).
   - Centroid Tooltips Micro-Badges (`<ParcelCentroidLabelsLayer />`).
   - Spatial CRUD API and resilient offline fallback.
2. Create `PROJECT_DETAILS/Reports/Phase 2/TODO-209-parcel-drawer.md`:
   - Summary of implemented components, state machine, Z-index hierarchy compliance, and test matrix.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/README.md "PROJECT_DETAILS/Reports/Phase 2/TODO-209-parcel-drawer.md"
git commit -m "docs(map): document TODO-209 parcel drawer and record milestone report"
```

---

## Plan Self-Review Checklist

1. **Spec Coverage:**
   - Section 4.1: Drawer shell & motion engineering (440px desktop panel, Apple spring 320ms, mobile bottom sheet, grab handle) -> Covered in Task 3.
   - Section 4.2: Form controls & fields (Name, Crop selector with emoji & families, Soil profile with $\theta_{\text{FC}}$, Planting date with DAP badge, Save/Discard buttons) -> Covered in Tasks 1 & 3.
   - Section 4.3: Crop categorization palette (Tomato `#10B981`, Corn `#F59E0B`, Potato `#8B5CF6`, Apple `#EC4899`, selected outlines) -> Covered in Tasks 1 & 2.
   - Section 4.4: Persistent centroid tooltip labels (micro-badges at centroid, zoom $\ge 14$ vs $< 14$) -> Covered in Tasks 1 & 2.
   - Section 5.1 & 5.2: Z-index matrix and UI state machine flow (auto-open on complete, inspect/edit on click, save to API, discard, delete) -> Covered in Task 4.
2. **Step Scan:** Every step specifies exact files, interfaces, test commands, and assertions. No vague steps or missing types.
3. **Type Consistency:** Types defined in Task 1 (`CropCategory`, `SoilType`, `CropPalette`, `ParcelFormData`, `ParcelCentroid`) are consistently consumed in Tasks 2, 3, and 4.
4. **Review Focus Coverage:**
   - Future/extreme past planting dates -> Exercised in Task 1 Step 1.
   - Missing/null properties on loaded parcels -> Exercised in Task 2 Step 1.
   - Double-save / rapid submission race -> Handled in Task 3 Step 3 and Task 4 Step 3.
   - Centroid placement for complex geometries -> Exercised in Task 1 Step 1.
   - Network failure resilience in `auto`/`sample` -> Exercised in Task 4 Step 1.
5. **Proportion:** Right-sized across 5 distinct, independently reviewable tasks with clear verification gates.
