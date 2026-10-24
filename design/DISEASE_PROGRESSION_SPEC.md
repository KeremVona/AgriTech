# Disease Progression Studio: UX & Visual Specification
**System Designation:** "Precision Ag-Intelligence"  
**Page Module:** Prompt-to-Prompt Cross-Attention Disease Progression Studio  
**Primary Route:** `/disease-progression` (Promoted from `/disease-progression-experimental`)  
**Document Code:** `SPEC-UI-007`  
**Status:** PRODUCTION READY SPECIFICATION  

---

## 1. Feature Overview & Scientific Foundation

The **Disease Progression Studio** integrates Google Research's **Prompt-to-Prompt Image Editing with Cross-Attention Control** (Hertz et al., 2022) into an enterprise agronomic simulation platform. 

### 1.1 The Computational Problem & Solution
* **The Agronomic Data Desert:** Real-world agricultural datasets (e.g., PlantVillage) only capture static, disconnected leaf photos. There are zero continuous time-series datasets documenting the exact same leaf decaying over weeks because real leaves rot once detached, and field leaves shift under wind, growth, and lighting.
* **The P2P Cross-Attention Engine:** By freezing the initial latent noise $z_T \sim \mathcal{N}(0, \mathbf{I})$ and injecting source self-attention maps ($S_{\text{base}}$ for $t < \tau_{\text{self}}$) and cross-attention maps ($A_{\text{base}}$ for $t < \tau_{\text{cross}}$), the pipeline synthesizes progressive foliar disease stages ($S_0 \to S_1 \to S_2$) **strictly by editing prompt tokens** while locking petiole placement, leaf venation, perimeter contours, and background pixels down to the micron.
* **Client-Side Simulation:** The frontend ingests these synchronized diffusion plates and difference masks, driving a 60 FPS WebGL two-phase fragment shader governed by microclimate biology (USDA Magarey Beta curve) and what-if agronomic treatment branching.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             PROMPT-TO-PROMPT DIFFUSION FOUNDATION                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   Source Prompt (Stage 0: Healthy)               Target Prompt (Stage 1/2: Diseased)             │
│   "healthy green leaf blade, studio..."          "...with concentric target-like necrotic spots" │
│                 │                                                  │                             │
│                 ▼                                                  ▼                             │
│   CLIP Tokenizer & Text Encoder                  CLIP Tokenizer & Text Encoder                   │
│                 │                                                  │                             │
│                 └───────────────► seq_aligner.py ◄─────────────────┘                             │
│                       (Needleman-Wunsch Dynamic Programming)                                     │
│                                       │                                                          │
│                                       ▼                                                          │
│                        init_latent (Shared Latent z_T)                                           │
│                                       │                                                          │
│                                       ▼                                                          │
│                   DDIM Reverse Diffusion (T=50 ... t=0)                                          │
│                   ┌─────────────────────────────────────────┐                                    │
│                   │      AttentionControlEdit (UNet Hook)   │                                    │
│                   │  • Cross-Attention Override             │                                    │
│                   │  • Self-Attention Injection             │                                    │
│                   │  • LocalBlend Spatial Masking (tau=0.3) │                                    │
│                   └─────────────────────────────────────────┘                                    │
│                                       │                                                          │
│                                       ▼                                                          │
│                 VAEDecode -> S0 (Healthy), S1 (Chlorosis), S2 (Necrosis)                         │
│                                       │                                                          │
└───────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE PRODUCTION STUDIO (/disease-progression)                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  • 60 FPS Two-Phase WebGL Canvas Shader (Chlorosis mask -> Necrotic desiccation)                 │
│  • Attention-Map & LocalBlend Mask Inspection Modes                                              │
│  • Bi-directional Elapsed Days <-> Severity Scrubber (Magarey Beta f(T) * g(RH))                 │
│  • "What-If" Agronomic Treatment Branching (Protectant vs Curative vs Bio-control)               │
│  • Interactive Leaf Hotspot Markers (24 registered botanical symptom zones)                      │
│  • Media Studio: 60 FPS Timelapse WebM Recorder & Diagnostic PDF Report Generator                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Hierarchy & Layout Architecture

