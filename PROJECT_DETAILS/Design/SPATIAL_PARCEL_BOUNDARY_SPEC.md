# Spatial Parcel Boundary Subsystem: UX & Visual Specification
**System Designation:** "Precision Ag-Intelligence"  
**Subsystem:** Spatial GIS Parcel Boundary Management  
**Tickets Covered:** TODO-207 (Map Core & High-Resolution Tile Architecture), TODO-208 (Interactive Vector Polygon Drawing & Geoman Integration), TODO-209 (Parcel Metadata Drawer & Form)  
**Primary Route:** `/fields/:fieldId/parcels` | `/map`  
**Document Code:** `SPEC-UI-008`  
**Status:** PRODUCTION READY SPECIFICATION  

---

## 1. Subsystem Overview & Architectural Objectives

The **Spatial Parcel Boundary Subsystem** provides farm operators with an interactive geospatial canvas to delineate, manage, and monitor agricultural zones. Rather than treating farms as abstract tables, parcels are managed as real-world GeoJSON vector boundaries drawn on top of high-resolution satellite tiles.

### 1.1 Technical Foundations
* **Map Container (TODO-207):** Built using `react-leaflet` with seamless tile layer switching between **Esri World Imagery** (high-resolution satellite) and **OpenStreetMap** (cartographic street vectors), coupled with dynamic bounding-box auto-centering (`L.latLngBounds`).
* **Vector Drawing Engine (TODO-208):** Powered by `@geoman-io/leaflet-geoman-free`, providing smooth vertex placement, mid-segment insertion handles, polygon rotation/dragging, and real-time surface area calculations via Turf.js (`@turf/area`).
* **Self-Intersection Defense (TODO-208):** Client-side topological validation via Turf.js (`@turf/kinks`) that detects self-intersecting strokes in real time, visually alerting operators and blocking invalid polygon submissions before reaching the PostGIS backend.
* **Metadata Association (TODO-209):** A sliding drawer interface that automatically opens upon polygon completion to capture agronomic metadata (Parcel Name, Crop Type, Soil Profile, Planting Date) and immediately paints the polygon with crop-specific semantic color fills.

---

## 2. Spatial Viewport & Map Architecture (TODO-207)

The spatial canvas serves as the foundational layer of the application. It replaces raw Leaflet UI controls with modern enterprise floating controls engineered for high sunlight visibility.

```
+-----------------------------------------------------------------------------------------------------------------------------+
| [TOP BAR: Farm Selector / Field Stats / Active Layer Summary]                                                               |
+-----------------------------------------------------------------------------------------------------------------------------+
| [MAP VIEWPORT: Full-Height Responsive Canvas (100vh - Header)]                                                              |
|                                                                                                                             |
|  [TOP-LEFT: DRAWING TOOLBAR]                                                  [TOP-RIGHT: BASEMAP & LAYER SWITCHER]         |
|  +-------------------------------------+                                      +-----------------------------------------+   |
|  | [Polygon] [Edit] [Drag] [Delete]    |                                      | [ Satellite (Esri) ] [ Streets (OSM) ]  |   |
|  +-------------------------------------+                                      +-----------------------------------------+   |
|                                                                                                                             |
|                                   [ P-01: TOMATO - SAN MARZANO ]                                                            |
|                                    Stroke: 2px solid #10B981                                                                |
|                                    Fill: rgba(16, 185, 129, 0.18)                                                           |
|                                    Tooltip: "P-01 • Tomato • 2.45 ha"                                                       |
|                                                                                                                             |
|                                                                                                                             |
|  [BOTTOM-LEFT: COMPASS & LIVE COORD HUD]                                      [BOTTOM-RIGHT: ZOOM & RE-CENTER DOCK]         |
|  +------------------------------------------------+                           +-----------------------------------------+   |
|  | [Compass N] 38.42371° N, 27.14282° E | 1:5,000 |                           | [+] Zoom In                             |   |
|  | Scale: 50m | 150ft                             |                           | [-] Zoom Out                            |   |
|  +------------------------------------------------+                           | [o] Fit Parcels (Auto Bounding Box)     |   |
|                                                                               +-----------------------------------------+   |
+-----------------------------------------------------------------------------------------------------------------------------+
```

