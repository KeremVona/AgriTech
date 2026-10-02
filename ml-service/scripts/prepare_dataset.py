"""
Dataset Preparation, Filtering, and Validation Pipeline for PlantVillage Dataset.
Precision AgriTech Platform - Phase 1 (TODO-101).

Implements:
1. Targeted filtering to 12 crop-disease classes across 4 staple crops.
2. Deterministic, stratified 70/15/15 dataset splitting (train, val, test).
3. Image validation pass (corrupt header detection, non-RGB channel rejection, minimum resolution verification >= 224x224).
4. Zero-label leakage verification via SHA-256 image content hashing.
"""

import os
import sys
import shutil
import hashlib
import random
import argparse
from pathlib import Path
from typing import List, Tuple, Dict, Set
from PIL import Image, UnidentifiedImageError

# The 12 target crop-disease classes defined in Phase 1 specifications:
# Tomato (4): Healthy, Early Blight, Late Blight, Bacterial Spot
# Potato (3): Healthy, Early Blight, Late Blight
# Corn (Maize) (3): Healthy, Common Rust, Northern Leaf Blight
# Apple (3 minus 1 healthy shared -> 2 disease + 1 healthy = 3, or Apple Scab & Cedar Apple Rust):
TARGET_CLASSES = [
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
    # Apple (2 disease classes, 1 healthy) -> 12 total classes
    "Apple___healthy",
    "Apple___Cedar_apple_rust",
    # Note: "Apple___Apple_scab" can also be aliased or included
]


