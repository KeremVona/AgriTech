"""
Standalone ONNX Benchmarking & Parity Evaluation Harness.
Precision AgriTech Platform - Phase 1 (TODO-103).

Benchmarks:
1. Model Artifact Sizes: FP32 and INT8 (Acceptance: <= 25 MB).
2. CPU Latency: Runs 100 sequential inferences on CPU (single-thread runner).
   (Acceptance: Median CPU latency <= 85 ms).
3. Probability Parity: Validates max absolute Softmax difference against native PyTorch
   across 20 diverse random synthetic test inputs (Acceptance: Delta < 1e-3).
4. Outputs structured JSON report: models/benchmark_report.json.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import torch
import torch.nn as nn
import onnxruntime as ort

try:
    from scripts.train import build_mobilenet_v3_small
    from scripts.export_onnx import verify_probability_parity, measure_inference_latency
except ModuleNotFoundError:
    from train import build_mobilenet_v3_small
    from export_onnx import verify_probability_parity, measure_inference_latency


def run_comprehensive_benchmark(
    checkpoint_path: str = "models/best_model.pth",
    fp32_onnx_path: str = "models/agritech_classifier.onnx",
    int8_onnx_path: str = "models/agritech_classifier_quantized.onnx",
    output_report_path: str = "models/benchmark_report.json",
    num_runs: int = 100,
    warmup_runs: int = 10,
    num_parity_samples: int = 20,
    num_classes: int = 12,
    input_size: int = 224,
) -> Dict[str, Any]:
    """
    Executes the full benchmarking test harness against all acceptance criteria.
    """
    chk_file = Path(checkpoint_path)
    fp32_file = Path(fp32_onnx_path)
    int8_file = Path(int8_onnx_path)

    if not chk_file.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    if not fp32_file.exists():
        raise FileNotFoundError(f"FP32 ONNX model not found: {fp32_onnx_path}")
    if not int8_file.exists():
        raise FileNotFoundError(f"INT8 ONNX model not found: {int8_onnx_path}")

    print("=" * 65)
    print("AgriTech ONNX Latency & Parity Benchmarking Harness")
    print("=" * 65)

    # 1. Artifact Sizes
    fp32_size_mb = fp32_file.stat().st_size / (1024 * 1024)
    int8_size_mb = int8_file.stat().st_size / (1024 * 1024)
    size_criterion_met = fp32_size_mb <= 25.0 and int8_size_mb <= 25.0

    print(f"[*] Artifact Sizes:")
    print(f"    - FP32 ONNX: {fp32_size_mb:.2f} MB (Threshold: <= 25.0 MB)")
    print(f"    - INT8 ONNX: {int8_size_mb:.2f} MB (Threshold: <= 25.0 MB)")
    print(f"    - Size Criterion Met: {'PASS ✅' if size_criterion_met else 'FAIL ❌'}")

    # 2. Probability Parity Check
    print(f"\n[*] Evaluating Probability Parity across {num_parity_samples} diverse inputs...")
    model = build_mobilenet_v3_small(num_classes=num_classes, pretrained=False)
    state_dict = torch.load(str(chk_file), map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    max_observed_delta = 0.0
    parity_passes_all = True

    for i in range(num_parity_samples):
        # Generate random inputs with varied seeds
        np.random.seed(1000 + i)
        test_input = np.random.randn(1, 3, input_size, input_size).astype(np.float32)
        delta, passes = verify_probability_parity(
            pytorch_model=model,
            onnx_model_path=str(fp32_file),
            input_data=test_input,
            threshold=1e-3,
        )
        if delta > max_observed_delta:
            max_observed_delta = delta
        if not passes:
            parity_passes_all = False

    print(f"    - Maximum Observed Delta (FP32 vs PyTorch): {max_observed_delta:.7f}")
    print(f"    - Parity Criterion (Delta < 1e-3): {'PASS ✅' if parity_passes_all else 'FAIL ❌'}")

    # 3. CPU Latency Benchmarking (100 sequential inferences)
    print(f"\n[*] Running {num_runs} Sequential CPU Inferences (Warmup: {warmup_runs})...")
    
    # Configure single-thread CPU execution provider to simulate strict low-resource runner
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = 1
    session_options.inter_op_num_threads = 1

    fp32_session = ort.InferenceSession(str(fp32_file), sess_options=session_options, providers=["CPUExecutionProvider"])
    int8_session = ort.InferenceSession(str(int8_file), sess_options=session_options, providers=["CPUExecutionProvider"])

    dummy_input = np.random.randn(1, 3, input_size, input_size).astype(np.float32)
    input_name = fp32_session.get_inputs()[0].name
    output_name = fp32_session.get_outputs()[0].name

    def benchmark_session(session: ort.InferenceSession, label: str) -> Dict[str, float]:
        # Warmup
        for _ in range(warmup_runs):
            session.run([output_name], {input_name: dummy_input})
        latencies = []
        for _ in range(num_runs):
            t0 = time.perf_counter()
            session.run([output_name], {input_name: dummy_input})
            latencies.append((time.perf_counter() - t0) * 1000.0)
        lat = np.array(latencies)
        return {
            "model_type": label,
            "num_runs": num_runs,
            "median_ms": float(np.median(lat)),
            "mean_ms": float(np.mean(lat)),
            "p95_ms": float(np.percentile(lat, 95)),
            "p99_ms": float(np.percentile(lat, 99)),
            "min_ms": float(np.min(lat)),
            "max_ms": float(np.max(lat)),
            "std_ms": float(np.std(lat)),
        }

    fp32_bench = benchmark_session(fp32_session, "FP32 (Standard)")
    int8_bench = benchmark_session(int8_session, "INT8 (Quantized)")

    print(f"    - FP32 Median CPU Latency: {fp32_bench['median_ms']:.2f} ms (p95: {fp32_bench['p95_ms']:.2f} ms)")
    print(f"    - INT8 Median CPU Latency: {int8_bench['median_ms']:.2f} ms (p95: {int8_bench['p95_ms']:.2f} ms)")

    latency_criterion_met = fp32_bench["median_ms"] <= 85.0 or int8_bench["median_ms"] <= 85.0
    print(f"    - Latency Criterion (Median <= 85 ms): {'PASS ✅' if latency_criterion_met else 'FAIL ❌'}")

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "criteria": {
            "artifact_size_under_25mb": size_criterion_met,
            "median_latency_under_85ms": latency_criterion_met,
            "probability_parity_under_1e_minus_3": parity_passes_all,
            "all_criteria_met": size_criterion_met and latency_criterion_met and parity_passes_all,
        },
        "artifacts": {
            "fp32_path": str(fp32_file),
            "fp32_size_mb": fp32_size_mb,
            "int8_path": str(int8_file),
            "int8_size_mb": int8_size_mb,
        },
        "parity": {
            "test_samples_evaluated": num_parity_samples,
            "max_probability_delta": max_observed_delta,
            "threshold": 1e-3,
            "passed": parity_passes_all,
        },
        "benchmarks": {
            "fp32": fp32_bench,
            "int8": int8_bench,
        },
    }

    out_json = Path(output_report_path)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n[+] Full benchmark report saved to: {out_json}")
    print("=" * 65 + "\n")
    return report


def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech ONNX Benchmark & Parity Evaluation Harness")
    parser.add_argument("--checkpoint", type=str, default="models/best_model.pth", help="Path to best_model.pth")
    parser.add_argument("--fp32", type=str, default="models/agritech_classifier.onnx", help="Path to FP32 ONNX model")
    parser.add_argument("--int8", type=str, default="models/agritech_classifier_quantized.onnx", help="Path to INT8 ONNX model")
    parser.add_argument("--report", type=str, default="models/benchmark_report.json", help="Path for JSON benchmark report")
    parser.add_argument("--runs", type=int, default=100, help="Number of sequential inference runs")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_comprehensive_benchmark(
        checkpoint_path=args.checkpoint,
        fp32_onnx_path=args.fp32,
        int8_onnx_path=args.int8,
        output_report_path=args.report,
        num_runs=args.runs,
    )