The route `/disease-progression` replaces the experimental dark sandbox with our production **Light-Mode "Precision Ag-Intelligence"** design system.

### 2.1 Responsive Viewport Grid Layout ($\ge 1280\text{px}$)

* **Grid System:** 12-column baseline grid with 24px gutters, max-width `1440px` centered.
* **Layout Structure:**
  * **Top Sub-Navigation:** Compact Crop Selector Rail spanning all 12 columns.
  * **Left Column (7 Columns / ~58% width):** Interactive Foliar Canvas Viewport, Attention Map Controls, and Agronomic Timeline Slider.
  * **Right Column (5 Columns / ~42% width):** Studio Parameter Inspector Rail (Microclimate, Treatment Branching, Cross-Attention Prompts, and Media Export).

```
+-----------------------------------------------------------------------------------------------------------------------------+
| BREADCRUMBS: Operations / Agronomy Intelligence / Disease Progression Studio       [ SNAPSHOT ] [ RECORD TIMELAPSE ] [ PDF ]|
+-----------------------------------------------------------------------------------------------------------------------------+
| TOP RAIL: COMPACT CROP SPECIMEN SELECTOR (8 Agricultural Staples)                                                           |
| [🍅 Tomato (Early Blight)] [🥔 Potato (Late Blight)] [🫑 Pepper] [🌽 Corn] [🍏 Apple] [🍑 Peach] [🍇 Grape] [🎃 Squash]     |
+-----------------------------------------------------------------------------------------------------------------------------+
| LEFT PANEL (COLS 1-7): WEBGL VIEWPORT & SCRUBBER              | RIGHT PANEL (COLS 8-12): PARAMETER INSPECTOR RAIL           |
|                                                              |                                                              |
| +----------------------------------------------------------+ | +----------------------------------------------------------+ |
| | CANVAS HEADER: View Mode & Attention Toggles             | | | INSPECTOR TABS: [Climate] [Treatment] [Prompts] [Export]  | |
| | [ Compare: Off/Split ] [ View: RGB / Attention / Mask ]  | | +----------------------------------------------------------+ |
| | Trajectory: (*) Untreated  ( ) Treated  ( ) Dual Split   | | | TAB CONTENT PANEL:                                       | |
| +----------------------------------------------------------+ | |                                                          | |
| | 60 FPS WEBGL SHADER CANVAS (SQUARE 1:1 OR 4:3)           | | | (A) MICROCLIMATE & EPIDEMIOLOGY:                         | |
| |                                                          | | | Temperature Slider: [ 24.0°C ] (Optimum: 22-26°C)        | |
| |       (O) Hotspot Pin 1                                  | | | Relative Humidity:  [ 88.0%  ] (Critical: >85%)          | |
| |       "Concentric target ring"                           | | | Pathogen Acceleration: 2.2x [ACCELERATED SPORULATION]    | |
| |                                                          | | | Cardinal Curve: Magarey Beta Response f(T)*g(RH)         | |
| |                        (O) Hotspot Pin 2                 | | |                                                          | |
| |                        "Chlorotic Halo Margin"           | | | (B) "WHAT-IF" TREATMENT BRANCHING:                       | |
| |                                                          | | | Intervention Toggle: [ ON ] at Day 4.2 (25.0% Severity)  | |
| |  [ Attention Mask Overlay Active: Yellow/Red Heatmap ]   | | | Fungicide Class: Systemic Curative (Difenoconazole)      | |
| +----------------------------------------------------------+ | | Efficacy: 82.4% | Yield Saved: +38.5%                      | |
| | BI-DIRECTIONAL TIMELINE & SEVERITY SCRUBBER              | | | Trajectory Plateau: Severity arrested at 28.4%           | |
| | [ |> PLAY ] Day 0.0 ────────── [ Day 4.2 / 25% ] ── Day 18| | |                                                          | |
| | Stage: Incubation -> Initial Lesions -> Confluent Rot    | | | (C) CROSS-ATTENTION & PROMPT DIFF:                       | |
| |                                                          | | | S0: "healthy green leaf blade, studio background"        | |
| | ACTIVE SYMPTOM CALLOUT:                                  | | | S1: "...with localized [concentric] necrotic spots"      | |
| | "Water-soaked dark brown flecks with pale yellow halos." | | | tau_cross: 0.75 | tau_self: 0.50 | tau_blend: 0.30       | |
| +----------------------------------------------------------+ | +----------------------------------------------------------+ |
+-----------------------------------------------------------------------------------------------------------------------------+
```