def calculate_file_hash(file_path: Path) -> str:
    """Calculates SHA-256 hash of image file contents to detect duplicates/leakage."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_image(image_path: Path, min_resolution: Tuple[int, int] = (224, 224)) -> Tuple[bool, str]:
    """
    Validates an image file:
    1. Checks if file can be opened and decoded as a valid image (rejects corrupt headers).
    2. Enforces RGB channel format (rejects grayscale, RGBA, CMYK, etc.).
    3. Enforces minimum resolution (default: 224x224).

    Returns:
        (is_valid, rejection_reason)
    """
    try:
        with Image.open(image_path) as img:
            img.verify()  # Verifies header and stream integrity

        # reopen to read properties and decode image data
        with Image.open(image_path) as img:
            img.load()

            if img.mode != "RGB":
                return False, f"Unsupported color mode: {img.mode} (expected RGB)"

            width, height = img.size
            min_w, min_h = min_resolution
            if width < min_w or height < min_h:
                return False, f"Resolution {width}x{height} is below minimum {min_w}x{min_h}"

            return True, ""
    except (UnidentifiedImageError, OSError, SyntaxError) as e:
        return False, f"Corrupted or invalid image file: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error during validation: {str(e)}"


def deterministic_stratified_split(
    items: List[str],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> Tuple[List[str], List[str], List[str]]:
    """
    Splits a list of items deterministically into train, val, and test partitions
    according to specified ratios (default 70 / 15 / 15).
    """
    if abs((train_ratio + val_ratio + test_ratio) - 1.0) > 1e-5:
        raise ValueError("Split ratios must sum to 1.0")

    # Sort first to ensure deterministic baseline regardless of filesystem iteration order
    sorted_items = sorted(items)

    rng = random.Random(seed)
    shuffled_items = sorted_items.copy()
    rng.shuffle(shuffled_items)

    total = len(shuffled_items)
    train_end = int(round(total * train_ratio))
    val_end = train_end + int(round(total * val_ratio))

    # Adjust rounding discrepancy for test split if needed
    train = shuffled_items[:train_end]
    val = shuffled_items[train_end:val_end]
    test = shuffled_items[val_end:]

    return train, val, test


def check_label_leakage(dataset_dir: Path) -> Tuple[bool, List[str]]:
    """
    Verifies that no identical images exist across train, val, and test splits.
    Uses SHA-256 content hashing.

    Returns:
        (has_leakage, list_of_duplicate_reports)
    """
    hashes: Dict[str, Tuple[str, str]] = {}  # hash -> (split, relative_path)
    leakage_reports: List[str] = []

    splits = ["train", "val", "test"]
    for split in splits:
        split_dir = dataset_dir / split
        if not split_dir.exists():
            continue

        for file_path in split_dir.rglob("*"):
            if file_path.is_file():
                file_hash = calculate_file_hash(file_path)
                rel_path = file_path.relative_to(dataset_dir)

                if file_hash in hashes:
                    prev_split, prev_rel = hashes[file_hash]
                    if prev_split != split:
                        leakage_reports.append(
                            f"LEAKAGE DETECTED: File {rel_path} in '{split}' has identical content to {prev_rel} in '{prev_split}' (hash: {file_hash[:12]})"
                        )
                else:
                    hashes[file_hash] = (split, str(rel_path))

    return len(leakage_reports) > 0, leakage_reports


def prepare_dataset_pipeline(
    raw_dir: Path,
    output_dir: Path,
    min_resolution: Tuple[int, int] = (224, 224),
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> Dict[str, any]:
    """
    Executes full dataset preparation:
    - Filters to TARGET_CLASSES
    - Rejects corrupt, low-res, non-RGB images
    - Stratified deterministic 70/15/15 split per class
    - Copies files into output_dir/{train,val,test}/{class_name}/
    - Performs zero-leakage check
    """
    raw_dir = Path(raw_dir)
    output_dir = Path(output_dir)

    # Initialize destination directory structure with all 12 classes
    splits = ["train", "val", "test"]
    for split in splits:
        for class_name in TARGET_CLASSES:
            (output_dir / split / class_name).mkdir(parents=True, exist_ok=True)

    total_inspected = 0
    valid_count = 0
    rejected_count = 0
    rejections: List[Dict[str, str]] = []
    class_stats: Dict[str, Dict[str, int]] = {cls: {"train": 0, "val": 0, "test": 0, "rejected": 0} for cls in TARGET_CLASSES}

    for class_name in TARGET_CLASSES:
        source_class_dir = raw_dir / class_name
        if not source_class_dir.exists():
            continue

        valid_files_for_class: List[Path] = []
        seen_hashes_for_class: Set[str] = set()

        for file_path in source_class_dir.iterdir():
            if not file_path.is_file():
                continue

            total_inspected += 1
            is_valid, reason = validate_image(file_path, min_resolution=min_resolution)
            if not is_valid:
                rejected_count += 1
                class_stats[class_name]["rejected"] += 1
                rejections.append({"file": str(file_path), "reason": reason})
                continue

            # Check for duplicate image content within class to eliminate leakage across splits
            file_hash = calculate_file_hash(file_path)
            if file_hash in seen_hashes_for_class:
                rejected_count += 1
                class_stats[class_name]["rejected"] += 1
                rejections.append({"file": str(file_path), "reason": f"Duplicate image content (SHA-256: {file_hash[:12]})"})
                continue

            seen_hashes_for_class.add(file_hash)
            valid_files_for_class.append(file_path)

        valid_count += len(valid_files_for_class)

        # Perform deterministic stratified split on valid files
        file_names = [f.name for f in valid_files_for_class]
        train_names, val_names, test_names = deterministic_stratified_split(
            file_names,
            train_ratio=train_ratio,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
            seed=seed,
        )

        name_to_path = {f.name: f for f in valid_files_for_class}

        for split, names in [("train", train_names), ("val", val_names), ("test", test_names)]:
            for name in names:
                src = name_to_path[name]
                dst = output_dir / split / class_name / name
                shutil.copy2(src, dst)
                class_stats[class_name][split] += 1

    # Sanity check for label leakage
    has_leakage, leaks = check_label_leakage(output_dir)
    if has_leakage:
        raise RuntimeError(f"Sanity test failed: Label leakage detected:\n" + "\n".join(leaks))

    return {
        "total_inspected": total_inspected,
        "valid_count": valid_count,
        "rejected_count": rejected_count,
        "rejections": rejections,
        "class_stats": class_stats,
        "zero_leakage_verified": True,
    }


def main():
    parser = argparse.ArgumentParser(description="AgriTech PlantVillage Dataset Preparation & Splitting Tool")
    parser.add_argument("--raw-dir", type=str, default="data/raw/PlantVillage", help="Path to raw PlantVillage dataset directory")
    parser.add_argument("--output-dir", type=str, default="data/processed/PlantVillage", help="Output directory for processed splits")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic splitting")
    parser.add_argument("--min-res", type=int, default=224, help="Minimum width and height for images")
    args = parser.parse_args()

    print("=" * 60)
    print("AgriTech - PlantVillage Dataset Ingestion & Validation Pipeline")
    print("=" * 60)
    print(f"Source Directory: {args.raw_dir}")
    print(f"Target Directory: {args.output_dir}")
    print(f"Target Classes:   {len(TARGET_CLASSES)} classes")
    print(f"Split Ratios:     70% Train / 15% Validation / 15% Test (Seed: {args.seed})")
    print(f"Min Resolution:   {args.min_res}x{args.min_res}")
    print("-" * 60)

    raw_path = Path(args.raw_dir)
    if not raw_path.exists():
        print(f"[!] Warning: Raw directory '{raw_path}' does not exist yet.")
        print("    Run with valid dataset path or place PlantVillage data in 'data/raw/PlantVillage'.")
        sys.exit(0)

    summary = prepare_dataset_pipeline(
        raw_dir=raw_path,
        output_dir=Path(args.output_dir),
        min_resolution=(args.min_res, args.min_res),
        seed=args.seed,
    )

    print("\n[+] Processing Completed Successfully!")
    print(f"    Total Inspected: {summary['total_inspected']}")
    print(f"    Valid Samples:   {summary['valid_count']}")
    print(f"    Rejected:        {summary['rejected_count']}")
    print("    Zero Label Leakage Verified: PASS")


if __name__ == "__main__":
    main()
