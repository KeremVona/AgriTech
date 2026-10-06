"""
MobileNetV3-Small Transfer Learning, Training Pipeline & Utilities.
Precision AgriTech Platform - Phase 1 (TODO-102).

Provides modular components for both local and Google Colab T4 GPU execution:
- Target 12-class definition
- Outdoor-lighting augmentations (RandomHorizontalFlip, RandomRotation(30), ColorJitter)
- MobileNetV3-Small model architecture with 12-class linear classifier
- EarlyStopping callback monitoring validation loss (patience=5)
- Metric computation (Top-1 Accuracy, Precision, Recall, Macro F1)
- End-to-end training loop with cosine learning rate scheduling and hyperparameter logging
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Tuple, Dict, Any, Optional, List

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import transforms, models, datasets
from sklearn.metrics import precision_recall_fscore_support, accuracy_score

# Standard 12 target crop-disease classes aligned with TODO-101 and Phase 1 specifications
TARGET_12_CLASSES = [
    "Tomato___healthy",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Bacterial_spot",
    "Potato___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Corn_(maize)___healthy",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Apple___healthy",
    "Apple___Cedar_apple_rust",
]


def get_transforms(img_size: int = 224) -> Tuple[transforms.Compose, transforms.Compose]:
    """
    Returns data transforms for training and validation splits.
    Includes outdoor lighting and orientation augmentations:
    - RandomHorizontalFlip
    - RandomRotation(degrees=30)
    - ColorJitter(brightness=0.2, contrast=0.2)
    - ImageNet standard normalization: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    """
    train_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=30),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    return train_transform, val_transform


def build_mobilenet_v3_small(num_classes: int = 12, pretrained: bool = True) -> nn.Module:
    """
    Builds a MobileNetV3-Small backbone and replaces the final classification layer
    with a linear projection for `num_classes` outputs.
    """
    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)

    # In MobileNetV3, model.classifier is a Sequential ending with classifier[-1] == Linear(1024, 1000)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features=in_features, out_features=num_classes)

    return model


class EarlyStopping:
    """
    Early stopping callback that halts training when validation loss does not
    improve for `patience` consecutive epochs, and retains the best model checkpoint.
    """

    def __init__(self, patience: int = 5, delta: float = 0.0001, checkpoint_path: str = "best_model.pth"):
        self.patience = patience
        self.delta = delta
        self.checkpoint_path = checkpoint_path
        self.counter = 0
        self.best_loss = float("inf")
        self.early_stop = False

    def __call__(self, val_loss: float, model: nn.Module) -> None:
        if val_loss < self.best_loss - self.delta:
            self.best_loss = val_loss
            self.counter = 0
            self.save_checkpoint(model)
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True

    def save_checkpoint(self, model: nn.Module) -> None:
        """Saves current best model weights to disk."""
        target_path = Path(self.checkpoint_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), str(target_path))


def compute_metrics(y_true: torch.Tensor, y_pred: torch.Tensor, num_classes: int = 12) -> Dict[str, float]:
    """
    Computes Top-1 Accuracy, Macro-averaged Precision, Recall, and F1 score.
    """
    y_true_np = y_true.cpu().numpy() if isinstance(y_true, torch.Tensor) else y_true
    y_pred_np = y_pred.cpu().numpy() if isinstance(y_pred, torch.Tensor) else y_pred

    acc = float(accuracy_score(y_true_np, y_pred_np))
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true_np,
        y_pred_np,
        average="macro",
        zero_division=0,
    )

    return {
        "accuracy": acc,
        "macro_precision": float(precision),
        "macro_recall": float(recall),
        "macro_f1": float(f1),
    }


def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float]:
    """Runs a single training epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, targets in dataloader:
        images = images.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == targets).sum().item()
        total += targets.size(0)

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc


def evaluate_split(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    num_classes: int = 12,
) -> Tuple[float, Dict[str, float]]:
    """Evaluates validation or test split and returns loss and metrics."""
    model.eval()
    running_loss = 0.0
    total = 0
    all_targets: List[int] = []
    all_preds: List[int] = []

    with torch.no_grad():
        for images, targets in dataloader:
            images = images.to(device)
            targets = targets.to(device)

            outputs = model(images)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)

            all_targets.extend(targets.cpu().tolist())
            all_preds.extend(preds.cpu().tolist())
            total += targets.size(0)

    split_loss = running_loss / max(total, 1)
    metrics = compute_metrics(
        torch.tensor(all_targets),
        torch.tensor(all_preds),
        num_classes=num_classes,
    )
    return split_loss, metrics


