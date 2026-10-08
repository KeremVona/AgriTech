# FIX-001: Synchronize Inference Class Labels with Training Ground Truth

**Status:** DONE  
**Branch:** `fix/ml-class-labels-ordering`  
**Phase:** Phase 1 — Machine Learning Core & Serving API  

---

## Summary

Diagnosed and fixed a critical label permutation bug in `ml-service/inference.py`. The trained ONNX deep learning model operated with 100% accuracy, but the API was returning incorrect disease names (e.g. Tomato Late Blight returned as Apple Healthy, Apple Cedar Rust as Tomato Healthy) because `CLASS_LABELS` had been hardcoded starting with Tomato, whereas PyTorch's `ImageFolder` sorted the 12 classes alphabetically (Apple $\to$ Corn $\to$ Potato $\to$ Tomato).

Reordered `CLASS_LABELS` to the exact alphabetical ground-truth list, added a dynamic loader that reads directly from `models/hyperparameters.json` with static fallback, updated `_stub_probabilities()` to use label index lookups, added automated CI parity tests, and validated the fix empirically across 36 PlantVillage leaf specimens (100% pass rate).

---

## Changes Made

### Made
- `PROJECT_DETAILS/Reports/Phase 1/FIX-class-labels-ordering.md` — Formal completion report.
- `ml-service/models/diagnostic_test_results.json` — Empirical test results across 36 images.

### Modified
- `ml-service/inference.py`:
  - Reordered `DEFAULT_CLASS_LABELS` to strict alphabetical ordering matching `hyperparameters.json`.
  - Added `_load_class_labels()` helper to dynamically synchronize `CLASS_LABELS` from `models/hyperparameters.json` on startup.
  - Refactored `_stub_probabilities()` to use dynamic index lookup for `Tomato___Late_blight`, `Tomato___Early_blight`, and `Tomato___healthy`.
- `ml-service/requirements.txt`:
  - Added `pydantic-settings>=2.0.0` to ensure clean environment installations without missing dependency errors.
- `ml-service/tests/test_inference_engine.py`:
  - Added `test_class_labels_alphabetical_order()` to enforce strict alphabetical ordering.
  - Added `test_class_labels_matches_hyperparameters()` to guarantee automated parity between `inference.py` and `hyperparameters.json`.
- `tasks/plan.md` & `tasks/todo.md`:
  - Documented implementation plan and verified all tasks.

### Removed
- None.

---

## Implementation Details

- **Ground Truth Label Ordering:**
  ```python
  CLASS_LABELS = [
      "Apple___Cedar_apple_rust",            # 0
      "Apple___healthy",                     # 1
      "Corn_(maize)___Common_rust_",          # 2
      "Corn_(maize)___Northern_Leaf_Blight", # 3
      "Corn_(maize)___healthy",              # 4
      "Potato___Early_blight",               # 5
      "Potato___Late_blight",                # 6
      "Potato___healthy",                    # 7
      "Tomato___Bacterial_spot",             # 8
      "Tomato___Early_blight",               # 9
      "Tomato___Late_blight",                # 10
      "Tomato___healthy",                    # 11
  ]
  ```
- **Automated Drift Prevention:**
  `_load_class_labels()` inspects `models/hyperparameters.json` upon module initialization. If the file is present and contains 12 classes, it assigns them directly to `CLASS_LABELS`, preventing any manual drift if models are retrained in future phases.

---

## Testing / Validation

### Commands Executed

```bash
# 1. Run full test suite in ml-service
pytest tests/

# 2. Run empirical 36-image diagnostic test script
python scratch/diagnose_samples.py

# 3. Test live FastAPI endpoint with test image payload
python -c "from main import app; from fastapi.testclient import TestClient; ..."
```

### Results
- `pytest tests/`: **136 passed, 0 failed** in 11.33s.
  - `test_class_labels_count` — PASS
  - `test_class_labels_coverage` — PASS
  - `test_class_labels_alphabetical_order` — PASS
  - `test_class_labels_matches_hyperparameters` — PASS
  - All 132 other existing tests — PASS
- **Empirical 36-Sample Verification (`PlantVillage/`):**
  - Raw Model Accuracy: **36 / 36 (100.0%)**
  - API Output Accuracy: **36 / 36 (100.0%)** (increased from 16.7%)
  - Every pathology (Tomato Late Blight, Potato Healthy, Apple Cedar Rust, Corn Rust, etc.) now outputs its exact ground truth.
- **Live Endpoint Test:**
  - `GET /health/ready` responded `HTTP 200 OK`, `mode: "LIVE"`, `model_loaded: true`.
  - `POST /api/v1/classify-leaf` returned valid `PredictionDetail` and `agronomic_advisory` with 4.4 ms CPU latency.

---

## Acceptance Criteria Checklist

- [x] `CLASS_LABELS` strictly synchronized with PyTorch `ImageFolder` alphabetical ordering.
- [x] Dynamic fallback loader prevents label drift.
- [x] Unit test suite passes 100% (136/136).
- [x] Empirical testing on 36 real leaf images yields 100% classification accuracy.
- [x] Live FastAPI endpoint functions in LIVE mode with sub-10ms inference time.
