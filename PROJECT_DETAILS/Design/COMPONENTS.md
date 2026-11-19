# UI Component Library & Agronomic Organism Specification
**System Designation:** "Precision Ag-Intelligence"  
**Scope:** Core UI Primitives, GIS Overlays, 3D Canvas, Telemetry Charts, Progression Slider, and Climate Choropleth  
**Document Code:** `SPEC-DES-003`  

---

## 1. Core UI Atoms & Molecules

### 1.1 Buttons (`<AgButton />`)

Buttons are tactile, direct, and explicit. Following Apple WWDC fluid interface rules, buttons register feedback on `pointerdown` rather than waiting for `click`.

```
[ Primary CTA: Solid Bio-Teal ]    [ Secondary: Outline Slate ]    [ Danger: Solid Red ]
```

| Variant | Idle Styling | Hover State | Active Press State (`:active`) | Min Height |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `bg-teal-700 text-white font-medium shadow-xs` | `bg-teal-800` | `bg-teal-900 transform scale-[0.97]` | `40px` (Desktop) / `48px` (Mobile) |
| **Secondary** | `bg-white text-slate-800 border border-slate-300 shadow-xs` | `bg-slate-50 border-slate-400` | `bg-slate-100 transform scale-[0.97]` | `40px` (Desktop) / `48px` (Mobile) |
| **Danger** | `bg-red-600 text-white font-medium shadow-xs` | `bg-red-700` | `bg-red-800 transform scale-[0.97]` | `40px` (Desktop) / `48px` (Mobile) |
| **Ghost / Icon**| `bg-transparent text-slate-600 hover:text-slate-900` | `bg-slate-100` | `bg-slate-200 transform scale-[0.95]` | `36px` / `44px` |

```css
/* Standard Button Base Class */
.ag-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 6px;
  font-family: 'Geist Sans', -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition: transform 120ms ease-out, background-color 150ms ease, border-color 150ms ease;
  will-change: transform;
}
.ag-btn:active {
  transform: scale(0.97);
}
```

---

### 1.2 Status Badges & Agronomic Severity Pills

Badges communicate categorical risk, valve states, and sensor health. Badges are styled with solid high-contrast borders to survive outdoor light washing.

```
[ (v) Healthy ]   [ (!) Early Watch ]   [ (/!\) Moderate Alert ]   [ [X] Critical Cluster ]
```

| Badge Type | Icon Glyph | Tailwind Class Composition | Text & Border Contract |
| :--- | :--- | :--- | :--- |
| **Tier 0: Healthy** | `CheckCircle` | `bg-emerald-50 text-emerald-800 border border-emerald-300` | Text `#065F46`, Border `#86EFAC` |
| **Tier 1: Low / Watch** | `AlertTriangle` | `bg-amber-50 text-amber-900 border border-amber-300` | Text `#78350F`, Border `#FDE68A` |
| **Tier 2: Moderate Alert**| `AlertCircle` | `bg-orange-50 text-orange-900 border border-orange-300` | Text `#7C2D12`, Border `#FDBA74` |
| **Tier 3: Critical DBSCAN**| `OctagonAlert` | `bg-red-50 text-red-900 border border-red-400 font-semibold` | Text `#7F1D1D`, Border `#FCA5A5` |
| **Valve Open (Hydrating)**| `Droplet` (Pulsing)| `bg-emerald-100 text-emerald-900 border border-emerald-400` | Text `#064E3B`, Border `#34D399` |
| **Valve Closed (Idle)** | `CircleSlash` | `bg-slate-100 text-slate-700 border border-slate-300` | Text `#334155`, Border `#CBD5E1` |
| **Soil Moisture Normal** | `Waves` | `bg-cyan-50 text-cyan-900 border border-cyan-300` | Text `#164E63`, Border `#67E8F9` |

---

### 1.3 Form Controls & High-Sunlight Inputs

To prevent iOS Safari from automatically zooming into web pages during form input in the field, all inputs strictly enforce a minimum `16px` font size on mobile.

