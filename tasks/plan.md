# Implementation Plan: TODO-110 (PlantVillage + PlantDoc Hybrid Dataset & Multi-Task MobileNetV3-Large Architecture)

> **Assignee:** ML Engineer  
> **Phase:** Phase 1 — Machine Learning Core (Domain Adaptation & Multi-Task Upgrade)  
> **Branch:** `feat/ml-todo110-hybrid-dataset-multitask`  
> **Key Objective:** Solve in-the-wild domain shift and cross-crop pathogen confusion (e.g. Potato vs. Tomato Late Blight) by merging PlantVillage and PlantDoc with balanced sampling and upgrading to a Dual-Head Multi-Task `MobileNetV3-Large` backbone.

---

## 1. Executive Summary & Problem Formulation

In our empirical evaluation on real-world field test images (`ml-service/data/raw/`), we uncovered two critical machine learning phenomena:
1. **Domain Shift & Background Bias (Shortcut Learning):** Training strictly on laboratory PlantVillage images (single leaf on neutral grey table) achieves 99.95% lab accuracy but struggles on field photos containing soil, shadows, watermarks, and complex foliage.
2. **Pathogen Host Confusion:** Both Tomato and Potato are attacked by *Phytophthora infestans* (Late Blight), producing identical dark necrotic lesions. A single-head flat 12-class classifier triggers "Late Blight" features without forcing the network to preserve distinguishing leaf margin morphology (serrated/lobed vs. entire/smooth).

### Solution Architecture:
- **Dataset Level:** Combine **PlantVillage** (large volume, clean pathology features) + **PlantDoc** (in-the-wild field conditions) using:
  1. **Strict Class Mapping:** Normalizing PlantDoc labels to our target taxonomy.
  2. **Class Balancing:** Capping PlantVillage samples (e.g. max 600–800 images per class) to avoid overwhelming PlantDoc samples.
- **Model Architecture Level:** Upgrade from `MobileNetV3-Small` to **`MobileNetV3-Large`** with **Multi-Task Dual Heads**:
  - **Crop Head:** 4 classes (`Apple, Corn, Potato, Tomato`) — enforces macro-morphology learning.
  - **Disease Pathology Head:** 8 classes (`Healthy, Early Blight, Late Blight, Bacterial Spot, Common Rust, Northern Leaf Blight, Cedar Apple Rust, Apple Scab`) — enforces micro-lesion pathology learning.
- **Training Environment:** Google Colab GPU (NVIDIA T4).
- **Inference Runtime:** ONNX export with dynamic batching, sub-25 MB size, sub-85 ms CPU latency, and aspect-ratio preserving resize (replacing aggressive CenterCrop).

---

## 2. Multi-Task System Architecture

```
                       [ Input: 3 x 224 x 224 Image ]
                                      │
                       [ Letterbox / Aspect-Ratio Resize ]
                                      │
                   ┌──────────────────▼──────────────────┐
                   │    MobileNetV3-Large Shared Body    │
                   │      (Features + GlobalAvgPool)     │
                   └──────────────────┬──────────────────┘
                                      │
                                 [ z: 960-d ]
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│     Crop Species Head        │              │   Pathology / Disease Head   │
│ Linear(960, 256) -> Hardswish│              │ Linear(960, 512)-> Hardswish │
│  -> Dropout -> Linear(256, 4)│              │  -> Dropout -> Linear(512, 8)│
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               ▼                                             ▼
        Crop Logits [B, 4]                           Disease Logits [B, 8]
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
                      Hierarchical Softmax Combiner
           (Supports optional crop_hint from UI: e.g. "Potato")
```

---

## 3. Subtask Breakdown & Git Commit Cadence

Following `PROJECT_DETAILS/GIT_CHANGES.md`, each subtask is verified with tests and committed independently to `feat/ml-todo110-hybrid-dataset-multitask`.

