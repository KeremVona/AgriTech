# TODO-103: ONNX Model Export, Quantization & Benchmarking (Task List)

## Current Status: COMPLETED (READY FOR PR / MERGE)
**Branch:** `feat/ml-todo103-onnx-export`  
**Target:** Phase 1 — Machine Learning Core (TODO-103)  
**Input Checkpoint:** `ml-service/models/best_model.pth` (TODO-102 output)

---

- [x] **Task 1: Git Branch & Environment Setup**
  - Create and switch to `feat/ml-todo103-onnx-export`.
  - Install `onnx` in `ml-service/venv`.
  - Verify `onnxruntime` and `onnx` are ready.

- [x] **Task 2: TDD Test Suite (`ml-service/tests/test_onnx_export.py`)**
  - Test ONNX model export function outputs valid graph.
  - Test dynamic batching works across shapes `[1, 3, 224, 224]`, `[2, 3, 224, 224]`, `[4, 3, 224, 224]`.
  - Test parity check logic verifies $\Delta < 10^{-3}$ against PyTorch model.
  - Test latency benchmark helper accurately computes statistics (median, mean, p95).

- [x] **Task 3: ONNX Export & INT8 Quantization Script (`ml-service/scripts/export_onnx.py`)**
  - Implement `export_to_onnx()` from `best_model.pth` with dynamic axes.
  - Implement `quantize_onnx_model()` using `onnxruntime.quantization.quantize_dynamic`.
  - Validate models with `onnx.checker.check_model()`.

- [x] **Task 4: Standalone Benchmarking & Parity Harness (`ml-service/scripts/benchmark_onnx.py`)**
  - Implement 100 sequential CPU runs latency measuring harness.
  - Verify acceptance criterion: Median CPU latency $\le 85\text{ ms}$.
  - Verify acceptance criterion: Maximum probability difference $\Delta < 10^{-3}$.
  - Save `models/benchmark_report.json`.

- [x] **Task 5: FastAPI Service Integration & Regression Suite**
  - Validate that `inference.py` loads the exported ONNX model (`settings.onnx_model_path`).
  - Run full pytest test suite across `ml-service` to ensure zero regressions.

- [x] **Task 6: Completion Report & Git Commit**
  - Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-103-onnx-export.md`.
  - Commit all changes following Conventional Commits format (`feat(ml): ...`).
