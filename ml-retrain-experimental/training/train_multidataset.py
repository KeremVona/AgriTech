"""
Multi-Task Training Harness & Experimentation Engine.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).

Orchestrates multi-task model training for MobileNetV3-Large:
- AdamW optimizer with decoupled weight decay (1e-4)
- SequentialLR: Linear warmup (3 epochs) followed by Cosine Annealing decay
- Combined Multi-Task Loss with label smoothing (0.1)
- Validation tracking for Joint Accuracy, Crop Accuracy, Disease Accuracy, and Disease Macro F1
- Early stopping callback retaining the best checkpoint
- Reloads best checkpoint into model before returning
- JSON metrics tracking for training curve visualizations
"""

import os
import sys
import json
import time
import random
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List

# Ensure experimental root is in sys.path
exp_root = Path(__file__).resolve().parent.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from models.model_multitask import (
    MultiTaskPlantClassifier,
    MultiTaskLoss,
    compute_multitask_evaluation_metrics,
)
from pipeline.dataset import create_dataloaders

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MultiTaskTraining")


class EarlyStopping:
    """
    Early stopping monitor tracking validation Joint Accuracy (primary) and loss.
    Saves the best model weights when validation score improves.
    """

    def __init__(
        self,
        patience: int = 7,
        min_delta: float = 0.001,
        checkpoint_path: Path = Path("ml-retrain-experimental/models/best_multitask_model.pth"),
        mode: str = "max",
    ) -> None:
        self.patience = patience
        self.min_delta = min_delta
        self.checkpoint_path = Path(checkpoint_path)
        self.mode = mode
        self.counter = 0
        self.best_score: Optional[float] = None
        self.early_stop = False
        self.best_epoch = 0

    def step(
        self,
        score: float,
        model: nn.Module,
        optimizer: torch.optim.Optimizer,
        epoch: int,
        metrics: Dict[str, Any],
    ) -> bool:
        """
        Returns True if score improved and checkpoint was saved, False otherwise.
        """
        if self.best_score is None:
            self.best_score = score
            self.best_epoch = epoch
            self._save_checkpoint(model, optimizer, epoch, metrics)
            return True

        if self.mode == "max":
            improved = score > (self.best_score + self.min_delta)
        else:
            improved = score < (self.best_score - self.min_delta)

        if improved:
            self.best_score = score
            self.counter = 0
            self.best_epoch = epoch
            self._save_checkpoint(model, optimizer, epoch, metrics)
            return True
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
            return False

    def _save_checkpoint(
        self,
        model: nn.Module,
        optimizer: torch.optim.Optimizer,
        epoch: int,
        metrics: Dict[str, Any],
    ) -> None:
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        checkpoint = {
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "best_score": self.best_score,
            "metrics": metrics,
        }
        torch.save(checkpoint, self.checkpoint_path)
        logger.info(f"Saved new best model checkpoint to {self.checkpoint_path} (Epoch {epoch}, Score {self.best_score:.4f})")


