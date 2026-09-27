"""
Unit and integration tests for dataset preparation, validation, and zero-leakage splitting.
Following TDD principles (TODO-101 acceptance criteria).
"""

import os
import shutil
import pytest
from PIL import Image
from scripts.prepare_dataset import (
    TARGET_CLASSES,
    validate_image,
    deterministic_stratified_split,
    check_label_leakage,
    prepare_dataset_pipeline,
)


@pytest.fixture
def mock_raw_dataset(tmp_path):
    """
    Creates a temporary raw dataset structure with 12 valid classes
    and various edge case images (corrupt, non-RGB, low resolution).
    """
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()

    # Create dummy images for each target class
    for class_name in TARGET_CLASSES:
        class_dir = raw_dir / class_name
        class_dir.mkdir()

        # Create 20 valid RGB images >= 224x224
        for i in range(20):
            img = Image.new("RGB", (256, 256), color=(i * 10, 100, 50))
            img.save(class_dir / f"img_{i:03d}.jpg", "JPEG")

    # Add edge cases in the first class:
    first_class_dir = raw_dir / TARGET_CLASSES[0]

    # 1. Low resolution (< 224x224)
    low_res = Image.new("RGB", (100, 100), color=(255, 0, 0))
    low_res.save(first_class_dir / "low_res.jpg", "JPEG")

    # 2. Non-RGB (Grayscale 'L')
    gray = Image.new("L", (256, 256), color=128)
    gray.save(first_class_dir / "grayscale.jpg", "JPEG")

    # 3. Corrupt file
    corrupt_file = first_class_dir / "corrupt.jpg"
    with open(corrupt_file, "wb") as f:
        f.write(b"NOT_A_VALID_JPEG_HEADER")

    return raw_dir


def test_target_classes_count():
    """Verify exactly 12 target classes are defined matching Phase 1 spec."""
    assert len(TARGET_CLASSES) == 12
    # Check key crops are present
    assert any("Tomato" in c for c in TARGET_CLASSES)
    assert any("Potato" in c for c in TARGET_CLASSES)
    assert any("Corn" in c for c in TARGET_CLASSES)
    assert any("Apple" in c for c in TARGET_CLASSES)


def test_validate_image_valid(tmp_path):
    """Verify valid image passes validation."""
    valid_path = tmp_path / "valid.jpg"
    img = Image.new("RGB", (224, 224), color=(0, 255, 0))
    img.save(valid_path, "JPEG")
    is_valid, reason = validate_image(valid_path, min_resolution=(224, 224))
    assert is_valid is True
    assert reason == ""


def test_validate_image_corrupt(tmp_path):
    """Verify corrupt file is rejected."""
    corrupt_path = tmp_path / "corrupt.jpg"
    with open(corrupt_path, "wb") as f:
        f.write(b"MALFORMED_HEADER")
    is_valid, reason = validate_image(corrupt_path)
    assert is_valid is False
    assert "corrupt" in reason.lower() or "error" in reason.lower()


def test_validate_image_low_resolution(tmp_path):
    """Verify image below minimum resolution is rejected."""
    small_path = tmp_path / "small.jpg"
    img = Image.new("RGB", (200, 200), color=(0, 0, 255))
    img.save(small_path, "JPEG")
    is_valid, reason = validate_image(small_path, min_resolution=(224, 224))
    assert is_valid is False
    assert "resolution" in reason.lower()


def test_validate_image_non_rgb(tmp_path):
    """Verify non-RGB (e.g. RGBA, Grayscale) is rejected."""
    rgba_path = tmp_path / "rgba.png"
    img = Image.new("RGBA", (256, 256), color=(255, 0, 0, 128))
    img.save(rgba_path, "PNG")
    is_valid, reason = validate_image(rgba_path)
    assert is_valid is False
    assert "rgb" in reason.lower()


def test_deterministic_stratified_split():
    """Verify split produces identical 70/15/15 partitions across multiple runs."""
    items = [f"image_{i:04d}.jpg" for i in range(100)]
    seed = 42

    train1, val1, test1 = deterministic_stratified_split(items, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=seed)
    train2, val2, test2 = deterministic_stratified_split(items, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=seed)

    assert train1 == train2
    assert val1 == val2
    assert test1 == test2

    assert len(train1) == 70
    assert len(val1) == 15
    assert len(test1) == 15

    # Check zero overlap
    assert set(train1).isdisjoint(set(val1))
    assert set(train1).isdisjoint(set(test1))
    assert set(val1).isdisjoint(set(test1))


def test_check_label_leakage_clean(tmp_path):
    """Verify zero label leakage test passes on clean dataset splits."""
    output_dir = tmp_path / "processed"
    pixel_val = 1
    for split in ["train", "val", "test"]:
        for cls in TARGET_CLASSES:
            (output_dir / split / cls).mkdir(parents=True)
            # Distinct filenames and distinct pixel contents
            for i in range(5):
                img_path = output_dir / split / cls / f"{split}_{i}.jpg"
                img = Image.new("RGB", (224, 224), color=(pixel_val % 255, (pixel_val * 2) % 255, (pixel_val * 3) % 255))
                img.save(img_path)
                pixel_val += 1

    has_leakage, leaks = check_label_leakage(output_dir)
    assert has_leakage is False
    assert len(leaks) == 0


def test_check_label_leakage_detected(tmp_path):
    """Verify zero label leakage test flags duplicate content across splits."""
    output_dir = tmp_path / "processed_leaky"
    # Create identical file in train and test
    content = b"SAME_IMAGE_DATA_BYTES"
    (output_dir / "train" / TARGET_CLASSES[0]).mkdir(parents=True)
    (output_dir / "test" / TARGET_CLASSES[0]).mkdir(parents=True)

    with open(output_dir / "train" / TARGET_CLASSES[0] / "file1.jpg", "wb") as f:
        f.write(content)
    with open(output_dir / "test" / TARGET_CLASSES[0] / "file2.jpg", "wb") as f:
        f.write(content)

    has_leakage, leaks = check_label_leakage(output_dir)
    assert has_leakage is True
    assert len(leaks) > 0


def test_prepare_dataset_pipeline_execution(mock_raw_dataset, tmp_path):
    """Test full pipeline execution: clean 12 classes, stratified split, rejects edge cases."""
    output_dir = tmp_path / "final_dataset"

    summary = prepare_dataset_pipeline(
        raw_dir=mock_raw_dataset,
        output_dir=output_dir,
        min_resolution=(224, 224),
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        seed=42,
    )

    # 1. Directory Structure check
    for split in ["train", "val", "test"]:
        split_dir = output_dir / split
        assert split_dir.exists()
        subdirs = [d.name for d in split_dir.iterdir() if d.is_dir()]
        assert len(subdirs) == 12
        assert set(subdirs) == set(TARGET_CLASSES)

    # 2. Acceptance check: edge cases rejected
    assert summary["rejected_count"] == 3  # low_res, grayscale, corrupt

    # 3. Acceptance check: label leakage check passes
    has_leakage, _ = check_label_leakage(output_dir)
    assert has_leakage is False
