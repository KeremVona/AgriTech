"""
Multi-Dataset Ingestion, Balancing, and Anti-Leakage Partitioning Pipeline.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).

Orchestrates multi-source ingestion from:
1. PlantVillage (Clean lab benchmark, uniform background)
2. Mendeley Corn (hmkd6nbngr/1 - Authentic field)
3. Mendeley Potato (mwbwbdzz7z/1 - Authentic field)
4. Mendeley Tomato (zfv4jj7855/1 - Authentic field/greenhouse)
5. PlantDoc (In-the-wild orchard & garden field captures)

Features:
- Strict canonical 12-class taxonomy mapping with dual-head multi-task indices.
- Deep image integrity validation (full pixel decoding to catch truncated streams).
- SHA-256 content deduplication for absolute zero-leakage guarantee across train/val/test.
- Balanced domain fusion (~50% lab + ~50% field) with domain backfilling and per-class caps.
- Cross-platform POSIX path serialization in JSON manifests.
"""

import os
import sys
import json
import random
import hashlib
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Set, Union
from PIL import Image, UnidentifiedImageError

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MultiDatasetIngestion")

# ---------------------------------------------------------------------------
# Canonical Taxonomy & Multi-Task Encodings
# ---------------------------------------------------------------------------

CANONICAL_CLASSES: List[str] = [
    # Apple (2 classes)
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    # Corn (3 classes)
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    # Potato (3 classes)
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    # Tomato (4 classes)
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___healthy",
]

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
    "Apple Scab": 7,  # Reserved
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
# External Dataset Folder Mappings
# ---------------------------------------------------------------------------

# Mendeley Corn (hmkd6nbngr/1)
MENDELEY_CORN_MAP: Dict[str, str] = {
    "Common Rust": "Corn_(maize)___Common_rust_",
    "common rust": "Corn_(maize)___Common_rust_",
    "Corn Leaf Blight": "Corn_(maize)___Northern_Leaf_Blight",
    "corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Healthy": "Corn_(maize)___healthy",
    "healthy": "Corn_(maize)___healthy",
}

# Mendeley Potato (mwbwbdzz7z/1)
MENDELEY_POTATO_MAP: Dict[str, str] = {
    "HEALTHY": "Potato___healthy",
    "Healthy": "Potato___healthy",
    "healthy": "Potato___healthy",
    "EARLY LEAF SPOT": "Potato___Early_blight",
    "Early Blight": "Potato___Early_blight",
    "early blight": "Potato___Early_blight",
    "LATE LEAF SPOT": "Potato___Late_blight",
    "Late Blight": "Potato___Late_blight",
    "late blight": "Potato___Late_blight",
}

# Mendeley Tomato (zfv4jj7855/1)
MENDELEY_TOMATO_MAP: Dict[str, str] = {
    "Tomato_healthy": "Tomato___healthy",
    "Tomato___healthy": "Tomato___healthy",
    "healthy": "Tomato___healthy",
    "Bacterial_spot": "Tomato___Bacterial_spot",
    "Tomato___Bacterial_spot": "Tomato___Bacterial_spot",
    "bacterial_spot": "Tomato___Bacterial_spot",
    "Early_blight": "Tomato___Early_blight",
    "Tomato___Early_blight": "Tomato___Early_blight",
    "early_blight": "Tomato___Early_blight",
    "Late_blight": "Tomato___Late_blight",
    "Tomato___Late_blight": "Tomato___Late_blight",
    "late_blight": "Tomato___Late_blight",
}

# PlantDoc dataset mappings (Note: Apple Scab intentionally excluded to avoid label noise on Cedar Apple Rust)
PLANTDOC_MAP: Dict[str, str] = {
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
    "Corn leaf": "Corn_(maize)___healthy",
    "Corn_leaf": "Corn_(maize)___healthy",
    "corn leaf": "Corn_(maize)___healthy",
    "Corn rust leaf": "Corn_(maize)___Common_rust_",
    "Corn_rust_leaf": "Corn_(maize)___Common_rust_",
    "corn rust": "Corn_(maize)___Common_rust_",
    "Corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_leaf_blight": "Corn_(maize)___Northern_Leaf_Blight",
    "corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Apple leaf": "Apple___healthy",
    "Apple_leaf": "Apple___healthy",
    "apple leaf": "Apple___healthy",
    "Apple rust leaf": "Apple___Cedar_apple_rust",
    "Apple_rust_leaf": "Apple___Cedar_apple_rust",
    "apple rust": "Apple___Cedar_apple_rust",
}