```css
.ag-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-family: 'Geist Sans', -apple-system, sans-serif;
  font-size: 14px; /* Scaled to 16px via media query on mobile */
  color: #0F172A;
  background-color: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
@media (max-width: 768px) {
  .ag-input {
    font-size: 16px; /* Prevents auto-zoom on iOS */
    height: 48px;
    border-width: 1.5px;
    border-color: #9CA3AF;
  }
}
.ag-input:focus {
  border-color: #0F766E;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
}
```

---

## 2. Interactive GIS Map Overlays & Spatial Canvas

The interactive GIS map represents the primary operational hub of the platform. Built on Leaflet / Mapbox GL with high-resolution satellite imagery (Esri World Imagery).

```
+-----------------------------------------------------------------------------------+
|  [GIS CANVAS: Esri Satellite Tile Base]                                           |
|                                                                                   |
|  [P-01] Tomato Parcel (GeoJSON)          [P-02] Corn Parcel                       |
|   Boundary: 2px solid #10B981             Boundary: 2px solid #F59E0B             |
|   Fill: rgba(16, 185, 129, 0.15)          Fill: rgba(245, 158, 11, 0.15)          |
|                                                                                   |
|      ( * ) Sensor Probe 01                     (( O )) Active Valve Actuator       |
|            [VWC: 32.4% | Batt: 98%]                    Pulsing Cobalt Ring        |
|                                                                                   |
|   { ! ! ! } DBSCAN Outbreak Envelope                                              |
|             Late Blight Cluster (eps=50m, minpoints=3)                            |
|             Stroke: 2px dashed #DC2626 | Fill: rgba(220, 38, 38, 0.22)            |
|                                                                                   |
|  [HUD LAYER SWITCHER: Top Right Floating Pill]                                    |
+-----------------------------------------------------------------------------------+
```

### 2.1 Parcel Polygon Boundary Styling

Farm parcels are drawn and updated via PostGIS GeoJSON polygons. Boundary colors dynamically map to crop type:

| Crop Type | GeoJSON Stroke Color | Fill Color (15% Opacity) | Selected State Stroke |
| :--- | :--- | :--- | :--- |
| **Tomato** (*Solanum lycopersicum*) | `#10B981` (Emerald 500, 2px) | `rgba(16, 185, 129, 0.15)` | `#047857` (3px solid + halo) |
| **Corn / Maize** (*Zea mays*) | `#F59E0B` (Amber 500, 2px) | `rgba(245, 158, 11, 0.15)` | `#B45309` (3px solid + halo) |
| **Potato** (*Solanum tuberosum*) | `#8B5CF6` (Violet 500, 2px) | `rgba(139, 92, 246, 0.15)`| `#6D28D9` (3px solid + halo) |
| **Apple / Orchard** (*Malus*) | `#EC4899` (Pink 500, 2px) | `rgba(236, 72, 153, 0.15)` | `#BE185D` (3px solid + halo) |

### 2.2 Active Irrigation Valve Ring Animation

When simulated or real MQTT valve triggers fire (`VALVE_TRIGGER_OPEN`), the parcel centroid renders an animated radiating pulse ring:

```css
@keyframes agValveRingPulse {
  0% {
    transform: scale(0.9);
    opacity: 0.95;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.40;
  }
  100% {
    transform: scale(2.2);
    opacity: 0.0;
  }
}

.ag-valve-pulse-marker {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #10B981;
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
  position: relative;
}

.ag-valve-pulse-marker::after {
  content: '';
  position: absolute;
  top: -6px;
  left: -6px;
  right: -6px;
  bottom: -6px;
  border-radius: 50%;
  border: 2.5px solid #10B981;
  animation: agValveRingPulse 2.0s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
  pointer-events: none;
}
```

### 2.3 PostGIS DBSCAN Pathogen Cluster Geometry

