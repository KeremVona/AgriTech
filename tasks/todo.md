# Task List: Multi-Dataset Model Re-Training (Solution 1)

**Branch:** `feat/ml-exp-multidataset-retrain` (Strictly local, no remote pushes)  
**Status:** READY FOR IMPLEMENTATION PLAN APPROVAL  
**Plan Document:** `tasks/plan.md`  

---

- [ ] **Phase 1: Dataset Review & Taxonomy Alignment (Joint Review)**
  - Review 4 candidate Mendeley datasets with user.
  - Establish class mapping dictionary to the 12 canonical project classes.
  - Set per-class sample balancing caps (e.g., max 500–800 images per class) to avoid skew.
  - Decide on handling of out-of-scope classes.
  - Checkpoint: User approves dataset selection and class mapping.

- [ ] **Phase 2: Isolated Experimental Directory & Ingestion Pipeline**
  - Create directory structure under `ml-retrain-experimental/`.
  - Implement `ingest_multidataset.py` with image validation and SHA-256 leakage protection.
  - Implement deterministic stratified split (70% Train / 15% Val / 15% Test).
  - Implement PyTorch Dataset & DataLoader with augmentations (`RandomResizedCrop`, `ColorJitter`, `RandomErasing`).
  - Verification: Split verification script passes; class distribution report generated.
  - Commit: `feat(ml-retrain-exp): implement multi-dataset ingestion and augmentation pipeline`.

- [ ] **Phase 3: Model Architecture Configuration (`MobileNetV3-Large` Multi-Task)**
  - Implement `MultiTaskPlantClassifier` with `MobileNetV3-Large` backbone.
  - Define Crop Species Head (4 classes) and Disease Pathology Head (8 classes).
  - Implement combined Multi-Task Loss with label smoothing.
  - Verification: Unit tests pass; output shapes and backprop verified.
  - Commit: `feat(ml-retrain-exp): implement MobileNetV3-Large dual-head multi-task architecture`.

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
