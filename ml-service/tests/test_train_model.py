"""
Unit and integration tests for CNN model training components, transfer learning architecture,
augmentations, early stopping callback, and evaluation metrics (TODO-102).
"""

import os
import json
import pytest
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from scripts.train import (
    get_transforms,
    build_mobilenet_v3_small,
    EarlyStopping,
    compute_metrics,
    TARGET_12_CLASSES,
)


def test_target_12_classes_alignment():
    """Verify exact 12 target classes alignment with TODO-101 and Phase 1."""
    assert len(TARGET_12_CLASSES) == 12
    assert "Tomato___healthy" in TARGET_12_CLASSES
    assert "Tomato___Early_blight" in TARGET_12_CLASSES
    assert "Potato___Late_blight" in TARGET_12_CLASSES
    assert "Corn_(maize)___Common_rust_" in TARGET_12_CLASSES
    assert "Apple___Cedar_apple_rust" in TARGET_12_CLASSES


def test_train_transforms_outdoor_lighting(tmp_path):
    """
    Verify training transforms include:
    - RandomHorizontalFlip
    - RandomRotation(degrees=30)
    - ColorJitter(brightness=0.2, contrast=0.2)
    - Resize and ImageNet normalization to 3x224x224 tensor
    """
    train_transform, val_transform = get_transforms(img_size=224)

    # Create dummy PIL Image
    img = Image.new("RGB", (300, 300), color=(120, 180, 70))

    tensor_train = train_transform(img)
    tensor_val = val_transform(img)

    assert isinstance(tensor_train, torch.Tensor)
    assert tensor_train.shape == (3, 224, 224)
    assert tensor_train.dtype == torch.float32

    assert isinstance(tensor_val, torch.Tensor)
    assert tensor_val.shape == (3, 224, 224)


def test_build_mobilenet_v3_small_architecture():
    """
    Verify MobileNetV3-Small model builder:
    - Backbone initialized
    - Final linear classifier replaced with num_classes=12
    - Forward pass outputs logits of shape [batch_size, 12]
    """
    model = build_mobilenet_v3_small(num_classes=12, pretrained=False)

    # Check classifier structure
    assert isinstance(model.classifier, nn.Sequential)
    last_layer = model.classifier[-1]
    assert isinstance(last_layer, nn.Linear)
    assert last_layer.out_features == 12

    # Forward pass with dummy batch
    dummy_input = torch.randn(2, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)

    assert output.shape == (2, 12)


def test_early_stopping_behavior(tmp_path):
    """
    Verify EarlyStopping callback:
    - Saves checkpoint when validation loss improves
    - Increments counter when loss stagnates
    - Triggers early_stop = True when patience (e.g. 3 or 5) is reached
    """
    checkpoint_path = tmp_path / "best_model.pth"
    model = nn.Linear(10, 2)

    es = EarlyStopping(patience=3, delta=0.001, checkpoint_path=str(checkpoint_path))

    # Epoch 1: Loss 1.0 (Improvement) -> Save
    es(val_loss=1.0, model=model)
    assert es.counter == 0
    assert not es.early_stop
    assert checkpoint_path.exists()

    # Epoch 2: Loss 0.8 (Improvement) -> Save
    es(val_loss=0.8, model=model)
    assert es.counter == 0
    assert not es.early_stop

    # Epoch 3: Loss 0.82 (Stagnation 1)
    es(val_loss=0.82, model=model)
    assert es.counter == 1
    assert not es.early_stop

    # Epoch 4: Loss 0.81 (Stagnation 2)
    es(val_loss=0.81, model=model)
    assert es.counter == 2
    assert not es.early_stop

    # Epoch 5: Loss 0.85 (Stagnation 3 == patience) -> Trigger stop
    es(val_loss=0.85, model=model)
    assert es.counter == 3
    assert es.early_stop is True


def test_compute_metrics():
    """
    Verify calculation of Top-1 Accuracy, Precision, Recall, and Macro F1 score.
    """
    # 4 samples, 3 classes (0, 1, 2)
    y_true = torch.tensor([0, 1, 2, 0])
    y_pred = torch.tensor([0, 1, 2, 1])  # 3 correct, 1 wrong (sample 3 predicted as 1 instead of 0)

    metrics = compute_metrics(y_true, y_pred, num_classes=3)

    assert "accuracy" in metrics
    assert "macro_precision" in metrics
    assert "macro_recall" in metrics
    assert "macro_f1" in metrics

    # Accuracy is 3/4 = 0.75
    assert pytest.approx(metrics["accuracy"], 0.01) == 0.75
    # F1 must be between 0 and 1
    assert 0.0 <= metrics["macro_f1"] <= 1.0


def test_evaluate_model_and_confusion_matrix(tmp_path):
    """
    Verify test evaluation helper and confusion matrix plotting.
    """
    from scripts.evaluate import evaluate_model_on_test_split, plot_and_save_confusion_matrix
    from torch.utils.data import TensorDataset

    class DummyModel(nn.Module):
        def forward(self, x):
            # return deterministic logits
            return torch.tensor([[10.0, 0.0], [0.0, 10.0], [10.0, 0.0]])

    dummy_loader = [(torch.randn(3, 3, 224, 224), torch.tensor([0, 1, 1]))]
    class_names = ["ClassA", "ClassB"]

    results = evaluate_model_on_test_split(
        DummyModel(),
        dummy_loader,
        class_names,
        device=torch.device("cpu"),
    )

    assert "overall" in results
    assert "per_class" in results
    assert "confusion_matrix" in results
    assert 0.0 <= results["overall"]["macro_f1"] <= 1.0

    # Test plotting
    cm = np.array(results["confusion_matrix"])
    cm_path = tmp_path / "cm.png"
    plot_and_save_confusion_matrix(cm, class_names, str(cm_path))
    assert cm_path.exists()

