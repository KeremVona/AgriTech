"""
Unit tests for the standalone ONNX export engine.
Precision AgriTech Platform - Retraining Experimentation (Phase 6).
"""

import sys
from pathlib import Path
import pytest
import torch

current_dir = Path(__file__).resolve().parent
exp_root = current_dir.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

from models.model_multitask import MultiTaskPlantClassifier
from models.export_onnx import export_multitask_onnx


def test_export_multitask_onnx_roundtrip(tmp_path):
    # 1. Create a lightweight mock checkpoint
    mock_model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    ckpt_path = tmp_path / "mock_checkpoint.pth"
    torch.save(
        {
            "epoch": 1,
            "best_score": 0.95,
            "model_state_dict": mock_model.state_dict(),
        },
        ckpt_path,
    )

    out_onnx = tmp_path / "test_model.onnx"

    # 2. Execute export
    results = export_multitask_onnx(
        checkpoint_path=ckpt_path,
        output_onnx_path=out_onnx,
        opset_version=17,
        run_benchmark=True,
    )

    # 3. Assertions
    assert out_onnx.exists()
    assert results["size_budget_passed"] is True
    assert results["file_size_mb"] < 25.0
    assert results["parity_passed"] is True
    assert results["parity_crop_diff"] < 1e-4
    assert results["parity_disease_diff"] < 1e-4
    assert results["latency_budget_passed"] is True
    assert results["latency_mean_ms"] < 30.0
