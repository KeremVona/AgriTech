"""
Precision AgriTech - PlantVillage + PlantDoc Hybrid Dataset Ingestion & Balancing Pipeline.
Merges lab-controlled PlantVillage images with in-the-wild PlantDoc field images.

Key Capabilities:
1. Strict Class Mapping: Translates diverse PlantDoc folder conventions to target taxonomy.
2. Balanced Sampling: Caps PlantVillage samples to prevent overwhelming PlantDoc field images.
3. Multi-Task Labeling: Generates dual-target metadata (crop_idx, disease_idx).
4. Zero Data Leakage: SHA-256 hash checking guarantees no sample overlap across train/val/test.
5. Deterministic Stratified Split: 70% Train, 15% Val, 15% Test.
"""

import os
import sys
import json
import shutil
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

from PIL import Image, UnidentifiedImageError
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------------------------
# Target Taxonomy & Class Mappings
# ---------------------------------------------------------------------------

TARGET_CLASSES: List[str] = [
    # Tomato (4 classes)
    "Tomato___healthy",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Bacterial_spot",
    # Potato (3 classes)
    "Potato___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    # Corn (Maize) (3 classes)
    "Corn_(maize)___healthy",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    # Apple (2 classes)
    "Apple___healthy",
    "Apple___Cedar_apple_rust",
]

# PlantDoc label variations mapped to our 12 canonical target classes
PLANTDOC_TO_TARGET_MAP: Dict[str, str] = {
    # Tomato
    "Tomato leaf": "Tomato___healthy",
    "Tomato_leaf": "Tomato___healthy",
    "tomato leaf": "Tomato___healthy",
    "Tomato Early blight leaf": "Tomato___Early_blight",
    "Tomato_Early_blight_leaf": "Tomato___Early_blight",
    "tomato early blight": "Tomato___Early_blight",
    "Tomato leaf late blight": "Tomato___Late_blight",
    "Tomato_leaf_late_blight": "Tomato___Late_blight",
    "tomato late blight": "Tomato___Late_blight",
    "Tomato leaf bacterial spot": "Tomato___Bacterial_spot",
    "Tomato_leaf_bacterial_spot": "Tomato___Bacterial_spot",
    "tomato bacterial spot": "Tomato___Bacterial_spot",
    
    # Potato
    "Potato leaf": "Potato___healthy",
    "Potato_leaf": "Potato___healthy",
    "potato leaf": "Potato___healthy",
    "Potato leaf early blight": "Potato___Early_blight",
    "Potato_leaf_early_blight": "Potato___Early_blight",
    "potato early blight": "Potato___Early_blight",
    "patato early blight": "Potato___Early_blight",
    "Potato leaf late blight": "Potato___Late_blight",
    "Potato_leaf_late_blight": "Potato___Late_blight",
    "potato late blight": "Potato___Late_blight",
    "patato late blight": "Potato___Late_blight",
    
    # Corn
    "Corn leaf": "Corn_(maize)___healthy",
    "Corn_leaf": "Corn_(maize)___healthy",
    "corn leaf": "Corn_(maize)___healthy",
    "Corn rust leaf": "Corn_(maize)___Common_rust_",
    "Corn_rust_leaf": "Corn_(maize)___Common_rust_",
    "corn rust": "Corn_(maize)___Common_rust_",
    "Corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_leaf_blight": "Corn_(maize)___Northern_Leaf_Blight",
    "corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    
    # Apple
    "Apple leaf": "Apple___healthy",
    "Apple_leaf": "Apple___healthy",
    "apple leaf": "Apple___healthy",
    "Apple rust leaf": "Apple___Cedar_apple_rust",
    "Apple_rust_leaf": "Apple___Cedar_apple_rust",
    "apple rust": "Apple___Cedar_apple_rust",
    "Apple Scab Leaf": "Apple___Cedar_apple_rust",  # Folded into apple pathology
    "Apple_Scab_Leaf": "Apple___Cedar_apple_rust",
}

# Multi-Task Label Encodings
CROP_TAXONOMY: Dict[str, int] = {
    "Apple": 0,
    "Corn": 1,
    "Potato": 2,
    "Tomato": 3,
}

DISEASE_TAXONOMY: Dict[str, int] = {
    "Healthy": 0,
    "Early Blight": 1,
    "Late Blight": 2,
    "Bacterial Spot": 3,
    "Common Rust": 4,
    "Northern Leaf Blight": 5,
    "Cedar Apple Rust": 6,
    "Apple Scab": 7,
}

