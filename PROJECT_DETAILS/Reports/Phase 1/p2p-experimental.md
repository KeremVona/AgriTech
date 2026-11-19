Ran command: Check current git status and branch (`git status`)
Ran command: List local and remote git branches (`git branch -a`)
Ran command: View commits on p2p branch (`git log -n 10 --oneline feat/ml-todo107-p2p-progression-generator`)
Ran command: View recent commits on main (`git log -n 5 --oneline main`)
Ran command: View fix branch commits (`git log -n 5 --oneline fix/ml-class-labels-ordering`)
Ran command: Check branch divergence (`git log --graph --oneline -n 20 main feat/ml-todo107-p2p-progression-generator`)
Viewed App.tsx:1-23
Viewed DiseaseProgressionPage.tsx:1-100
Viewed DiseaseProgressionPage.tsx:100-192
Viewed DiagnosticUploadCard.tsx:60-180
Viewed generate_progression.py:1-24
Viewed p2p_generator.py:1-100
Viewed p2p_generator.py:100-220
Viewed p2p_generator.py:220-320

### Prompt-to-Prompt Disease Progression Feature: Comprehensive Analysis & Improvement Roadmap

---

### 1. Current State & What We Built

The Prompt-to-Prompt (P2P) progression system is an end-to-end multi-tier pipeline bridging **generative diffusion modeling** and **client-side 60 FPS WebGL rendering**:

```
[ Colab / Headless CLI ]                     [ Frontend Client ]
Stable Diffusion v1-5 + DDIM                 Vite + React 19 + WebGL
        │                                             │
AttentionRefine + LocalBlend                          │
  (Cross-attention word replacement)                  ▼
        │                                 ProgressionShaderRenderer
        ▼                                 • Two-phase fragment shader
Single Latent Broadcast                       (Phase 1: Chlorosis mask)
  (Stage 0 -> Stage 1 -> Stage 2)             (Phase 2: Necrotic reveal)
        │                                 • CSS multi-layer fallback
        ▼                                             ▲
Postprocessing Pipeline                               │
  • Background matte cutout                           │
  • Difference mask derivation                        │
  • 800x800 WebP normalization                        │
        │                                             │
        └─── Ingested Assets ─────────────────────────┘
             4 Crops (Tomato, Potato, Corn, Apple)
             12 Stage plates + 8 Companion masks (<70 KB/file)
```

1. **ML Generation Core** (`ml-service/scripts/p2p/` & `notebooks/prompt-to-prompt_stable.ipynb`):
   - Deterministic single-latent initialization via DDIM and seed locking.
   - Attention control (`AttentionRefine` with Needleman-Wunsch sequence alignment and `LocalBlend` on symptom tokens like `"concentric"`, `"pustules"`, `"water-soaked"`).
   - Headless CLI (`generate_progression.py`) with unit test suite passing (5/5).
   - Automated matte cutout (`remove_white_background`), connected component filtering, and companion difference mask derivation (`compute_difference_mask`).
2. **Frontend & WebGL Engine** (`DiseaseProgressionViewer/` & `pages/DiseaseProgressionPage.tsx`):
   - Two-phase WebGL fragment shader interpolating across 0–100% infection levels with zero GPU context leaks across React StrictMode remounts.
   - Hardware-accelerated CSS multi-layer opacity fallback ensuring zero possibility of blank screens.
   - Compare Mode toggle (side-by-side with healthy Stage 0 baseline folium).
   - Integrated AI Leaf Scanner card linking diagnostic classification to the exact progression percentage.

---

### 2. Breakdown of What Is Missing (Gap Analysis)

