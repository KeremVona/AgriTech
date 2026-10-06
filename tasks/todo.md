# TODO-102: CNN Model Training, Transfer Learning & Evaluation (Task List)

## Current Status: COMPLETED (TODO-102 DONE)
**Branch:** `feat/ml-todo102-cnn-training`  
**Target:** Phase 1 — Machine Learning Core (TODO-102)

---

- [x] **Task 1: Git Branch & Dependencies Setup**
  - Create and switch to `feat/ml-todo102-cnn-training`.
  - Add `torch`, `torchvision`, `scikit-learn`, `matplotlib`, `seaborn` to `ml-service/pyproject.toml` and `requirements.txt`.
  - Verify local virtual environment installation.

- [x] **Task 2: TDD Test Suite (`ml-service/tests/test_train_model.py`)**
  - Implement tests for augmentation transforms (`RandomHorizontalFlip`, `RandomRotation(30)`, `ColorJitter(0.2, 0.2)`, ImageNet normalization).
  - Implement test for `EarlyStopping` logic (patience=5 trigger and best model checkpointing).
  - Implement test for `MobileNetV3-Small` architecture modification (12-class classifier head).
  - Implement test for Top-1 Accuracy and Macro F1 metric calculations.
  - Verify tests run and fail/pass cleanly (TDD RED -> GREEN).

- [x] **Task 3: Modular Training Script (`ml-service/scripts/train.py`)**
  - Implement CLI argument parsing (`--data-dir`, `--epochs`, `--batch-size`, `--lr`, `--patience`, `--device`).
  - Implement transfer learning model builder with pretrained `MobileNetV3-Small`.
  - Implement training and validation loops with loss logging.
  - Implement `EarlyStopping` callback saving `best_model.pth` and `hyperparameters.json`.

- [x] **Task 4: Evaluation & Reporting Script (`ml-service/scripts/evaluate.py`)**
  - Implement evaluation loop computing confusion matrix, Precision, Recall, F1 across 12 classes.
  - Implement `plot_confusion_matrix` generating `confusion_matrix.png`.
  - Implement JSON report generator (`test_metrics.json`).

- [x] **Task 5: Standalone Google Colab T4 Notebook (`notebooks/TODO_102_MobileNetV3_Training.ipynb`)**
  - Create single-click Google Colab notebook utilizing T4 GPU.
  - Add automated PlantVillage 12-class dataset download and preparation via `prepare_dataset.py`.
  - Wire GPU training loop with progress bars and real-time loss/accuracy plots.
  - Run evaluation on held-out test split, verifying Top-1 Macro F1 $\ge 0.94$.
  - Package `best_model.pth`, `hyperparameters.json`, `confusion_matrix.png`, and `test_metrics.json` into a downloadable zip file.

- [x] **Task 6: Local Verification, Completion Report & Git Commit**
  - Validate model checkpoints in `ml-service/models/`.
  - Run regression test suite on `ml-service` (ensure all existing tests still pass).
  - Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-102-cnn-training.md` following `Task Completion.md`.
  - Commit changes following Conventional Commits format (`feat(ml): ...`).
