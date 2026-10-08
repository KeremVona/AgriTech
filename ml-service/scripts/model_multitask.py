"""
Precision AgriTech - Multi-Task Dual-Head MobileNetV3-Large Architecture.
Shares a single convolutional backbone to predict both Crop Species (4 classes)
and Pathology Condition (8 classes) simultaneously.
"""

from typing import Tuple, Dict, Any, Optional
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights
from sklearn.metrics import f1_score, accuracy_score


class MultiTaskPlantClassifier(nn.Module):
    """
    Dual-Head MobileNetV3-Large Classifier.
    - Head 1 (Crop Species): 4 classes (Apple, Corn, Potato, Tomato)
      Enforces macro-morphology learning (leaf lobes, serrated vs entire margins, venation).
    - Head 2 (Disease Pathology): 8 classes (Healthy, Early Blight, Late Blight, Bacterial Spot,
      Common Rust, Northern Leaf Blight, Cedar Apple Rust, Apple Scab).
      Enforces micro-morphology lesion pattern learning.
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

        # MobileNetV3-Large last convolutional feature depth is 960
        in_features = 960

        # 2. Crop Species Head (Macro-morphology)
        self.crop_head = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(256, num_crops),
        )

        # 3. Disease Pathology Head (Micro-morphology)
        self.disease_head = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(512, num_diseases),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass producing raw logits for both tasks.
        Returns:
            (crop_logits [B, num_crops], disease_logits [B, num_diseases])
        """
        feat = self.features(x)
        feat = self.avgpool(feat)
        feat = torch.flatten(feat, 1)

        crop_logits = self.crop_head(feat)
        disease_logits = self.disease_head(feat)

        return crop_logits, disease_logits

    @torch.no_grad()
    def predict_probabilities(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Returns softmax probability distributions for both heads."""
        crop_logits, disease_logits = self.forward(x)
        crop_probs = torch.softmax(crop_logits, dim=-1)
        disease_probs = torch.softmax(disease_logits, dim=-1)
        return {
            "crop_probabilities": crop_probs,
            "disease_probabilities": disease_probs,
        }


class MultiTaskLoss(nn.Module):
    """
    Weighted Multi-Task Loss combining Crop Cross-Entropy and Disease Cross-Entropy.
    Formula:
        Loss = weight_crop * Loss_crop + weight_disease * Loss_disease
    """

    def __init__(
        self,
        weight_crop: float = 0.4,
        weight_disease: float = 0.6,
        label_smoothing: float = 0.05,
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
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        loss_crop = self.criterion_crop(crop_logits, crop_targets)
        loss_disease = self.criterion_disease(disease_logits, disease_targets)

        total_loss = (self.weight_crop * loss_crop) + (self.weight_disease * loss_disease)

        metrics = {
            "loss_crop": float(loss_crop.item()),
            "loss_disease": float(loss_disease.item()),
            "total_loss": float(total_loss.item()),
        }
        return total_loss, metrics


def compute_multitask_evaluation_metrics(
    crop_preds: list,
    crop_targets: list,
    disease_preds: list,
    disease_targets: list,
) -> Dict[str, float]:
    """Computes Crop Accuracy, Disease Accuracy, Joint Accuracy, and Disease Macro F1."""
    crop_acc = accuracy_score(crop_targets, crop_preds)
    disease_acc = accuracy_score(disease_targets, disease_preds)

    # Joint accuracy: both crop and disease predicted correctly for the same sample
    joint_correct = sum(
        1 for cp, ct, dp, dt in zip(crop_preds, crop_targets, disease_preds, disease_targets)
        if cp == ct and dp == dt
    )
    joint_acc = joint_correct / len(crop_targets) if crop_targets else 0.0

    disease_macro_f1 = f1_score(disease_targets, disease_preds, average="macro", zero_division=0)
    crop_macro_f1 = f1_score(crop_targets, crop_preds, average="macro", zero_division=0)

    return {
        "crop_accuracy": float(crop_acc),
        "crop_macro_f1": float(crop_macro_f1),
        "disease_accuracy": float(disease_acc),
        "disease_macro_f1": float(disease_macro_f1),
        "joint_accuracy": float(joint_acc),
    }