### Subtask 1: Diagnostic Artifacts & Branch Initialization
- **Action:** Switch to `feat/ml-todo110-hybrid-dataset-multitask`, record initial diagnostics.
- **Commit:** `docs(ml): record external test diagnostic report and initialize todo-110 branch`

### Subtask 2: Hybrid Dataset Merger, Class Mapping & Balancing (`prepare_hybrid_dataset.py`)
- **Action:** Implement dataset script merging PlantDoc and PlantVillage with explicit label mapping, capping PlantVillage classes to balance with PlantDoc, and performing deterministic 70/15/15 stratified split with SHA-256 leakage protection.
- **Testing:** `tests/test_hybrid_dataset.py` verifying mapping integrity, sample balance, and zero leakage.
- **Commit:** `feat(ml): implement PlantVillage and PlantDoc hybrid dataset merger and class balancing`

### Subtask 3: Multi-Task Model Architecture & Loss (`model_multitask.py`)
- **Action:** Implement `MultiTaskPlantClassifier` (MobileNetV3-Large backbone, dual-head output for crop and disease) and multi-task weighted loss ($\mathcal{L} = 0.4 \cdot \mathcal{L}_{\text{crop}} + 0.6 \cdot \mathcal{L}_{\text{disease}}$).
- **Testing:** `tests/test_model_multitask.py` verifying forward pass shapes, head independence, and backward gradients.
- **Commit:** `feat(ml): build MobileNetV3-Large dual-head multi-task architecture and loss`

### Subtask 4: Google Colab GPU End-to-End Training Notebook (`notebooks/TODO_110_MultiTask_Training.ipynb`)
- **Action:** Create a self-contained, reproducible Jupyter notebook for Google Colab with NVIDIA T4 GPU support.
- **Features:** Automated dataset download, multi-task dataset loader, outdoor lighting augmentations, CosineAnnealingLR, EarlyStopping, per-head confusion matrices, and dual-head ONNX export.
- **Commit:** `feat(ml): create self-contained Google Colab GPU training and evaluation notebook`

### Subtask 5: Dual-Head ONNX Export & Benchmarking Pipeline (`export_multitask_onnx.py`)
- **Action:** Build script exporting PyTorch dual-head checkpoint to ONNX with dynamic batch axes and benchmark 100 sequential single-thread CPU runs.
- **Testing:** Verify model size $\le 25\text{ MB}$, median latency $\le 85\text{ ms}$, probability parity.
- **Commit:** `feat(ml): implement dual-head ONNX export, INT8 quantization and latency benchmarking`

### Subtask 6: FastAPI Service Multi-Task Adapter & Preprocessing Upgrade (`inference.py`)
- **Action:** Update `preprocess_image` to use padding/letterbox resize (no center-crop loss), adapt `InferenceEngine` for dual-head ONNX, support optional `crop_hint` parameter in `/api/v1/classify-leaf`, and verify full regression suite.
- **Testing:** Full pytest regression across `ml-service` (100% passing).
- **Commit:** `feat(ml): integrate dual-head ONNX engine with hierarchical inference and resize preprocessing`

### Subtask 7: Formal Completion Report (DoD)
- **Action:** Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-110-hybrid-multitask.md`.
- **Commit:** `docs(ml): add TODO-110 completion report and mark tasks complete`

---

## 4. Acceptance Criteria

- [ ] PlantDoc and PlantVillage datasets mapped cleanly across target taxonomy.
- [ ] Balanced dataset pipeline generated with zero data leakage (SHA-256 validated).
- [ ] Dual-head `MobileNetV3-Large` PyTorch architecture implemented with multi-task loss.
- [ ] Google Colab training notebook ready with GPU optimization and evaluation plots.
- [ ] Exported dual-head ONNX model artifact $\le 25\text{ MB}$.
- [ ] Median CPU latency $\le 85\text{ ms}$ on single-thread execution.
- [ ] FastAPI `/api/v1/classify-leaf` supports dual-head predictions and optional `crop_hint`.
- [ ] All unit and regression tests pass across `ml-service`.