---

## 3. Core Feature Workflows & Detailed Component Architecture

### 3.1 Compact Crop Specimen Selector Rail (`<CropSelectorRail />`)
Allows switching between the 8 trained agricultural crop-pathology profiles with instant state retention:
1. **Tomato** (*Solanum lycopersicum*) • Early Blight (*Alternaria solani*)
2. **Potato** (*Solanum tuberosum*) • Late Blight (*Phytophthora infestans*)
3. **Pepper Bell** (*Capsicum annuum*) • Bacterial Spot (*Xanthomonas campestris*)
4. **Corn / Maize** (*Zea mays*) • Common Rust (*Puccinia sorghi*)
5. **Apple** (*Malus domestica*) • Apple Scab (*Venturia inaequalis*)
6. **Peach** (*Prunus persica*) • Bacterial Spot (*Xanthomonas arboricola*)
7. **Grape** (*Vitis vinifera*) • Black Rot (*Guignardia bidwellii*)
8. **Squash** (*Cucurbita pepo*) • Powdery Mildew (*Podosphaera xanthii*)

* **Visual Styling:** Horizontal scrollable rail on mobile; wrapped flex pill grid on desktop.
* **Card State:** Inactive cards use `#FFFFFF` background, `1px solid #E2E8F0`, and text `#475569`. Active card uses `#F0FDFA` background, `1.5px solid #0F766E`, text `#0F766E`, with a subtle scale press (`:active: scale(0.97)`).

---

### 3.2 Dual-Mode WebGL Foliar Canvas (`<ProgressionCanvasViewport />`)

The central simulation stage renders high-resolution foliar plates through the two-phase GLSL fragment shader (`ProgressionShaderRenderer.ts`):

```
Phase 1: Progress in [0.0, 0.5]  ──> Lerp(Stage0, Stage1, smoothstep(Mask1))
Phase 2: Progress in [0.5, 1.0]  ──> Lerp(Stage1, Stage2, smoothstep(Mask2))
```

```
+-----------------------------------------------------------------------------------+
|  CANVAS TOOLBAR: View Mode & Attention Toggles                                    |
|                                                                                   |
|  View Mode:       [ (•) Standard RGB ]  [ Attention Heatmap ]  [ Difference Mask ]|
|  Comparison:      [ ( ) Single Leaf  ]  [ (•) Split Compare ]  [ Overlay Slider ] |
|  Trajectory Mode: [ (•) Untreated    ]  [ Treated Branch    ]  [ Dual Path Curve ]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|           LEFT: STAGE 0 (HEALTHY)          |         RIGHT: STAGE 1 (DISEASED)    |
|                                            |                                      |
|                                            |             (O) Hotspot Pin          |
|                                            |             "Necrotic lesion"        |
|                                            |                                      |
|                                      [ < | > ] <── 36px Split Divider Handle      |
|                                            |                                      |
|                                            |                                      |
+-----------------------------------------------------------------------------------+
```

#### Viewport Mode Switches:
1. **Standard RGB Mode:** Full-color biophysical progression blend.
2. **Cross-Attention Heatmap Mode:** Overlays the spatial cross-attention intensity matrix $A_{i,j}$ for the active disease prompt tokens (`"concentric"`, `"necrotic"`, `"pustules"`). High attention values map to a warm viridis/turbo gradient (`#0F766E` $\to$ `#F59E0B` $\to$ `#DC2626`) directly illuminating which leaf pixels are driven by which text tokens.
3. **Difference Mask Mode:** Renders the isolated binary/alpha difference masks ($\text{Mask}_1$ and $\text{Mask}_2$) on a neutral slate backing stage, showing exact lesion segmentation boundaries derived from the `LocalBlend` algorithm.
4. **Compare Mode (Split Curtain):** A draggable vertical divider allowing the operator to swipe between the uninfected Stage 0 healthy leaf and the current progression stage.