### 2.1 Viewport Framing & Safe Zones

* **Desktop Viewport ($\ge 1024\text{px}$):** Full-height spatial layout occupying `calc(100vh - 64px)` without outer page scrollbars. Floating map controls maintain a minimum `20px` inset margin from viewport edges.
* **Mobile Viewport ($375\text{px} - 430\text{px}$):** Floating controls reposition into compact floating clusters:
  * Top controls maintain `12px` padding below the mobile header.
  * Bottom controls clear a `calc(72px + env(safe-area-inset-bottom))` safe zone to prevent obstruction by bottom navigation bars.
* **Auto-Centering Logic:** When parcel data is fetched or a field is selected:
  ```typescript
  const bounds = L.latLngBounds(parcels.map(p => p.coordinates));
  map.fitBounds(bounds, {
    padding: [48, 48], // Desktop safe padding
    maxZoom: 18,
    animate: true,
    duration: 0.8
  });
  ```

---

### 2.2 Custom Floating Map Controls Styling

Raw Leaflet buttons (`leaflet-bar`, gray borders, harsh square shadows) are entirely suppressed via CSS. All map controls are replaced with custom frosted slate glass panels:

```css
/* Base Style for All Floating Map Controls */
.ag-map-control-card {
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
  border-radius: 8px;
  color: #0F172A;
  transition: transform 120ms ease-out, border-color 150ms ease, box-shadow 150ms ease;
}

@media (max-width: 768px) {
  .ag-map-control-card {
    background-color: #FFFFFF; /* High-sunlight solid fallback */
    border-width: 1.5px;
    border-color: #9CA3AF;
  }
}
```

#### Floating Control Modules:
1. **Base Layer Switcher (Top-Right):**
   * Dimensions: Compact segmented toggle (`h-9 p-1 flex items-center gap-1`).
   * Inactive Option: `text-slate-600 hover:text-slate-900 text-xs font-medium px-2.5 py-1 rounded-md transition-colors`.
   * Active Option: `bg-teal-700 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs`.
   * Options: **Satellite (Esri World Imagery)** and **Streets (OpenStreetMap)**.
2. **Navigation & Re-Center Dock (Bottom-Right):**
   * Vertical button stack: `[+]` Zoom In, `[-]` Zoom Out, `[⛶]` Fit All Parcels (Auto-Bounds).
   * Button styling: `w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-[0.95] cursor-pointer`.
   * Dividers: Internal `1px solid #E2E8F0` hairline between buttons.
3. **Telemetry Coordinates & Scale Pill (Bottom-Left):**
   * Displays cursor coordinates with micro-scale bar: `38.42371° N, 27.14282° E | Scale: 50m`.
   * Font: `Geist Mono` 11px, `tabular-nums`, color `#475569`.
4. **North Compass Indicator:**
   * 32px circular pill featuring an SVG compass arrow pointing strictly North (`0°` rotation), providing orientation in wide field views.

---

## 3. Interactive Vector Polygon Drawing & Geoman Integration (TODO-208)

Vector boundary drawing is integrated via `@geoman-io/leaflet-geoman-free`, styled with precision visual tokens that prevent visual ambiguity against dark satellite imagery.

