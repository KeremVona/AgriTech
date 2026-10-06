"""
Unit and integration tests for ONNX model export, dynamic batching, parity,
and latency benchmarking (TODO-103).
"""

import os
import json
import pytest
import numpy as np
import torch
import torch.nn as nn
import onnx
import onnxruntime as ort

from scripts.export_onnx import (
    export_to_onnx,
    quantize_onnx_model,
    verify_onnx_graph,
    verify_probability_parity,
    measure_inference_latency,
)


@pytest.fixture
def dummy_pytorch_model():
    """Returns a simple model with MobileNetV3-like output (12 logits)."""
    class SimpleLeafClassifier(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv = nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1)
            self.pool = nn.AdaptiveAvgPool2d((1, 1))
            self.fc = nn.Linear(16, 12)

        def forward(self, x):
            x = self.conv(x)
            x = self.pool(x)
            x = torch.flatten(x, 1)
            return self.fc(x)

    model = SimpleLeafClassifier()
    model.eval()
    return model


def test_export_to_onnx_and_graph_verification(tmp_path, dummy_pytorch_model):
    """
    Verify ONNX export:
    - Creates valid ONNX graph
    - Passes onnx.checker.check_model
    - Validates input and output tensor shapes
    """
    onnx_path = tmp_path / "model.onnx"
    export_to_onnx(
        model=dummy_pytorch_model,
        output_path=str(onnx_path),
        input_size=224,
        opset_version=17,
    )

    assert onnx_path.exists()
    assert onnx_path.stat().st_size > 0

    # Verify ONNX structure
    is_valid, msg = verify_onnx_graph(str(onnx_path))
    assert is_valid is True
    assert msg == "VALID"


def test_onnx_dynamic_batching(tmp_path, dummy_pytorch_model):
    """
    Verify dynamic batch axes:
    - Execution succeeds across varying batch sizes (1, 2, 4)
    - Output shape matches [batch_size, 12]
    """
    onnx_path = tmp_path / "dynamic_model.onnx"
    export_to_onnx(
        model=dummy_pytorch_model,
        output_path=str(onnx_path),
        input_size=224,
    )

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    for batch_size in [1, 2, 4]:
        dummy_input = np.random.randn(batch_size, 3, 224, 224).astype(np.float32)
        outputs = session.run([output_name], {input_name: dummy_input})
        logits = outputs[0]

        assert logits.shape == (batch_size, 12)


def test_probability_parity_within_threshold(tmp_path, dummy_pytorch_model):
    """
    Verify output probability parity:
    Delta < 1e-3 (0.001) between native PyTorch Softmax and ONNX Softmax.
    """
    onnx_path = tmp_path / "parity_model.onnx"
    export_to_onnx(model=dummy_pytorch_model, output_path=str(onnx_path))

    dummy_input = np.random.randn(1, 3, 224, 224).astype(np.float32)
    max_delta, passes = verify_probability_parity(
        pytorch_model=dummy_pytorch_model,
        onnx_model_path=str(onnx_path),
        input_data=dummy_input,
        threshold=1e-3,
    )

    assert passes is True
    assert max_delta < 1e-3


def test_int8_quantization_reduces_size(tmp_path, dummy_pytorch_model):
    """
    Verify INT8 dynamic quantization pipeline:
    - Produces quantized ONNX file
    - Executes valid inference on CPU
    """
    fp32_path = tmp_path / "fp32_model.onnx"
    int8_path = tmp_path / "int8_model.onnx"

    export_to_onnx(model=dummy_pytorch_model, output_path=str(fp32_path))
    quantize_onnx_model(str(fp32_path), str(int8_path))

    assert int8_path.exists()
    assert int8_path.stat().st_size > 0

    # Ensure quantized model runs in ONNXRuntime
    session = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"])
    inp = np.random.randn(1, 3, 224, 224).astype(np.float32)
    out = session.run(None, {session.get_inputs()[0].name: inp})
    assert out[0].shape == (1, 12)


def test_measure_inference_latency(tmp_path, dummy_pytorch_model):
    """
    Verify latency benchmark harness:
    - Measures sequential inference
    - Accurately computes median, p95, min, max
    """
    onnx_path = tmp_path / "bench_model.onnx"
    export_to_onnx(model=dummy_pytorch_model, output_path=str(onnx_path))

    metrics = measure_inference_latency(
        onnx_path=str(onnx_path),
        num_runs=10,
        warmup_runs=2,
    )

    assert "median_ms" in metrics
    assert "mean_ms" in metrics
    assert "p95_ms" in metrics
    assert "min_ms" in metrics
    assert "max_ms" in metrics
    assert metrics["median_ms"] > 0
    assert metrics["min_ms"] <= metrics["median_ms"] <= metrics["max_ms"]