def set_seed(seed: int = 42) -> None:
    """Sets deterministic random seed across Python, NumPy, and PyTorch."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> Dict[str, float]:
    """Runs a single training epoch."""
    model.train()
    total_loss_sum = 0.0
    crop_loss_sum = 0.0
    disease_loss_sum = 0.0
    total_samples = 0

    all_crop_preds = []
    all_crop_targets = []
    all_disease_preds = []
    all_disease_targets = []

    for batch in dataloader:
        images, crop_targets, disease_targets = batch[:3]
        batch_size = images.size(0)
        images = images.to(device, non_blocking=True)
        crop_targets = crop_targets.to(device, non_blocking=True)
        disease_targets = disease_targets.to(device, non_blocking=True)

        optimizer.zero_grad()

        crop_logits, disease_logits = model(images)
        loss, loss_dict = criterion(crop_logits, disease_logits, crop_targets, disease_targets)

        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss_sum += loss_dict["total_loss"].item() * batch_size
        crop_loss_sum += loss_dict["loss_crop"].item() * batch_size
        disease_loss_sum += loss_dict["loss_disease"].item() * batch_size
        total_samples += batch_size

        with torch.no_grad():
            crop_preds = torch.argmax(crop_logits, dim=-1).cpu().tolist()
            disease_preds = torch.argmax(disease_logits, dim=-1).cpu().tolist()
            all_crop_preds.extend(crop_preds)
            all_crop_targets.extend(crop_targets.cpu().tolist())
            all_disease_preds.extend(disease_preds)
            all_disease_targets.extend(disease_targets.cpu().tolist())

    metrics = compute_multitask_evaluation_metrics(
        all_crop_preds, all_crop_targets, all_disease_preds, all_disease_targets
    )
    denom = max(total_samples, 1)
    metrics["loss_total"] = total_loss_sum / denom
    metrics["loss_crop"] = crop_loss_sum / denom
    metrics["loss_disease"] = disease_loss_sum / denom
    return metrics


@torch.no_grad()
def evaluate_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Dict[str, float]:
    """Runs validation/testing evaluation."""
    model.eval()
    total_loss_sum = 0.0
    crop_loss_sum = 0.0
    disease_loss_sum = 0.0
    total_samples = 0

    all_crop_preds = []
    all_crop_targets = []
    all_disease_preds = []
    all_disease_targets = []

    for batch in dataloader:
        images, crop_targets, disease_targets = batch[:3]
        batch_size = images.size(0)
        images = images.to(device, non_blocking=True)
        crop_targets = crop_targets.to(device, non_blocking=True)
        disease_targets = disease_targets.to(device, non_blocking=True)

        crop_logits, disease_logits = model(images)
        loss, loss_dict = criterion(crop_logits, disease_logits, crop_targets, disease_targets)

        total_loss_sum += loss_dict["total_loss"].item() * batch_size
        crop_loss_sum += loss_dict["loss_crop"].item() * batch_size
        disease_loss_sum += loss_dict["loss_disease"].item() * batch_size
        total_samples += batch_size

        crop_preds = torch.argmax(crop_logits, dim=-1).cpu().tolist()
        disease_preds = torch.argmax(disease_logits, dim=-1).cpu().tolist()
        all_crop_preds.extend(crop_preds)
        all_crop_targets.extend(crop_targets.cpu().tolist())
        all_disease_preds.extend(disease_preds)
        all_disease_targets.extend(disease_targets.cpu().tolist())

    metrics = compute_multitask_evaluation_metrics(
        all_crop_preds, all_crop_targets, all_disease_preds, all_disease_targets
    )
    denom = max(total_samples, 1)
    metrics["loss_total"] = total_loss_sum / denom
    metrics["loss_crop"] = crop_loss_sum / denom
    metrics["loss_disease"] = disease_loss_sum / denom
    return metrics


def build_scheduler(optimizer: torch.optim.Optimizer, epochs: int, warmup_epochs: int = 3) -> torch.optim.lr_scheduler.SequentialLR:
    """Builds a composite scheduler with linear warmup followed by cosine annealing decay."""
    warmup_epochs = min(warmup_epochs, max(epochs - 1, 1))
    warmup_scheduler = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=0.1, end_factor=1.0, total_iters=warmup_epochs
    )
    cosine_scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=max(epochs - warmup_epochs, 1), eta_min=1e-6
    )
    return torch.optim.lr_scheduler.SequentialLR(
        optimizer,
        schedulers=[warmup_scheduler, cosine_scheduler],
        milestones=[warmup_epochs],
    )


def run_training(
    train_manifest: Path,
    val_manifest: Path,
    output_dir: Path = Path("ml-retrain-experimental/models"),
    root_dir: Optional[Path] = None,
    epochs: int = 25,
    batch_size: int = 32,
    lr: float = 1e-4,
    weight_decay: float = 1e-4,
    patience: int = 7,
    num_workers: int = 0,
    seed: int = 42,
    pretrained: bool = True,
    device: Optional[torch.device] = None,
) -> Dict[str, Any]:
    """
    Main training loop.
    """
    set_seed(seed)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using compute device: {device}")

    # Build DataLoaders
    loaders = create_dataloaders(
        train_manifest=train_manifest,
        val_manifest=val_manifest,
        batch_size=batch_size,
        num_workers=num_workers,
        root_dir=root_dir,
    )
    train_loader = loaders["train"]
    val_loader = loaders["val"]

    logger.info(f"Loaded {len(train_loader.dataset)} training samples and {len(val_loader.dataset)} validation samples.")

    # Initialize Model, Loss, Optimizer, Scheduler
    model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=pretrained).to(device)
    criterion = MultiTaskLoss(weight_crop=0.4, weight_disease=0.6, label_smoothing=0.1)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = build_scheduler(optimizer, epochs=epochs, warmup_epochs=3)

    checkpoint_path = output_dir / "best_multitask_model.pth"
    early_stopping = EarlyStopping(
        patience=patience, min_delta=0.001, checkpoint_path=checkpoint_path, mode="max"
    )

    history: List[Dict[str, Any]] = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        current_lr = optimizer.param_groups[0]["lr"]

        train_metrics = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_metrics = evaluate_one_epoch(model, val_loader, criterion, device)
        scheduler.step()

        epoch_duration = time.time() - epoch_start
        epoch_record = {
            "epoch": epoch,
            "lr": current_lr,
            "duration_sec": epoch_duration,
            "train": train_metrics,
            "val": val_metrics,
        }
        history.append(epoch_record)

        logger.info(
            f"Epoch {epoch:02d}/{epochs:02d} [{epoch_duration:.1f}s] - "
            f"Train Loss: {train_metrics['loss_total']:.4f} (Joint Acc: {train_metrics['joint_accuracy']*100:.1f}%) | "
            f"Val Loss: {val_metrics['loss_total']:.4f} (Joint Acc: {val_metrics['joint_accuracy']*100:.1f}%, "
            f"Disease F1: {val_metrics['disease_macro_f1']*100:.1f}%)"
        )

        improved = early_stopping.step(
            score=val_metrics["joint_accuracy"],
            model=model,
            optimizer=optimizer,
            epoch=epoch,
            metrics=val_metrics,
        )

        if early_stopping.early_stop:
            logger.info(f"Early stopping triggered at Epoch {epoch}. Best Epoch was {early_stopping.best_epoch}.")
            break

    total_time = time.time() - start_time
    logger.info(f"Training completed in {total_time/60:.2f} minutes.")

    # Reload best checkpoint weights into model before exiting
    if checkpoint_path.exists():
        best_ckpt = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(best_ckpt["model_state_dict"])
        logger.info(f"Reloaded best model weights from Epoch {early_stopping.best_epoch} into in-memory model.")

    # Save history
    history_file = output_dir / "training_history.json"
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "best_epoch": early_stopping.best_epoch,
                "best_score": early_stopping.best_score,
                "total_duration_sec": total_time,
                "epochs": history,
            },
            f,
            indent=2,
        )

    return {
        "best_epoch": early_stopping.best_epoch,
        "best_score": early_stopping.best_score,
        "history_file": str(history_file),
        "checkpoint_file": str(checkpoint_path),
        "model": model,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Multi-Task MobileNetV3-Large Training Harness")
    parser.add_argument("--train-manifest", type=str, default="ml-retrain-experimental/data/manifests/train_manifest.json")
    parser.add_argument("--val-manifest", type=str, default="ml-retrain-experimental/data/manifests/val_manifest.json")
    parser.add_argument("--root-dir", type=str, default=None)
    parser.add_argument("--output-dir", type=str, default="ml-retrain-experimental/models")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=7)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_training(
        train_manifest=Path(args.train_manifest),
        val_manifest=Path(args.val_manifest),
        output_dir=Path(args.output_dir),
        root_dir=Path(args.root_dir) if args.root_dir else None,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        weight_decay=args.weight_decay,
        patience=args.patience,
        num_workers=args.num_workers,
        seed=args.seed,
    )
