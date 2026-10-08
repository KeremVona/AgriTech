"""
Precision AgriTech - Dual-Head Multi-Task ONNX Export & Benchmarking Pipeline.
Exports MobileNetV3-Large MultiTask model to ONNX with dynamic batch axes,
applies dynamic INT8 quantization, and benchmarks CPU latency.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, Tuple

import numpy as np
import torch
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

# Ensure ml-service root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scripts.model_multitask import MultiTaskPlantClassifier


def export_multitask_to_onnx(
    model: torch.nn.Module,
    output_path: str = "models/agritech_multitask.onnx",
    opset_version: int = 17,
    input_size: int = 224,
) -> Path:
    """Exports PyTorch MultiTask model to ONNX computational graph with dual output heads."""
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    model.eval()
    model.cpu()

    dummy_input = torch.randn(1, 3, input_size, input_size, dtype=torch.float32)

    torch.onnx.export(
        model,
        dummy_input,
        str(out_file),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["crop_logits", "disease_logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "crop_logits": {0: "batch_size"},
            "disease_logits": {0: "batch_size"},
        },
        dynamo=False,
    )

    onnx_model = onnx.load(str(out_file))
    onnx.checker.check_model(onnx_model)
    return out_file


def quantize_multitask_onnx(
    input_path: str = "models/agritech_multitask.onnx",
    output_path: str = "models/agritech_multitask_quantized.onnx",
) -> Path:
    """Applies dynamic INT8 quantization to dual-head ONNX model."""
    in_file = Path(input_path)
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    quantize_dynamic(
        model_input=str(in_file),
        model_output=str(out_file),
        weight_type=QuantType.QInt8,
        op_types_to_quantize=["MatMul", "Gemm"],
    )

    onnx_model = onnx.load(str(out_file))
    onnx.checker.check_model(onnx_model)
    return out_file


def verify_multitask_parity(
    pytorch_model: torch.nn.Module,
    onnx_path: str,
    threshold: float = 1e-3,
    num_samples: int = 10,
) -> Dict[str, Any]:
    """Verifies probability parity between PyTorch model and ONNX Runtime for both heads."""
    pytorch_model.eval()
    pytorch_model.cpu()

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    max_delta_crop = 0.0
    max_delta_disease = 0.0

    for i in range(num_samples):
        dummy = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            pt_crop_logits, pt_disease_logits = pytorch_model(dummy)
            pt_crop_probs = torch.softmax(pt_crop_logits, dim=-1).numpy()[0]
            pt_disease_probs = torch.softmax(pt_disease_logits, dim=-1).numpy()[0]

        ort_out = session.run(None, {input_name: dummy.numpy()})
        ort_crop_logits = ort_out[0][0]
        ort_disease_logits = ort_out[1][0]

        # Softmax
        ort_crop_probs = np.exp(ort_crop_logits - np.max(ort_crop_logits))
        ort_crop_probs /= ort_crop_probs.sum()

        ort_disease_probs = np.exp(ort_disease_logits - np.max(ort_disease_logits))
        ort_disease_probs /= ort_disease_probs.sum()

        delta_crop = float(np.max(np.abs(pt_crop_probs - ort_crop_probs)))
        delta_disease = float(np.max(np.abs(pt_disease_probs - ort_disease_probs)))

        max_delta_crop = max(max_delta_crop, delta_crop)
        max_delta_disease = max(max_delta_disease, delta_disease)

    passed = (max_delta_crop < threshold) and (max_delta_disease < threshold)
    return {
        "max_delta_crop": max_delta_crop,
        "max_delta_disease": max_delta_disease,
        "threshold": threshold,
        "passed": passed,
    }


def benchmark_multitask_cpu_latency(
    onnx_path: str,
    num_runs: int = 100,
    warmup_runs: int = 10,
) -> Dict[str, float]:
    """Measures single-thread sequential CPU inference latency for dual-head ONNX graph."""
    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 1
    opts.intra_op_num_threads = 1
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    session = ort.InferenceSession(onnx_path, sess_options=opts, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    dummy = np.random.randn(1, 3, 224, 224).astype(np.float32)

    # Warmup
    for _ in range(warmup_runs):
        _ = session.run(None, {input_name: dummy})

    latencies = []
    for _ in range(num_runs):
        t0 = time.perf_counter()
        _ = session.run(None, {input_name: dummy})
        latencies.append((time.perf_counter() - t0) * 1000.0)

    latencies.sort()
    return {
        "num_runs": num_runs,
        "min_ms": round(latencies[0], 2),
        "median_ms": round(latencies[num_runs // 2], 2),
        "mean_ms": round(float(np.mean(latencies)), 2),
        "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        "p99_ms": round(float(np.percentile(latencies, 99)), 2),
        "max_ms": round(latencies[-1], 2),
    }


def run_multitask_export_pipeline(
    checkpoint_path: Optional[str] = None,
    output_fp32: str = "models/agritech_multitask.onnx",
    output_int8: str = "models/agritech_multitask_quantized.onnx",
    report_path: str = "models/benchmark_multitask_report.json",
) -> Dict[str, Any]:
    """Executes end-to-end export, quantization, parity and benchmarking harness."""
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    if checkpoint_path and Path(checkpoint_path).exists():
        model.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))

    fp32_p = export_multitask_to_onnx(model, output_fp32)
    int8_p = quantize_multitask_onnx(output_fp32, output_int8)

    fp32_size_mb = fp32_p.stat().st_size / (1024 * 1024)
    int8_size_mb = int8_p.stat().st_size / (1024 * 1024)

    parity = verify_multitask_parity(model, str(fp32_p))
    lat_fp32 = benchmark_multitask_cpu_latency(str(fp32_p))
    lat_int8 = benchmark_multitask_cpu_latency(str(int8_p))

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "criteria": {
            "artifact_size_under_25mb": fp32_size_mb <= 25.0 and int8_size_mb <= 25.0,
            "median_latency_under_85ms": lat_fp32["median_ms"] <= 85.0,
            "parity_met": parity["passed"],
        },
        "artifacts": {
            "fp32_size_mb": round(fp32_size_mb, 2),
            "int8_size_mb": round(int8_size_mb, 2),
        },
        "parity": parity,
        "latency_fp32": lat_fp32,
        "latency_int8": lat_int8,
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


if __name__ == "__main__":
    run_multitask_export_pipeline()