```
+-----------------------------------------------------------------------------------+
|  [ACTIVE DRAWING MODE]                                                            |
|                                                                                   |
|     Vertex 1 (Anchored)                         Vertex 2 (Anchored)               |
|     (•) 10px Teal Disc                          (•) 10px Teal Disc                |
|      \                                           /                                |
|       \   2px dashed #0F766E                    /                                 |
|        \                                       /                                  |
|         \                                     /                                   |
|          (•) Midpoint Insert Handle          /                                    |
|          6px semi-transparent               /                                     |
|            \                               /                                      |
|             \                             /                                       |
|              (x) Cursor Active Vertex ───'                                        |
|              Precision Crosshair                                                  |
|                                                                                   |
|  [FLOATING LIVE DRAWING HUD BADGE]                                                |
|  +-----------------------------------------------------------------------------+  |
|  | AREA: 1.84 ha (4.55 acres) | PERIMETER: 542 m | VERTICES: 5                 |  |
|  | Action: Click first point to close polygon | [ ESC to Cancel ]              |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 3.1 Custom Geoman Toolbar & Cursor States

* **Drawing Toolbar Shell:** Positioned at `top-4 left-4 z-[1000]`. Uses the `.ag-map-control-card` container.
* **Tool Buttons (40px touch targets):**
  * `[Draw Polygon]` (Pen icon with polygon node).
  * `[Edit Vertices]` (Cursor with node adjustment handles).
  * `[Drag Parcel]` (Move hand icon).
  * `[Delete Parcel]` (Trash can icon).
* **Active Tool Indicator:** Selected tool receives `bg-teal-50 border border-teal-600 text-teal-800` styling.
* **Cursor States:**
  * Idle Map: `cursor-default` or `cursor-grab`.
  * Active Drawing Mode: `cursor-crosshair`.
  * Hovering Existing Vertex: `cursor-pointer`.
  * Dragging Vertex: `cursor-grabbing`.

### 3.2 Vertex Handle & Stroke Visual Styling

| Element | Idle State | Hover State | Dragging / Active State |
| :--- | :--- | :--- | :--- |
| **Main Vertex Handle** | 10px circle, `#0F766E` fill, `2px solid #FFFFFF`, shadow `0 2px 4px rgba(0,0,0,0.3)` | 14px circle, `#115E59` fill, `2.5px solid #FFFFFF` | 14px circle, `#0D9488` fill, `ring-4 ring-teal-500/30` |
| **Midpoint Insert Handle**| 6px circle, `#FFFFFF` fill, `2px solid #0F766E`, opacity `0.85` | 10px circle, `#0F766E` fill, `2px solid #FFFFFF` | Promotes to Main Vertex Handle |
| **Drawing Guide Line** | `2px dashed #0F766E`, dash pattern `6 4` | N/A | Rubber-band line following pointer |
| **In-Progress Polygon Fill**| `rgba(15, 118, 110, 0.14)` | N/A | Semi-translucent Bio-Teal surface |

---

### 3.3 Live Drawing HUD Overlay (`<DrawingLiveAreaBadge />`)

During active polygon drawing, a floating HUD pill docks at the top-center of the map (`top-4 left-1/2 -translate-x-1/2 z-[1000]`):

* **Real-time Turf.js Calculation:** On every vertex placement and mouse movement:
  ```typescript
  import area from '@turf/area';
  import { polygon } from '@turf/helpers';

  const squareMeters = area(polygon([currentCoordinates]));
  const hectares = (squareMeters / 10000).toFixed(2);
  const acres = (squareMeters * 0.000247105).toFixed(2);
  ```
* **Visual Card Styling:**
  * Background: `#FFFFFF` (94% opacity with `backdrop-blur-md`).
  * Border: `1px solid #CBD5E1`.
  * Metrics Display: `Geist Mono` 13px Bold, `tabular-nums`.
  * Format: `1.84 ha (4.55 acres) • 5 Vertices • Perimeter: 542m`.
  * User Microcopy: *"Click initial vertex to complete polygon • Press ESC to cancel."*

---

### 3.4 Kinks & Self-Intersection Warning State

Self-intersecting polygons ("figure-eights" or bowties) break PostGIS geometric spatial queries. The UI validates topology on every vertex move using `@turf/kinks`.

