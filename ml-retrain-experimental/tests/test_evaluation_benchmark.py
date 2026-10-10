"""
Unit Tests for BenchmarkEvaluator and Field Reporting Engine.
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

from models.model_multitask import MultiTaskPlantClassifier
from evaluation.evaluate_benchmark import (
    BenchmarkEvaluator,
    format_benchmark_markdown_report,
)


def test_evaluator_evaluate_manifest_and_diagnostics(tmp_path: Path):
    """Verify BenchmarkEvaluator computes domain breakdowns and Potato Late Blight diagnostics."""
    records = []
    # 4 field potato late blight, 4 lab healthy tomato
    for i in range(8):
        img_file = tmp_path / f"test_img_{i}.jpg"
        Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)).save(img_file)
        if i < 4:
            records.append({
                "file_path": str(img_file.as_posix()),
                "canonical_class": "Potato___Late_blight",
                "crop_idx": 2,  # Potato
                "disease_idx": 2,  # Late Blight
                "domain": "field",
                "source_dataset": "FieldDS",
                "sha256": f"sha_f_{i}",
            })
        else:
            records.append({
                "file_path": str(img_file.as_posix()),
                "canonical_class": "Tomato___healthy",
                "crop_idx": 3,  # Tomato
                "disease_idx": 0,  # Healthy
                "domain": "lab",
                "source_dataset": "LabDS",
                "sha256": f"sha_l_{i}",
            })

    manifest_path = tmp_path / "test_manifest.json"
    manifest_path.write_text(json.dumps(records), encoding="utf-8")

    model = MultiTaskPlantClassifier(pretrained=False)
    evaluator = BenchmarkEvaluator(model=model, device=torch.device("cpu"))

    results = evaluator.evaluate_manifest(manifest_path, batch_size=4)

    assert results["total_evaluated"] == 8
    assert "overall_metrics" in results
    assert "field_metrics" in results
    assert "lab_metrics" in results
    assert results["field_metrics"]["sample_count"] == 4
    assert results["lab_metrics"]["sample_count"] == 4

    # Potato late blight resolution
    plb = results["potato_late_blight_resolution"]
    assert plb["total_samples"] == 4
    assert "crop_accuracy" in plb
    assert "disease_accuracy" in plb
    assert "joint_accuracy" in plb

    # Latency metrics
    assert "mean" in results["latency_ms"]
    assert "p95" in results["latency_ms"]

    # Markdown report formatting
    md_report = format_benchmark_markdown_report(results)
    assert "# Multi-Dataset Multi-Task Benchmark Evaluation Report" in md_report
    assert "Potato Host Crop Accuracy:" in md_report