---

### 3.3 Interactive Anatomical Symptom Hotspots (`<LeafHotspotOverlay />`)

Registered biological symptom markers pinned to normalized coordinates $[x, y]$ on the leaf blade:
* **Pin Visual:** 24px circular glassmorphic pill badge (`bg-slate-900/90 text-white border border-white/80 shadow-hud`).
* **Active Symptom State:** When the current scrubber percentage enters a hotspot's active biological window (e.g., $15\% \le \text{Progress} \le 60\%$), the pin lights up with an emerald halo ring (`ring-2 ring-teal-500 animate-pulse`).
* **Hover / Tap Popover:**
  * **Title:** Anatomical Structure (e.g., *"Interveinal Lamina"*, *"Margin Senescence"*, *"Petiole Base"*).
  * **Pathology:** Microscopic description (e.g., *"Conidiophore sporulation of Alternaria solani forming concentric target rings"*).
  * **Physiological Impact:** Canopy photosynthetic reduction percentage.

---

### 3.4 Bi-directional Agronomic Timeline Scrubber (`<AgronomicTimelineSlider />`)

A dual-scale control that synchronizes abstract damage percentage with real-world biological time:

$$\text{Severity Percentage } (0\% \to 100\%) \quad \longleftrightarrow \quad \text{Elapsed Field Days } (0 \to 18\text{ days})$$

* **Biological Calibration (Magarey Beta Response):**
  $$f(T) = \left(\frac{T_{\max} - T}{T_{\max} - T_{\text{opt}}}\right) \left(\frac{T - T_{\min}}{T_{\text{opt}} - T_{\min}}\right)^{\frac{T_{\text{opt}} - T_{\min}}{T_{\max} - T_{\text{opt}}}}$$
  $$g(RH) = \begin{cases} 0.05, & RH < 70\% \\ 0.05 + 0.95 \left(\frac{RH - 70}{30}\right)^2, & RH \ge 70\% \end{cases}$$
* **Interactive Controls:**
  * **Play/Pause Toggle:** Automated 60 FPS progression playback (4-second smooth loop).
  * **Milestone Stage Anchors:** Clickable tick marks at:
    * `Day 0.0` (Inoculation / Asymptomatic)
    * `Day 3.5` (Initial Chlorotic Flecks)
    * `Day 8.0` (Concentric Necrotic Expansion)
    * `Day 14.0` (Confluent Blight & Structural Desiccation)
  * **Intervention Marker Pin:** When treatment branching is active, a vertical blue dashed reference marker flags the exact day when fungicide was applied.

---

### 3.5 Parameter Inspector Rail (`<StudioInspectorRail />`)

A 4-tab docked inspector panel engineered with tactile tab switches:

#### Tab 1: Microclimate & Epidemiology (`<MicroclimateControlPanel />`)
* **Temperature Slider:** Dual-range slider ($10^\circ\text{C}$ to $38^\circ\text{C}$). Displays real-time status: *Sub-optimal (Slow)*, *Optimum Germination*, or *Thermal Arrest ($T > T_{\max}$)*.
* **Relative Humidity Slider:** $40\%$ to $100\%$. Displays spore acceleration factor (e.g., $RH \ge 85\% \to 2.2\times\text{ sporulation rate}$).
* **Epidemiological Curve Mini-Chart:** SVG visualizer plotting the active Magarey Beta curve with the current temperature pinned as a cursor dot.

#### Tab 2: "What-If" Treatment Branching (`<TreatmentBranchingControls />`)
* **Intervention Checkpoint:** Pin intervention at current scrubber percentage.
* **Fungicide Category Selector:**
  * **Systemic Curative:** Halts expanding lesions, dries active chlorosis into stable brown scar tissue, arresting progression.
  * **Protectant / Contact:** Forms chemical barrier protecting uninfected tissue; slow containment.
  * **Bio-Fungicide / Organic:** Retards fungal expansion by 45–60%; ideal for organic certification.
