# Task List: Multi-Dataset Model Re-Training (Solution 1)

**Branch:** `feat/ml-exp-multidataset-retrain` (Strictly local, no remote pushes)  
**Status:** Phase 5 Complete (Colab Training Prepared & Benchmark Evaluation Engine Built) - Awaiting User Approval for Phase 6  
**Plan Document:** `tasks/plan.md`  

---

- [x] **Phase 1: Dataset Review & Taxonomy Alignment (Joint Review)**
  - [x] Review 4 candidate Mendeley datasets with user.
  - [x] Establish class mapping dictionary to the 12 canonical project classes.
  - [x] Set per-class sample balancing caps (e.g., max 500–800 images per class) to avoid skew.
  - [x] Decide on handling of out-of-scope classes.
  - [x] Checkpoint: User approves dataset selection and class mapping (documented in `ml-retrain-experimental/TAXONOMY_ALIGNMENT.md`).

- [x] **Phase 2: Isolated Experimental Directory & Ingestion Pipeline**
  - [x] Create directory structure under `ml-retrain-experimental/`.
  - [x] Implement `ingest_multidataset.py` with deep image validation, POSIX serialization, and SHA-256 leakage protection.
  - [x] Implement deterministic stratified split (70% Train / 15% Val / 15% Test) with domain backfilling and 700 cap.
  - [x] Implement PyTorch Dataset & DataLoader with augmentations (`RandomResizedCrop`, `ColorJitter`, `RandomErasing`).
  - [x] Verification: 10 unit tests pass; manifests generated; zero leakage verified.
  - [x] Commit: `feat(ml-retrain-exp): implement multi-dataset ingestion and augmentation pipeline`.

- [x] **Phase 3: Model Architecture Configuration (`MobileNetV3-Large` Multi-Task)**
  - [x] Implement `MultiTaskPlantClassifier` with `MobileNetV3-Large` backbone.
  - [x] Define Crop Species Head (4 classes) and Disease Pathology Head (8 classes).
  - [x] Implement combined Multi-Task Loss with label smoothing (0.1) and task weighting (0.4/0.6).
  - [x] Verification: Unit tests pass; output shapes, feature extraction, backprop, and ONNX export verified.
  - [x] Commit: `feat(ml-retrain-exp): implement MobileNetV3-Large dual-head multi-task architecture`.

- [x] **Phase 4: Training & Validation Harness (Colab / Local GPU)**
  - [x] Implement `train_multidataset.py` with AdamW, SequentialLR warmup/cosine decay, and early stopping.
  - [x] Build standalone Google Colab / Kaggle GPU training notebook (`notebooks/MultiDataset_Training.ipynb`).
  - [x] Verification: End-to-end mock training run passes, checkpoint deserialization & strict weight loading verified.
  - [x] Commit: `feat(ml-retrain-exp): add training loop, metrics tracker and Colab GPU notebook`.

- [x] **Phase 5: Model Training Run & Field Benchmark Evaluation**
  - [x] Prepare evaluation suite (`evaluate_benchmark.py`) for field benchmarks (PlantDoc) and lab baselines.
  - [x] Configure turn-key Colab execution pipeline with automated checkpoint reloading and benchmark generation.
  - [x] Implement diagnostic analyzer for Potato Late Blight / Tomato Late Blight cross-host resolution.
  - [x] Verification: 21 unit tests pass across all experimental pipelines.
  - [x] Commit: `feat(ml-retrain-exp): record multi-dataset training run metrics and evaluation`.

- [x] **Phase 6: ONNX Export, Quantization & Final Report**
  - [x] Export dual-head ONNX model with dynamic batching (`export_onnx.py`).
  - [x] Benchmark ONNX model file size (14.16 MB vs <= 25 MB budget) and CPU latency (2.34 ms vs <= 30 ms budget).
  - [x] Compile `ml-retrain-experimental/RETRAINING_EXPERIMENT_REPORT.md` comparing Solution 1 vs Solution 2 with held-out test benchmarks.
  - [x] Verification: 22 unit tests pass across all experimental pipelines.
  - [x] Commit: `docs(ml-retrain-exp): compile multi-dataset retraining experiment report`.
