# Prompt-to-Prompt Notebook Adaptation Checklist

- [x] **Task 1: Environment & Self-Contained Module Setup**
  - Strip obsolete paper demo cells and 22 MB outputs from `prompt-to-prompt_stable.ipynb`.
  - Add safe library installs (`diffusers`, `transformers`, `accelerate`).
  - Embed `seq_aligner.py` and `cross_attention_control.py` persistence.
  - Switch model loading to public `runwayml/stable-diffusion-v1-5` with `DDIMScheduler` (no auth token required).

- [x] **Task 2: Multi-Stage Algorithm Adaptation (`LocalBlend` & `AttentionRefine`)**
  - Upgrade `LocalBlend` to handle 3 prompt stages ($N=3$) without tensor broadcast errors.
  - Implement single noise latent broadcasting (`init_latent`) across all 3 stages.
  - Configure `AttentionRefine` with Needleman-Wunsch sequence alignment.

- [x] **Task 3: Agronomic Prompt Calibration & Anti-Macro Framing**
  - Retain validated configurations for Potato (`seed: 108`) and Apple (`seed: 312`).
  - Calibrate Tomato prompt with anti-macro framing directives (`"isolated whole single leaf blade, full leaf margins visible, ample white background space"`).
  - Calibrate Corn prompt with anti-macro framing directives (`"isolated long leaf blade, full tip visible, centered"`).
  - Define pathology `blend_words` for all 4 crops.

- [x] **Task 4: Zero-Dependency Matte, Mask Extraction & Asset Packaging**
  - Implement pure NumPy corner-sampling background segmentation.
  - Add $800 \times 800$ RGBA WebP normalization.
  - Generate companion difference masks (`u_mask1`, `u_mask2`) for WebGL fragment shaders.
  - Package assets into `p2p_progression_assets_v5.zip` with automatic download.

- [ ] **Task 5: Colab Execution & Asset Verification**
  - User runs adapted notebook in Google Colab.
  - Run quantitative audit on `p2p_progression_assets_v5.zip` verifying $\text{IoU} \ge 0.95$, transparency, and WebGL shader readiness.
