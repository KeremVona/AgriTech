# Implementation Plan: Fix ML Class Labels Ordering & Index Permutation

> **Assignee:** Backend / ML Engineer  
> **Target Branch:** `fix/ml-class-labels-ordering`  
> **Phase:** Phase 1 — Machine Learning Core & Serving API  
> **Issue:** Ground-truth index permutation mismatch between PyTorch `ImageFolder` alphabetical training ordering and hardcoded `CLASS_LABELS` in `ml-service/inference.py`.

---

## 1. Overview

Empirical evaluation on 36 clinical leaf specimens across 12 pathologies revealed that the trained ONNX neural network model operates with 100.0% classification accuracy, but the API returned incorrect disease names (16.7% API accuracy) due to an index mismatch. During PyTorch training (`scripts/train.py`), `torchvision.datasets.ImageFolder` sorted the 12 class directories alphabetically (0: `Apple___Cedar_apple_rust` to 11: `Tomato___healthy`, logged in `models/hyperparameters.json`). However, `ml-service/inference.py` hardcoded `CLASS_LABELS` starting with Tomato instead of Apple. 

This implementation plan corrects the class label mapping, makes the inference engine resilient to future retraining shifts, updates deterministic stub probabilities, executes regression tests, and verifies 100% end-to-end classification accuracy across real leaf specimens.

---

## 2. Architecture Decisions

1. **Synchronize `CLASS_LABELS` with Training Ground Truth:**
   Align `ml-service/inference.py::CLASS_LABELS` with the alphabetical ordering recorded in `ml-service/models/hyperparameters.json`.
   
   ```python
   CLASS_LABELS: list[str] = [
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

2. **Resilient Dynamic Loader with Static Fallback:**
   Enhance `ml-service/inference.py` to attempt loading the class list dynamically from `hyperparameters.json` on initialization, falling back to the hardcoded alphabetical list if the JSON file is absent. This guarantees zero future label drift.

3. **Dynamic Stub Probabilities:**
   Refactor `_stub_probabilities()` in `ml-service/inference.py` to dynamically reference `CLASS_LABELS.index("Tomato___Late_blight")` rather than hardcoding numeric indices (`probs[2]`), ensuring existing test assertions for stub mode continue to pass cleanly.

4. **Add Cross-Validation Parity Test:**
   Add a unit test in `ml-service/tests/test_inference_engine.py` asserting that `CLASS_LABELS` strictly equals `hyperparameters.json["classes"]` when the artifact is present, acting as an automated CI regression guardrail.

---

## 3. Vertical Slice Task Breakdown

### Task 1: Git Branch Creation
- Branch `fix/ml-class-labels-ordering` from `main`.
- Verify clean working tree.

### Task 2: Core Mapping Fix (`ml-service/inference.py`)
- Update `CLASS_LABELS` to the exact 12-class alphabetical order.
- Add dynamic sync check against `models/hyperparameters.json`.
- Update `_stub_probabilities()` to use label index lookups for `Tomato___Late_blight` (~89%) and `Tomato___Early_blight` (~6%).

### Task 3: Test Suite Updates & CI Guardrails
- Install testing utilities (`pytest`, `httpx`, `pytest-asyncio`) into `ml-service/venv`.
- Add `test_class_labels_matches_hyperparameters()` in `ml-service/tests/test_inference_engine.py`.
- Run pytest across all test files in `ml-service/tests/` to assert zero regressions.

### Task 4: Empirical Sample Validation (36 PlantVillage Images)
- Execute the 36-image diagnostic test harness across all 12 target classes.
- Verify 36/36 (100.0%) API classification accuracy.

### Task 5: Live API Verification & Documentation
- Launch `uvicorn main:app --port 8000`.
- Verify `GET /health/ready` and test a multipart upload to `POST /api/v1/classify-leaf`.
- Generate completion report `PROJECT_DETAILS/Reports/Phase 1/FIX-class-labels-ordering.md`.

---

## 4. Verification Checkpoints

- [ ] **Checkpoint 1:** `inference.py` updated and imports cleanly without errors.
- [ ] **Checkpoint 2:** Full test suite passes (`pytest ml-service/tests`).
- [ ] **Checkpoint 3:** 36 sample images across 12 classes achieve 100.0% accuracy on real ONNX inference.
- [ ] **Checkpoint 4:** Ready for PR review following `GIT_CHANGES.md`.

---

## 5. Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :---: | :--- |
| Stub mode tests break due to altered index | Medium | Use `CLASS_LABELS.index(...)` in `_stub_probabilities()` so `Tomato___Late_blight` remains the top stub class. |
| Future model training reorders classes | High | Add automated parity assertion in `test_inference_engine.py` checking `hyperparameters.json["classes"] == CLASS_LABELS`. |
| Modifying files directly on `main` | High | Strict git check: switch to `fix/ml-class-labels-ordering` before editing any code. |
