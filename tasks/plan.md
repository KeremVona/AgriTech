# Implementation Plan: TODO-102 (CNN Model Training, Transfer Learning & Evaluation)

> **Assignee:** ML Engineer  
> **Phase:** Phase 1 — Machine Learning Core & Disease Progression Slider Engine  
> **Target Branch:** `feat/ml-todo102-cnn-training`  
> **Compute Platform:** Google Colab T4 GPU (Training) + Local Python/CLI (Testing & Integration)  

---

## 1. Executive Summary & Objectives

`TODO-102` establishes the deep learning foliar disease classification core for the AgriTech platform:
1. Fine-tune a lightweight CNN architecture (`MobileNetV3-Small`, compatible with sub-100ms ONNX export in TODO-103) on the 12 targeted crop-disease classes across 4 staple crops (Tomato, Potato, Corn, Apple).
2. Incorporate outdoor lighting-specific augmentations: `RandomHorizontalFlip`, `RandomRotation(degrees=30)`, `ColorJitter(brightness=0.2, contrast=0.2)`, and standard ImageNet normalization.
3. Enforce an **Early Stopping callback** tracking validation loss with `patience = 5`.
4. Train efficiently on **Google Colab (T4 GPU)**, producing a `.pth` model checkpoint and logged hyperparameters.
5. Evaluate on the held-out test split, verifying the acceptance criterion of **Top-1 Macro F1-score $\ge 0.94$**, and outputting a confusion matrix and classification report.

---

## 2. Architecture & Design Principles

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                           Local Repository Workspace                        │
  │                                                                             │
  │  ml-service/                                                                │
  │  ├── scripts/                                                               │
  │  │   ├── train.py          (CLI & modular training pipeline)                │
  │  │   └── evaluate.py       (Test evaluation, confusion matrix & metrics)    │
  │  ├── tests/                                                                 │
  │  │   └── test_train_model.py (TDD unit tests for transforms, loss, model)   │
  │  └── models/                                                                │
  │      └── README.md         (Checkpoint storage guide)                       │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                   Synchronized to Colab │ / Downloaded weights
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                         Google Colab Workspace (T4 GPU)                     │
  │                                                                             │
  │  notebooks/TODO_102_MobileNetV3_Training.ipynb                              │
  │  ├── Ingests PlantVillage 12-class dataset (fast GDown/Kaggle download)     │
  │  ├── Executes train.py logic on CUDA (T4 16GB VRAM, ~5-8 mins runtime)      │
  │  ├── EarlyStopping logs best checkpoint                                     │
  │  ├── Generates confusion_matrix.png & test_evaluation_report.json           │
  │  └── Bundles best_model.pth + metrics into downloadable archive             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Targeted 12-Class Label Specification

The model will output logits for the exact 12 classes standardized in `TODO-101`:
1. `Tomato___healthy`
2. `Tomato___Early_blight`
3. `Tomato___Late_blight`
4. `Tomato___Bacterial_spot`
5. `Potato___healthy`
6. `Potato___Early_blight`
7. `Potato___Late_blight`
8. `Corn_(maize)___healthy`
9. `Corn_(maize)___Common_rust_`
10. `Corn_(maize)___Northern_Leaf_Blight`
11. `Apple___healthy`
12. `Apple___Cedar_apple_rust`

---

## 4. Vertical Slice Task Breakdown

### Task 1: Environment & Dependency Setup (Local & Colab)
- Update `ml-service/pyproject.toml` and `requirements.txt` with PyTorch, Torchvision, scikit-learn, and matplotlib.
- Ensure CPU compatibility locally without requiring heavy CUDA gigabytes, while enabling auto-detection of `cuda` if available.

### Task 2: TDD Test Suite (`ml-service/tests/test_train_model.py`)
- Test data transformations (outdoor lighting color jitter, rotation, normalization).
- Test model initialization and classifier head replacement ($12$ logits).
- Test `EarlyStopping` callback behavior (saves model on loss decrease, terminates after 5 stagnant epochs).
- Test metric calculation (Top-1 Accuracy, Precision, Recall, Macro F1).

### Task 3: Modular Training Script (`ml-service/scripts/train.py`)
- Model backbone: `torchvision.models.mobilenet_v3_small(weights="DEFAULT")`.
- Replace `classifier[3]` linear layer with `nn.Linear(in_features=1024, out_features=12)`.
- Optimizer: `AdamW(lr=1e-3, weight_decay=1e-4)`.
- Learning rate scheduler: `CosineAnnealingLR` or `ReduceLROnPlateau`.
- Criterion: `nn.CrossEntropyLoss()`.
- Checkpointing: saves `best_model.pth` and `hyperparameters.json`.

### Task 4: Evaluation & Reporting Module (`ml-service/scripts/evaluate.py`)
- Evaluates test split.
- Generates classification report (Precision, Recall, F1 per class and Macro F1).
- Generates high-resolution confusion matrix plot (`confusion_matrix.png`).
- Saves machine-readable JSON metrics (`test_metrics.json`).

### Task 5: Self-Contained Google Colab Notebook (`notebooks/TODO_102_MobileNetV3_Training.ipynb`)
- Self-contained, single-click runner on Google Colab T4.
- Ingests dataset, executes training with GPU acceleration, runs evaluation, and automatically downloads the resulting artifacts (`best_model.pth`, `confusion_matrix.png`, `hyperparameters.json`).

### Task 6: Model Verification & Completion Report
- Verify `Top-1 Macro F1 >= 0.94` on test split.
- Place `best_model.pth` in `ml-service/models/`.
- Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-102-cnn-training.md` following `Task Completion.md`.
- Commit changes to `feat/ml-todo102-cnn-training`.

---

## 5. Acceptance Criteria

- [ ] Training script implements required augmentations: `RandomHorizontalFlip`, `RandomRotation(degrees=30)`, `ColorJitter(brightness=0.2, contrast=0.2)`, ImageNet normalization.
- [ ] Early stopping callback monitors validation loss with a patience of 5 epochs.
- [ ] Evaluation outputs confusion matrix, Precision, Recall, and F1-score across all 12 classes.
- [ ] Overall Top-1 Macro F1-score $\ge 0.94$ on the held-out test split.
- [ ] Model artifacts saved as `.pth` checkpoints with logged hyperparameters.
- [ ] Zero changes made to untouched modules or files belonging to other team members.
