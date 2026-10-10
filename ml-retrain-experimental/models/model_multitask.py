"""
Multi-Task Dual-Head MobileNetV3-Large Architecture.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).

Architecture:
- Shared Backbone: MobileNetV3-Large (Feature dimension: 960)
- Head 1 (Crop Species): 4 classes (Apple, Corn, Potato, Tomato)
  Captures macro-morphological cues (leaf lobes, edge serration, venation).
- Head 2 (Disease Pathology): 8 classes (Healthy, Early Blight, Late Blight, Bacterial Spot,
  Common Rust, Northern Leaf Blight, Cedar Apple Rust, Apple Scab).
  Captures micro-morphological pathology lesions.
- MultiTaskLoss: Combined cross-entropy with label smoothing (0.1) and task weighting:
  Total Loss = 0.4 * Loss_crop + 0.6 * Loss_disease.
"""

from typing import Tuple, Dict, Any, Optional, List, Sequence, Union
import numpy as np
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights
from sklearn.metrics import f1_score, accuracy_score


class MultiTaskPlantClassifier(nn.Module):
    """
    Dual-Head MobileNetV3-Large Classifier for Plant Disease Diagnosis.
    """

    def __init__(
        self,
        num_crops: int = 4,
        num_diseases: int = 8,
        pretrained: bool = True,
        dropout_rate: float = 0.2,
    ) -> None:
        super().__init__()
        self.num_crops = num_crops
        self.num_diseases = num_diseases

        weights = MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        base_model = mobilenet_v3_large(weights=weights)

        # 1. Shared Feature Extractor
        self.features = base_model.features
        self.avgpool = base_model.avgpool

        # Dynamic feature depth inspection from base classifier
        in_features = getattr(base_model.classifier[0], "in_features", 960)

        # 2. Crop Species Head (Macro-morphology)
        self.crop_head = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(256, num_crops),
        )

        # 3. Disease Pathology Head (Micro-morphology lesions)
        self.disease_head = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(512, num_diseases),
        )

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts the 960-dimensional pooled feature representations."""
        feat = self.features(x)
        feat = self.avgpool(feat)
        return torch.flatten(feat, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass yielding raw logits for both tasks.
        Compatible with ONNX dynamic batch tracing.
        Returns:
            crop_logits: torch.Tensor of shape (B, num_crops)
            disease_logits: torch.Tensor of shape (B, num_diseases)
        """
        feat = self.extract_features(x)
        crop_logits = self.crop_head(feat)
        disease_logits = self.disease_head(feat)
        return crop_logits, disease_logits

    @torch.no_grad()
    def predict_probabilities(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Returns softmax probability distributions for both heads.
        Guarantees eval mode during inference and restores prior training state.
        """
        was_training = self.training
        self.eval()
        try:
            crop_logits, disease_logits = self.forward(x)
            crop_probs = torch.softmax(crop_logits, dim=-1)
            disease_probs = torch.softmax(disease_logits, dim=-1)
            return {
                "crop_probabilities": crop_probs,
                "disease_probabilities": disease_probs,
            }
        finally:
            if was_training:
                self.train()


class MultiTaskLoss(nn.Module):
    """
    Weighted Multi-Task Loss combining Crop Cross-Entropy and Disease Cross-Entropy
    with label smoothing for field boundary noise invariance.
    """

    def __init__(
        self,
        weight_crop: float = 0.4,
        weight_disease: float = 0.6,
        label_smoothing: float = 0.1,
    ) -> None:
        super().__init__()
        self.weight_crop = weight_crop
        self.weight_disease = weight_disease
        self.criterion_crop = nn.CrossEntropyLoss(label_smoothing=label_smoothing)
        self.criterion_disease = nn.CrossEntropyLoss(label_smoothing=label_smoothing)

    def forward(
        self,
        crop_logits: torch.Tensor,
        disease_logits: torch.Tensor,
        crop_targets: torch.Tensor,
        disease_targets: torch.Tensor,
    ) -> Tuple[torch.Tensor, Dict[str, Any]]:
        loss_crop = self.criterion_crop(crop_logits, crop_targets)
        loss_disease = self.criterion_disease(disease_logits, disease_targets)

        total_loss = (self.weight_crop * loss_crop) + (self.weight_disease * loss_disease)

        metrics = {
            "loss_crop": loss_crop.detach(),
            "loss_disease": loss_disease.detach(),
            "total_loss": total_loss.detach(),
        }
        return total_loss, metrics


def _to_list(val: Union[Sequence[int], torch.Tensor, np.ndarray]) -> List[int]:
    """Helper to convert tensors, numpy arrays, or sequences to Python lists."""
    if isinstance(val, torch.Tensor):
        return val.detach().cpu().tolist()
    if isinstance(val, np.ndarray):
        return val.tolist()
    return list(val)


def compute_multitask_evaluation_metrics(
    crop_preds: Union[Sequence[int], torch.Tensor, np.ndarray],
    crop_targets: Union[Sequence[int], torch.Tensor, np.ndarray],
    disease_preds: Union[Sequence[int], torch.Tensor, np.ndarray],
    disease_targets: Union[Sequence[int], torch.Tensor, np.ndarray],
) -> Dict[str, float]:
    """
    Computes Crop Accuracy, Disease Accuracy, Joint Accuracy, and Macro F1 scores.
    Accepts Python lists, numpy arrays, or PyTorch tensors.
    """
    cp = _to_list(crop_preds)
    ct = _to_list(crop_targets)
    dp = _to_list(disease_preds)
    dt = _to_list(disease_targets)

    n = len(ct)
    if n == 0:
        return {
            "crop_accuracy": 0.0,
            "crop_macro_f1": 0.0,
            "disease_accuracy": 0.0,
            "disease_macro_f1": 0.0,
            "joint_accuracy": 0.0,
        }

    if not (len(cp) == n == len(dp) == len(dt)):
        raise ValueError(
            f"Length mismatch: crop_targets ({n}), crop_preds ({len(cp)}), "
            f"disease_targets ({len(dt)}), disease_preds ({len(dp)})"
        )

    crop_acc = accuracy_score(ct, cp)
    disease_acc = accuracy_score(dt, dp)

    # Joint accuracy: both crop AND disease predicted accurately for the same leaf sample
    joint_correct = sum(
        1 for c_pred, c_true, d_pred, d_true in zip(cp, ct, dp, dt)
        if c_pred == c_true and d_pred == d_true
    )
    joint_acc = joint_correct / n

    crop_macro_f1 = f1_score(ct, cp, average="macro", zero_division=0)
    disease_macro_f1 = f1_score(dt, dp, average="macro", zero_division=0)

    return {
        "crop_accuracy": float(crop_acc),
        "crop_macro_f1": float(crop_macro_f1),
        "disease_accuracy": float(disease_acc),
        "disease_macro_f1": float(disease_macro_f1),
        "joint_accuracy": float(joint_acc),
    }