While the engine operates reliably at 60 FPS, there are key functional and biological gaps across four critical pillars:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CRITICAL GAPS IDENTIFIED                             │
├─────────────────────────┬─────────────────────────┬──────────────────────────────┤
│ 1. ML & Diffusion       │ 2. WebGL & Visuals      │ 3. Agronomy & Real World     │
│ • Fixed synthetic seeds │ • 2D cross-dissolve     │ • No day/calendar timeline   │
│   (no real leaf invert) │   (no 3D leaf curling)  │ • No weather/RH acceleration │
│ • 3 discrete keyframes  │ • No hotspot pins       │ • Unidirectional decline     │
│ • Only 4 of 38 classes  │ • No timelapse export   │   (no treatment branching)   │
└─────────────────────────┴─────────────────────────┴──────────────────────────────┘
```

#### Pillar A: ML Generation & Diffusion Core

1. **Synthetic Generation vs. Real Leaf Inversion (DDIM / Null-Text Inversion)**:
   - _Current Limitation_: The pipeline generates leaves from scratch using random seeds. When a farmer uploads an _actual photo_ of an infected plant from their field, the viewer only shows a pre-baked synthetic generic leaf.
   - _Missing_: **Image-to-Progression conditioning** (via DDIM Inversion, Null-Text Inversion, or ControlNet/IP-Adapter) that takes the farmer's actual leaf photograph, reconstructs its latent code, and simulates future necrosis on their _own specimen_.
2. **Discrete 3-Keyframe Approximation vs. Continuous Latent Trajectory**:
   - _Current Limitation_: We only generate 3 discrete anchor plates ($S_0$, $S_1$, $S_2$). The continuous slider between 1% and 49% or 51% and 99% is computed entirely in 2D image pixel space inside the WebGL shader.
   - _Missing_: True spherical latent interpolation ($\text{slerp}$) or multi-step intermediate checkpoint sampling (e.g. 5–7 plates) for diseases with non-linear morphological transitions.
3. **Limited Pathological Coverage (4 of 38 Classes)**:
   - _Current Limitation_: The MobileNetV3 CNN classifier supports 38 crop-disease combinations across 14 crops, but the P2P progression viewer only has assets for 4 crops / 1 disease each. Uploading Grape Black Rot, Peach Bacterial Spot, or Pepper Bacterial Spot has no progression assets.
4. **Heuristic Mask Calculation vs. Semantic Lesion Segmentation**:
   - _Current Limitation_: `compute_difference_mask` uses absolute luminance differencing (`ImageChops.difference`) with Gaussian blur. If lighting or minor diffuse shading shifts between stages, the difference mask can pick up global illumination shifts rather than true lesion margins.
   - _Missing_: Semantic segmentation masking (e.g., using SAM / Segment Anything or color-space HSV thresholding) to extract ground-truth pathological margins.

#### Pillar B: Frontend & WebGL Visual Engine

1. **Flat Image Blending vs. Morphological Deformation**:
   - _Current Limitation_: The shader performs color-space cross-dissolve. In real plant biology, severe blight causes leaf edges to wrinkle, curl, and shrivel (necrosis causes volumetric water loss).
   - _Missing_: A vertex shader displacement map or normal map that physically deforms leaf margins as the slider approaches 80–100% to simulate foliar collapse and curling.
2. **Interactive Anatomical Hotspots**:
   - _Current Limitation_: The canvas is purely visual. Farmers and agronomy students cannot interact with specific symptom areas.
   - _Missing_: Interactive hotspot pins (e.g., hovering over a concentric spot on tomato reveals: _"Target-board conidiophore ring — Alternaria solani sporulation zone"_).
3. **Media Export & Timelapse Generation**:
   - _Current Limitation_: Users cannot save or share the progression outside the browser.
   - _Missing_: An automated export utility that records a 5-second WebM/MP4 or animated GIF timelapse of the leaf progression, or generates a downloadable PDF advisory report.

#### Pillar C: Agronomic & Real-World Biological Alignment

1. **Timeline Missing (Slider % $\neq$ Real-World Days)**:
   - _Current Limitation_: The slider shows $0\%$ to $100\%$, but does not communicate _how long_ this progression takes.
   - _Missing_: A calendar/day timeline (e.g., Day 0 $\to$ Day 3 $\to$ Day 7 $\to$ Day 14), with variable incubation periods based on pathogen biology (e.g. Potato Late Blight progresses in 3–5 days, while Apple Scab takes 10–14 days).
2. **Weather & Environmental Modifiers**:
   - _Current Limitation_: Progression is treated as static. In reality, fungal sporulation requires high relative humidity ($>85\%$) and specific temperatures ($18\text{--}24^\circ\text{C}$).
   - _Missing_: Interactive environmental toggles (e.g., "High Humidity & Rain" speeds up progression by $2.5\times$; "Dry & Sunny" halts progression).
3. **Intervention & Treatment Branching**:
   - _Current Limitation_: Progression is strictly unidirectional deterioration ($0\% \to 100\%$).
   - _Missing_: A **"What-If / Intervention" Mode** showing what happens if the farmer applies fungicide at 35% infection: the trajectory forks into a healed/contained state (desiccated brown scars without chlorotic spreading).

#### Pillar D: Diagnostic Pipeline Integration

1. **Heuristic Slider Percentage Mapping**:
   - _Current Limitation_: In `DiagnosticUploadCard.tsx`, the classifier assigns `sliderPct` based on coarse severity tiers (`Low` = 25%, `Moderate` = 50%, `High` = 85%).
   - _Missing_: Quantitative Lesion Surface Area ($\% \text{LAI}$ - Leaf Area Index affected) computed directly from segmented infected pixels.

---

### 3. Prioritized Improvement Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION ROADMAP                          │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: HIGH-IMPACT / NEAR-TERM                                        │
│  [1] Days-to-Stage Calendar Timeline with RH/Temp modifiers            │
│  [2] Interactive Symptom Hotspots on Leaf Canvas                       │
│  [3] Treatment Branching Toggle ("Treated" vs "Untreated")             │
│  [4] Progression Timelapse & PDF Advisory Export                       │
│  [5] Expand asset suites to 8 priority crops                           │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: ADVANCED WEBGL & SEGMENTATION                                  │
│  [6] Vertex displacement shader for leaf margin curling & wilting      │
│  [7] Semantic lesion mask extraction (SAM / HSV color separation)      │
│  [8] Exact pixel % lesion surface area measurement in classifier       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: GENERATIVE DEEP TECH                                           │
│  [9] Real leaf DDIM Inversion (simulate farmer's exact leaf)           │
│  [10] Asynchronous diffusion job queue backend                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### Tier 1: High-Impact / Near-Term (Frontend & Agronomy)

##### 1. Real-World Day Calibration & Environmental Modifiers

Add a timeline bar beneath the slider converting percentage into projected field days:

- **Tomato Early Blight**: Day 0 (Infection) $\to$ Day 4 (Initial Lesions) $\to$ Day 10 (Target Spots) $\to$ Day 18 (Defoliation).
- **Potato Late Blight**: Day 0 (Spore Germination) $\to$ Day 2 (Water-soaked spot) $\to$ Day 5 (Total Blight Collapse).
- Add microclimate toggles:
  - Ambient Humidity: Dry ($<60\%$), Moderate ($75\%$), Saturated ($>90\%$).
  - When humidity is high, show a flashing warning: _"Pathogen sporulation accelerated by $2.2\times$"_.

##### 2. Interactive Hotspot Anatomical Inspection Pins

Overlay interactive glowing markers on the leaf canvas when the slider reaches relevant thresholds:

- Clicking a pin opens a floating diagnostic popover:
  - Microscopic pathogen morphology (conidia, sporangia, rust urediniospores).
  - Agronomic physiological impact (loss of photosynthetic canopy, vascular collapse).
  - Recommended chemical intervention active ingredients (FRAC group codes).

##### 3. "What-If" Intervention Branching

Add a split-screen or toggle for **Treated vs. Untreated**:

- When toggled ON at $\le 50\%$ infection:
  - Untreated curve continues to $100\%$ defoliation.
  - Treated curve halts progression, showing dry localized scar tissue with green leaf margins preserved.

##### 4. Automated Timelapse Video & Diagnostic Report Export

- Use the HTML5 `canvas.captureStream()` API with `MediaRecorder` to let the farmer click **"Export Progression Timelapse"** $\to$ generates an instant 5-second WebM/MP4 download showing the leaf evolving from 0% to 100%.
- Generate a printable agronomic PDF report summarizing crop pathology, active stage, and preventive spray schedule.

##### 5. Expand Crop Coverage from 4 to 8 Priority Crops

Generate calibrated asset suites for the next 4 highest-incidence agricultural diseases:

1. **Grape** (_Vitis vinifera_) • Black Rot (_Guignardia bidwellii_)
2. **Pepper Bell** (_Capsicum annuum_) • Bacterial Spot (_Xanthomonas campestris_)
3. **Peach** (_Prunus persica_) • Bacterial Spot (_Xanthomonas arboricola_)
4. **Squash** (_Cucurbita pepo_) • Powdery Mildew (_Podosphaera xanthii_)

---

#### Tier 2: Advanced WebGL & Vision Upgrades

##### 6. Vertex Shader Foliar Curling & Edge Wilt

Upgrade `ProgressionShaderRenderer.ts` with vertex displacement:

```glsl
// Vertex Shader with organic leaf curl
attribute vec2 a_position;
uniform float u_progress;
varying vec2 v_texCoord;