```
+-----------------------------------------------------------------------------------+
|  [!] SELF-INTERSECTION DETECTED (TURF.JS KINKS ERROR)                             |
|                                                                                   |
|           Vertex 1 ───────────────.                                               |
|                    \               \                                              |
|                     \      ( X ) <── Pulsing Red Kink Marker                      |
|                      \     /         Lat: 38.4239°, Lng: 27.1431°                 |
|                       \   /                                                       |
|           Vertex 3 ────\─'                                                        |
|                                                                                   |
|  Stroke: 2.5px solid #EF4444 (Red 500) | Fill: rgba(239, 68, 68, 0.22)            |
|                                                                                   |
|  FLOATING ERROR ALERT HUD:                                                        |
|  +-----------------------------------------------------------------------------+  |
|  | [!] SELF-INTERSECTING BOUNDARY: Lines cannot cross over each other.         |  |
|  |     Move vertex to uncross lines before completing parcel.                  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

#### Visual Treatment for Invalid Polygons:
1. **Stroke Highlight:** The in-progress polygon stroke immediately transitions from Bio-Teal `#0F766E` to **Red 500 `#EF4444`** (`stroke-width: 2.5px`, solid).
2. **Fill Highlight:** Fill opacity shifts to `rgba(239, 68, 68, 0.22)`.
3. **Pulsing Kink Intersection Marker:** At the exact coordinate intersection returned by `@turf/kinks`, Leaflet renders a 16px pulsating red marker ring (`bg-red-600 ring-4 ring-red-400/50 animate-ping`).
4. **Floating Alert Banner:** A warning toast anchors below the Live Drawing HUD:
   * Styling: `bg-red-50 text-red-900 border border-red-300 shadow-hud px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2`.
   * Text: `Self-intersecting polygon. Uncross boundary lines to complete parcel.`
5. **Hard Submission Lockout:** While kinks exist, double-clicking or clicking the initial vertex to close the polygon is completely disabled.

---

## 4. Parcel Metadata Drawer & Form Design (TODO-209)

Upon successfully closing a valid polygon (or clicking an existing parcel on the map), the **Parcel Metadata Drawer** slides smoothly into view.

```
+-----------------------------------------------------------------------------------+
| MAP CANVAS (Dimmed 10% during active editing)     | PARCEL METADATA DRAWER (440px)|
|                                                   |                               |
|                                                   | [<-] Parcel Setup        [ X ]|
|                                                   +-------------------------------+
|                                                   | AREA SUMMARY (AUTO-CALCULATED)|
|                                                   | 2.45 ha (6.05 acres)          |
|                                                   | Perimeter: 624 m              |
|                                                   +-------------------------------+
|                                                   | FORM FIELDS:                  |
|                                                   |                               |
|                                                   | 1. Parcel Name *              |
|                                                   | [ P-04 - North Field Potato ] |
|                                                   |                               |
|                                                   | 2. Crop Type *                |
|                                                   | [🥔 Potato (Solanaceae)    v] |
|                                                   |                               |
|                                                   | 3. Soil Profile *             |
|                                                   | [ Sandy Loam (Optimal)     v] |
|                                                   |                               |
|                                                   | 4. Planting Date *            |
|                                                   | [ 2026-04-15 (DAP: 42)    📅] |
|                                                   +-------------------------------+
|                                                   | CROP PALETTE PREVIEW:         |
|                                                   | Stroke: #8B5CF6 | Fill: 18%   |
|                                                   +-------------------------------+
|                                                   | [ SAVE PARCEL ] [ DISCARD ]   |
+-----------------------------------------------------------------------------------+
```

### 4.1 Drawer Shell & Motion Engineering

* **Desktop Viewport ($\ge 1024\text{px}$):**
  * Positioning: Fixed docked panel on the right side of the screen (`fixed top-0 right-0 h-full w-[440px] z-[1200]`).
  * Elevation: `#FFFFFF` surface, `1px solid #E2E8F0` left border, `shadow-modal` (`0 20px 40px -8px rgba(15, 23, 42, 0.18)`).
  * Transition: Enters via Apple fluid spring physics:
    ```css
    .ag-drawer-desktop {
      transform: translateX(100%);
      transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
      will-change: transform;
    }
    .ag-drawer-desktop[data-open="true"] {
      transform: translateX(0%);
    }
    ```
* **Mobile Viewport ($< 768\text{px}$):**
  * Positioning: Slide-up bottom sheet (`fixed bottom-0 left-0 right-0 max-h-[88vh] rounded-t-2xl z-[1200]`).
  * Grab Handle: 36px wide by 4px high pill centered at `top-3` (`bg-slate-300 rounded-full`).
  * Padding: Bottom padded with `calc(20px + env(safe-area-inset-bottom))`.