* **Outcome Analytics Card (`<TreatmentOutcomeCard />`):**
  * **Trajectory Plateau:** Projected severity ceiling (e.g., arrested at $28.4\%$ vs $100\%$ defoliation).
  * **Intervention Efficacy:** $0\text{--}100\%$ score.
  * **Yield Retention:** Estimated harvest yield protected ($+38.5\%$).

#### Tab 3: Cross-Attention & Prompt Diff (`<PromptAttentionInspector />`)
* **Token Difference Visualizer:** Displays the Needleman-Wunsch aligned prompt sequence. Common tokens (e.g., `"leaf"`, `"blade"`, `"stem"`) highlight in slate; newly injected pathological tokens (`"concentric"`, `"water-soaked"`, `"necrotic"`) highlight in Bio-Teal with badge counters.
* **Attention Hyperparameter Readouts:**
  * $\tau_{\text{cross}}$ (Cross-attention injection threshold): `0.75` (75% of diffusion steps).
  * $\tau_{\text{self}}$ (Self-attention layout freeze): `0.50` (Preserves petiole and perimeter).
  * $\tau_{\text{blend}}$ (LocalBlend spatial mask threshold): `0.30`.
* **Attention Map Download:** Button to export the 2D cross-attention token tensor map.

#### Tab 4: Media Studio & Diagnostic Export (`<ExportToolbar />`)
* **60 FPS Timelapse Video Export:** Leverages `canvas.captureStream()` and `MediaRecorder` to generate a 5-second WebM/MP4 timelapse of the leaf evolving from 0% to 100%.
* **Canvas Snapshot:** One-click instant PNG export of the current canvas view.
* **Agronomic PDF Report:** Compiles a multi-page diagnostic summary: crop taxonomy, active disease stage, treatment recommendations, microclimate history, and yield retention projections.

---

## 4. Visual Design Tokens & Styling Specifications

This design strictly applies the **"Precision Ag-Intelligence" Light-Mode** token architecture.

### 4.1 Color Token Contract

```
[ Canvas: #F8FAFC ] [ Surface: #FFFFFF ] [ Muted: #F1F5F9 ] [ Border: #E2E8F0 ]
[ Ink 900: #0F172A ] [ Ink 600: #475569 ] [ Brand: #0F766E ] [ Brand Hover: #115E59 ]
[ Attention Cold: #0F766E ] [ Attention Mid: #F59E0B ] [ Attention Peak: #DC2626 ]
```

| UI Element Area | Semantic Token Name | Concrete Hex Code | Function & Usage Contract |
| :--- | :--- | :--- | :--- |
| **Root Background** | `--ag-canvas` | `#F8FAFC` | Slate 50 base canvas; eliminates eye glare during prolonged monitoring. |
| **Container Cards** | `--ag-surface` | `#FFFFFF` | Pure white container surfaces for high micro-contrast. |
| **Inspector Rails** | `--ag-surface-elevated`| `#FFFFFF` | Docked tool cards with `border border-slate-200 shadow-xs`. |
| **Standard Borders** | `--ag-border` | `#E2E8F0` | Hairline 1px structural borders defining canvas frames and cards. |
| **Field / Active Borders**| `--ag-border-field` | `#9CA3AF` | Reinforced 1.5px borders for mobile controls and slider thumbs. |
| **Primary Typography** | `--ag-ink` | `#0F172A` | Slate 900 for titles, metrics, and stage readouts ($15.8:1$ AAA contrast). |
| **Secondary Metadata** | `--ag-ink-secondary`| `#475569` | Slate 600 for Latin names, days labels, and parameter captions. |
| **Primary Brand Accent**| `--ag-brand` | `#0F766E` | Bio-Teal 700 for active states, slider fills, and primary CTAs. |
| **Brand Accent Hover** | `--ag-brand-hover` | `#115E59` | Bio-Teal 800 for active hover and press feedback. |
| **Brand Subtle Tint** | `--ag-brand-subtle`| `#F0FDFA` | Teal 50 for selected crop pills and active segmented tab tracks. |
| **Attention Map Low** | `--ag-attn-low` | `#0F766E` | Deep teal base indicating minimal token attention ($0.0 - 0.3$). |
| **Attention Map Mid** | `--ag-attn-mid` | `#F59E0B` | Warm amber indicating moderate cross-attention focus ($0.3 - 0.7$). |
| **Attention Map Peak**| `--ag-attn-peak`| `#DC2626` | Vivid red indicating localized lesion token convergence ($0.7 - 1.0$). |
| **Treatment Arrest Line**|`--ag-treated-line`| `#0284C7` | Sky Blue 600 indicating treated trajectory curve and intervention pin. |
| **Untreated Defoliation**|`--ag-untreated-line`|`#DC2626` | Red 600 indicating unconstrained exponential disease progression. |