void main() {
    vec2 pos = a_position;
    // Edge wilt factor increases with distance from leaf center and progression stage
    float dist = length(pos);
    float wilt = pow(dist, 2.0) * smoothstep(0.5, 1.0, u_progress) * 0.08;
    pos.y -= wilt;
    gl_Position = vec4(pos, 0.0, 1.0);
}
```

##### 7. Semantic Lesion Masking with SAM

Replace naive luminance differencing in `compute_difference_mask` with color-space chlorosis/necrosis segmentation:

- Extract $L^*a^*b^*$ color channel shifts ($b^*$ channel yellowing for chlorosis, low $L^*$ luminance for necrotic cores).
- Eliminates camera illumination differences and isolates true pathological lesions.

---

#### Tier 3: Generative Deep Tech (Personalized Leaf Inversion)

##### 8. Real Farmer Leaf Inversion (DDIM / ControlNet)

Instead of purely pre-baked synthetic specimens:

1. Farmer snaps a photo of their leaf in the field.
2. Background segmentation isolates the leaf.
3. Invert the image into Stable Diffusion latent space ($z_0 \to z_T$) using DDIM Inversion.
4. Inject attention cross-replacement targeting the inverted latents to project future symptoms onto the _actual leaf geometry_.

---

### 4. Recommended Immediate Next Step

To maximize project quality and impact for your graduation presentation, I recommend starting with **Tier 1**:

1. **Agronomic Calendar Timeline & Weather Modifiers**: Convert the abstract 0–100% slider into an intuitive **Day 0 $\to$ Day 14 timeline** with temperature and humidity controls.
2. **Interactive Anatomical Hotspots**: Add clickable symptom markers directly on the leaf canvas explaining pathogen morphology.
3. **Timelapse Video Export**: Enable one-click WebM/MP4 timelapse download directly from the browser canvas.

Would you like to start implementing the **Agronomic Day Timeline & Weather Modifiers** or the **Interactive Hotspots** first?
