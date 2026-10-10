"""
Unit Tests for Multi-Task Training Harness and Early Stopping.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).
"""

import sys
import json
import pytest
import numpy as np
from pathlib import Path
from PIL import Image

# Ensure ml-retrain-experimental is in sys.path
exp_root = Path(__file__).resolve().parent.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from models.model_multitask import MultiTaskPlantClassifier, MultiTaskLoss
from training.train_multidataset import (
    EarlyStopping,
    train_one_epoch,
    evaluate_one_epoch,
    run_training,
)


def test_early_stopping_logic(tmp_path: Path):
    """Verify EarlyStopping counter increment and patience trigger."""
    ckpt_path = tmp_path / "best_model.pth"
    model = nn.Linear(10, 2)
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)

    es = EarlyStopping(patience=3, min_delta=0.01, checkpoint_path=ckpt_path, mode="max")

    # Step 1: Initial score 0.50 -> should save
    assert es.step(0.50, model, optimizer, epoch=1, metrics={"acc": 0.50}) is True
    assert es.counter == 0
    assert ckpt_path.exists()

    # Step 2: Improved score 0.60 -> should save
    assert es.step(0.60, model, optimizer, epoch=2, metrics={"acc": 0.60}) is True
    assert es.counter == 0
    assert es.best_score == 0.60

    # Step 3: No improvement (0.59) -> counter becomes 1
    assert es.step(0.59, model, optimizer, epoch=3, metrics={"acc": 0.59}) is False
    assert es.counter == 1
    assert es.early_stop is False

    # Step 4: No improvement (0.58) -> counter becomes 2
    assert es.step(0.58, model, optimizer, epoch=4, metrics={"acc": 0.58}) is False
    assert es.counter == 2
    assert es.early_stop is False

    # Step 5: No improvement (0.57) -> counter becomes 3 (patience reached)
    assert es.step(0.57, model, optimizer, epoch=5, metrics={"acc": 0.57}) is False
    assert es.counter == 3
    assert es.early_stop is True


def test_train_and_evaluate_one_epoch():
    """Verify train_one_epoch and evaluate_one_epoch execution with mock data."""
    model = MultiTaskPlantClassifier(pretrained=False)
    criterion = MultiTaskLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    device = torch.device("cpu")

    # Mock dataset: 4 images
    images = torch.randn(4, 3, 224, 224)
    crop_targets = torch.tensor([0, 1, 2, 3], dtype=torch.long)
    disease_targets = torch.tensor([0, 1, 2, 3], dtype=torch.long)
    dataset = TensorDataset(images, crop_targets, disease_targets)
    loader = DataLoader(dataset, batch_size=2)

    # Train 1 epoch
    train_res = train_one_epoch(model, loader, criterion, optimizer, device)
    assert "loss_total" in train_res
    assert "crop_accuracy" in train_res
    assert "disease_accuracy" in train_res
    assert "joint_accuracy" in train_res

    # Eval 1 epoch
    eval_res = evaluate_one_epoch(model, loader, criterion, device)
    assert "loss_total" in eval_res
    assert "joint_accuracy" in eval_res


def test_run_training_end_to_end_mock(tmp_path: Path):
    """Verify run_training executes cleanly and writes checkpoint and history."""
    # Create mock images and manifest
    records = []
    for i in range(4):
        img_file = tmp_path / f"leaf_{i}.jpg"
        Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)).save(img_file)
        records.append({
            "file_path": str(img_file.as_posix()),
            "canonical_class": "Potato___healthy",
            "crop_idx": 2,
            "disease_idx": 0,
            "domain": "field",
            "source_dataset": "MockDS",
            "sha256": f"sha_{i}",
        })

    manifest_path = tmp_path / "mock_manifest.json"
    manifest_path.write_text(json.dumps(records), encoding="utf-8")

    out_dir = tmp_path / "output_models"

    result = run_training(
        train_manifest=manifest_path,
        val_manifest=manifest_path,
        output_dir=out_dir,
        epochs=1,
        batch_size=2,
        lr=1e-3,
        num_workers=0,
        pretrained=False,
        device=torch.device("cpu"),
    )

    assert result["best_epoch"] == 1
    assert Path(result["checkpoint_file"]).exists()
    assert Path(result["history_file"]).exists()

    # Verify checkpoint deserialization and strict weight loading
    ckpt = torch.load(result["checkpoint_file"], map_location="cpu")
    assert ckpt["epoch"] == 1
    assert "model_state_dict" in ckpt
    assert "optimizer_state_dict" in ckpt

    new_model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
    new_model.load_state_dict(ckpt["model_state_dict"], strict=True)

    with open(result["history_file"], "r", encoding="utf-8") as f:
        history_data = json.load(f)
    assert len(history_data["epochs"]) == 1
    assert "train" in history_data["epochs"][0]
    assert "val" in history_data["epochs"][0]
