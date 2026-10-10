"""
Unit and Integration Tests for Ingestion and Dataset Pipelines.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).
"""

import sys
import json
import pytest
import numpy as np
from pathlib import Path
from PIL import Image

# Ensure ml-retrain-experimental is in sys.path
exp_root = Path(__file__).resolve().parent.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

import torch
from torch.utils.data import DataLoader

from data.ingest_multidataset import (
    validate_image_file,
    calculate_sha256,
    discover_folder_dataset,
    balance_and_split_dataset,
    run_ingestion_pipeline,
    CANONICAL_CLASSES,
    CLASS_TO_MULTITASK,
    PLANTDOC_MAP,
)
from pipeline.dataset import (
    MultiTaskDataset,
    get_train_transforms,
    get_val_transforms,
    create_dataloaders,
)


@pytest.fixture
def mock_dataset_tree(tmp_path: Path):
    """Creates a temporary directory with mock images for testing ingestion."""
    root = tmp_path / "mock_dataset"
    root.mkdir()

    # Create nested folder structure: e.g., root/subfolder/Corn Leaf Blight
    subfolder = root / "category_a"
    subfolder.mkdir()

    for class_folder, img_count in [
        ("Corn Leaf Blight", 10),
        ("Common Rust", 8),
        ("Unrelated Disease", 5),  # Unmapped
    ]:
        folder = subfolder / class_folder
        folder.mkdir()
        for i in range(img_count):
            img_path = folder / f"img_{i}.jpg"
            arr = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
            img = Image.fromarray(arr)
            img.save(img_path)

    # Duplicate image
    dup_path = subfolder / "Corn Leaf Blight" / "duplicate_img.jpg"
    orig_path = subfolder / "Corn Leaf Blight" / "img_0.jpg"
    dup_path.write_bytes(orig_path.read_bytes())

    # Corrupt header
    corrupt_path = subfolder / "Common Rust" / "corrupt.jpg"
    corrupt_path.write_bytes(b"NOT_A_VALID_IMAGE_HEADER")

    # Low-res image (50x50)
    low_res_path = subfolder / "Common Rust" / "low_res.jpg"
    low_res_img = Image.fromarray(np.zeros((50, 50, 3), dtype=np.uint8))
    low_res_img.save(low_res_path)

    return root


def test_validate_image_file(tmp_path: Path):
    # Valid image
    valid_file = tmp_path / "valid.jpg"
    Image.new("RGB", (200, 200), color=(100, 150, 200)).save(valid_file)
    is_valid, msg = validate_image_file(valid_file, min_resolution=(150, 150))
    assert is_valid is True
    assert msg == "Valid"

    # Low-res image
    low_res_file = tmp_path / "low_res.jpg"
    Image.new("RGB", (100, 100), color=(50, 50, 50)).save(low_res_file)
    is_valid, msg = validate_image_file(low_res_file, min_resolution=(150, 150))
    assert is_valid is False
    assert "below minimum" in msg

    # Corrupt image
    corrupt_file = tmp_path / "corrupt.jpg"
    corrupt_file.write_bytes(b"corrupted header data")
    is_valid, msg = validate_image_file(corrupt_file)
    assert is_valid is False


def test_plantdoc_map_excludes_apple_scab():
    """Ensure Apple Scab is never mapped to Cedar Apple Rust to prevent label corruption."""
    assert "Apple Scab Leaf" not in PLANTDOC_MAP
    assert "Apple_Scab_Leaf" not in PLANTDOC_MAP


def test_calculate_sha256(tmp_path: Path):
    file1 = tmp_path / "file1.txt"
    file2 = tmp_path / "file2.txt"
    file1.write_bytes(b"identical image bytes")
    file2.write_bytes(b"identical image bytes")

    hash1 = calculate_sha256(file1)
    hash2 = calculate_sha256(file2)
    assert len(hash1) == 64
    assert hash1 == hash2


def test_discover_folder_dataset_nested(mock_dataset_tree: Path):
    mapping = {
        "Corn Leaf Blight": "Corn_(maize)___Northern_Leaf_Blight",
        "Common Rust": "Corn_(maize)___Common_rust_",
    }
    samples, hashes, rejections = discover_folder_dataset(
        mock_dataset_tree,
        folder_mapping=mapping,
        domain="greenhouse",  # Should normalize to 'field'
        source_name="MockCorn",
        min_resolution=(150, 150),
    )

    # 10 valid in Corn Leaf Blight + 8 valid in Common Rust = 18 unique valid
    assert len(samples) == 18
    assert rejections["duplicate"] >= 1
    assert rejections["corrupt"] >= 2
    for s in samples:
        assert s["crop_idx"] == 1
        assert s["disease_idx"] in (4, 5)
        assert s["domain"] == "field"
        # Verify POSIX paths
        assert "\\" not in s["file_path"]


def test_balance_and_split_ratio_validation():
    with pytest.raises(ValueError, match="Split ratios must sum to 1.0"):
        balance_and_split_dataset([], train_ratio=0.7, val_ratio=0.1, test_ratio=0.1)