def run_training_pipeline(
    data_dir: str,
    output_dir: str = "models/checkpoints",
    epochs: int = 20,
    batch_size: int = 32,
    lr: float = 1e-3,
    weight_decay: float = 1e-4,
    patience: int = 5,
    img_size: int = 224,
    num_workers: int = 2,
    device_str: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full end-to-end training pipeline:
    1. Loads train and val datasets from data_dir
    2. Builds MobileNetV3-Small backbone
    3. Runs training loop with EarlyStopping (patience=5)
    4. Saves best_model.pth and hyperparameters.json
    """
    device = torch.device(device_str if device_str else ("cuda" if torch.cuda.is_available() else "cpu"))
    print(f"[*] Training on device: {device}")

    train_transform, val_transform = get_transforms(img_size=img_size)
    data_path = Path(data_dir)
    train_dir = data_path / "train"
    val_dir = data_path / "val"

    if not train_dir.exists() or not val_dir.exists():
        raise FileNotFoundError(f"Missing train or val directory in {data_dir}")

    train_dataset = datasets.ImageFolder(str(train_dir), transform=train_transform)
    val_dataset = datasets.ImageFolder(str(val_dir), transform=val_transform)

    # Class indexing validation
    class_names = train_dataset.classes
    print(f"[*] Found {len(class_names)} classes: {class_names}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    model = build_mobilenet_v3_small(num_classes=len(class_names), pretrained=True).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    checkpoint_file = out_path / "best_model.pth"

    early_stopping = EarlyStopping(
        patience=patience,
        delta=0.0001,
        checkpoint_path=str(checkpoint_file),
    )

    history: List[Dict[str, Any]] = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_metrics = evaluate_split(model, val_loader, criterion, device, num_classes=len(class_names))
        scheduler.step()

        epoch_time = time.time() - epoch_start
        epoch_record = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_accuracy": train_acc,
            "val_loss": val_loss,
            "val_accuracy": val_metrics["accuracy"],
            "val_macro_f1": val_metrics["macro_f1"],
            "epoch_time_sec": epoch_time,
        }
        history.append(epoch_record)

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {train_loss:.4f} | Acc: {train_acc*100:.2f}% | "
            f"Val Loss: {val_loss:.4f} | Macro F1: {val_metrics['macro_f1']:.4f} | "
            f"Time: {epoch_time:.1f}s"
        )

        early_stopping(val_loss, model)
        if early_stopping.early_stop:
            print(f"[!] Early stopping triggered at epoch {epoch} (patience={patience}).")
            break

    total_training_time = time.time() - start_time

    # Save hyperparameters and metadata log
    metadata = {
        "model_architecture": "MobileNetV3-Small",
        "num_classes": len(class_names),
        "classes": class_names,
        "class_to_idx": train_dataset.class_to_idx,
        "hyperparameters": {
            "epochs_planned": epochs,
            "epochs_trained": len(history),
            "batch_size": batch_size,
            "learning_rate": lr,
            "weight_decay": weight_decay,
            "patience": patience,
            "optimizer": "AdamW",
            "scheduler": "CosineAnnealingLR",
            "img_size": img_size,
        },
        "best_val_loss": early_stopping.best_loss,
        "total_training_time_sec": total_training_time,
        "history": history,
    }

    meta_file = out_path / "hyperparameters.json"
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[+] Model checkpoint saved to: {checkpoint_file}")
    print(f"[+] Hyperparameters logged to: {meta_file}")
    return metadata


def parse_args():
    parser = argparse.ArgumentParser(description="AgriTech MobileNetV3-Small Training CLI")
    parser.add_argument("--data-dir", type=str, required=True, help="Path to processed dataset root containing train/ and val/")
    parser.add_argument("--output-dir", type=str, default="models/checkpoints", help="Directory to save checkpoint and hyperparameters")
    parser.add_argument("--epochs", type=int, default=20, help="Maximum epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience")
    parser.add_argument("--device", type=str, default=None, help="Device to use ('cuda' or 'cpu')")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_training_pipeline(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        patience=args.patience,
        device_str=args.device,
    )