CLASS_TO_MULTITASK: Dict[str, Dict[str, int]] = {
    "Apple___healthy":                     {"crop_idx": 0, "disease_idx": 0},
    "Apple___Cedar_apple_rust":            {"crop_idx": 0, "disease_idx": 6},
    "Corn_(maize)___healthy":              {"crop_idx": 1, "disease_idx": 0},
    "Corn_(maize)___Common_rust_":         {"crop_idx": 1, "disease_idx": 4},
    "Corn_(maize)___Northern_Leaf_Blight": {"crop_idx": 1, "disease_idx": 5},
    "Potato___healthy":                    {"crop_idx": 2, "disease_idx": 0},
    "Potato___Early_blight":               {"crop_idx": 2, "disease_idx": 1},
    "Potato___Late_blight":                {"crop_idx": 2, "disease_idx": 2},
    "Tomato___healthy":                    {"crop_idx": 3, "disease_idx": 0},
    "Tomato___Early_blight":               {"crop_idx": 3, "disease_idx": 1},
    "Tomato___Late_blight":                {"crop_idx": 3, "disease_idx": 2},
    "Tomato___Bacterial_spot":             {"crop_idx": 3, "disease_idx": 3},
}


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def calculate_sha256(file_path: Path) -> str:
    """Calculates SHA-256 hash of an image file to prevent data duplication and leakage."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_image_file(image_path: Path, min_resolution: Tuple[int, int] = (150, 150)) -> Tuple[bool, str]:
    """Validates image integrity, RGB channels, and minimum dimensions."""
    try:
        with Image.open(image_path) as img:
            img.verify()
        # Re-open for mode/size check
        with Image.open(image_path) as img:
            if img.mode != "RGB":
                return False, f"Invalid color mode '{img.mode}', expected 'RGB'"
            width, height = img.size
            if width < min_resolution[0] or height < min_resolution[1]:
                return False, f"Resolution {width}x{height} below minimum {min_resolution[0]}x{min_resolution[1]}"
        return True, "Valid"
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        return False, f"Corrupted or invalid image: {exc}"


# ---------------------------------------------------------------------------
# Dataset Discovery & Balancing
# ---------------------------------------------------------------------------

def discover_plantvillage_samples(
    pv_dir: Path,
    max_per_class: int = 700,
) -> Dict[str, List[Path]]:
    """
    Discovers samples from PlantVillage directory, capped at max_per_class
    to balance with field samples and prevent laboratory background dominance.
    """
    class_samples: Dict[str, List[Path]] = {cls_name: [] for cls_name in TARGET_CLASSES}
    if not pv_dir.exists():
        return class_samples

    for class_folder in pv_dir.iterdir():
        if not class_folder.is_dir() or class_folder.name not in TARGET_CLASSES:
            continue
        
        target_name = class_folder.name
        images = sorted([
            p for p in class_folder.iterdir()
            if p.is_file() and p.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]
        ])
        
        # Take up to max_per_class
        selected = images[:max_per_class]
        class_samples[target_name].extend(selected)

    return class_samples


def discover_plantdoc_samples(
    plantdoc_dir: Path,
) -> Dict[str, List[Path]]:
    """
    Discovers field samples from PlantDoc directory and maps labels
    to our target 12 classes using PLANTDOC_TO_TARGET_MAP.
    100% of validated field samples are preserved.
    """
    class_samples: Dict[str, List[Path]] = {cls_name: [] for cls_name in TARGET_CLASSES}
    if not plantdoc_dir.exists():
        return class_samples

    # Traverse all subdirectories (handles flat or nested train/test structures in PlantDoc)
    for folder in plantdoc_dir.rglob("*"):
        if not folder.is_dir():
            continue
        folder_name = folder.name
        target_class = PLANTDOC_TO_TARGET_MAP.get(folder_name)
        if not target_class:
            continue

        images = [
            p for p in folder.iterdir()
            if p.is_file() and p.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]
        ]
        class_samples[target_class].extend(images)

    return class_samples


def build_hybrid_manifest(
    pv_dir: Path,
    plantdoc_dir: Path,
    max_pv_per_class: int = 700,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Combines PlantVillage and PlantDoc samples into a unified manifest
    with domain tagging and SHA-256 deduplication.
    """
    pv_samples = discover_plantvillage_samples(pv_dir, max_per_class=max_pv_per_class)
    pd_samples = discover_plantdoc_samples(plantdoc_dir)

    manifest: List[Dict[str, Any]] = []
    seen_hashes: set = set()
    stats: Dict[str, Any] = {
        cls_name: {"plantvillage": 0, "plantdoc": 0, "total": 0}
        for cls_name in TARGET_CLASSES
    }

    # 1. Add PlantDoc field samples first (highest priority)
    for cls_name, paths in pd_samples.items():
        for path in paths:
            is_valid, _ = validate_image_file(path)
            if not is_valid:
                continue
            h = calculate_sha256(path)
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            entry = {
                "source_path": str(path),
                "file_hash": h,
                "domain": "plantdoc_field",
                "canonical_class": cls_name,
                "crop_idx": CLASS_TO_MULTITASK[cls_name]["crop_idx"],
                "disease_idx": CLASS_TO_MULTITASK[cls_name]["disease_idx"],
            }
            manifest.append(entry)
            stats[cls_name]["plantdoc"] += 1
            stats[cls_name]["total"] += 1

    # 2. Add PlantVillage samples up to cap
    for cls_name, paths in pv_samples.items():
        for path in paths:
            is_valid, _ = validate_image_file(path)
            if not is_valid:
                continue
            h = calculate_sha256(path)
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            entry = {
                "source_path": str(path),
                "file_hash": h,
                "domain": "plantvillage_lab",
                "canonical_class": cls_name,
                "crop_idx": CLASS_TO_MULTITASK[cls_name]["crop_idx"],
                "disease_idx": CLASS_TO_MULTITASK[cls_name]["disease_idx"],
            }
            manifest.append(entry)
            stats[cls_name]["plantvillage"] += 1
            stats[cls_name]["total"] += 1

    return manifest, stats