---

### 4.2 Typography & Tabular Numerals

* **Studio Header Title:** `Geist Sans`, 22px / 1.375rem, Bold 700, tracking `-0.025em`, color `#0F172A`.
* **Crop Specimen Labels:** `Geist Sans`, 14px / 0.875rem, SemiBold 600, tracking `-0.010em`.
* **Scientific Binomial Taxonomy:** `Inter`, 13px / 0.8125rem, Italic Regular 400, color `#475569`.
* **Bi-directional Time Readout:** `Geist Mono`, 18px / 1.125rem, Bold 700, `font-variant-numeric: tabular-nums`, color `#0F172A`.
* **Parameter & Metric Values:** `Geist Mono`, 13px / 0.8125rem, Medium 500, `tabular-nums`, color `#0F172A`.
* **Symptom Annotation Prose:** `Inter`, 14px / 0.875rem, Regular 400, line-height 1.55, color `#334155`.

---

### 4.3 Tactile Micro-Interactions (Emil Kowalski Philosophy)

* **Button & Pill Active State:** All pressable elements scale down on `:active` with `transform: scale(0.97)` via a snappy `120ms ease-out` transition.
* **Slider Direct Touch Tracking:** Following Apple fluid principles, the timeline scrubber handle binds to `pointerdown` and uses `setPointerCapture` so dragging remains smooth and continuous even when the pointer moves outside the slider bounding box.
* **Instant Tooltips on Subsequent Hover:** When scanning adjacent symptom hotspot pins or inspector tabs, the initial tooltip has a `250ms` delay, while adjacent tooltips open instantly (`0ms` duration).
* **Non-Zero Scale Entrances:** Modals, popovers, and slide-out cards enter from `scale(0.96)` and `opacity: 0` to `scale(1.0)` and `opacity: 1` over `200ms ease-out`.

---

## 5. Component State Matrix

The interface accounts for all edge cases across eight operational states:

| State Key | Viewport Presentation | Interactive Controls | User Feedback Messaging |
| :--- | :--- | :--- | :--- |
| **1. Initial Texture Loading** | Canvas displays neutral slate frame with centered pulsing bio-leaf spinner; inspector displays skeleton bars. | Controls disabled until WebGL textures bind to GPU buffers. | *"Streaming multi-stage diffusion plates and difference masks (800x800 WebP)..."* |
| **2. Interactive 60 FPS Scrubbing** | Real-time GLSL fragment blend executes; active hotspot pins update dynamically; days and severity sync at 60 FPS. | Scrubber tracks pointer 1:1; timeline cursor moves smoothly. | Tabular numerals update: `"Day 6.4 (38.2% Infection Severity)"` |
| **3. Automated Playback Loop** | Play icon swaps to Pause; scrubber advances continuously from 0% to 100% over 4.5 seconds and loops smoothly. | User can tap anywhere to interrupt playback instantly. | *"Automated progression playback active (1x real-time scale)."* |
| **4. Attention Heatmap Active** | Canvas replaces RGB texture with color-coded cross-attention density map; token tags appear above canvas. | Attention threshold slider unlocked in inspector panel. | *"Rendering cross-attention map for prompt token: 'concentric target spots'"* |
| **5. Treatment Branching Engaged** | Canvas splits or renders blue trajectory plateau; intervention pin drops on timeline; outcome card populates. | User can adjust intervention day or switch fungicide categories. | *"Intervention Active: Progression arrested at 28.4% severity ceiling."* |
| **6. 60 FPS Timelapse Recording** | Red recording indicator pulses on canvas; scrubber sweeps automatically; progress bar displays 0–100%. | All other controls locked; cancel button enabled. | *"Capturing 60 FPS canvas stream via MediaRecorder (30/100 frames)..."* |
| **7. WebGL Context Loss / Fallback** | System catches WebGL context loss; swaps automatically to multi-layer CSS cross-fade opacity fallback. | Full slider functionality remains intact without WebGL shaders. | *"Hardware acceleration degraded. Standard multi-layer canvas active."* |
| **8. Asset Load Error Boundary** | Error card displays with retry trigger; previous working crop specimen restored. | *"Retry Asset Load"* button active; detailed network diagnostic log available. | *"Failed to fetch progression textures. Verify network connectivity and retry."* |