---

### 4.2 Form Controls & Field Specifications

1. **Parcel Name Input:**
   * Label: `Parcel Name / Code` (Required).
   * Input: Height `42px` (Desktop) / `48px` (Mobile). Minimum font size `16px` on mobile to prevent iOS Safari auto-zoom.
   * Placeholder: `e.g., Parcel 04 - East Valley Corn`.
2. **Crop Type Custom Selector:**
   * Options: **Tomato**, **Corn (Maize)**, **Potato**, **Apple**.
   * Dropdown Items feature:
     * High-contrast crop icon (`🍅`, `🌽`, `🥔`, `🍏`).
     * Botanical family name in secondary text (`Solanaceae`, `Poaceae`, `Rosaceae`).
     * Color swatch showing the corresponding polygon stroke color.
3. **Soil Profile Custom Dropdown:**
   * Options:
     * **Sand:** Low water retention, rapid drainage ($\theta_{\text{FC}} = 0.12$).
     * **Sandy Loam:** Recommended agronomic balance, optimal drainage ($\theta_{\text{FC}} = 0.22$).
     * **Silt:** High moisture retention, medium aeration ($\theta_{\text{FC}} = 0.31$).
     * **Clay:** Very high retention, heavy compaction risk ($\theta_{\text{FC}} = 0.38$).
4. **Planting Date Picker:**
   * Standardized date input (`type="date"`) paired with a calculated **Days After Planting (DAP)** badge:
     * If date is `2026-04-15` and today is `2026-05-27`, renders: `DAP: 42 Days (Development Stage)`.
5. **Action Buttons:**
   * Primary Button: `[ Save Parcel Boundary ]` (Solid Bio-Teal `#0F766E`, height `44px`, `:active: scale(0.97)`).
   * Secondary Button: `[ Discard Boundary ]` (Outline `#CBD5E1`, text `#475569`, hover `#F1F5F9`).

---

### 4.3 Crop Categorization Palette

Polygons rendered on the map reflect standardized semantic color pairings ensuring instant visual recognition across crop varieties:

| Crop Category | Scientific Name | Vector Stroke Hex | Translucent Fill Hex (18%) | Selected Outline Stroke |
| :--- | :--- | :--- | :--- | :--- |
| **Tomato** | *Solanum lycopersicum* | `#10B981` (Emerald 500, 2px) | `rgba(16, 185, 129, 0.18)` | `#047857` (3px solid + halo) |
| **Corn (Maize)** | *Zea mays* | `#F59E0B` (Amber 500, 2px) | `rgba(245, 158, 11, 0.18)` | `#B45309` (3px solid + halo) |
| **Potato** | *Solanum tuberosum* | `#8B5CF6` (Violet 500, 2px) | `rgba(139, 92, 246, 0.18)` | `#6D28D9` (3px solid + halo) |
| **Apple** | *Malus domestica* | `#EC4899` (Pink 500, 2px) | `rgba(236, 72, 153, 0.18)` | `#BE185D` (3px solid + halo) |

---

### 4.4 Persistent Centroid Map Tooltip Labels

To prevent clutter, parcels display a clean, floating micro-badge anchored to their geometric centroid (`ST_Centroid(geom)`):

```
+---------------------------------------+
| (•) P-04 • Potato (San Marzano)       |
| Area: 2.45 ha | Soil: Sandy Loam      |
+---------------------------------------+
```

* **HTML Structure:** Injected via Leaflet `L.divIcon`:
  ```html
  <div class="ag-parcel-tooltip">
    <div class="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
      <span class="w-2 h-2 rounded-full" style="background-color: #8B5CF6;"></span>
      <span>P-04 • Potato</span>
    </div>
    <div class="text-[10px] font-mono text-slate-500 mt-0.5">
      2.45 ha • Sandy Loam
    </div>
  </div>
  ```
