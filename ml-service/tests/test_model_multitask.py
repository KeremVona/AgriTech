"""
Unit tests for MultiTaskPlantClassifier and MultiTaskLoss.
Verifies tensor shapes, dual-head output dimensions, and gradient backpropagation.
"""

import pytest
import torch
from scripts.model_multitask import (
    MultiTaskPlantClassifier,
    MultiTaskLoss,
    compute_multitask_evaluation_metrics,
)


def test_multitask_architecture_forward_shapes():
    """Forward pass must produce [B, 4] for crop and [B, 8] for disease."""
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    dummy_input = torch.randn(2, 3, 224, 224)

    crop_logits, disease_logits = model(dummy_input)

    assert crop_logits.shape == (2, 4)
    assert disease_logits.shape == (2, 8)


def test_multitask_predict_probabilities():
    """Predict probabilities must output normalized distributions summing to 1.0."""
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    dummy_input = torch.randn(3, 3, 224, 224)

    probs = model.predict_probabilities(dummy_input)

    crop_probs = probs["crop_probabilities"]
    disease_probs = probs["disease_probabilities"]

    assert crop_probs.shape == (3, 4)
    assert disease_probs.shape == (3, 8)
    assert torch.allclose(crop_probs.sum(dim=-1), torch.ones(3), atol=1e-4)
    assert torch.allclose(disease_probs.sum(dim=-1), torch.ones(3), atol=1e-4)


def test_multitask_loss_and_gradients():
    """Combined multi-task loss must compute properly and propagate gradients through both heads."""
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    loss_fn = MultiTaskLoss(weight_crop=0.4, weight_disease=0.6)

    dummy_input = torch.randn(4, 3, 224, 224)
    crop_targets = torch.tensor([0, 1, 2, 3], dtype=torch.long)
    disease_targets = torch.tensor([0, 2, 4, 6], dtype=torch.long)

    crop_logits, disease_logits = model(dummy_input)
    total_loss, metrics = loss_fn(crop_logits, disease_logits, crop_targets, disease_targets)

    assert total_loss.item() > 0.0
    assert "loss_crop" in metrics
    assert "loss_disease" in metrics

    total_loss.backward()

    # Check gradients on both heads and backbone
    assert model.crop_head[-1].weight.grad is not None
    assert model.disease_head[-1].weight.grad is not None
    assert model.features[0][0].weight.grad is not None


def test_compute_multitask_metrics():
    """Metric evaluation helper must calculate accurate accuracies and joint accuracy."""
    crop_targets = [0, 1, 2, 3]
    crop_preds   = [0, 1, 2, 0]  # 3/4 = 0.75

    disease_targets = [1, 2, 3, 4]
    disease_preds   = [1, 2, 0, 4]  # 3/4 = 0.75

    # Joint: samples 0 and 1 are both correct -> 2/4 = 0.50
    metrics = compute_multitask_evaluation_metrics(
        crop_preds, crop_targets, disease_preds, disease_targets
    )

    assert metrics["crop_accuracy"] == 0.75
    assert metrics["disease_accuracy"] == 0.75
    assert metrics["joint_accuracy"] == 0.50
    assert 0.0 <= metrics["disease_macro_f1"] <= 1.0
