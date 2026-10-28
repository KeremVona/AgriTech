# TODO-208 / TODO-209 Review Follow-ups

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to work through this plan task by task. Use superpowers:test-driven-development wherever a pure `.ts` helper is involved: write the failing test first, then the code. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 bugs and 3 smaller issues found while reviewing the branch `fix/web-todo208-209-review-findings`, which implemented `docs/superpowers/plans/2026-10-28-todo-207-209-review-fixes.md`. A reviewer reproduced each one in the browser (sample mode, desktop width).

**Branch:** Keep working on `fix/web-todo208-209-review-findings`. Do not create a new branch, do not touch `main`, and do not push. Make one commit per item, in the existing style (e.g. `fix(map): ...`, `refactor(map): ...`).

**Scope:** Frontend only (`frontend/`). **Do not change anything in `backend/`, `docker/` or the database.** Do not redo or undo the earlier fixes 1–7. Change only what this plan asks for.

**Tech stack:** React 19, TypeScript, React-Leaflet 5, Leaflet 1.9, Geoman (`@geoman-io/leaflet-geoman-free` 2.20), Turf.js. Tests are plain Node scripts in `frontend/scripts/` run with `node --experimental-strip-types`. They cover pure `.ts` modules only: no DOM, no React rendering.

---

## Background you need

### How the map page is wired

- `frontend/src/pages/FieldMapPage.tsx` owns all state:
  - `drawnParcels`: parcels drawn in this session, both pending and saved.
  - `pendingParcel`: the one drawn but not yet saved.
  - `selectedParcel`, `isDrawerOpen`, `drawerMode`: the drawer.
  - `parcelOverrides`: metadata edits.
  - `geometryOverrides`: vertex and drag edits.
  - `deletedIds`.
  - `renderVersion`: bumping it remounts the parcel layer.
- The `collection` memo (around L83–106) = loaded data (`data.collection`) minus `deletedIds`, plus `parcelOverrides` and `geometryOverrides`. Then `scopedCollection` (L109) filters it by `fieldId`, and `activeCollection` (L111) adds `drawnParcels`. **`activeCollection` is what gets drawn.**
- `frontend/src/components/FarmMap/FarmMapContainer.tsx`:
  - It holds the toolbar mode (`activeMode`, and `effectiveActiveMode`, which is `'idle' | 'draw' | 'edit' | 'drag' | 'delete'`).
  - `ParcelLayer` renders `collection` with react-leaflet `<GeoJSON key={`${features.length}-${renderVersion}`}>`. Its `onEachFeature` binds `click` (L64–68: `L.DomEvent.stopPropagation(e); onParcelSelectRef.current?.(feature)`), plus `pm:edit` and `pm:dragend`.
  - `ParcelCentroidLabelsLayer` renders one `<Marker>` label per parcel and also calls `onParcelSelect` on click.
  - `bounds = useMemo(() => getParcelBounds(collection), [collection])` (L181) feeds `<FarmMapViewport bounds=…>`. That component calls `map.fitBounds` **every time the bounds values change** (see `shouldFitParcels` in `farmMapPolicy.ts`).
- In delete mode, Geoman removes the clicked Leaflet layer **itself** and then fires `pm:remove`. `FarmMapDrawingManager.handleRemove` forwards that to `FieldMapPage.handlePolygonDelete(id)`.

### Commands (run from `frontend/`)

```bash
npm run test:map
```
```bash
npx tsc -b
```
```bash
npm run lint
```
```bash
npm run dev
```
`frontend/.env.local` already contains `VITE_GIS_DATA_MODE=sample`. Test page: `/fields/20700000-0000-4000-8000-000000000010/parcels`. All three checks pass before you start and must still pass at the end.

---

## Item 1 (bug) — Deleting from the toolbar opens the edit drawer for the deleted parcel

**What happens.** Turn on delete mode and click "Demo east parcel". The parcel is removed and "Parcel boundary removed…" shows, but the drawer **also opens in "Edit Parcel Metadata" mode for the deleted parcel**. Pressing "Update Parcel Metadata" there would send a `PUT` for a parcel that no longer exists.

**Why.** The same click does two things. Geoman's removal handler removes the layer and fires `pm:remove`, which leads to `handlePolygonDelete` → `deleteParcel`. **And** `ParcelLayer`'s own `click` handler calls `onParcelSelect`, which leads to `handleParcelSelect` (opens the drawer). `deleteParcel` tries to close the drawer with `if (selectedParcel && selId === targetId)`, but `selectedParcel` in that closure is the value from before the click, so the check misses.

