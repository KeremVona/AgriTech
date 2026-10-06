# TODO-103 Completion Report

**Status:** DONE

---

## Summary

Successfully exported the fine-tuned `MobileNetV3-Small` model (`models/best_model.pth`) to standard Open Neural Network Exchange (**ONNX**) format with dynamic batching, applied post-training dynamic **INT8 quantization**, built a standalone latency and probability parity benchmarking test harness, and integrated the exported model into the FastAPI inference microservice. All three acceptance criteria specified in `PROJECT_DETAILS/Phase Plans/Phase 1.md` were met and validated with substantial safety margins: artifact sizes are well under 25 MB (FP32: 5.85 MB, INT8: 1.62 MB), single-thread CPU median latency is sub-85 ms (FP32: 4.55 ms, INT8: 68.17 ms), and probability parity against the native PyTorch baseline is $\Delta \approx 5.96 \times 10^{-7}$ (well within $\Delta < 10^{-3}$).

---

## Changes Made

### Made
- `ml-service/scripts/export_onnx.py` — Standalone export pipeline converting PyTorch checkpoints to ONNX graph format with dynamic batch axes (`batch_size`), graph verification (`onnx.checker.check_model`), dynamic INT8 quantization via `onnxruntime.quantization.quantize_dynamic`, parity assertion, and latency checks.
- `ml-service/scripts/benchmark_onnx.py` — Standalone benchmarking harness executing 100 sequential CPU inferences (with 10 warmup runs), multi-sample probability parity verification across 20 synthetic inputs, and automated JSON report serialization.
- `ml-service/tests/test_onnx_export.py` — Comprehensive TDD test suite (5 tests) verifying ONNX graph validity, dynamic batch size handling (`[1, 3, 224, 224]`, `[2, 3, 224, 224]`, `[4, 3, 224, 224]`), probability parity threshold enforcement, INT8 quantization size reduction, and latency calculation metrics.
- `ml-service/models/benchmark_report.json` — Machine-readable evaluation report recording model sizes, parity deltas, and statistical latency distributions (min, median, mean, p95, p99, max, std).
- `ml-service/models/agritech_classifier.onnx` — Exported FP32 ONNX model artifact (5.85 MB, gitignored).
- `ml-service/models/agritech_classifier_quantized.onnx` — Exported INT8 quantized ONNX model artifact (1.62 MB, gitignored).
- `PROJECT_DETAILS/Reports/Phase 1/TODO-103-onnx-export.md` — Formal completion report for TODO-103.

### Modified
- `ml-service/requirements.txt` — Added `onnx>=1.15.0` and `onnxscript>=0.1.0`.
- `ml-service/pyproject.toml` — Added ONNX export tooling dependencies.
- `ml-service/tests/test_inference_engine.py` — Added live ONNX model loading, prediction, and INT8 loading test cases.
- `ml-service/tests/test_classify_leaf.py` — Added live ONNX model integration test against `/health/ready` and `/api/v1/classify-leaf`.
- `tasks/plan.md` & `tasks/todo.md` — Updated task list and phase tracking.

### Removed
- None.

---

## Implementation Details

- **ONNX Model Export Architecture:**
  - Base checkpoint: `ml-service/models/best_model.pth` (MobileNetV3-Small, 12 classes).
  - Exporter configuration: `torch.onnx.export(..., dynamo=False, opset_version=17)`.
  - Dynamic Axes: Specified for input `{"input": {0: "batch_size"}}` and output `{"output": {0: "batch_size"}}`, allowing batch sizes of 1, 2, 4, etc. without recompilation.
  - Graph Validation: Verified via `onnx.checker.check_model()`.
- **Dynamic INT8 Quantization:**
  - Applied using `onnxruntime.quantization.quantize_dynamic`.
  - Quantized operator types: `["MatMul", "Gemm"]` with `weight_type=QuantType.QInt8`.
  - Shape inference pre-step executed cleanly using standard initializer bindings.
  - Size reduction: From 5.85 MB down to 1.62 MB (**-72.2% compression**).
- **Latency & Single-Thread CPU Benchmarking:**
  - Configured ONNXRuntime `SessionOptions`: `inter_op_num_threads=1`, `intra_op_num_threads=1`, `execution_mode=ExecutionMode.ORT_SEQUENTIAL`, `providers=["CPUExecutionProvider"]`.
  - Harness executed 10 warmup iterations followed by 100 sequential inferences per model.
- **FastAPI Service Integration:**
  - `ml-service/config.py` configured with `onnx_model_path = "models/agritech_classifier.onnx"`.
  - At application startup, `lifespan` automatically loads the ONNX session into `InferenceEngine`, transitioning the service from `STUB` to `LIVE` mode.
  - Sub-15ms end-to-end processing time recorded within FastAPI worker threads.

---

## Testing / Validation

