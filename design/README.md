# Precision Ag-Intelligence: Design System Specification
**Platform:** Precision AgriTech Field Operations & Crop Health Platform  
**System Designation:** "Precision Ag-Intelligence" (Modern Data-Dense SaaS with High-Sunlight Industrial Hardening)  
**Default Theme:** Light Mode Engineered  
**Target Roles:** Enterprise Agronomists, Farm Operations Directors, Field Scouts, Agricultural Consortium Officers  
**Version:** 1.0.0-PROD  

---

## 1. System Vision & Design Manifesto

The **Precision AgriTech Field Operations & Crop Health Platform** manages millions of dollars in crop assets through automated biological mathematics (FAO-56 Penman-Monteith dynamic irrigation), computer vision diagnostics (12-class PlantVillage foliar CNN), geospatial vector overlays (PostGIS parcels, DBSCAN pathogen outbreak clusters), and macro climate modeling (Türkiye 7-Region / 81-Province choropleth).

Traditional enterprise agriculture software falls into two traps:
1. **Legacy Clunky SCADA/Industrial software:** Low informational hierarchy, harsh 1990s desktop frames, zero mobile adaptability, visually exhausting.
2. **Generic Trendy "AI SaaS" templates:** Excessive washed-out purples/indigos, oversized `rounded-3xl` cards floating on fuzzy low-contrast shadows, weak gray typography (`#9CA3AF`) that becomes completely invisible under direct noon sunlight ($50{,}000+\text{ lux}$).

**"Precision Ag-Intelligence"** is built on five core design tenets:

* **Sunlight Survivability (High-Noon Outdoor Hardening):** Contrast ratios must never drop below WCAG AA, with all critical telemetry and status markers adhering to **WCAG AAA ($7:1+$)**. Borders replace fuzzy drop shadows to define boundaries against glare.
* **Rigid Columnar Stability (No Metric Jitter):** IoT telemetry from MQTT queues and SignalR websockets updates continuously. All numeric data MUST use fixed tabular figures (`font-variant-numeric: tabular-nums`) so layout boundaries never jump or shift during live data streams.
* **Direct Manipulation & Instant Response:** Following Apple fluid interface and Emil Kowalski design engineering principles, interactive controls highlight on `pointerdown` (not `click`), scale subtly on press (`scale(0.97)`), and maintain 1:1 direct tracking with the cursor or thumb.
* **Spatial Truth:** The interactive GIS map is the primary spatial canvas. Panels, sheets, and HUD overlays float over the map with controlled backdrop frostings, ensuring the user never loses spatial context of the parcels they are managing.
* **Deterministic Evaluation & Emergency Clarity:** High-stakes biological warnings (e.g., *Late Blight / Phytophthora infestans* outbreak clusters or extreme soil depletion below MAD) use distinct, unmistakable optical shapes and high-chroma safety tokens, never relying solely on subtle color hues.

---

## 2. Platform Architecture & User Modes

```
+----------------------------------------------------------------------------------------------------+
|                                    PLATFORM ARCHITECTURE                                           |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    DESKTOP OPERATIONS CENTER (HQ / Control Shed)            MOBILE PWA FIELD SCANNER (Sunlight)    |
|    - Dual/Single 1080p to 4K Displays                      - Handheld iOS Safari / Android Chrome  |
|    - Multi-Layer Interactive GIS Canvas (65% width)        - High-Noon Glare (20k - 80k lux)       |
|    - Analytical Inspection Drawer / Inspector (35% width)  - One-Handed Thumb Zone Operation       |
|    - 14-Day FAO-56 Soil Moisture vs ETc Time-Series        - 48px Minimum Touch Targets            |
|    - PostGIS DBSCAN Pathogen Cluster Geometry              - Device GPS / EXIF Ingest Fallback     |
|    - Türkiye 7-Region Macro Risk Choropleth Map            - Direct Leaf Viewfinder + Crop Select  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Design Suite File Index

This `/design` directory contains the exhaustive specification suite required for designers, frontend engineers, mobile developers, and AI agents to implement the user interface:

| Document | Primary Focus | Contents |
| :--- | :--- | :--- |
| **[`FOUNDATIONS.md`](./FOUNDATIONS.md)** | Core Design Tokens | Color palettes (Hex, HSL, contrast matrices), typography hierarchies (Geist Sans, Inter, Geist Mono), elevation, border contours, 8px spacing grid, and accessibility contracts. |
| **[`COMPONENTS.md`](./COMPONENTS.md)** | UI Component Library | Full styling specifications for Buttons, Badges, Forms, GIS Map HUD, Actuation Pulse Rings, Telemetry Charts, Disease Progression Shader Slider, 3D Plant Anatomy Explorer, and Türkiye Risk Map. |
| **[`MOTION_AND_INTERACTION.md`](./MOTION_AND_INTERACTION.md)** | Fluid Physics & Micro-Interactions | WWDC fluid interface principles, spring physics configs, Emil Kowalski interaction rules, button scale-press states, modal transitions, and `prefers-reduced-motion` fallbacks. |
| **[`MOBILE_AND_OUTDOOR_SPEC.md`](./MOBILE_AND_OUTDOOR_SPEC.md)** | In-Field PWA Ergonomics | High-sunlight outdoor visibility guidelines, 48px touch targets, 16px iOS zoom prevention, GPS extraction UX, leaf camera guide reticle, and offline connectivity indicators. |
| **[`AI_LEAF_DIAGNOSTICS_SPEC.md`](./AI_LEAF_DIAGNOSTICS_SPEC.md)** | Page UX/UI Specification | Focused design specification for AI Leaf Diagnostics: Image Ingestion, In-Flight ML Telemetry Beam, Diagnostic Verdict & Severity Card, and State Matrix. |
| **[`DISEASE_PROGRESSION_SPEC.md`](./DISEASE_PROGRESSION_SPEC.md)** | Page UX/UI Specification | Complete specification for the Disease Progression Studio: Prompt-to-Prompt cross-attention controls, 2-phase WebGL shader, bi-directional timeline scrubber, and treatment branching. |

---

## 4. Technology Stack & Design Alignment

* **Styling Engine:** Tailwind CSS (Vanilla / PostCSS-free or standard Vite Tailwind v3/v4).
* **Base Map Canvas:** Leaflet (`react-leaflet`) with Esri World Imagery high-resolution satellite tiles and vector GeoJSON layers.
* **3D Anatomy Viewer:** React Three Fiber (`@react-three/fiber`, `@react-three/drei`) with ACES Filmic Tone Mapping and low-poly Draco-compressed glTF assets.
* **Charting Engine:** Recharts or Chart.js configured for high-density, dual y-axis stepped time-series and area charts.
* **Real-time Gateway:** ASP.NET Core SignalR client receiving MQTT telemetry ticks and DBSCAN outbreak broadcasts.