def test_balance_and_split_backfill_and_zero_leakage():
    # Asymmetric sample pool: Class 0 has 80 lab and only 10 field
    synthetic_samples = []
    cls = CANONICAL_CLASSES[0]
    mt = CLASS_TO_MULTITASK[cls]

    # 80 lab
    for i in range(80):
        synthetic_samples.append({
            "file_path": f"/mock/{cls}/lab/img_{i}.jpg",
            "canonical_class": cls,
            "crop_idx": mt["crop_idx"],
            "disease_idx": mt["disease_idx"],
            "domain": "lab",
            "source_dataset": "LabSource",
            "sha256": f"lab_hash_{i:08d}",
        })
    # 10 field
    for i in range(10):
        synthetic_samples.append({
            "file_path": f"/mock/{cls}/field/img_{i}.jpg",
            "canonical_class": cls,
            "crop_idx": mt["crop_idx"],
            "disease_idx": mt["disease_idx"],
            "domain": "field",
            "source_dataset": "FieldSource",
            "sha256": f"field_hash_{i:08d}",
        })

    train, val, test, summary = balance_and_split_dataset(
        synthetic_samples,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        max_train_per_class=50,
        seed=42,
    )

    assert summary["zero_leakage_verified"] is True
    # Backfill should have taken extra lab samples because field was scarce
    cls_stats = summary["class_breakdown"][cls]
    assert cls_stats["train_lab"] > cls_stats["train_field"]
    assert cls_stats["total"] > 0

    tr_hashes = {s["sha256"] for s in train}
    va_hashes = {s["sha256"] for s in val}
    te_hashes = {s["sha256"] for s in test}

    assert len(tr_hashes.intersection(va_hashes)) == 0
    assert len(tr_hashes.intersection(te_hashes)) == 0
    assert len(va_hashes.intersection(te_hashes)) == 0


def test_multitask_dataset_and_metadata_flag(tmp_path: Path):
    records = []
    for i in range(6):
        img_path = tmp_path / f"img_{i}.jpg"
        arr = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        Image.fromarray(arr).save(img_path)
        records.append({
            "file_path": img_path.name,  # relative path
            "canonical_class": "Potato___Late_blight",
            "crop_idx": 2,
            "disease_idx": 2,
            "domain": "field",
            "source_dataset": "TestDS",
            "sha256": f"hash_{i}",
        })

    manifest_file = tmp_path / "manifest.json"
    manifest_file.write_text(json.dumps(records), encoding="utf-8")

    # Fast path: return_metadata=False (default) yields 3-tuple
    ds_fast = MultiTaskDataset(manifest_file, root_dir=tmp_path, return_metadata=False)
    assert len(ds_fast) == 6
    out = ds_fast[0]
    assert len(out) == 3
    img, crop, disease = out
    assert img.shape == (3, 224, 224)
    assert crop.item() == 2
    assert disease.item() == 2

    # Evaluation path: return_metadata=True yields 4-tuple
    ds_meta = MultiTaskDataset(manifest_file, root_dir=tmp_path, return_metadata=True)
    out_meta = ds_meta[0]
    assert len(out_meta) == 4
    _, _, _, meta = out_meta
    assert meta["canonical_class"] == "Potato___Late_blight"
    assert meta["domain"] == "field"


def test_dataset_error_handling(tmp_path: Path):
    # Missing manifest file
    with pytest.raises(FileNotFoundError):
        MultiTaskDataset(tmp_path / "non_existent.json")

    # Invalid manifest type
    with pytest.raises(TypeError):
        MultiTaskDataset(12345)

    # Corrupt image read
    corrupt_file = tmp_path / "bad.jpg"
    corrupt_file.write_bytes(b"garbage")
    records = [{"file_path": str(corrupt_file), "crop_idx": 0, "disease_idx": 0}]
    ds = MultiTaskDataset(records)
    with pytest.raises(IOError, match="Failed to load image"):
        _ = ds[0]


def test_create_dataloaders_factory(tmp_path: Path):
    records = []
    for i in range(8):
        img_path = tmp_path / f"batch_img_{i}.jpg"
        arr = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        Image.fromarray(arr).save(img_path)
        records.append({
            "file_path": str(img_path),
            "canonical_class": "Tomato___healthy",
            "crop_idx": 3,
            "disease_idx": 0,
            "domain": "field",
            "source_dataset": "TestDS",
            "sha256": f"hash_{i}",
        })

    loaders = create_dataloaders(
        train_manifest=records,
        val_manifest=records[:4],
        test_manifest=records[:4],
        batch_size=4,
        num_workers=0,
        image_size=224,
    )

    assert "train" in loaders
    assert "val" in loaders
    assert "test" in loaders

    # Check batch yield
    train_batch = next(iter(loaders["train"]))
    assert len(train_batch) == 3
    b_img, b_crop, b_dis = train_batch
    assert b_img.shape == (4, 3, 224, 224)
    assert b_crop.shape == (4,)
    assert b_dis.shape == (4,)


def test_dynamic_val_resize():
    # Test that non-224 input sizes scale resize dimension appropriately
    trans_224 = get_val_transforms(image_size=224)
    trans_384 = get_val_transforms(image_size=384)

    # First transform is Resize, second is CenterCrop
    resize_224 = trans_224.transforms[0].size
    resize_384 = trans_384.transforms[0].size
    assert resize_224 == 256
    assert resize_384 == int(round(384 * 256 / 224))
