# Task List: Multi-Dataset Model Re-Training (Solution 1)

**Branch:** `feat/ml-exp-multidataset-retrain` (Strictly local, no remote pushes)  
**Status:** Phase 3 Complete (MobileNetV3-Large Multi-Task Architecture Configured) - Awaiting User Approval for Phase 4  
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

- [ ] **Phase 4: Training & Validation Harness (Colab / Local GPU)**
  - Implement `train_multidataset.py` with AdamW, Cosine Annealing, and early stopping.
  - Build standalone Google Colab / Kaggle GPU training notebook (`notebooks/MultiDataset_Training.ipynb`).
  - Verification: Test run for 1 synthetic epoch passes cleanly.
  - Commit: `feat(ml-retrain-exp): add training loop, metrics tracker and Colab GPU notebook`.

- [ ] **Phase 5: Model Training Run & Field Benchmark Evaluation**
  - Execute full training run on GPU until convergence.
  - Benchmark checkpoint against 11 PlantDoc field samples and 8 PlantVillage lab samples.
  - Verify elimination of the Potato Late Blight baseline fumble and field accuracy $\ge 90\%$.
  - Commit: `feat(ml-retrain-exp): record multi-dataset training run metrics and evaluation`.

- [ ] **Phase 6: ONNX Export, Quantization & Final Report**
  - Export dual-head ONNX model with dynamic batching.
  - Benchmark ONNX model file size ($\le 25\text{ MB}$) and CPU latency ($\le 30\text{ ms}$).
  - Compile `ml-retrain-experimental/RETRAINING_EXPERIMENT_REPORT.md` comparing Solution 1 vs Solution 2.
  - Commit: `docs(ml-retrain-exp): compile multi-dataset retraining experiment report`.
