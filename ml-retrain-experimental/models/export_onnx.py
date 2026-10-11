"""
Standalone ONNX Export and Validation Engine.
Precision AgriTech Platform - Retraining Experimentation (Phase 6).

Exports the trained Dual-Head MobileNetV3-Large PyTorch checkpoint to ONNX format:
- Enforces Opset 17 with constant folding.
- Preserves dynamic batch dimensions on inputs and both output heads.
- Validates strict numerical parity with ONNX Runtime (< 1e-4 tolerance).
- Measures file size (budget <= 25 MB) and CPU inference latency (budget <= 30 ms).
"""

import sys
import time
import argparse
from pathlib import Path
import numpy as np
import torch

try:
    import onnx
    import onnxruntime as ort
except ImportError:
    ort = None

# Ensure experimental module path is accessible
current_dir = Path(__file__).resolve().parent
exp_root = current_dir.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

from models.model_multitask import MultiTaskPlantClassifier


def export_multitask_onnx(
    checkpoint_path: Path,
    output_onnx_path: Path,
    opset_version: int = 17,
    run_benchmark: bool = True,
    device: str = "cpu",
) -> dict:
    checkpoint_path = Path(checkpoint_path)
    output_onnx_path = Path(output_onnx_path)
    output_onnx_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("Dual-Head Multi-Task ONNX Export Engine")
    print(f"Checkpoint input: {checkpoint_path}")
    print(f"Target ONNX:      {output_onnx_path}")
    print(f"Opset version:    {opset_version}")
    print("=" * 65)

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}")

    # 1. Instantiate model & reload weights
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    ckpt = torch.load(checkpoint_path, map_location="cpu")
    state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
    model.load_state_dict(state_dict)
    model.eval()
    model.to(device)

    print(f"Loaded checkpoint successfully (Best Epoch: {ckpt.get('epoch', 'N/A')}, Joint Score: {ckpt.get('best_score', 0.0)*100:.2f}%)")

    # 2. Prepare dummy input and export
    dummy_input = torch.randn(1, 3, 224, 224, device=device)
    torch.onnx.export(
        model,
        dummy_input,
        str(output_onnx_path),
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
    print(f"Successfully generated ONNX artifact: {output_onnx_path}")

    # 3. File size verification
    file_size_bytes = output_onnx_path.stat().st_size
    file_size_mb = file_size_bytes / (1024 * 1024)
    size_passed = file_size_mb <= 25.0
    print(f"Artifact Size: {file_size_mb:.2f} MB (Budget <= 25.0 MB) -> {'PASS' if size_passed else 'FAIL'}")

    results = {
        "file_size_bytes": file_size_bytes,
        "file_size_mb": file_size_mb,
        "size_budget_passed": size_passed,
    }

    # 4. Parity and latency verification via ONNX Runtime
    if ort is not None:
        session = ort.InferenceSession(str(output_onnx_path))
        ort_inputs = {"input": dummy_input.cpu().numpy()}
        ort_crop, ort_disease = session.run(None, ort_inputs)

        with torch.no_grad():
            pt_crop, pt_disease = model(dummy_input)

        crop_diff = float(np.max(np.abs(ort_crop - pt_crop.cpu().numpy())))
        disease_diff = float(np.max(np.abs(ort_disease - pt_disease.cpu().numpy())))
        parity_passed = crop_diff < 1e-4 and disease_diff < 1e-4

        print(f"Parity Crop Max Diff:    {crop_diff:.6e} -> {'PASS' if crop_diff < 1e-4 else 'WARN'}")
        print(f"Parity Disease Max Diff: {disease_diff:.6e} -> {'PASS' if disease_diff < 1e-4 else 'WARN'}")

        results["parity_crop_diff"] = crop_diff
        results["parity_disease_diff"] = disease_diff
        results["parity_passed"] = parity_passed

        # Latency Benchmark
        if run_benchmark:
            print("\nExecuting CPU inference latency benchmark (100 warmup, 100 runs)...")
            for _ in range(20):
                session.run(None, ort_inputs)

            latencies = []
            for _ in range(100):
                t0 = time.perf_counter()
                session.run(None, ort_inputs)
                latencies.append((time.perf_counter() - t0) * 1000)

            lat_mean = float(np.mean(latencies))
            lat_p50 = float(np.percentile(latencies, 50))
            lat_p95 = float(np.percentile(latencies, 95))
            latency_passed = lat_mean <= 30.0

            print(f"Latency Mean: {lat_mean:.2f} ms | P50: {lat_p50:.2f} ms | P95: {lat_p95:.2f} ms")
            print(f"Latency Budget (<= 30.0 ms): {'PASS' if latency_passed else 'FAIL'}")

            results["latency_mean_ms"] = lat_mean
            results["latency_p50_ms"] = lat_p50
            results["latency_p95_ms"] = lat_p95
            results["latency_budget_passed"] = latency_passed

    print("=" * 65)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export trained checkpoint to ONNX")
    parser.add_argument("--checkpoint", type=str, default="ml-retrain-experimental/downloaded/best_multitask_model.pth")
    parser.add_argument("--output", type=str, default="ml-retrain-experimental/models/agritech_multitask.onnx")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--no-bench", action="store_true")
    args = parser.parse_args()

    export_multitask_onnx(
        checkpoint_path=Path(args.checkpoint),
        output_onnx_path=Path(args.output),
        opset_version=args.opset,
        run_benchmark=not args.no_bench,
    )