# ---------------------------------------------------------------------------
# Image Validation and Hashing
# ---------------------------------------------------------------------------

def calculate_sha256(file_path: Union[str, Path]) -> str:
    """Calculates SHA-256 hash of an image file to guarantee zero leakage."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_image_file(file_path: Union[str, Path], min_resolution: Tuple[int, int] = (150, 150)) -> Tuple[bool, str]:
    """
    Validates image integrity:
    1. Opens image and executes img.load() to force complete pixel decompression,
       catching truncated streams and corrupted blocks.
    2. Enforces minimum resolution dimensions.
    3. Verifies compatible color mode ('RGB', 'RGBA', 'L', 'P', 'CMYK').
    """
    try:
        with Image.open(file_path) as img:
            img.load()  # Force full pixel decoding
            width, height = img.size
            if width < min_resolution[0] or height < min_resolution[1]:
                return False, f"Resolution {width}x{height} below minimum {min_resolution[0]}x{min_resolution[1]}"
            if img.mode not in ("RGB", "RGBA", "L", "P", "CMYK"):
                return False, f"Unsupported color mode '{img.mode}'"
        return True, "Valid"
    except (UnidentifiedImageError, OSError, SyntaxError) as e:
        return False, f"Corrupted or invalid image: {str(e)}"
    except Exception as e:
        return False, f"Validation error: {str(e)}"


# ---------------------------------------------------------------------------
# Discovery and Collection Routines
# ---------------------------------------------------------------------------

def discover_folder_dataset(
    root_dir: Union[str, Path],
    folder_mapping: Dict[str, str],
    domain: str,
    source_name: str,
    min_resolution: Tuple[int, int] = (150, 150),
    global_hashes: Optional[Set[str]] = None,
) -> Tuple[List[Dict[str, Any]], Set[str], Dict[str, int]]:
    """
    Scans a directory hierarchy recursively to find folders whose names match
    folder_mapping keys. Assigns discovered images to canonical classes.
    Deduplicates against global_hashes.
    """
    if global_hashes is None:
        global_hashes = set()

    samples: List[Dict[str, Any]] = []
    rejections: Dict[str, int] = {"corrupt": 0, "duplicate": 0, "unmapped": 0}

    root_path = Path(root_dir)
    if not root_path.exists():
        logger.warning(f"Dataset directory does not exist: {root_path}")
        return samples, global_hashes, rejections

    # Find all subdirectories (including nested) that match folder_mapping keys (case- and underscore-insensitive)
    folder_mapping_norm = {k.strip().lower().replace("_", " "): v for k, v in folder_mapping.items()}
    candidate_folders: List[Tuple[Path, str]] = []
    for d in [root_path] + [p for p in root_path.rglob("*") if p.is_dir()]:
        norm_name = d.name.strip().lower().replace("_", " ")
        canonical_cls = folder_mapping.get(d.name) or folder_mapping_norm.get(norm_name)
        if canonical_cls and canonical_cls in CANONICAL_CLASSES:
            candidate_folders.append((d, canonical_cls))

    # Normalize domain
    norm_domain = domain.strip().lower()
    if norm_domain in ("greenhouse", "wild"):
        norm_domain = "field"

    processed_folders: Set[Path] = set()

    for folder, canonical_class in candidate_folders:
        if folder in processed_folders:
            continue
        processed_folders.add(folder)

        mt = CLASS_TO_MULTITASK[canonical_class]

        for file_path in folder.iterdir():
            if not file_path.is_file() or file_path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue

            is_valid, reason = validate_image_file(file_path, min_resolution=min_resolution)
            if not is_valid:
                rejections["corrupt"] += 1
                continue

            h = calculate_sha256(file_path)
            if h in global_hashes:
                rejections["duplicate"] += 1
                continue

            global_hashes.add(h)
            samples.append({
                "file_path": file_path.resolve().as_posix(),
                "canonical_class": canonical_class,
                "crop_idx": mt["crop_idx"],
                "disease_idx": mt["disease_idx"],
                "domain": norm_domain,
                "source_dataset": source_name,
                "sha256": h,
            })

    return samples, global_hashes, rejections


# ---------------------------------------------------------------------------
# Balanced Stratified Partitioning
# ---------------------------------------------------------------------------

def balance_and_split_dataset(
    all_samples: List[Dict[str, Any]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    max_train_per_class: int = 700,
    seed: int = 42,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Performs deterministic, balanced stratified splitting:
    1. Validates that split ratios sum to 1.0.
    2. Groups samples by canonical class and domain (lab vs field), normalizing aliases.
    3. Balances each class aiming for ~50% lab and ~50% field up to max_train_per_class.
    4. Backfills scarce domains from abundant domains to reach the training cap.
    5. Splits deterministically into Train, Val, Test.
    6. Verifies zero SHA-256 leakage across partitions.
    """
    if abs((train_ratio + val_ratio + test_ratio) - 1.0) > 1e-5:
        raise ValueError(
            f"Split ratios must sum to 1.0, got train={train_ratio}, val={val_ratio}, test={test_ratio}"
        )

    rng = random.Random(seed)

    # Group by class -> domain -> list of samples
    class_domain_pool: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        cls_name: {"lab": [], "field": []} for cls_name in CANONICAL_CLASSES
    }

    for s in all_samples:
        cls_name = s["canonical_class"]
        dom = s.get("domain", "field").strip().lower()
        if dom in ("greenhouse", "wild"):
            dom = "field"
        if dom not in ("lab", "field"):
            raise ValueError(f"Unrecognized domain '{dom}' for sample {s['file_path']}")

        if cls_name in class_domain_pool:
            class_domain_pool[cls_name][dom].append(s)

    train_manifest: List[Dict[str, Any]] = []
    val_manifest: List[Dict[str, Any]] = []
    test_manifest: List[Dict[str, Any]] = []

    stats_summary: Dict[str, Dict[str, int]] = {
        cls_name: {"train_lab": 0, "train_field": 0, "val": 0, "test": 0, "total": 0}
        for cls_name in CANONICAL_CLASSES
    }

    # Target total per class based on train cap and ratio
    max_total_per_class = int(round(max_train_per_class / train_ratio))
    target_lab_total = max_total_per_class // 2
    target_field_total = max_total_per_class - target_lab_total

    for cls_name in CANONICAL_CLASSES:
        lab_samples = sorted(class_domain_pool[cls_name]["lab"], key=lambda x: x["sha256"])
        field_samples = sorted(class_domain_pool[cls_name]["field"], key=lambda x: x["sha256"])

        rng.shuffle(lab_samples)
        rng.shuffle(field_samples)

        selected_lab = lab_samples[:target_lab_total]
        selected_field = field_samples[:target_field_total]

        # Domain backfilling: if one domain is scarce, fill from the other
        shortage_lab = target_lab_total - len(selected_lab)
        shortage_field = target_field_total - len(selected_field)

        if shortage_lab > 0 and len(field_samples) > target_field_total:
            backfill = field_samples[target_field_total : target_field_total + shortage_lab]
            selected_field.extend(backfill)
        elif shortage_field > 0 and len(lab_samples) > target_lab_total:
            backfill = lab_samples[target_lab_total : target_lab_total + shortage_field]
            selected_lab.extend(backfill)

        # Deterministic partition
        def _split_pool(pool: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
            n = len(pool)
            tr = int(round(n * train_ratio))
            va = int(round(n * val_ratio))
            return pool[:tr], pool[tr : tr + va], pool[tr + va :]

        tr_lab, va_lab, te_lab = _split_pool(selected_lab)
        tr_field, va_field, te_field = _split_pool(selected_field)

        train_manifest.extend(tr_lab + tr_field)
        val_manifest.extend(va_lab + va_field)
        test_manifest.extend(te_lab + te_field)

        stats_summary[cls_name]["train_lab"] = len(tr_lab)
        stats_summary[cls_name]["train_field"] = len(tr_field)
        stats_summary[cls_name]["val"] = len(va_lab) + len(va_field)
        stats_summary[cls_name]["test"] = len(te_lab) + len(te_field)
        stats_summary[cls_name]["total"] = (
            len(tr_lab) + len(tr_field) + len(va_lab) + len(va_field) + len(te_lab) + len(te_field)
        )

    # Anti-leakage verification
    train_hashes = {s["sha256"] for s in train_manifest}
    val_hashes = {s["sha256"] for s in val_manifest}
    test_hashes = {s["sha256"] for s in test_manifest}

    leak_tr_va = train_hashes.intersection(val_hashes)
    leak_tr_te = train_hashes.intersection(test_hashes)
    leak_va_te = val_hashes.intersection(test_hashes)

    if leak_tr_va or leak_tr_te or leak_va_te:
        raise RuntimeError(
            f"Zero leakage check failed! Overlaps detected: "
            f"Train-Val={len(leak_tr_va)}, Train-Test={len(leak_tr_te)}, Val-Test={len(leak_va_te)}"
        )

    summary = {
        "total_train": len(train_manifest),
        "total_val": len(val_manifest),
        "total_test": len(test_manifest),
        "zero_leakage_verified": True,
        "class_breakdown": stats_summary,
    }

    return train_manifest, val_manifest, test_manifest, summary


# ---------------------------------------------------------------------------
# Main Ingestion Workflow
# ---------------------------------------------------------------------------

def run_ingestion_pipeline(
    plantvillage_dir: Optional[Path] = None,
    mendeley_corn_dir: Optional[Path] = None,
    mendeley_potato_dir: Optional[Path] = None,
    mendeley_tomato_dir: Optional[Path] = None,
    plantdoc_dir: Optional[Path] = None,
    output_dir: Path = Path("ml-retrain-experimental/data/manifests"),
    max_train_per_class: int = 700,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Executes full ingestion across all available data directories and outputs
    verified manifests and summary metadata.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    global_hashes: Set[str] = set()
    all_collected: List[Dict[str, Any]] = []

    # 1. Ingest PlantVillage (Lab)
    if plantvillage_dir and Path(plantvillage_dir).exists():
        pv_mapping = {cls_name: cls_name for cls_name in CANONICAL_CLASSES}
        samples, global_hashes, _ = discover_folder_dataset(
            plantvillage_dir, pv_mapping, domain="lab", source_name="PlantVillage", global_hashes=global_hashes
        )
        all_collected.extend(samples)
        logger.info(f"Ingested {len(samples)} valid samples from PlantVillage.")

    # 2. Ingest Mendeley Corn (Field)
    if mendeley_corn_dir and Path(mendeley_corn_dir).exists():
        samples, global_hashes, _ = discover_folder_dataset(
            mendeley_corn_dir, MENDELEY_CORN_MAP, domain="field", source_name="MendeleyCorn_hmkd6nbngr", global_hashes=global_hashes
        )
        all_collected.extend(samples)
        logger.info(f"Ingested {len(samples)} valid samples from Mendeley Corn.")

    # 3. Ingest Mendeley Potato (Field)
    if mendeley_potato_dir and Path(mendeley_potato_dir).exists():
        samples, global_hashes, _ = discover_folder_dataset(
            mendeley_potato_dir, MENDELEY_POTATO_MAP, domain="field", source_name="MendeleyPotato_mwbwbdzz7z", global_hashes=global_hashes
        )
        all_collected.extend(samples)
        logger.info(f"Ingested {len(samples)} valid samples from Mendeley Potato.")

    # 4. Ingest Mendeley Tomato (Field)
    if mendeley_tomato_dir and Path(mendeley_tomato_dir).exists():
        samples, global_hashes, _ = discover_folder_dataset(
            mendeley_tomato_dir, MENDELEY_TOMATO_MAP, domain="field", source_name="MendeleyTomato_zfv4jj7855", global_hashes=global_hashes
        )
        all_collected.extend(samples)
        logger.info(f"Ingested {len(samples)} valid samples from Mendeley Tomato.")

    # 5. Ingest PlantDoc (Field)
    if plantdoc_dir and Path(plantdoc_dir).exists():
        samples, global_hashes, _ = discover_folder_dataset(
            plantdoc_dir, PLANTDOC_MAP, domain="field", source_name="PlantDoc", global_hashes=global_hashes
        )
        all_collected.extend(samples)
        logger.info(f"Ingested {len(samples)} valid samples from PlantDoc.")

    logger.info(f"Total unique valid samples across all sources: {len(all_collected)}")

    # Balance and split
    tr_manifest, va_manifest, te_manifest, summary = balance_and_split_dataset(
        all_collected,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        max_train_per_class=max_train_per_class,
        seed=seed,
    )

    # Save manifests
    with open(output_dir / "train_manifest.json", "w", encoding="utf-8") as f:
        json.dump(tr_manifest, f, indent=2)
    with open(output_dir / "val_manifest.json", "w", encoding="utf-8") as f:
        json.dump(va_manifest, f, indent=2)
    with open(output_dir / "test_manifest.json", "w", encoding="utf-8") as f:
        json.dump(te_manifest, f, indent=2)
    with open(output_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    logger.info(
        f"Manifest generation complete. Train: {len(tr_manifest)}, Val: {len(va_manifest)}, Test: {len(te_manifest)}"
    )
    return summary


if __name__ == "__main__":
    pv_path = Path("ml-service/data/raw/PlantVillage")
    run_ingestion_pipeline(
        plantvillage_dir=pv_path if pv_path.exists() else None,
        output_dir=Path("ml-retrain-experimental/data/manifests"),
    )