### Commands Executed
```powershell
# 1. TDD test suite for ONNX export & quantization
$env:PYTHONPATH="."
.\venv\Scripts\pytest -v tests/test_onnx_export.py

# 2. Standalone export script execution
.\venv\Scripts\python scripts/export_onnx.py

# 3. Standalone benchmarking harness execution
.\venv\Scripts\python scripts/benchmark_onnx.py

# 4. Targeted inference engine and API integration tests
.\venv\Scripts\pytest -v tests/test_inference_engine.py tests/test_classify_leaf.py

# 5. Full regression test suite across ml-service
.\venv\Scripts\pytest -q
```

### Test Results
| Test File / Suite | Tests | Result |
| :--- | :---: | :---: |
| `tests/test_onnx_export.py` | 5 | **5/5 PASS (100%)** |
| `tests/test_inference_engine.py` | 16 | **16/16 PASS (100%)** |
| `tests/test_classify_leaf.py` | 14 | **14/14 PASS (100%)** |
| `tests/test_train_model.py` | 6 | **6/6 PASS (100%)** |
| `tests/test_prepare_dataset.py` | 9 | **9/9 PASS (100%)** |
| `tests/test_advisory_engine.py` | 79 | **79/79 PASS (100%)** |
| `tests/test_p2p_cli.py` | 5 | **5/5 PASS (100%)** |
| **Total Full ML-Service Regression** | **134** | **134/134 PASS (100%)** |

---

## Results / Metrics

### Acceptance Criteria Verification Table
| Criterion | Project Requirement | Measured Result | Evaluation |
| :--- | :--- | :--- | :---: |
| **Model Artifact Size** | $\le 25\text{ MB}$ | **FP32:** 5.85 MB<br>**INT8:** 1.62 MB | **PASS ✅** |
| **Median CPU Latency** | $\le 85\text{ ms}$ (single-thread CPU) | **FP32:** **4.55 ms**<br>**INT8:** **68.17 ms** | **PASS ✅** |
| **Output Probability Parity** | $\Delta < 10^{-3}$ ($0.001$) vs PyTorch | $\Delta_{\max} = \mathbf{5.96 \times 10^{-7}}$ | **PASS ✅** |
| **Dynamic Batching** | Shapes $B \in \{1, 2, 4\}$ supported | Shapes $[1, 3, 224, 224]$, $[2, 3, 224, 224]$, $[4, 3, 224, 224]$ validated | **PASS ✅** |

### Benchmark Latency Distribution (100 Sequential CPU Inferences)
| Metric | FP32 (Standard) | INT8 (Quantized) | Threshold Limit |
| :--- | :---: | :---: | :---: |
| **Min** | 3.91 ms | 64.37 ms | — |
| **Median** | **4.55 ms** | **68.17 ms** | $\le 85.0\text{ ms}$ |
| **Mean** | 4.86 ms | 69.71 ms | — |
| **p95** | 7.02 ms | 80.08 ms | — |
| **p99** | 8.33 ms | 82.28 ms | — |
| **Max** | 8.40 ms | 105.94 ms | — |
| **Std Dev** | 0.94 ms | 5.38 ms | — |

---

## Acceptance Criteria
- [x] Model artifact size $\le 25\text{ MB}$ (FP32: 5.85 MB, INT8: 1.62 MB).
- [x] Median CPU inference latency $\le 85\text{ ms}$ on single-thread execution with zero external GPU dependency (FP32: 4.55 ms, INT8: 68.17 ms).
- [x] Output probability parity within $\Delta < 10^{-3}$ against native PyTorch baseline ($\Delta_{\max} = 5.96 \times 10^{-7}$).
- [x] Export script `scripts/export_onnx.py` defining dynamic batch axes.
- [x] Post-training dynamic quantization pipeline via `onnxruntime.quantization`.
- [x] Standalone test harness `scripts/benchmark_onnx.py` measuring latency across 100 sequential inferences and logging `models/benchmark_report.json`.

---

## Issues / Notes
- **PyTorch 2.14 Dynamo Compatibility:** During dynamic quantization, the default PyTorch 2.14 Dynamo exporter created initializer naming patterns that triggered dimension inference errors in `onnxruntime.quantization.quant_utils.infer_shapes_path`. This was resolved by explicitly setting `dynamo=False` and `opset_version=17` in `scripts/export_onnx.py`, producing a standard TorchScript ONNX graph that quantizes cleanly without errors.
- **Latency Observation:** The FP32 ONNX model achieved an ultra-fast median latency of **4.55 ms** on CPU, which is $\sim 18\times$ faster than the 85 ms requirement. While INT8 quantization successfully compresses the artifact by 72.2% (1.62 MB), FP32 is currently recommended for production serving due to its sub-5ms speed and negligible file size overhead.
- Model binary weights (`*.pth`, `*.onnx`) remain excluded from git tracking under `.gitignore`.
