"""
Unit tests for Dual-Head Multi-Task ONNX export, dynamic batching, and parity.
"""

import tempfile
from pathlib import Path
import pytest
import torch
import onnxruntime as ort

from scripts.model_multitask import MultiTaskPlantClassifier
from scripts.export_multitask_onnx import (
    export_multitask_to_onnx,
    quantize_multitask_onnx,
    verify_multitask_parity,
    benchmark_multitask_cpu_latency,
)


@pytest.fixture(scope="module")
def exported_onnx_model(tmp_path_factory):
    """Module-scoped fixture exporting a lightweight model for test harness."""
    temp_dir = tmp_path_factory.mktemp("multitask_onnx")
    onnx_path = str(temp_dir / "test_multitask.onnx")

    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    export_multitask_to_onnx(model, onnx_path)
    return model, onnx_path, temp_dir


def test_export_multitask_onnx_structure(exported_onnx_model):
    """Exported ONNX graph must have 1 input and 2 output heads."""
    _, onnx_path, _ = exported_onnx_model

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    outputs = session.get_outputs()

    assert len(inputs) == 1
    assert inputs[0].name == "input"

    assert len(outputs) == 2
    out_names = {o.name for o in outputs}
    assert "crop_logits" in out_names
    assert "disease_logits" in out_names


def test_multitask_dynamic_batch_execution(exported_onnx_model):
    """Dual-head graph must dynamically execute across arbitrary batch dimensions (B=1, 2, 4)."""
    _, onnx_path, _ = exported_onnx_model
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    for b in [1, 2, 4]:
        dummy = torch.randn(b, 3, 224, 224).numpy()
        outs = session.run(None, {input_name: dummy})
        crop_out, disease_out = outs[0], outs[1]

        assert crop_out.shape == (b, 4)
        assert disease_out.shape == (b, 8)


def test_multitask_parity_within_threshold(exported_onnx_model):
    """Output probabilities between PyTorch and ONNX must differ by less than 1e-3."""
    model, onnx_path, _ = exported_onnx_model
    parity_result = verify_multitask_parity(model, onnx_path, threshold=1e-3, num_samples=5)

    assert parity_result["passed"] is True
    assert parity_result["max_delta_crop"] < 1e-3
    assert parity_result["max_delta_disease"] < 1e-3


def test_quantize_multitask_onnx_compresses(exported_onnx_model):
    """Dynamic INT8 quantization must generate valid model with smaller footprint."""
    _, onnx_path, temp_dir = exported_onnx_model
    quant_path = str(temp_dir / "test_multitask_quantized.onnx")

    quantize_multitask_onnx(onnx_path, quant_path)

    orig_size = Path(onnx_path).stat().st_size
    quant_size = Path(quant_path).stat().st_size

    assert quant_size < orig_size
    assert quant_size <= 25 * 1024 * 1024  # Well within Phase 1 threshold <= 25 MB


def test_benchmark_multitask_cpu_latency_stats(exported_onnx_model):
    """Latency benchmarking helper must return proper distribution statistics."""
    _, onnx_path, _ = exported_onnx_model
    stats = benchmark_multitask_cpu_latency(onnx_path, num_runs=5, warmup_runs=2)

    assert "median_ms" in stats
    assert "min_ms" in stats
    assert "max_ms" in stats
    assert stats["median_ms"] > 0
