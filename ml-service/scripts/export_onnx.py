"""
ONNX Model Export, INT8 Quantization, Parity Verification & Latency Measuring.
Precision AgriTech Platform - Phase 1 (TODO-103).

Provides:
- export_to_onnx: Converts PyTorch MobileNetV3 to ONNX with dynamic batch axes.
- quantize_onnx_model: Dynamic INT8 post-training quantization via onnxruntime.quantization.
- verify_onnx_graph: Validates graph sanity via onnx.checker.
- verify_probability_parity: Computes max absolute Softmax difference against PyTorch (Delta < 1e-3).
- measure_inference_latency: Measures CPU runtime statistics across sequential inferences.
"""

import os
import sys
import time
import argparse
from pathlib import Path
from typing import Tuple, Dict, Any, Optional

import numpy as np
import torch
import torch.nn as nn
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

try:
    from scripts.train import build_mobilenet_v3_small
except ModuleNotFoundError:
    from train import build_mobilenet_v3_small


def export_to_onnx(
    model: nn.Module,
    output_path: str,
    input_size: int = 224,
    opset_version: int = 17,
) -> str:
    """
    Exports a PyTorch model to ONNX format with dynamic batch dimension.
    Uses robust TorchScript-based export (dynamo=False) to ensure complete
    shape inference compatibility with onnxruntime.quantization.
    """
    model.eval()
    dummy_input = torch.randn(1, 3, input_size, input_size, requires_grad=False)

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        str(out_file),
        dynamo=False,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
    )

    return str(out_file)


