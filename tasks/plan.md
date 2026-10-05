# Implementation Plan: Adapting Google's `prompt-to-prompt_stable.ipynb` for AgriTech Disease Progression

## Overview
Adapt the official Google Research Prompt-to-Prompt Stable Diffusion notebook (`ml-service/scripts/p2p/prompt-to-prompt_stable.ipynb`) into a production-grade, standalone Google Colab generator for Feature #1 / TODO-107 (Interactive 0–100% Disease Progression Slider). The adapted notebook will generate geometrically aligned, transparent $800 \times 800$ RGBA WebP assets across 3 progression stages (Stage 0: Healthy $\to$ Stage 1: Early Lesions $\to$ Stage 2: Severe Necrosis) plus companion difference masks for the 4 target crops (Tomato, Potato, Corn, Apple).

---

## Analysis of the Existing `prompt-to-prompt_stable.ipynb`

### Current State
1. **File Source:** Direct copy of `google/prompt-to-prompt/prompt-to-prompt_stable.ipynb` (22.6 MB with embedded historical run outputs).
2. **Current Deficiencies for our Project:**
   - **Missing Dependencies:** Relies on local files `ptp_utils.py` and `seq_aligner.py` via `import ptp_utils, seq_aligner`. These are not present in Colab's default `/content/` directory, failing with `ModuleNotFoundError`.
   - **Gated SD 1.4 & Auth Token:** Uses `CompVis/stable-diffusion-v1-4` with `use_auth_token=MY_TOKEN`, which fails without HuggingFace credentials and license acceptance.
   - **2-Prompt Dimension Crash in `LocalBlend`:** `LocalBlend` hardcodes 2-prompt shapes `mask = (mask[:1] + mask[1:]).float()`, which immediately crashes with broadcast errors when passed our 3 disease stages.
   - **Irrelevant Demo Content:** Contains paper demonstration cells (squirrels, croutons, soup, teddy bears) instead of foliar plant pathology.
   - **Missing Post-Processing:** Has no background removal, no $800 \times 800$ WebP normalization, no WebGL companion difference mask extraction, and no archive download.

---

## Architecture & Engineering Solutions

1. **Self-Contained Module Architecture:**
   - Embed `seq_aligner` and `ptp_utils` logic directly into the notebook cells (written to `/content/` on startup) to eliminate missing file errors.
   - Use public `runwayml/stable-diffusion-v1-5` with `DDIMScheduler` to eliminate token gates and deprecation warnings.

2. **$N$-Stage Generalization for `LocalBlend`:**
   - Upgrade latent blending to dynamically support $N \ge 3$ stages:
     $$M_{\text{targets}} = \left(M_0 + \sum_{i=1}^{N-1} M_i\right) > 0$$
     $$z_t^{(i)} = z_t^{(0)} + M_{\text{targets}}^{(i)} \cdot \left(z_t^{(i)} - z_t^{(0)}\right) \quad \forall i \ge 1$$
   - Enforce single Gaussian noise broadcasting ($z_T^{(0)} = z_T^{(1)} = z_T^{(2)}$) via `init_latent`.

3. **Foliage Framing & Pathology Calibration:**
   - Retain validated configurations for **Potato** (99.6% IoU) and **Apple** (97.3% IoU).
   - Re-calibrate **Tomato** and **Corn** to eliminate the edge-to-edge macro zoom defect discovered in v4 audit. Add explicit framing bounds: `"isolated whole single leaf blade, full leaf margins visible, ample white background space, centered specimen"`. Add negative guidance: `"close up, macro, cropped, edge-to-edge, touching borders"`.

4. **Production Output Packaging:**
   - Pure NumPy corner-sampling background segmentation (zero external C-libraries).
   - Export strictly formatted $800 \times 800$ RGBA WebP plates ($< 150\text{ KB}$) and grayscale difference masks for WebGL uniforms `u_mask1`, `u_mask2`.
   - Package all 20 assets into `p2p_progression_assets_v5.zip` with automatic Colab browser download.

---

## Task Breakdown

### Task 1: Environment & Self-Contained Module Setup
- **Description:** Strip obsolete paper demo cells and embedded historical outputs from `prompt-to-prompt_stable.ipynb`. Replace with clean Colab pip install (`diffusers transformers accelerate`) and self-contained disk persistence for `seq_aligner` and `cross_attention_control`.
- **Acceptance Criteria:**
  - File size reduced from 22.6 MB to $< 50\text{ KB}$.
  - Cells 1–3 execute in Colab without `ModuleNotFoundError` or `_Ink` typing errors.
  - Model loads `runwayml/stable-diffusion-v1-5` with `DDIMScheduler` without requiring HuggingFace tokens.

### Task 2: Multi-Stage Algorithm Adaptation (`LocalBlend` & `AttentionRefine`)
- **Description:** Implement $N$-stage support in `LocalBlend` and wire `AttentionRefine` with Needleman-Wunsch token alignment and single latent noise broadcasting.
- **Acceptance Criteria:**
  - `LocalBlend` executes on 3 stages simultaneously without dimension mismatch.
  - Cross-attention replacement transfers healthy leaf geometry from Stage 0 to Stages 1 and 2 while allowing disease tokens to form symptoms.

### Task 3: Agronomic Prompt Calibration & Anti-Macro Framing
- **Description:** Configure prompts, seeds, negative prompts, and `blend_words` for the 4 target crops. Apply framing directives for Tomato and Corn to prevent edge-to-edge macro zoom.
- **Acceptance Criteria:**
  - Potato and Apple retain their verified seeds and prompts.
  - Tomato prompt updated to isolated compound leaf on white background.
  - Corn prompt updated to isolated full lanceolate leaf blade with visible margins.

### Task 4: Zero-Dependency Matte, Mask Extraction & Asset Packaging
- **Description:** Implement corner-sampling white background removal, 800x800 WebP normalization, companion difference masks (`u_mask1`, `u_mask2`), and zip archiving with `files.download()`.
- **Acceptance Criteria:**
  - All outputs saved as transparent $800 \times 800$ RGBA WebP plates.
  - Companion difference masks generated for WebGL fragment shaders.
  - Downloads `p2p_progression_assets_v5.zip`.

### Task 5: Verification & Acceptance Testing in Google Colab
- **Description:** User executes the adapted notebook in Google Colab. Run automated quantitative audit on the downloaded zip (IoU $\ge 0.95$, file size $< 150\text{ KB}$, no macro clipping).
- **Acceptance Criteria:**
  - All 4 crops achieve $\text{IoU} \ge 0.95$ across progression stages.
  - Zero fruit/tuber hallucinations and zero macro border clippings.