* **Styling Specification:**
  * Background: `rgba(255, 255, 255, 0.94)` with `backdrop-filter: blur(8px)`.
  * Border: `1px solid rgba(203, 213, 225, 0.8)`.
  * Box Shadow: `0 2px 8px rgba(15, 23, 42, 0.08)`.
  * Padding: `4px 8px`.
  * Border Radius: `6px`.
  * Behavior: Persistent at `Zoom >= 14`; collapses to mini-dot badges at `Zoom < 14` to prevent label collisions.

---

## 5. Z-Index Layering Matrix & UI State Machine

Spatial GIS interfaces suffer from severe stacking bugs if z-indexes are not rigorously orchestrated. Leaflet defines internal DOM panes that must harmonize with external React UI overlays.

### 5.1 Strict Z-Index Hierarchy Matrix

| Layer / Component | DOM Element / Leaflet Pane | Z-Index Value | Purpose & Interaction Behavior |
| :--- | :--- | :--- | :--- |
| **Base Map Tile Layer** | `.leaflet-tile-pane` | `z-index: 200` | Satellite (Esri) and street (OSM) raster image tiles. |
| **Saved Vector Polygons** | `.leaflet-overlay-pane` | `z-index: 400` | SVG parcel polygon geometries and borders. |
| **Centroid Tooltip Labels**| `.leaflet-marker-pane` | `z-index: 500` | Persistent parcel name/area micro-badges. |
| **Geoman Drawing Handles**| `.leaflet-marker-pane` (Geoman)| `z-index: 600` | Active vertex markers, midpoint handles, and drag targets. |
| **Floating Map HUD Controls**| React Portal (Over Map) | `z-index: 1000` | Drawing toolbar, Basemap switcher, Zoom buttons, Live Area HUD. |
| **Kink Error Toast Alert** | React Portal (Over Map) | `z-index: 1050` | Self-intersection alert banner. |
| **Metadata Sliding Drawer** | React Portal (Right / Bottom)| `z-index: 1200` | Slide-over parcel form (desktop) or bottom sheet (mobile). |
| **Modal Confirmation Dialog**| React Portal (Root Level) | `z-index: 1300` | "Discard Changes?" or "Delete Parcel?" alert modals. |

---

### 5.2 End-to-End UI State Machine Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               PARCEL BOUNDARY UI STATE MACHINE                                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [ 1. IDLE_MAP ] ──(Click Draw Polygon)──► [ 2. DRAWING_ACTIVE ]                                │
│          ▲                                             │                                         │
│          │ (Discard / Cancel)                          ├──(Self-Intersection Detected)           │
│          │                                             │   │                                     │
│          │                                             │   ▼                                     │
│          │                                             │ [ 3. DRAWING_INVALID_KINK ]             │
│          │                                             │   │ (Uncross Lines / Move Vertex)       │
│          │                                             │   ▼                                     │
│          │                                             └──► [ 2. DRAWING_ACTIVE ]                │
│          │                                                        │                              │
│          │                                                        ├──(Click First Point / Close) │
│          │                                                        ▼                              │
│          │                                            [ 4. POLYGON_COMPLETED ]                   │
│          │                                                        │                              │
│          │                                                        ├──(Auto-Open Sliding Drawer)  │
│          │                                                        ▼                              │
│   [ 6. SAVED_RENDERED ] ◄──(Save Success 200 OK)────── [ 5. METADATA_EDITING ]                   │
│          │                                                        │                              │
│          ├──(Click Existing Parcel)                               └──(Validation Error 400)      │
│          ▼                                                            (Highlight Missing Field)  │
│   [ 7. PARCEL_INSPECT_EDIT ]                                                                     │
│          │                                                                                       │
│          ├──(Update Geometry / Edit Form) ──► PUT /api/v1/parcels/{id}                           │
│          └──(Delete Parcel) ────────────────► DELETE /api/v1/parcels/{id}                        │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed State Transition Contract:
1. **`IDLE_MAP`:** Standard map navigation. Parcels are displayed with crop colors and centroid labels. Hovering over a parcel subtly darkens its stroke (`2px` $\to$ `2.5px`). Clicking a parcel transitions to `PARCEL_INSPECT_EDIT`.
2. **`DRAWING_ACTIVE`:** Geoman polygon mode enabled. Cursor is `crosshair`. Clicking drops vertices. Live Drawing Area HUD displays real-time area. ESC key cancels and returns to `IDLE_MAP`.
3. **`DRAWING_INVALID_KINK`:** Turf.js detects self-intersection (`kinks.features.length > 0`). In-progress line turns `#EF4444`, pulsing red marker appears at the intersection point, and completion is locked. Moving the vertex to uncross lines immediately restores `DRAWING_ACTIVE`.
4. **`POLYGON_COMPLETED`:** User clicks the initial vertex. Geoman finishes the ring. Turf.js calculates final area in hectares. The system transitions to `METADATA_EDITING` and opens the sliding drawer automatically.
5. **`METADATA_EDITING`:** Drawer slides in (`320ms ease-out`). Map viewport shifts slightly left (`padding-right: 440px`) to keep the drawn parcel centered. Form captures Name, Crop, Soil, Planting Date. Clicking *"Save"* triggers `POST /api/v1/parcels`.
6. **`SAVED_RENDERED`:** API returns `201 Created`. Drawer closes. The newly created parcel replaces the drawing vector, painted with the crop's official palette and a permanent centroid label. Toast confirms: *"Parcel successfully registered."*
7. **`PARCEL_INSPECT_EDIT`:** Clicking an existing parcel opens the drawer in inspect/edit mode. The operator can edit metadata or click *"Edit Boundary"* to re-engage Geoman vertex handles.

