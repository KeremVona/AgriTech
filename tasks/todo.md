# Task List: Fix ML Class Labels Ordering & Index Permutation

**Branch:** `fix/ml-class-labels-ordering`  
**Status:** READY TO START  
**Plan Document:** `tasks/plan.md`  

---

- [x] **Task 1: Git Branch Setup**
  - Create and switch to `fix/ml-class-labels-ordering` from `main`.
  - Confirm working tree is clean.

- [x] **Task 2: Update Class Labels & Resilient Loader (`ml-service/inference.py`)**
  - Reorder `CLASS_LABELS` in `ml-service/inference.py` to match `hyperparameters.json` alphabetical order.
  - Implement dynamic fallback sync reading `hyperparameters.json` if available.
  - Update `_stub_probabilities()` to use dynamic index lookup for `Tomato___Late_blight`.
  - Acceptance: `CLASS_LABELS[0] == "Apple___Cedar_apple_rust"` and `CLASS_LABELS[11] == "Tomato___healthy"`.

- [x] **Task 3: Unit Testing & CI Regression Guardrails**
  - Install `pytest`, `pytest-asyncio`, `httpx` in `ml-service/venv`.
  - Add `test_class_labels_matches_hyperparameters()` in `test_inference_engine.py`.
  - Run full test suite: `pytest ml-service/tests`.
  - Acceptance: 100% test pass rate across all test modules (136/136 passed).

- [x] **Task 4: Empirical Sample Verification (36 PlantVillage Images)**
  - Run 36-image diagnostic test script across 12 target pathologies.
  - Verify API accuracy jumps from 16.7% to 100.0% (36/36 correct).
  - Acceptance: Every class folder predicts its exact corresponding pathology (36/36, 100.0% verified).

- [x] **Task 5: Completion Report & Git Commit**
  - Generate `PROJECT_DETAILS/Reports/Phase 1/FIX-class-labels-ordering.md`.
  - Commit changes with conventional commit `fix(ml): synchronize inference class labels with training ground truth`.
  - Acceptance: Complete Definition of Done report matching `Task Completion.md`.
