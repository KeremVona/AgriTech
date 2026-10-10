"""
PyTorch Multi-Task Dataset and In-Field Data Augmentation Pipeline.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).

Features:
1. MultiTaskDataset: Loads images from manifest JSON and yields (image, crop_target, disease_target).
2. Dynamic Resize: Scales validation/test resize proportionally to any target resolution.
3. In-Field Augmentations:
   - RandomResizedCrop (scale=(0.7, 1.0))
   - ColorJitter (brightness/contrast/saturation/hue variation for field sun/shadow)
   - RandomErasing (simulates occlusions, prevents leaf-border shortcut learning)
   - ImageNet Normalization
4. Low Collation Overhead: return_metadata defaults to False for maximum training loop throughput.
5. Cross-Platform Root Resolution: Supports relative paths via root_dir.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Callable, Union

import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image


# ---------------------------------------------------------------------------
# Augmentation Transforms
# ---------------------------------------------------------------------------

def get_train_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Constructs robust training augmentation pipeline designed to overcome
    domain shift on complex field backgrounds (soil, weeds, shadows, occlusions).
    """
    return transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.7, 1.0), interpolation=transforms.InterpolationMode.BILINEAR),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.2, hue=0.05),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.25, scale=(0.02, 0.20), ratio=(0.3, 3.3), value="random"),
    ])


def get_val_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Deterministic validation and test transforms. Dynamically calculates resize dimension.
    """
    resize_size = int(round(image_size * (256.0 / 224.0)))
    return transforms.Compose([
        transforms.Resize(resize_size, interpolation=transforms.InterpolationMode.BILINEAR),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


# ---------------------------------------------------------------------------
# PyTorch Multi-Task Dataset
# ---------------------------------------------------------------------------

class MultiTaskDataset(Dataset):
    """
    Dataset for Dual-Head Multi-Task Plant Classification.
    Yields:
        image: torch.Tensor of shape (3, H, W)
        crop_target: torch.Tensor scalar (int64) - Crop Species (0..3)
        disease_target: torch.Tensor scalar (int64) - Pathology Condition (0..7)
        (optional if return_metadata=True) metadata: Dict
    """

    def __init__(
        self,
        manifest: Any,
        transform: Optional[Callable] = None,
        root_dir: Optional[Union[str, Path]] = None,
        return_metadata: bool = False,
    ):
        """
        Args:
            manifest: Either a Path/str pointing to manifest.json, or an in-memory List[Dict].
            transform: Optional torchvision transform to apply.
            root_dir: Optional root directory to prepend to relative paths.
            return_metadata: If True, returns a 4-tuple including metadata dict. Default False for speed.
        """
        if isinstance(manifest, (str, Path)):
            manifest_path = Path(manifest)
            if not manifest_path.exists():
                raise FileNotFoundError(f"Manifest file not found: {manifest_path}")
            with open(manifest_path, "r", encoding="utf-8") as f:
                self.records: List[Dict[str, Any]] = json.load(f)
        elif isinstance(manifest, list):
            self.records = manifest
        else:
            raise TypeError(f"Expected manifest path or list, got {type(manifest)}")

        self.transform = transform
        self.root_dir = Path(root_dir) if root_dir is not None else None
        self.return_metadata = return_metadata

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Union[Tuple[torch.Tensor, torch.Tensor, torch.Tensor], Tuple[torch.Tensor, torch.Tensor, torch.Tensor, Dict[str, Any]]]:
        record = self.records[idx]
        file_path = Path(record["file_path"])

        if self.root_dir and not file_path.is_absolute():
            file_path = self.root_dir / file_path

        try:
            with Image.open(file_path) as img:
                img = img.convert("RGB")
                if self.transform:
                    image_tensor = self.transform(img)
                else:
                    image_tensor = transforms.ToTensor()(img)
        except Exception as e:
            raise IOError(f"Failed to load image at index {idx} ({file_path}): {e}")

        crop_target = torch.tensor(record["crop_idx"], dtype=torch.long)
        disease_target = torch.tensor(record["disease_idx"], dtype=torch.long)

        if self.return_metadata:
            metadata = {
                "canonical_class": record.get("canonical_class", ""),
                "domain": record.get("domain", "unknown"),
                "source_dataset": record.get("source_dataset", "unknown"),
                "file_path": str(file_path.as_posix()),
            }
            return image_tensor, crop_target, disease_target, metadata

        return image_tensor, crop_target, disease_target


# ---------------------------------------------------------------------------
# DataLoader Factory
# ---------------------------------------------------------------------------

def create_dataloaders(
    train_manifest: Any,
    val_manifest: Any,
    test_manifest: Optional[Any] = None,
    batch_size: int = 32,
    num_workers: int = 0,
    image_size: int = 224,
    root_dir: Optional[Union[str, Path]] = None,
    pin_memory: Optional[bool] = None,
    return_metadata: bool = False,
) -> Dict[str, DataLoader]:
    """
    Creates PyTorch DataLoaders for train, val, and test splits.
    """
    if pin_memory is None:
        pin_memory = torch.cuda.is_available()

    train_ds = MultiTaskDataset(
        train_manifest,
        transform=get_train_transforms(image_size),
        root_dir=root_dir,
        return_metadata=return_metadata,
    )
    val_ds = MultiTaskDataset(
        val_manifest,
        transform=get_val_transforms(image_size),
        root_dir=root_dir,
        return_metadata=return_metadata,
    )

    loaders = {
        "train": DataLoader(
            train_ds,
            batch_size=batch_size,
            shuffle=True,
            num_workers=num_workers,
            pin_memory=pin_memory,
            drop_last=True if len(train_ds) > batch_size else False,
        ),
        "val": DataLoader(
            val_ds,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=pin_memory,
        ),
    }

    if test_manifest is not None:
        test_ds = MultiTaskDataset(
            test_manifest,
            transform=get_val_transforms(image_size),
            root_dir=root_dir,
            return_metadata=return_metadata,
        )
        loaders["test"] = DataLoader(
            test_ds,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            pin_memory=pin_memory,
        )

    return loaders
