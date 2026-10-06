"""
Unit and Sanity Tests for Prompt-to-Prompt Disease Progression CLI (TODO-107).
Validates CLI argument parsing, crop specification dictionaries,
and image postprocessing utilities (matte cutout, WebGL mask generation, 800x800 normalizer).
"""

import sys
from pathlib import Path
from PIL import Image
import numpy as np
import pytest

# Add ml-service/scripts/p2p to sys.path
P2P_DIR = Path(__file__).resolve().parent.parent / "scripts" / "p2p"
if str(P2P_DIR) not in sys.path:
    sys.path.insert(0, str(P2P_DIR))

from p2p_generator import (
    DEFAULT_CROP_SPECS,
    remove_white_background,
    compute_difference_mask,
    normalize_to_target_spec,
    keep_largest_component,
)


def test_crop_specs_completeness():
    """Verify that all 4 target crops are defined with calibrated prompts and seeds."""
    required_crops = {"tomato", "potato", "corn", "apple"}
    assert set(DEFAULT_CROP_SPECS.keys()) == required_crops

    for crop_id, spec in DEFAULT_CROP_SPECS.items():
        assert "crop_name" in spec
        assert "disease_name" in spec
        assert "prompts" in spec
        assert len(spec["prompts"]) == 3, f"{crop_id} must have exactly 3 stage prompts"
        assert "seed" in spec
        assert isinstance(spec["seed"], int)
        assert "cross_replace_steps" in spec
        assert "self_replace_steps" in spec
        assert "blend_words" in spec
        assert len(spec["blend_words"]) == 3


def test_remove_white_background():
    """Verify that white background cutout correctly sets alpha to 0 for corners and 255 for center leaf."""
    # Create synthetic test image: white background with green center circle
    w, h = 512, 512
    arr = np.full((h, w, 3), 255, dtype=np.uint8)
    yy, xx = np.ogrid[:h, :w]
    circle_mask = (xx - 256) ** 2 + (yy - 256) ** 2 < 100 ** 2
    arr[circle_mask] = [34, 139, 34]  # Forest green

    img = Image.fromarray(arr, mode="RGB")
    result = remove_white_background(img)

    assert result.mode == "RGBA"
    res_arr = np.array(result)
    # Corners must be transparent
    assert res_arr[0, 0, 3] == 0
    assert res_arr[h - 1, w - 1, 3] == 0
    # Center must be opaque
    assert res_arr[256, 256, 3] == 255


def test_normalize_to_target_spec():
    """Verify that images of arbitrary size are centered on an 800x800 RGBA transparent canvas."""
    small_img = Image.new("RGBA", (200, 300), (0, 128, 0, 255))
    normalized = normalize_to_target_spec(small_img, target_size=(800, 800))

    assert normalized.size == (800, 800)
    assert normalized.mode == "RGBA"
    # Corners must be transparent padding
    arr = np.array(normalized)
    assert arr[0, 0, 3] == 0
    assert arr[799, 799, 3] == 0


def test_compute_difference_mask():
    """Verify that difference mask isolates localized changes between two stages."""
    # Stage 0: pure green
    s0 = Image.new("RGBA", (800, 800), (0, 150, 0, 255))
    # Stage 1: green with yellow lesion patch
    s1_arr = np.full((800, 800, 4), [0, 150, 0, 255], dtype=np.uint8)
    s1_arr[300:500, 300:500] = [200, 100, 0, 255]
    s1 = Image.fromarray(s1_arr, mode="RGBA")

    mask = compute_difference_mask(s0, s1)
    assert mask.size == (800, 800)
    mask_arr = np.array(mask)
    # Changed area must have higher intensity than unchanged area
    assert mask_arr[400, 400] > mask_arr[50, 50]


def test_keep_largest_component():
    """Verify that disconnected small border artifacts are eliminated while the primary leaf is preserved."""
    w, h = 800, 800
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    # Large leaf in center (size ~40,000 pixels)
    arr[200:400, 200:400] = [34, 139, 34, 255]
    # Small artifact on right border (size ~50 pixels)
    arr[100:150, 750:751] = [200, 200, 200, 255]

    img = Image.fromarray(arr, mode="RGBA")
    cleaned = keep_largest_component(img)
    cleaned_arr = np.array(cleaned)

    # Leaf preserved
    assert (cleaned_arr[200:400, 200:400, 3] == 255).all()
    # Artifact removed
    assert (cleaned_arr[100:150, 750:751, 3] == 0).all()