---

## 6. Implementation Instructions for Frontend Engineers

### 6.1 Directory & File Promotion Structure

The implementation engineer agent must transfer and refactor the experimental modules into the permanent production directory structure:

```
frontend/src/
├── pages/
│   ├── DiseaseProgressionPage.tsx              <-- Replace with refactored light-mode Studio
│   └── ...
├── components/
│   └── DiseaseProgressionViewer/
│       ├── DiseaseProgressionViewer.tsx        <-- Promoted from DiseaseProgressionViewerExperimental
│       ├── ProgressionShaderRenderer.ts        <-- Core 2-phase WebGL fragment shader
│       ├── CompactCropSelectorRail.tsx         <-- 8-crop selector with light-mode tokens
│       ├── AgronomicTimelineSlider.tsx         <-- Bi-directional days <-> severity scrubber
│       ├── LeafHotspotOverlay.tsx              <-- 24 interactive anatomical pins
│       ├── StudioInspectorRail.tsx             <-- 4-tab docked parameter inspector
│       ├── MicroclimateControlPanel.tsx        <-- Magarey Beta temp/RH controls
│       ├── TreatmentBranchingControls.tsx      <-- What-if intervention branching
│       ├── TreatmentOutcomeCard.tsx            <-- Efficacy & yield retention card
│       ├── PromptAttentionInspector.tsx        <-- Prompt diff & cross-attention tokens
│       ├── ExportToolbar.tsx                   <-- 60 FPS timelapse & PDF triggers
│       └── DiagnosticPdfReportModal.tsx        <-- Advisory PDF compilation modal
├── models/
│   ├── agronomicTimelineModel.ts               <-- Magarey Beta equations & calibrations
│   ├── treatmentBranchingModel.ts              <-- Curative & protectant decay curves
│   ├── hotspotRegistry.ts                      <-- 24 registered anatomical coordinates
│   └── exportReportModel.ts                    <-- Field report schema
└── utils/
    └── timelapseRecorder.ts                    <-- canvas.captureStream() & MediaRecorder
```

### 6.2 Key Refactoring Checklist for Frontend Agent

1. **Purge Dark Mode Classes:**
   * Replace all `bg-slate-950`, `bg-slate-900`, `text-slate-100`, and `border-white/10` with our production light tokens: `bg-ag-canvas` (`#F8FAFC`), `bg-ag-surface` (`#FFFFFF`), `text-ag-ink` (`#0F172A`), `border-ag-border` (`#E2E8F0`), and `text-ag-ink-secondary` (`#475569`).
2. **Promote Route in `App.tsx`:**
   * Ensure `/disease-progression` routes directly to the newly upgraded `DiseaseProgressionPage.tsx`.
   * Deprecate the `/disease-progression-experimental` sandbox and route link.
3. **Tabular Numerals Enforcement:**
   * Verify all elapsed days (`Day 4.2`), temperature readouts (`24.0°C`), humidity (`88.0%`), and severity percentages (`25.0%`) have `font-variant-numeric: tabular-nums` or the `.ag-tabular-numeric` class applied.
4. **WebGL Context Safety:**
   * Ensure `ProgressionShaderRenderer.dispose()` is invoked in the `useEffect` cleanup return to prevent GPU memory leaks across navigation switches.
