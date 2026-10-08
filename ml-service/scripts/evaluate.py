"""
Model Evaluation, Confusion Matrix & Metrics Reporting Suite.
Precision AgriTech Platform - Phase 1 (TODO-102).

Evaluates trained MobileNetV3 model on the held-out test split:
- Precision, Recall, and F1-score across all 12 classes
- Overall Top-1 Macro F1-score calculation (Acceptance threshold: >= 0.94)
- High-resolution Confusion Matrix visualization (confusion_matrix.png)
- Machine-readable evaluation report (test_metrics.json)
"""
# updated
import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless & server environments
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_recall_fscore_support,
)

try:
    from scripts.train import (
        TARGET_12_CLASSES,
        build_mobilenet_v3_small,
        get_transforms,
    )
except ModuleNotFoundError:
    from train import (
        TARGET_12_CLASSES,
        build_mobilenet_v3_small,
        get_transforms,
    )


def plot_and_save_confusion_matrix(
    cm: np.ndarray,
    class_names: List[str],
    output_path: str,
    title: str = "AgriTech Leaf Disease Classification - Confusion Matrix",
) -> None:
    """
    Plots a normalized confusion matrix heatmap and saves it to disk.
    """
    cm_norm = cm.astype("float") / (cm.sum(axis=1)[:, np.newaxis] + 1e-9)

    plt.figure(figsize=(12, 10))
    sns.heatmap(
        cm_norm,
        annot=True,
        fmt=".2f",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        cbar=True,
    )
    plt.title(title, fontsize=14, pad=15)
    plt.ylabel("True Label", fontsize=12)
    plt.xlabel("Predicted Label", fontsize=12)
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(str(out_file), dpi=300)
    plt.close()
    print(f"[+] Confusion matrix saved to: {out_file}")


def evaluate_model_on_test_split(
    model: nn.Module,
    test_loader: DataLoader,
    class_names: List[str],
    device: torch.device,
) -> Dict[str, Any]:
    """
    Runs model inference across test_loader, computing full classification metrics.
    """
    model.eval()
    all_targets: List[int] = []
    all_preds: List[int] = []

    with torch.no_grad():
        for images, targets in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)

            all_targets.extend(targets.cpu().tolist())
            all_preds.extend(preds.cpu().tolist())

    y_true = np.array(all_targets)
    y_pred = np.array(all_preds)

    # Calculate overall metrics
    top1_acc = float(accuracy_score(y_true, y_pred))
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        y_true,
        y_pred,
        average="macro",
        zero_division=0,
    )

    # Detailed per-class classification report
    report_dict = classification_report(
        y_true,
        y_pred,
        target_names=class_names,
        output_dict=True,
        zero_division=0,
    )

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(class_names))))

    return {
        "overall": {
            "accuracy": top1_acc,
            "macro_precision": float(macro_precision),
            "macro_recall": float(macro_recall),
            "macro_f1": float(macro_f1),
            "acceptance_criteria_f1_met": macro_f1 >= 0.94,
        },
        "per_class": report_dict,
        "confusion_matrix": cm.tolist(),
    }


def run_evaluation(
    data_dir: str,
    checkpoint_path: str,
    output_dir: str = "models/evaluation",
    batch_size: int = 32,
    device_str: str = None,
) -> Dict[str, Any]:
    """
    Full evaluation pipeline:
    1. Loads test dataset from data_dir/test
    2. Restores model weights from checkpoint_path
    3. Evaluates predictions and computes Macro F1
    4. Generates confusion_matrix.png and test_metrics.json
    """
    device = torch.device(device_str if device_str else ("cuda" if torch.cuda.is_available() else "cpu"))
    print(f"[*] Evaluating on device: {device}")

    data_path = Path(data_dir)
    test_dir = data_path / "test"
    if not test_dir.exists():
        raise FileNotFoundError(f"Missing test directory in {data_dir}")

    _, test_transform = get_transforms(img_size=224)
    test_dataset = datasets.ImageFolder(str(test_dir), transform=test_transform)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    class_names = test_dataset.classes
    print(f"[*] Evaluating {len(class_names)} classes with {len(test_dataset)} test samples.")

    # Load model
    model = build_mobilenet_v3_small(num_classes=len(class_names), pretrained=False)
    checkpoint = Path(checkpoint_path)
    if not checkpoint.exists():
        raise FileNotFoundError(f"Model checkpoint not found at: {checkpoint_path}")

    state_dict = torch.load(str(checkpoint), map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)

    # Run evaluation
    results = evaluate_model_on_test_split(model, test_loader, class_names, device)

    # Save artifacts
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cm_array = np.array(results["confusion_matrix"])
    cm_path = out_dir / "confusion_matrix.png"
    plot_and_save_confusion_matrix(cm_array, class_names, str(cm_path))

    metrics_path = out_dir / "test_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("AgriTech MobileNetV3 Test Evaluation Summary")
    print("=" * 60)
    print(f"Accuracy:         {results['overall']['accuracy']*100:.2f}%")
    print(f"Macro Precision:  {results['overall']['macro_precision']:.4f}")
    print(f"Macro Recall:     {results['overall']['macro_recall']:.4f}")
    print(f"Macro F1-Score:   {results['overall']['macro_f1']:.4f}")
    print(f"Threshold Met:    {'PASS (>= 0.94)' if results['overall']['acceptance_criteria_f1_met'] else 'FAIL (< 0.94)'}")
    print(f"Report saved:     {metrics_path}")
    print("=" * 60 + "\n")

    return results


def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech Model Evaluation CLI")
    parser.add_argument("--data-dir", type=str, required=True, help="Path to processed dataset containing test/")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to best_model.pth")
    parser.add_argument("--output-dir", type=str, default="models/evaluation", help="Directory for reports and confusion matrix")
    parser.add_argument("--batch-size", type=int, default=32, help="Evaluation batch size")
    parser.add_argument("--device", type=str, default=None, help="Device ('cuda' or 'cpu')")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_evaluation(
        data_dir=args.data_dir,
        checkpoint_path=args.checkpoint,
        output_dir=args.output_dir,
        batch_size=args.batch_size,
        device_str=args.device,
    )