---

## 6. Implementation Reference Code (Frontend Engineering Contract)

For the frontend engineering agent implementing tickets TODO-207, TODO-208, and TODO-209:

```tsx
import React, { useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import area from '@turf/area';
import kinks from '@turf/kinks';
import { polygon } from '@turf/helpers';

export type CropCategory = 'Tomato' | 'Corn' | 'Potato' | 'Apple';
export type SoilType = 'Sand' | 'Sandy Loam' | 'Silt' | 'Clay';
export type BaseLayerType = 'satellite' | 'streets';

export const CROP_PALETTES: Record<CropCategory, { stroke: string; fill: string }> = {
  Tomato: { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.18)' },
  Corn: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.18)' },
  Potato: { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.18)' },
  Apple: { stroke: '#EC4899', fill: 'rgba(236, 72, 153, 0.18)' },
};

export function FarmMapContainer() {
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('satellite');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [liveAreaHa, setLiveAreaHa] = useState<number | null>(null);
  const [hasKinks, setHasKinks] = useState<boolean>(false);
  const [activePolygonGeom, setActivePolygonGeom] = useState<any>(null);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-slate-900 select-none">
      {/* 1. Floating Base Layer Switcher (Top Right - TODO-207) */}
      <div className="absolute top-4 right-4 z-[1000] ag-map-control-card p-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setBaseLayer('satellite')}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
            baseLayer === 'satellite' ? 'bg-teal-700 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => setBaseLayer('streets')}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
            baseLayer === 'streets' ? 'bg-teal-700 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Streets
        </button>
      </div>

      {/* 2. Live Drawing HUD Overlay (Top Center - TODO-208) */}
      {liveAreaHa !== null && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] ag-map-control-card px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            <span>{liveAreaHa.toFixed(2)} ha ({(liveAreaHa * 2.47105).toFixed(2)} ac)</span>
          </div>
          {hasKinks && (
            <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
              [!] Self-intersecting border
            </span>
          )}
        </div>
      )}

      {/* 3. React-Leaflet Map Instance */}
      <MapContainer
        center={[38.4237, 27.1428]}
        zoom={15}
        className="w-full h-full"
        zoomControl={false}
      >
        {baseLayer === 'satellite' ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            maxZoom={19}
          />
        )}
      </MapContainer>

      {/* 4. Sliding Parcel Metadata Drawer (TODO-209) */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-modal z-[1200] transform transition-transform duration-320 ease-out flex flex-col ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Parcel Metadata</h2>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            ✕
          </button>
        </div>
        {/* Form controls rendered here */}
      </div>
    </div>
  );
}
```
