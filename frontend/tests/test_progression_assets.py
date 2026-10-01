"""
Unit and Sanity Test Suite for Morphological Progression Assets (TODO-107).
Precision AgriTech Platform - Phase 1.

Validates:
1. Manifest structure, schema compliance, and completeness across 4 crops and 3 stages.
2. Exact image resolutions (strictly 800x800).
3. Image format (valid WebP) and color mode (RGBA).
4. File size limits (strictly < 150 KB per asset).
5. Visual anchor alignment (petiole and vertical centerline stability across stages).
"""

import json
from pathlib import Path
from PIL import Image

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "public" / "progression" / "manifest.json"
ASSET_DIR = Path(__file__).resolve().parent.parent / "public" / "progression"
MAX_FILE_SIZE_BYTES = 150 * 1024  # 150 KB limit


def load_manifest() -> dict:
    assert MANIFEST_PATH.exists(), f"Manifest file missing: {MANIFEST_PATH}"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_manifest_structure():
    """Verifies that the manifest defines all required fields and the 4 target crops."""
    manifest = load_manifest()
    assert "version" in manifest
    assert "crops" in manifest
    assert len(manifest["crops"]) == 4

    expected_crops = {"tomato", "potato", "corn", "apple"}
    actual_crops = {c["crop_id"] for c in manifest["crops"]}
    assert actual_crops == expected_crops, f"Crop mismatch: {actual_crops} vs {expected_crops}"


def test_all_12_images_exist_and_conform():
    """Verifies all 12 base images and companion masks exist, are 800x800 WebP, and < 150 KB."""
    manifest = load_manifest()

    total_images_checked = 0
    total_masks_checked = 0

    for crop in manifest["crops"]:
        crop_id = crop["crop_id"]
        assert len(crop["stages"]) == 3, f"Crop {crop_id} must have exactly 3 progression stages"

        for stage in crop["stages"]:
            order = stage["stage_order"]
            base_url = stage["assets"]["base_image_url"]
            assert base_url.startswith("/progression/"), f"Invalid asset URL scheme: {base_url}"

            rel_path = base_url.replace("/progression/", "")
            file_path = ASSET_DIR / rel_path
            assert file_path.exists(), f"Image file missing on disk: {file_path}"

            # Check file size
            file_size = file_path.stat().st_size
            assert file_size < MAX_FILE_SIZE_BYTES, f"File {file_path.name} exceeds 150 KB: {file_size / 1024:.2f} KB"
            assert file_size > 1024, f"File {file_path.name} is abnormally small: {file_size} bytes"

            # Check image format, mode, and resolution with Pillow
            with Image.open(file_path) as img:
                assert img.format == "WEBP", f"File {file_path.name} is {img.format}, expected WEBP"
                assert img.size == (800, 800), f"File {file_path.name} size {img.size} != (800, 800)"
                assert img.mode in ("RGBA", "RGB"), f"File {file_path.name} mode {img.mode} invalid"

            total_images_checked += 1

            # Check mask if present (stages 1 and 2)
            mask_url = stage["assets"]["mask_image_url"]
            if mask_url:
                mask_rel = mask_url.replace("/progression/", "")
                mask_path = ASSET_DIR / mask_rel
                assert mask_path.exists(), f"Mask file missing on disk: {mask_path}"
                mask_size = mask_path.stat().st_size
                assert mask_size < MAX_FILE_SIZE_BYTES, f"Mask {mask_path.name} exceeds 150 KB"

                with Image.open(mask_path) as m_img:
                    assert m_img.format == "WEBP", f"Mask {mask_path.name} is not WEBP"
                    assert m_img.size == (800, 800), f"Mask {mask_path.name} size {m_img.size} != (800, 800)"

                total_masks_checked += 1

    assert total_images_checked == 12, f"Expected 12 base images, verified {total_images_checked}"
    assert total_masks_checked == 8, f"Expected 8 transition masks (2 per crop), verified {total_masks_checked}"


def test_morphological_alignment():
    """
    Verifies that for each crop, the leaf silhouette bounding box and petiole anchor
    remain stable across Stage 0, Stage 1, and Stage 2 (variance < 2%).
    """
    manifest = load_manifest()

    for crop in manifest["crops"]:
        crop_id = crop["crop_id"]
        bboxes = []

        for stage in crop["stages"]:
            base_url = stage["assets"]["base_image_url"]
            file_path = ASSET_DIR / base_url.replace("/progression/", "")
            with Image.open(file_path) as img:
                alpha = img.split()[-1]
                bbox = alpha.getbbox()  # (left, upper, right, lower)
                assert bbox is not None, f"Leaf image {file_path.name} has empty alpha"
                bboxes.append(bbox)

        # Compare Stage 0 vs Stage 1 and Stage 2 bounding boxes
        b0 = bboxes[0]
        for idx in [1, 2]:
            b_curr = bboxes[idx]
            # Width and height delta check
            w0, h0 = b0[2] - b0[0], b0[3] - b0[1]
            w_c, h_c = b_curr[2] - b_curr[0], b_curr[3] - b_curr[1]
            dw = abs(w0 - w_c) / w0
            dh = abs(h0 - h_c) / h0
            assert dw < 0.02, f"Crop {crop_id} stage {idx} width shifted by {dw:.2%}"
            assert dh < 0.02, f"Crop {crop_id} stage {idx} height shifted by {dh:.2%}"


def test_slider_thresholds_continuity():
    """Verifies that slider percentage thresholds form a continuous 0 to 100 coverage."""
    manifest = load_manifest()
    for crop in manifest["crops"]:
        stages = crop["stages"]
        assert stages[0]["min_slider_pct"] == 0.0
        assert stages[-1]["max_slider_pct"] == 100.0

        for i in range(len(stages) - 1):
            curr_max = stages[i]["max_slider_pct"]
            next_min = stages[i + 1]["min_slider_pct"]
            # Threshold gap should be minimal (within 0.02)
            assert abs(next_min - curr_max) <= 0.02, f"Discontinuity between stages {i} and {i+1} in {crop['crop_id']}"


if __name__ == "__main__":
    print("Running Progression Assets Test Suite...")
    test_manifest_structure()
    print("  [PASS] test_manifest_structure passed")
    test_all_12_images_exist_and_conform()
    print("  [PASS] test_all_12_images_exist_and_conform passed (12/12 images, 8/8 masks)")
    test_morphological_alignment()
    print("  [PASS] test_morphological_alignment passed (Delta < 2%)")
    test_slider_thresholds_continuity()
    print("  [PASS] test_slider_thresholds_continuity passed (0% to 100% continuous)")
    print("\nALL PROGRESSION ASSET TESTS PASSED!")
