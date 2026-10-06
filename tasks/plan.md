# Implementation Plan: TODO-103 (ONNX Model Export, Quantization & Benchmarking)

> **Assignee:** ML Engineer  
> **Phase:** Phase 1 — Machine Learning Core & Disease Progression Slider Engine  
> **Target Branch:** `feat/ml-todo103-onnx-export`  
> **Input Artifact:** `ml-service/models/best_model.pth` (MobileNetV3-Small PyTorch checkpoint from TODO-102)  
> **Output Artifacts:** `models/agritech_classifier.onnx`, `models/agritech_classifier_quantized.onnx`, `models/benchmark_report.json`

---

## 1. Executive Summary & Objectives

`TODO-103` bridges the trained PyTorch model (`best_model.pth`, Top-1 Accuracy: 99.95%, Macro F1: 0.9996) with the low-latency production serving infrastructure:
1. Export the PyTorch state dictionary into an optimized **ONNX (Open Neural Network Exchange)** computational graph with dynamic batch axes (`input: [batch_size, 3, 224, 224]`, `output: [batch_size, 12]`).
2. Implement **INT8 Post-Training Quantization** via `onnxruntime.quantization` (`quantize_dynamic`) to optimize CPU cache locality, footprint, and execution speed.
3. Build a standalone **benchmarking test harness** executing 100 sequential inferences on CPU (single-thread runner simulation) to measure p50/median latency.
4. Validate strict parity between the native PyTorch FP32 model and the ONNX model, enforcing maximum probability delta $\Delta < 10^{-3}$ ($0.001$).
5. Connect the exported ONNX model directly to the FastAPI service (`settings.onnx_model_path = "models/agritech_classifier.onnx"`).

---

## 2. Architecture & Export Pipeline

```
  ┌────────────────────────────────────────────────────────┐
  │ PyTorch Baseline Checkpoint                            │
  │ (models/best_model.pth, 6.25 MB FP32)                  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ ONNX Graph Exporter (scripts/export_onnx.py)           │
  │ - torch.onnx.export (opset=17)                         │
  │ - Dynamic batch axes: {0: 'batch_size'}                │
  │ -> models/agritech_classifier.onnx (FP32, ~6 MB)      │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ INT8 Dynamic Quantization                              │
  │ - onnxruntime.quantization.quantize_dynamic            │
  │ - Weight type: QInt8                                   │
  │ -> models/agritech_classifier_quantized.onnx (~2-3 MB) │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ Verification & Benchmarking Suite                      │
  │ 1. Parity Check: max(|P_pytorch - P_onnx|) < 1e-3      │
  │ 2. Latency Benchmark: 100 sequential CPU runs          │
  │    (Acceptance: Median latency <= 85 ms)               │
  │ 3. Artifact Size: <= 25 MB (Pass: ~2-6 MB)             │
  │ 4. FastAPI ONNX Inference Integration Check            │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Vertical Slice Task Breakdown

### Task 1: Git Branch & Environment Setup
- Create and switch to `feat/ml-todo103-onnx-export` branch.
- Verify `onnx` and `onnxruntime` installations in `ml-service/venv`.

### Task 2: TDD Test Suite (`ml-service/tests/test_onnx_export.py`)
- Test ONNX model loading and I/O shapes (`input: (batch, 3, 224, 224)` -> `output: (batch, 12)`).
- Test dynamic batching (batch sizes 1, 2, 4).
- Test probability parity test harness (assert $\Delta < 10^{-3}$).
- Test latency benchmark calculation (median, p95, min, max).

### Task 3: ONNX Export & INT8 Quantization Script (`ml-service/scripts/export_onnx.py`)
- Implement `export_to_onnx()` converting `best_model.pth` to ONNX with opset 17.
- Implement `quantize_onnx_model()` producing INT8 quantized artifact.
- Implement validation passes checking node count and graph sanity via `onnx.checker`.

### Task 4: Standalone Benchmarking & Parity Harness (`ml-service/scripts/benchmark_onnx.py`)
- Measure median, mean, p95, and p99 inference latency over 100 warm sequential runs on CPU.
- Verify probability delta against PyTorch baseline: $\max_i |P_{\text{PyTorch}}(c_i) - P_{\text{ONNX}}(c_i)| < 10^{-3}$.
- Save structured JSON benchmark results to `models/benchmark_report.json`.

### Task 5: Microservice Integration & Regression Test
- Connect `models/agritech_classifier.onnx` to `ml-service/inference.py`.
- Run full test suite (`pytest`) ensuring `/api/v1/classify-leaf` switches from stub mode to real ONNX inference seamlessly.

### Task 6: Completion Report & Git Commit
- Verify all 3 Acceptance Criteria:
  - Model artifact size $\le 25\text{ MB}$.
  - Median CPU inference latency $\le 85\text{ ms}$.
  - Output probability parity within $\Delta < 10^{-3}$.
- Generate `PROJECT_DETAILS/Reports/Phase 1/TODO-103-onnx-export.md`.
- Commit changes to `feat/ml-todo103-onnx-export`.

---

## 4. Acceptance Criteria Verification Checklist

- [x] Model artifact size $\le 25\text{ MB}$ (FP32: 5.85 MB, INT8: 1.62 MB).
- [x] Median CPU inference latency $\le 85\text{ ms}$ on single-thread execution with zero external GPU dependency (FP32: 4.55 ms, INT8: 68.17 ms).
- [x] Output probability parity within $\Delta < 10^{-3}$ against the native PyTorch baseline (Max delta: $5.96 \times 10^{-7}$).
- [x] Dynamic batching supported for arbitrary batch dimensions (Validated across shapes $B \in \{1, 2, 4\}$).
- [x] Full regression test suite passing across `ml-service` (134/134 tests passed).