When `ST_ClusterDBSCAN(geom_point, eps := 50, minpoints := 3)` detects positive disease clustering:
* **Convex Hull / Bounding Envelope:** Rendered as an SVG polygon over the Leaflet map with `stroke: #DC2626`, `stroke-width: 2px`, `stroke-dasharray: 6 4`, and `fill: rgba(220, 38, 38, 0.20)`.
* **Cluster Marker Icon:** Pinned at cluster centroid: High-contrast red octagon containing an exclamation mark glyph (`#DC2626` background, `#FFFFFF` icon, `2px solid #FFFFFF` perimeter border).

---

## 3. Agronomic Telemetry Time-Series Chart

The analytical drawer displays a 14-day trailing and 7-day predictive water balance chart combining soil moisture, rainfall events, calculated evapotranspiration ($ET_c$), and automated irrigation valve runtimes.

```
  VWC %                                                                    Rain / Irrig (mm)
  50% +-------------------------------------------------------------------+ 30 mm
      |                               [ Field Capacity theta_FC: 38% ]   |
  40% |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~| 24 mm
      |       /\                                                          |
  30% |______/__\_________________________________________________________| 18 mm
      |     /    \    .-.                                                 |
  20% |---/-------\--/---\--[ MAD Threshold: 22% (Critical Water Stress) ]| 12 mm
      |  /         \/     \__________________                             |
  10% | /                                    \___________________________ | 6 mm
      |                                              [||| Valve: 45 min]  |
   0% +-------------------------------------------------------------------+ 0 mm
      Oct 10     Oct 12     Oct 14     Oct 16     Oct 18     Oct 20     Oct 22
```

### 3.1 Visual Specification

* **Chart Library Target:** Recharts (`ResponsiveContainer`, `ComposedChart`) or Chart.js with dual Y-axes.
* **Axis 1 (Left - Volumetric Water Content %):** Range `0% - 50%`. Label: `Soil VWC (%)`. Color: `#0891B2` (Cyan 600).
* **Axis 2 (Right - Water Volume mm):** Range `0mm - 40mm`. Label: `Precipitation & Irrigation (mm)`. Color: `#64748B`.
* **Soil Moisture Curve:** 2.5px solid line (`#0891B2`), curve type `monotoneX`. Zero blurred drop shadow.
* **Effective Rainfall ($P_{\text{eff}}$):** Sky blue bar series (`#38BDF8`, bar width `14px`, `border-radius: 2px 2px 0 0`).
* **Automated Irrigation Events ($I$):** Emerald green bar series (`#10B981`, bar width `14px`, opacity `0.85`).
* **Critical MAD Threshold Band:** Horizontal dashed reference line at `y = 22%` (`#DC2626`, `stroke-dasharray: 4 4`, `stroke-width: 1.5px`). The region below the MAD threshold features a subtle red warning fill (`rgba(220, 38, 38, 0.08)`).
* **Crosshair Tooltip:** Custom React tooltip with solid `#FFFFFF` card, `1px solid #CBD5E1` border, `shadow-hud`, and strictly formatted tabular figures.

---

## 4. Disease Progression Slider Engine (Feature #1)

An interactive HTML5 Canvas / WebGL image-morphing component allowing operators and students to simulate foliar disease progression from Stage 0 (Healthy) through Stage 1 (Initial Chlorosis) to Stage 2 (Severe Necrosis).

```
+-----------------------------------------------------------------------------------+
|  DISEASE PROGRESSION SIMULATOR: Tomato Late Blight (Phytophthora infestans)      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|        Stage 0: Healthy            |            Stage 2: Severe Necrosis          |
|                                    |                                              |
|                                    |                                              |
|                              [<< ( || ) >>]  <-- 36px Drag Handle                 |
|                                    |                                              |
|                                    |                                              |
|                                    |                                              |
+-----------------------------------------------------------------------------------+
|  [0%] --------------------------- [46%] -------------------------------- [100%]   |
|  Active Symptom: "Water-soaked irregular lesions with pale chlorotic margins"    |
+-----------------------------------------------------------------------------------+
```