The deeper cause: parcel clicks are handled in **every** toolbar mode. In draw mode the same handler also calls `L.DomEvent.stopPropagation`, so a click on an existing parcel never reaches the map. Geoman then cannot place a vertex there (for example when snapping a new parcel to a neighbour's edge), and the drawer opens instead.

**Target behaviour.** Parcel polygons and centroid labels open the drawer **only when the toolbar mode is `idle`**. In any other mode the click is left alone: no `onParcelSelect` call and no `stopPropagation`, so Geoman gets it.

**Steps.**
- [ ] In `FarmMapContainer.tsx`, compute `const parcelSelectHandler = effectiveActiveMode === 'idle' ? onParcelSelect : undefined;`. Pass it, instead of `onParcelSelect`, to both `<ParcelLayer>` (L244) and `<ParcelCentroidLabelsLayer>` (L251). `ParcelLayer` already keeps the latest value in `onParcelSelectRef`, so its listeners see the change without re-binding.
- [ ] In `ParcelLayer`'s `click` handler (L64–68), return early when `onParcelSelectRef.current` is undefined, **before** `L.DomEvent.stopPropagation(e)`, so in non-idle modes the click reaches the map and Geoman.
- [ ] Do the same in `ParcelCentroidLabelsLayer.tsx`'s marker `click` handler: return early when there is no handler.
- [ ] Keep the existing "close the drawer if it shows the deleted parcel" logic in `deleteParcel`. It is still right for the drawer's own Delete button.
- [ ] Browser check: delete mode → click a demo parcel → it disappears, the notice shows, and **the drawer stays closed**. Then draw mode → place a vertex by clicking **inside** an existing parcel → the vertex is placed and no drawer opens. Idle mode → clicking a parcel or its label still opens the edit drawer.

---

## Item 2 (bug) — The map re-zooms on every draw, edit and delete

**What happens.** `bounds` is computed from `activeCollection`, which includes newly drawn parcels, vertex edits and deletions. Whenever the outer edge of all parcels moves, `FarmMapViewport` calls `fitBounds` and the map animates to a new view. A reviewer saw the view jump after a single vertex drag in edit mode. The map also re-zooms right after drawing a parcel outside the current edge, and after deleting an edge parcel.

**Target behaviour.** Zoom-to-fit happens only when the **loaded data** changes (first load, retry or reload) or the **selected field** changes, plus when the user presses the existing fit button. Local drawing, editing and deleting never move the view.

**Steps.**
- [ ] In `FarmMapContainer.tsx`, add an optional prop `fitCollection?: ParcelFeatureCollection`, and change L181 to `const bounds = useMemo(() => getParcelBounds(fitCollection ?? collection), [fitCollection, collection]);`. `canFit={bounds !== null}` keeps working.
- [ ] In `FieldMapPage.tsx`, build it from the raw loaded data only, without overrides, deletions or drawn parcels:
  `const fitCollection = useMemo(() => filterParcelsByField(data?.collection ?? emptyCollection, fieldId), [data?.collection, fieldId]);`
  and pass `fitCollection={fitCollection}` to `<FarmMapContainer>`. Its reference changes only when `data` or `fieldId` changes.
- [ ] Do not change `FarmMapViewport.tsx` or `farmMapPolicy.ts`.
- [ ] Browser check: edit mode → drag a vertex outward → the view does **not** move. Draw a parcel outside the current edge and save it → the view does not move. Switch field in the header dropdown → the map still fits to that field. Press the fit button (bottom right) → it still fits.

---

## Item 3 (nice to have) — The map label shows the old area after a vertex edit

**What happens.** Edit a saved parcel's vertex (0.43 ha → 0.53 ha). The drawer correctly shows 0.53 ha, because it recomputes from geometry. But the centroid label on the map keeps "0.43 ha", even after "Update Parcel Metadata". The label reads `properties.area_hectares` (see `extractParcelCentroidData` in `utils/parcelStyling.ts`), and nothing updates that property when the geometry changes.

**Target behaviour.** Whenever a parcel's geometry changes locally, its `properties.area_hectares` is recomputed from the new geometry. This covers loaded parcels (via `geometryOverrides`), parcels saved this session (in `drawnParcels`) and the pending parcel.

**Steps.**
- [ ] In `frontend/src/utils/farmMapPage.ts`, add a pure helper `geometryAreaHa(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number`:
  - For a Polygon: `calculateParcelMetrics(geometry.coordinates[0]).areaHa`.
  - For a MultiPolygon: the sum of that over each polygon's outer ring.
  - Import `calculateParcelMetrics` from `./parcelTopology.ts`.
- [ ] Write tests first in `scripts/test_farm_map_crud.js`: a known square Polygon gives the same value as `calculateParcelMetrics`, and a MultiPolygon of two equal squares gives twice that.
- [ ] Make `applyGeometryOverrides` also set `properties.area_hectares` to `geometryAreaHa(newGeometry)` on each feature it changes. Extend its existing test to assert this.
- [ ] In `FieldMapPage.tsx` → `handleParcelGeometryChange` (L296), set `properties: { ...p.properties, area_hectares: geometryAreaHa(geometry) }` in both places it maps `drawnParcels`, and on the updated pending feature. For the pending feature you can use the `metrics.areaHa` you already compute.
- [ ] Browser check: edit a vertex of a saved parcel → the map label's area changes right away and still matches the drawer after "Update Parcel Metadata".

---

## Item 4 (nice to have) — An ignored delete leaves the parcel invisible

**What happens.** In delete mode, Geoman removes the clicked Leaflet layer **before** React hears about it. `handlePolygonDelete` (L262) and `deleteParcel` (L207) both `return` early when `isSaving` is true, e.g. when the user clicks a second parcel while the first delete request is still running. In that case the parcel is still in React state but its layer is gone from the map, and nothing redraws it until some unrelated change happens.

**Target behaviour.** Whenever the toolbar delete path decides **not** to delete, the parcel layer is redrawn so the polygon reappears.

**Steps.**
- [ ] In `handlePolygonDelete`, in the `isSaving` early return, call `setRenderVersion((v) => v + 1)` before returning. This is the same remount trick already used in `deleteParcel`'s `catch`.
- [ ] Leave the `!matchingParcel` early return as it is. It only triggers for non-parcel layers, and `ParcelLayer` remounting would not bring those back anyway.
- [ ] Leave the `isSaving` guard in `deleteParcel` alone. It is also used by the drawer button, where nothing was removed from the map.
- [ ] Browser check: this is hard to trigger in sample mode because deletes finish instantly. Confirm by reading the code. Optionally, in DevTools, set network throttling with a live backend, or temporarily wrap the call in a delay locally (do not commit that).

---

## Item 5 (nice to have) — Two small code cleanups

**5a. Constant above the imports.** In `frontend/src/services/farmMapService.ts`, `export const PARCELS_WRITE_PATH = '/api/v1/parcels';` sits on line 1, above the `import` lines. Move it below the imports. No behaviour change.

**5b. An argument with two meanings in `formatParcelFeedback`.** In `frontend/src/utils/farmMapPage.ts`, the second argument is currently "either `ParcelMetrics` or `{ localOnly }`", and the function inspects it with `'areaHa' in …` and `'localOnly' in …`. Make the signature plain:

```ts
export function formatParcelFeedback(
  type: 'complete' | 'delete' | 'register' | 'update',
  metrics?: ParcelMetrics,
  options?: { localOnly?: boolean },
): { type: 'success' | 'info'; message: string }
```

- [ ] Change the function, and remove the `in` checks.
- [ ] Update the callers in `FieldMapPage.tsx` that pass options: L250, L373 and L408 become `formatParcelFeedback('delete' | 'register' | 'update', undefined, { localOnly: isLocalOnly })`. L191 (`'complete', metrics`) and L289 (`'delete'`) stay as they are.
- [ ] Update the tests at `scripts/test_farm_map_crud.js` L601, L605 and L609 to the new form (`formatParcelFeedback('register', undefined, { localOnly: true })` and so on). The messages themselves must not change.

---

## Final verification

- [ ] `npm run test:map`, `npx tsc -b` and `npm run lint` all pass.
- [ ] Run **all** browser checks listed under Items 1–3 with `npm run dev`. **Actually open the app in a browser.** Do not report a browser check as done based on reading code or unit tests. If you cannot open a browser, say so plainly for each check.
- [ ] Re-run the earlier quick checks to be sure nothing broke:
  1. Draw → Discard leaves no polygon behind.
  2. Draw → Save gives one crop-coloured polygon with a label and the "saved to sample data" notice.
  3. A vertex edit survives drawing and discarding another polygon.
  4. A toolbar delete stays deleted.
  5. `/map` shows "Select a field to draw parcels", and clicking a parcel still opens the edit drawer.
- [ ] Add a short "Review follow-ups" list to the "Review fixes" section of `PROJECT_DETAILS/Reports/Phase 2/TODO-209-parcel-drawer.md`.

## Out of scope (do not do)

- Anything under `backend/`, `docker/` or the database.
- Merging the four request functions in `farmMapService.ts`, the style getter hack in `parcelStyling.ts`, the duplicate fallback config in `FieldMapPage.tsx`, MultiPolygon metrics in the drawer, and the notice-title logic.
- Pushing, opening a PR, or merging into `main`.
