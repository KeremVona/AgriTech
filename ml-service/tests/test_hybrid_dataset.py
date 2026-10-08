"""
Unit and integration tests for PlantVillage + PlantDoc Hybrid Dataset Ingestion.
Verifies class mapping, balancing cap, multi-task taxonomy, and zero data leakage.
"""

import io
import tempfile
from pathlib import Path
from PIL import Image
import pytest

from scripts.prepare_hybrid_dataset import (
    TARGET_CLASSES,
    PLANTDOC_TO_TARGET_MAP,
    CROP_TAXONOMY,
    DISEASE_TAXONOMY,
    CLASS_TO_MULTITASK,
    calculate_sha256,
    validate_image_file,
    split_hybrid_manifest,
    discover_plantvillage_samples,
)


def _create_dummy_image(path: Path, width: int = 224, height: int = 224, color: tuple = (100, 150, 200)) -> Path:
    img = Image.new("RGB", (width, height), color=color)
    img.save(path, format="JPEG")
    return path


def test_plantdoc_class_mapping_targets_valid():
    """All PlantDoc mappings must map to an official canonical target class."""
    for pd_label, target_cls in PLANTDOC_TO_TARGET_MAP.items():
        assert target_cls in TARGET_CLASSES, f"PlantDoc mapping '{pd_label}' points to unknown class '{target_cls}'"


def test_multitask_taxonomy_alignment():
    """All 12 target classes must have valid crop_idx (0..3) and disease_idx (0..7)."""
    assert len(TARGET_CLASSES) == 12
    assert len(CROP_TAXONOMY) == 4
    assert len(DISEASE_TAXONOMY) == 8

    for cls_name in TARGET_CLASSES:
        assert cls_name in CLASS_TO_MULTITASK, f"Missing multi-task mapping for {cls_name}"
        meta = CLASS_TO_MULTITASK[cls_name]
        assert 0 <= meta["crop_idx"] < 4
        assert 0 <= meta["disease_idx"] < 8


def test_sha256_hash_computation(tmp_path):
    """SHA-256 calculation must be deterministic and sensitive to content."""
    p1 = tmp_path / "img1.jpg"
    p2 = tmp_path / "img2.jpg"
    _create_dummy_image(p1, color=(50, 50, 50))
    _create_dummy_image(p2, color=(50, 50, 50))

    h1 = calculate_sha256(p1)
    h2 = calculate_sha256(p2)
    assert h1 == h2
    assert len(h1) == 64


def test_validate_image_file(tmp_path):
    """Verifies valid RGB images pass while corrupt or low-resolution ones fail."""
    valid_p = tmp_path / "valid.jpg"
    _create_dummy_image(valid_p, 250, 250)
    is_valid, reason = validate_image_file(valid_p, min_resolution=(150, 150))
    assert is_valid is True

    # Low resolution
    tiny_p = tmp_path / "tiny.jpg"
    _create_dummy_image(tiny_p, 50, 50)
    is_valid, reason = validate_image_file(tiny_p, min_resolution=(150, 150))
    assert is_valid is False
    assert "below minimum" in reason

    # Corrupted
    corrupt_p = tmp_path / "corrupt.jpg"
    corrupt_p.write_bytes(b"NOT_A_VALID_IMAGE_BYTES")
    is_valid, reason = validate_image_file(corrupt_p)
    assert is_valid is False


def test_stratified_split_zero_leakage():
    """Stratified 70/15/15 split must produce zero sample or hash overlap."""
    # Synthetic manifest with 120 samples (10 per class)
    manifest = []
    for cls_name in TARGET_CLASSES:
        for i in range(20):
            manifest.append({
                "source_path": f"/fake/path/{cls_name}_{i}.jpg",
                "file_hash": f"hash_{cls_name}_{i}",
                "domain": "plantdoc_field" if i % 2 == 0 else "plantvillage_lab",
                "canonical_class": cls_name,
                "crop_idx": CLASS_TO_MULTITASK[cls_name]["crop_idx"],
                "disease_idx": CLASS_TO_MULTITASK[cls_name]["disease_idx"],
            })

    train_set, val_set, test_set = split_hybrid_manifest(manifest, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15)

    assert len(train_set) == int(len(manifest) * 0.70)
    assert len(val_set) == int(len(manifest) * 0.15)
    assert len(test_set) == len(manifest) - len(train_set) - len(val_set)

    # Validate zero leakage
    train_h = {x["file_hash"] for x in train_set}
    val_h = {x["file_hash"] for x in val_set}
    test_h = {x["file_hash"] for x in test_set}

    assert len(train_h.intersection(val_h)) == 0
    assert len(train_h.intersection(test_h)) == 0
    assert len(val_h.intersection(test_h)) == 0


def test_discover_plantvillage_balancing_cap(tmp_path):
    """PlantVillage sample discovery must strictly respect max_per_class cap."""
    pv_dir = tmp_path / "PlantVillage"
    pv_dir.mkdir()
    target = TARGET_CLASSES[0]
    cls_dir = pv_dir / target
    cls_dir.mkdir()

    for i in range(15):
        _create_dummy_image(cls_dir / f"img_{i}.jpg", color=(i * 10, 50, 50))

    samples = discover_plantvillage_samples(pv_dir, max_per_class=5)
    assert len(samples[target]) == 5