# ---------------------------------------------------------------------------
# Stratified Split (70 / 15 / 15) with Zero Leakage
# ---------------------------------------------------------------------------

def split_hybrid_manifest(
    manifest: List[Dict[str, Any]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Performs deterministic stratified split by canonical_class while preserving
    domain representation across train, val, and test splits.
    """
    if abs(train_ratio + val_ratio + test_ratio - 1.0) > 1e-5:
        raise ValueError("Ratios must sum to 1.0")

    labels = [item["canonical_class"] for item in manifest]

    # Split Train vs (Val + Test)
    train_items, temp_items = train_test_split(
        manifest,
        train_size=train_ratio,
        stratify=labels,
        random_state=random_seed,
    )

    # Split Val vs Test (50/50 of remainder)
    temp_labels = [item["canonical_class"] for item in temp_items]
    relative_val_size = val_ratio / (val_ratio + test_ratio)
    val_items, test_items = train_test_split(
        temp_items,
        train_size=relative_val_size,
        stratify=temp_labels,
        random_state=random_seed,
    )

    # Verify zero hash leakage
    train_hashes = {x["file_hash"] for x in train_items}
    val_hashes = {x["file_hash"] for x in val_items}
    test_hashes = {x["file_hash"] for x in test_items}

    assert len(train_hashes.intersection(val_hashes)) == 0, "Train-Val leakage detected!"
    assert len(train_hashes.intersection(test_hashes)) == 0, "Train-Test leakage detected!"
    assert len(val_hashes.intersection(test_hashes)) == 0, "Val-Test leakage detected!"

    return train_items, val_items, test_items


def export_split_dataset(
    train_items: List[Dict[str, Any]],
    val_items: List[Dict[str, Any]],
    test_items: List[Dict[str, Any]],
    output_dir: Path,
    copy_files: bool = True,
) -> Dict[str, Any]:
    """Exports structured directory hierarchy with image files and metadata manifest."""
    output_dir.mkdir(parents=True, exist_ok=True)
    summary: Dict[str, Any] = {
        "splits": {
            "train": len(train_items),
            "val": len(val_items),
            "test": len(test_items),
            "total": len(train_items) + len(val_items) + len(test_items),
        },
        "target_classes": TARGET_CLASSES,
        "class_to_multitask": CLASS_TO_MULTITASK,
    }

    if copy_files:
        for split_name, items in [("train", train_items), ("val", val_items), ("test", test_items)]:
            split_dir = output_dir / split_name
            for item in items:
                dest_dir = split_dir / item["canonical_class"]
                dest_dir.mkdir(parents=True, exist_ok=True)
                src = Path(item["source_path"])
                dest = dest_dir / f"{item['domain']}_{src.name}"
                shutil.copy2(src, dest)

    # Save metadata JSON
    manifest_file = output_dir / "hybrid_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "summary": summary,
                "train": train_items,
                "val": val_items,
                "test": test_items,
            },
            f,
            indent=2,
        )

    return summary