### 4.1 Mechanical & Shader Specification

* **Canvas Container:** Standard 16:9 or 4:3 responsive aspect ratio container (`max-h-[500px]`, `rounded-lg border border-slate-300 overflow-hidden bg-slate-950`).
* **Two-Phase Blend Transition:**
  * **$0\% \to 50\%$ Slider:** Cross-dissolves Stage 0 (Healthy) into Stage 1 (Initial Lesions) utilizing a localized contrast mask that emphasizes yellow chlorotic discoloration.
  * **$51\% \to 100\%$ Slider:** Blends Stage 1 into Stage 2 (Severe Necrosis) via high-pass necrotic edge reveal, causing brown necrotic tissue collapse.
* **Scrubber Divider Line:** 2px solid white vertical rule (`#FFFFFF`) with a dynamic drop shadow (`0 0 8px rgba(0,0,0,0.4)`).
* **Scrubber Handle:** 36px circular button centered vertically on the divider line. White background, `1px solid #CBD5E1`, containing a dual-arrow SVG icon.
* **Diagnostic Annotation Tags:** Floating HTML callout chips positioned dynamically over active infection zones with smooth spring fades (`transition: opacity 200ms ease-out, transform 200ms ease-out`).

---

## 5. Interactive 3D Plant Anatomy Explorer (Feature #2)

A WebGL diagnostic inspection modal built in React Three Fiber (`@react-three/fiber`, `@react-three/drei`). Translates foliar and vascular diseases into an interactive 3D botanical specimen.

```
+-----------------------------------------------------------------------------------+
|  3D PLANT ANATOMY: Tomato (Solanum lycopersicum)                     [ RESET ] [X]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                 (O) [Foliage Canopy: Early Blight Risk]                           |
|                  \                                                                |
|                   \                                                               |
|                    |     +----------------------------------------------------+   |
|                   / \    | ANATOMICAL PATHOLOGY CARD                          |   |
|                  /   \   | Zone: Lower Stem / Vascular Xylem                  |   |
|                 (O)      | Associated Disease: Fusarium Wilt                  |   |
|               Stem Pin   | Pathogen: Fusarium oxysporum                       |   |
|                  |       | Symptom: Vascular browning of xylem vessels;       |   |
|                 / \      |          unilateral branch wilting.                |   |
|                (O)       | Action: Restrict root-zone overhead moisture.      |   |
|             Root Collar  +----------------------------------------------------+   |
|                                                                                   |
|  Controls: Drag to Orbit | Scroll to Zoom | Click Hotspot to Inspect              |
+-----------------------------------------------------------------------------------+
```

### 5.1 Three.js Lighting & Canvas Specification

* **Renderer Settings:** ACES Filmic Tone Mapping, sRGB color space, shadow map enabled (soft PCF shadows).
* **Lighting Rig:**
  * Directional Key Light: Sunlight simulation at `position: [5, 12, 8]`, intensity `1.8`, soft warm white (`#FFFBEB`).
  * Sky Fill Light: Hemispherical light, sky color `#E0F2FE`, ground color `#FEF3C7`, intensity `0.6`.
  * Subtle Rim Light: Backlight at `position: [-6, 4, -8]`, intensity `0.8`, delineating foliage leaf edges.
* **Camera Rigging:** `PerspectiveCamera` with $45^\circ$ FOV. OrbitControls clamped to `minPolarAngle: 10deg` and `maxPolarAngle: 85deg` to prevent underground clipping.

### 5.2 Raycasted Hotspot Pin Styling

Hotspot pins are projected from 3D mesh vertices into 2D screen space:
* **Pin Visual:** 26px circular glassmorphic pill badge (`background: rgba(15, 23, 42, 0.88)`, `border: 2px solid #FFFFFF`, `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`).
* **Occlusion State:** When a raycaster detects a plant leaf between the camera and the pin, the pin automatically transitions to `opacity: 0.25` and disables pointer events.
* **Active Pathology Sheet:** Clicking a pin slides out an inspection card from the right edge with a spring-eased transition (`damping: 1.0`, `response: 0.35s`).

