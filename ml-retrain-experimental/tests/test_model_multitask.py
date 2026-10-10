"""
Unit Tests for MultiTaskPlantClassifier, MultiTaskLoss, and Evaluation Metrics.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).
"""

import io
import sys
import pytest
import numpy as np
from pathlib import Path

# Ensure ml-retrain-experimental is in sys.path
exp_root = Path(__file__).resolve().parent.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

import torch

from models.model_multitask import (
    MultiTaskPlantClassifier,
    MultiTaskLoss,
    compute_multitask_evaluation_metrics,
)


def test_model_forward_shapes():
    """Verify forward pass output shapes for both heads across batch sizes 1 and 4."""
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    model.eval()

    # Test single-sample inference (B=1)
    single_input = torch.randn(1, 3, 224, 224)
    crop_1, dis_1 = model(single_input)
    assert crop_1.shape == (1, 4)
    assert dis_1.shape == (1, 8)

    # Test batch inference (B=4)
    batch_input = torch.randn(4, 3, 224, 224)
    crop_4, dis_4 = model(batch_input)
    assert crop_4.shape == (4, 4)
    assert dis_4.shape == (4, 8)


def test_model_feature_extraction():
    """Verify feature extractor outputs 960-dimensional embeddings."""
    model = MultiTaskPlantClassifier(pretrained=False)
    model.eval()

    dummy_input = torch.randn(2, 3, 224, 224)
    features = model.extract_features(dummy_input)

    assert features.shape == (2, 960)


def test_predict_probabilities_and_mode_safety():
    """Verify predict_probabilities sums to 1.0 and properly preserves training mode."""
    model = MultiTaskPlantClassifier(pretrained=False)
    model.train()  # Model is in training mode initially
    assert model.training is True

    dummy_input = torch.randn(3, 3, 224, 224)
    probs = model.predict_probabilities(dummy_input)

    # Verify that model was restored back to training mode
    assert model.training is True

    assert "crop_probabilities" in probs
    assert "disease_probabilities" in probs

    crop_probs = probs["crop_probabilities"]
    disease_probs = probs["disease_probabilities"]

    assert crop_probs.shape == (3, 4)
    assert disease_probs.shape == (3, 8)

    # Sum along class dimension should be ~1.0
    assert torch.allclose(crop_probs.sum(dim=-1), torch.ones(3), atol=1e-5)
    assert torch.allclose(disease_probs.sum(dim=-1), torch.ones(3), atol=1e-5)


def test_backward_gradient_flow():
    """Verify loss backward pass propagates gradients through both heads and backbone."""
    model = MultiTaskPlantClassifier(pretrained=False)
    model.train()

    criterion = MultiTaskLoss(weight_crop=0.4, weight_disease=0.6, label_smoothing=0.1)

    dummy_images = torch.randn(2, 3, 224, 224)
    crop_targets = torch.tensor([1, 2], dtype=torch.long)
    disease_targets = torch.tensor([3, 5], dtype=torch.long)

    crop_logits, disease_logits = model(dummy_images)
    total_loss, metrics = criterion(crop_logits, disease_logits, crop_targets, disease_targets)

    assert isinstance(total_loss, torch.Tensor)
    assert total_loss.item() > 0
    assert "loss_crop" in metrics
    assert "loss_disease" in metrics
    assert "total_loss" in metrics

    # Verify task weighted sum
    expected_loss = 0.4 * metrics["loss_crop"].item() + 0.6 * metrics["loss_disease"].item()
    assert abs(metrics["total_loss"].item() - expected_loss) < 1e-4

    # Backpropagation
    total_loss.backward()

    # Check gradients on backbone and heads
    assert model.features[0][0].weight.grad is not None
    assert model.crop_head[-1].weight.grad is not None
    assert model.disease_head[-1].weight.grad is not None


def test_compute_multitask_evaluation_metrics_lists_and_tensors():
    """Verify evaluation metric calculations with Python lists, PyTorch tensors, and NumPy arrays."""
    crop_targets = torch.tensor([0, 1, 2, 3])
    crop_preds = torch.tensor([0, 1, 2, 0])  # 3 of 4 correct -> 0.75

    disease_targets = np.array([1, 2, 3, 4])
    disease_preds = np.array([1, 2, 0, 4])  # 3 of 4 correct -> 0.75

    metrics = compute_multitask_evaluation_metrics(
        crop_preds=crop_preds,
        crop_targets=crop_targets,
        disease_preds=disease_preds,
        disease_targets=disease_targets,
    )

    assert metrics["crop_accuracy"] == 0.75
    assert metrics["disease_accuracy"] == 0.75
    assert metrics["joint_accuracy"] == 0.50
    assert 0.0 <= metrics["crop_macro_f1"] <= 1.0
    assert 0.0 <= metrics["disease_macro_f1"] <= 1.0


def test_metrics_empty_and_mismatch():
    """Verify edge cases for empty inputs and mismatched lengths."""
    empty_res = compute_multitask_evaluation_metrics([], [], [], [])
    assert empty_res["crop_accuracy"] == 0.0
    assert empty_res["joint_accuracy"] == 0.0

    with pytest.raises(ValueError, match="Length mismatch"):
        compute_multitask_evaluation_metrics([1, 2], [1], [1, 2], [1, 2])


def test_model_onnx_export_compatibility():
    """Verify that MultiTaskPlantClassifier cleanly traces and exports to ONNX (opset 17)."""
    model = MultiTaskPlantClassifier(pretrained=False)
    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224)
    buffer = io.BytesIO()

    torch.onnx.export(
        model,
        dummy_input,
        buffer,
        export_params=True,
        opset_version=17,
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

    assert buffer.tell() > 0