def quantize_onnx_model(
    model_input_path: str,
    model_output_path: str,
    weight_type: QuantType = QuantType.QInt8,
) -> str:
    """
    Applies post-training dynamic INT8 quantization to an ONNX model.
    """
    in_file = Path(model_input_path)
    out_file = Path(model_output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    quantize_dynamic(
        model_input=str(in_file),
        model_output=str(out_file),
        weight_type=weight_type,
    )

    return str(out_file)


def verify_onnx_graph(onnx_path: str) -> Tuple[bool, str]:
    """
    Validates structural and semantic validity of an ONNX file.
    """
    try:
        model = onnx.load(onnx_path)
        onnx.checker.check_model(model)
        return True, "VALID"
    except Exception as e:
        return False, str(e)


def verify_probability_parity(
    pytorch_model: nn.Module,
    onnx_model_path: str,
    input_data: Optional[np.ndarray] = None,
    threshold: float = 1e-3,
) -> Tuple[float, bool]:
    """
    Checks maximum absolute difference between PyTorch Softmax probabilities
    and ONNX Softmax probabilities:
        max |P_pytorch - P_onnx| < threshold (default 1e-3)
    """
    pytorch_model.eval()

    if input_data is None:
        input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)

    # 1. PyTorch inference
    torch_tensor = torch.from_numpy(input_data)
    with torch.no_grad():
        torch_logits = pytorch_model(torch_tensor)
        torch_probs = torch.softmax(torch_logits, dim=-1).cpu().numpy().flatten()

    # 2. ONNX inference
    session = ort.InferenceSession(onnx_model_path, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    onnx_logits = session.run([output_name], {input_name: input_data})[0].flatten()

    # Apply softmax to ONNX logits
    exp_logits = np.exp(onnx_logits - np.max(onnx_logits))
    onnx_probs = exp_logits / np.sum(exp_logits)

    max_delta = float(np.max(np.abs(torch_probs - onnx_probs)))
    passes = max_delta < threshold

    return max_delta, passes


def measure_inference_latency(
    onnx_path: str,
    num_runs: int = 100,
    warmup_runs: int = 10,
    input_size: int = 224,
) -> Dict[str, float]:
    """
    Benchmarks CPU inference latency across sequential runs.
    """
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    dummy_input = np.random.randn(1, 3, input_size, input_size).astype(np.float32)

    # Warmup runs
    for _ in range(warmup_runs):
        session.run([output_name], {input_name: dummy_input})

    # Benchmark runs
    latencies_ms = []
    for _ in range(num_runs):
        start = time.perf_counter()
        session.run([output_name], {input_name: dummy_input})
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        latencies_ms.append(elapsed_ms)

    latencies_ms = np.array(latencies_ms)
    return {
        "num_runs": num_runs,
        "median_ms": float(np.median(latencies_ms)),
        "mean_ms": float(np.mean(latencies_ms)),
        "p95_ms": float(np.percentile(latencies_ms, 95)),
        "p99_ms": float(np.percentile(latencies_ms, 99)),
        "min_ms": float(np.min(latencies_ms)),
        "max_ms": float(np.max(latencies_ms)),
    }


def run_export_pipeline(
    checkpoint_path: str = "models/best_model.pth",
    output_onnx_path: str = "models/agritech_classifier.onnx",
    output_quant_path: str = "models/agritech_classifier_quantized.onnx",
    num_classes: int = 12,
    input_size: int = 224,
) -> Dict[str, Any]:
    """
    Executes full production export pipeline:
    1. Loads PyTorch checkpoint
    2. Exports to FP32 ONNX graph
    3. Runs onnx.checker validation
    4. Performs dynamic INT8 quantization
    5. Measures artifact file sizes
    6. Verifies probability parity against PyTorch baseline
    """
    chk = Path(checkpoint_path)
    if not chk.exists():
        raise FileNotFoundError(f"Checkpoint not found at: {checkpoint_path}")

    print("=" * 60)
    print("AgriTech ONNX Export & INT8 Quantization Pipeline")
    print("=" * 60)
    print(f"[*] Loading PyTorch checkpoint: {chk}")
    model = build_mobilenet_v3_small(num_classes=num_classes, pretrained=False)
    state_dict = torch.load(str(chk), map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    # Step 1: Export FP32 ONNX
    print(f"[*] Exporting FP32 ONNX model to: {output_onnx_path}")
    export_to_onnx(model, output_onnx_path, input_size=input_size)
    is_valid, msg = verify_onnx_graph(output_onnx_path)
    if not is_valid:
        raise RuntimeError(f"ONNX graph validation failed: {msg}")
    print("    [+] ONNX graph check: PASS")

    fp32_size_mb = Path(output_onnx_path).stat().st_size / (1024 * 1024)
    print(f"    [+] FP32 Model Size: {fp32_size_mb:.2f} MB (Limit: <= 25 MB)")

    # Step 2: INT8 Quantization
    print(f"[*] Quantizing model (INT8 Dynamic) to: {output_quant_path}")
    quantize_onnx_model(output_onnx_path, output_quant_path)
    is_quant_valid, quant_msg = verify_onnx_graph(output_quant_path)
    if not is_quant_valid:
        raise RuntimeError(f"Quantized ONNX validation failed: {quant_msg}")
    print("    [+] Quantized graph check: PASS")

    int8_size_mb = Path(output_quant_path).stat().st_size / (1024 * 1024)
    compression_ratio = (1.0 - (int8_size_mb / fp32_size_mb)) * 100.0
    print(f"    [+] INT8 Model Size: {int8_size_mb:.2f} MB (Compression: -{compression_ratio:.1f}%)")

    # Step 3: Probability Parity Verification
    print("[*] Verifying output probability parity against native PyTorch...")
    max_delta, parity_passes = verify_probability_parity(
        pytorch_model=model,
        onnx_model_path=output_onnx_path,
        threshold=1e-3,
    )
    print(f"    [+] Max Probability Delta: {max_delta:.6f} (Threshold: < 0.001)")
    print(f"    [+] Parity Status: {'PASS' if parity_passes else 'FAIL'}")

    return {
        "fp32_onnx_path": output_onnx_path,
        "fp32_size_mb": fp32_size_mb,
        "int8_onnx_path": output_quant_path,
        "int8_size_mb": int8_size_mb,
        "compression_pct": compression_ratio,
        "max_probability_delta": max_delta,
        "parity_passes": parity_passes,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech ONNX Model Export CLI")
    parser.add_argument("--checkpoint", type=str, default="models/best_model.pth", help="Path to best_model.pth")
    parser.add_argument("--output-onnx", type=str, default="models/agritech_classifier.onnx", help="FP32 ONNX path")
    parser.add_argument("--output-quant", type=str, default="models/agritech_classifier_quantized.onnx", help="INT8 ONNX path")
    parser.add_argument("--num-classes", type=int, default=12, help="Number of classes")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_export_pipeline(
        checkpoint_path=args.checkpoint,
        output_onnx_path=args.output_onnx,
        output_quant_path=args.output_quant,
        num_classes=args.num_classes,
    )

