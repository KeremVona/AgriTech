# Precision AgriTech Platform - Prompt-to-Prompt Disease Progression Roadmap

## ML Notebook & Generation Adaptation (TODO-107)
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

- [x] **Task 5: Colab Execution & Asset Verification**
  - User runs adapted notebook in Google Colab with FlashAttention memory optimization.
  - Run quantitative audit on `p2p_progression_assets_v5.zip` verifying $\text{IoU} \ge 0.97$, transparency, and WebGL shader readiness.

---

## Phase 1: Asset Polish & Ingestion into Frontend
- [x] **Task 1.1: Tomato & Potato Asset Micro-Polish**
  - Cleaned thin frame artifact at $x \ge 626$ on Tomato using largest connected component filter.
  - Cleaned 15-pixel apex spur on Potato Stage 1 to ensure bounding box delta $\Delta < 2.0\%$.
- [x] **Task 1.2: Ingest Photorealistic P2P Assets into `frontend/public/progression/`**
  - Replaced prototype vector assets with real diffusion-generated leaf plates and companion difference masks across all 4 crops.
- [x] **Task 1.3: Run Asset Conformance & Regression Tests**
  - Verified `npm run test:assets` (all 20 files compliant).
  - Verified `pytest frontend/tests/` (12/12 tests passing).
  - Verified `npm run build` and `npm run lint` (0 errors, 0 warnings).

---

## Phase 2: Frontend WebGL Engine & UI Verification
- [x] **Task 2.1: WebGL Engine Performance & Lifecycle Hardening**
  - Cached uniform and attribute locations in `ProgressionShaderRenderer.ts` to eliminate CPU string-hashing overhead on 60 FPS scrub.
  - Added `loadRequestId` to cancel out-of-order texture resolution on rapid crop switching.
  - Handled WebGL context disposal with `WEBGL_lose_context` and `webglcontextlost` event listeners.
  - Decoupled slider scrubbing from texture loading, eliminating double-render thrashing.
  - Verified all static endpoints and WebP assets return 200 OK via Vite preview server.
- [x] **Task 2.2: Dynamic Agronomic Card & Compare Controls**
  - Verified `CompareHealthyToggle` A/B comparison against Stage 0 baseline.
  - Verified `DiagnosticOverlayCard` dynamic stage and symptom updates.

---

## Phase 3: ML Microservice CLI & End-to-End Diagnostic Link
- [x] **Task 3.1: Headless Batch CLI Generator (`ml-service/scripts/p2p/generate_progression.py`)**
  - Implemented standalone CLI entrypoint with `--crop`, `--steps`, `--device`, `--output-dir` arguments.
  - Hardened with memory-efficient FlashAttention hooks and connected component artifact cleaning.
  - Added unit test suite `ml-service/tests/test_p2p_cli.py` (5/5 tests passing).
- [x] **Task 3.2: Connect Diagnostic Leaf Classifier $\to$ Progression Visualizer**
  - Created `DiagnosticUploadCard` component supporting drag-and-drop leaf image classification and verified clinical sample presets.
  - Implemented seamless "Project Progression Trajectory in Slider" CTA linking diagnostic results to the WebGL slider with automatic crop selection and severity navigation.

---

## Phase 4: Production Build, Audit & Git Merge
- [ ] **Task 4.1: Final End-to-End Build & Lint Verification**
- [ ] **Task 4.2: Git Push to `feat/ml-todo107-p2p-progression-generator` & PR Preparation**
