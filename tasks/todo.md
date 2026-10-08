# TODO-110: PlantVillage + PlantDoc Hybrid Dataset & Multi-Task MobileNetV3-Large Architecture

## Current Status: IN PROGRESS
**Branch:** `feat/ml-todo110-hybrid-dataset-multitask`  
**Assignee:** ML Engineer  
**Phase:** Phase 1 — Machine Learning Core Upgrade  

---

- [x] **Subtask 1: Diagnostic Artifacts & Branch Initialization**
  - Switch to `feat/ml-todo110-hybrid-dataset-multitask`.
  - Stage diagnostic report `EXTERNAL_TEST_ACCURACY_REPORT.md` and test scripts.
  - Commit: `docs(ml): record external test diagnostic report and initialize todo-110 branch`.

- [x] **Subtask 2: Hybrid Dataset Merger, Class Mapping & Balancing (`prepare_hybrid_dataset.py`)**
  - Implement `ml-service/scripts/prepare_hybrid_dataset.py` with explicit PlantDoc mapping and class balancing cap.
  - Add deterministic 70/15/15 stratified split and SHA-256 leakage protection.
  - Write test suite `ml-service/tests/test_hybrid_dataset.py`.
  - Commit: `feat(ml): implement PlantVillage and PlantDoc hybrid dataset merger and class balancing`.

- [x] **Subtask 3: Multi-Task PyTorch Model Architecture (`model_multitask.py`)**
  - Implement `MultiTaskPlantClassifier` using `MobileNetV3-Large` backbone.
  - Define Crop Head (4 classes) and Disease Pathology Head (8 classes).
  - Implement combined loss: $\mathcal{L} = 0.4 \cdot \mathcal{L}_{\text{crop}} + 0.6 \cdot \mathcal{L}_{\text{disease}}$.
  - Write test suite `ml-service/tests/test_model_multitask.py`.
  - Commit: `feat(ml): build MobileNetV3-Large dual-head multi-task architecture and loss`.

- [x] **Subtask 4: Google Colab GPU End-to-End Training Notebook (`notebooks/TODO_110_MultiTask_Training.ipynb`)**
  - Build standalone Google Colab notebook for GPU (NVIDIA T4) training.
  - Include dataset downloads, DataLoader, augmentations, training loop, evaluation metrics, and dual-head ONNX export.
  - Commit: `feat(ml): create self-contained Google Colab GPU training and evaluation notebook`.

- [ ] **Subtask 5: Dual-Head ONNX Export & Benchmarking Pipeline (`export_multitask_onnx.py`)**
  - Build export and INT8 quantization script with dual outputs (`crop_logits`, `disease_logits`).
  - Run 100 sequential single-thread CPU benchmarks (verify $\le 25\text{ MB}$, $\le 85\text{ ms}$).
  - Commit: `feat(ml): implement dual-head ONNX export, INT8 quantization and latency benchmarking`.

- [ ] **Subtask 6: FastAPI Service Multi-Task Adapter & Preprocessing Upgrade (`inference.py`)**
  - Upgrade `preprocess_image` to aspect-ratio preserving resize/padding.
  - Adapt `InferenceEngine` for dual-head ONNX and support optional `crop_hint`.
  - Verify all unit and regression tests pass across `ml-service`.
  - Commit: `feat(ml): integrate dual-head ONNX engine with hierarchical inference and resize preprocessing`.

- [ ] **Subtask 7: Formal Completion Report (DoD) & Final Validation**
  - Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-110-hybrid-multitask.md`.
  - Commit: `docs(ml): add TODO-110 completion report and mark tasks complete`.