---

## 6. Türkiye Regional Crop Climate Risk Engine (Feature #3)

A macro geospatial choropleth visualizer modeling fungal disease pressure ($R_{\text{fungal}}$), drought stress ($R_{\text{drought}}$), and unseasonal frost risk ($R_{\text{frost}}$) across Türkiye's 7 agricultural regions and 81 provincial boundaries.

```
+-----------------------------------------------------------------------------------+
|  TÜRKIYE REGIONAL AGRO-CLIMATE RISK ENGINE            [ Fungal ] [ Drought ] [Frost]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|       [MARMARA: 42% Moderate]            [KARADENIZ: 88% CRITICAL FUNGAL]         |
|             \                                  /                                  |
|              +-------+                 +------+                                   |
|             /         \_______________/        \____                              |
|            (   IC ANADOLU: 68% Drought              \                             |
|             \                                        \___                         |
|              \______        GÜNEYDOGU ANADOLU:           )                        |
|              [EGE]  \       92% Severe Heat Stress      /                         |
|                      +---------------------------------+                          |
|                       [AKDENIZ: 54% Low Risk]                                     |
|                                                                                   |
|  RISK SPECTRUM:  [0% Low (Green)] === [50% Moderate (Amber)] === [100% Extreme]  |
+-----------------------------------------------------------------------------------+
```

### 6.1 Choropleth Styling & Interpolation

* **GeoJSON Source:** Simplified Turkish administrative boundary geometries (`EPSG:4326`).
* **Dynamic Color Scales:**
  * **$0\% \to 39\%$ (Low Risk):** `#10B981` (Emerald 500) with 40% polygon fill.
  * **$40\% \to 69\%$ (Moderate Risk):** `#F59E0B` (Amber 500) with 50% polygon fill.
  * **$70\% \to 84\%$ (High Risk):** `#EA580C` (Orange 600) with 60% polygon fill.
  * **$85\% \to 100\%$ (Critical Emergency):** `#DC2626` (Red 600) with 75% polygon fill.
* **Hover Interaction:** Moving the pointer over a province applies a 2.5px solid white stroke (`#FFFFFF`) and surfaces a floating card displaying active crop vulnerabilities, prevailing humidity, and agronomic preventative advisories.

---

## 7. Presentation & Evaluator "Demo Trigger" Control Panel

To ensure reliable, deterministic project evaluation and academic defense, an evaluator panel allows instant injection of edge cases without waiting for 24-hour weather cycles.

```
+-----------------------------------------------------------------------------------+
|  EVALUATION CONTROLS ("DEMO TRIGGERS")                             [ RUN ALL ] [X]|
+-----------------------------------------------------------------------------------+
|  [ TRIGGER ACTION ]              [ INJECTED TELEMETRY ]       [ EXPECTED REACTION]|
|                                                                                   |
|  [ (>) Accelerate Moisture ] --> Sets VWC to 14.2% (Below MAD) -> Valve Opens <5s |
|  [ (>) Inject Late Blight ]  --> 5 positive scans on P-01   -> DBSCAN Red Cluster |
|  [ (>) Force Heatwave ]      --> Tmax=42°C, RH=18%, CDD=30   -> SE Anatolia Alert |
|  [ (>) Inject Cold Snap ]    --> Tmin=-4.5°C during budburst -> Frost Warning Pop|
+-----------------------------------------------------------------------------------+
```

* **Styling:** Floating dock positioned bottom-left (`fixed bottom-4 left-4 z-[9999]`).
* **Visual Identity:** Matte charcoal header (`bg-slate-900 text-white`) with warning-yellow accents (`text-amber-400`), signaling test/simulation fixtures.
* **Execution Feedback:** Clicking any trigger button scales the button (`scale(0.96)`), shifts the icon to an active spinner, and immediately fires a SignalR telemetry mock event that updates the GIS map within $100\text{ ms}$.
