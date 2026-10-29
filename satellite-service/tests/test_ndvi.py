"""Tests for NDVI calculation, SCL cloud masking, scene classification, and colorization."""

import affine
import numpy as np
import pytest
import shapely.geometry

from geometry import TargetGrid
from ndvi import (
    NDVI_COLOR_STOPS,
    SCL_VALID,
    SceneStats,
    boa_offset,
    classify,
    colorize,
    compute_ndvi,
    inside_mask,
    reflectance,
    scene_stats,
)


def test_boa_offset_branches():
    # Branch 1: earthsearch:boa_offset_applied is True -> offset 0
    props_branch1 = {
        "earthsearch:boa_offset_applied": True,
        "s2:processing_baseline": "05.00",
    }
    assert boa_offset(props_branch1) == 0

    # Branch 2: earthsearch:boa_offset_applied is not True AND baseline >= "04.00" -> offset 1000
    props_branch2_s2 = {
        "earthsearch:boa_offset_applied": False,
        "s2:processing_baseline": "04.00",
    }
    assert boa_offset(props_branch2_s2) == 1000

    props_branch2_proc = {
        "earthsearch:boa_offset_applied": False,
        "processing:baseline": "04.02",
    }
    assert boa_offset(props_branch2_proc) == 1000

    # Branch 3: All other scenes (baseline < "04.00" or missing) -> offset 0
    props_branch3_legacy = {
        "earthsearch:boa_offset_applied": False,
        "s2:processing_baseline": "03.01",
    }
    assert boa_offset(props_branch3_legacy) == 0

    props_branch3_empty = {}
    assert boa_offset(props_branch3_empty) == 0


def test_reflectance_offsets():
    assert reflectance(np.array([2000]), 0)[0] == pytest.approx(0.2)
    assert reflectance(np.array([2000]), 1000)[0] == pytest.approx(0.1)
    assert np.isnan(reflectance(np.array([0]), 1000)[0])
    # Dtype check
    refl = reflectance(np.array([2000]), 0)
    assert refl.dtype == np.float32


def test_ndvi_known_values():
    # red .1, nir .5 -> (0.5 - 0.1) / (0.5 + 0.1) = 0.4 / 0.6 = 0.66666...
    red = np.array([0.1], dtype=np.float32)
    nir = np.array([0.5], dtype=np.float32)
    ndvi = compute_ndvi(red, nir)
    assert ndvi[0] == pytest.approx(0.6667, abs=1e-4)
    assert ndvi.dtype == np.float32


def test_ndvi_zero_sum_is_nan():
    # red 0, nir 0 -> NaN
    res_zero = compute_ndvi(np.array([0.0]), np.array([0.0]))
    assert np.isnan(res_zero[0])

    # red NaN -> NaN
    res_nan = compute_ndvi(np.array([np.nan]), np.array([0.5]))
    assert np.isnan(res_nan[0])

    # nir NaN -> NaN
    res_nan_nir = compute_ndvi(np.array([0.5]), np.array([np.nan]))
    assert np.isnan(res_nan_nir[0])

    # red + nir <= 0 -> NaN
    res_neg = compute_ndvi(np.array([0.5]), np.array([-0.6]))
    assert np.isnan(res_neg[0])


def test_scene_stats_valid_classes():
    # 4x4 inside-all, scl = [4,5,6,7 | 8,9,3,10 | ...]; only {4,5,6,7} counted; valid_fraction exact
    inside = np.ones((4, 4), dtype=bool)
    scl = np.array([
        [4, 5, 6, 7],      # all 4 valid
        [8, 9, 3, 10],     # all 4 invalid
        [1, 2, 11, 0],     # all 4 invalid
        [4, 5, 8, 9],      # 2 valid (4, 5)
    ], dtype=np.uint8)
    ndvi = np.full((4, 4), 0.5, dtype=np.float32)

    stats = scene_stats(ndvi, scl, inside)
    # Valid pixels: 4 in row 0 + 2 in row 3 = 6
    assert stats.valid.sum() == 6
    assert stats.valid_fraction == pytest.approx(6.0 / 16.0)
    assert stats.mean_ndvi == pytest.approx(0.5)
    assert stats.all_nodata is False

    # Check SCL_VALID constant
    assert SCL_VALID == frozenset({4, 5, 6, 7})


def test_scene_stats_nan_handling():
    inside = np.ones((2, 2), dtype=bool)
    scl = np.array([[4, 4], [4, 4]], dtype=np.uint8)
    # All NaN ndvi inside
    ndvi_all_nan = np.full((2, 2), np.nan, dtype=np.float32)
    stats = scene_stats(ndvi_all_nan, scl, inside)
    assert stats.all_nodata is True
    assert stats.valid.sum() == 0
    assert stats.valid_fraction == 0.0
    assert stats.mean_ndvi is None


def test_inside_mask_tiny_parcel_falls_back_to_all_touched():
    # parcel 3 m x 3 m in a 10m grid -> mask.sum() >= 1
    # At lat 38, 10m is roughly 0.0001 deg
    dx = 0.0001
    dy = 0.0001
    west = 32.6
    north = 38.0
    tr = affine.Affine(dx, 0, west, 0, -dy, north)
    grid = TargetGrid(
        transform=tr,
        width=5,
        height=5,
        bounds=[[north - 5 * dy, west], [north, west + 5 * dx]],
    )
    # Tiny parcel (0.00002 deg ~ 2m) off the pixel center: all_touched=False would yield 0
    tiny_poly = shapely.geometry.box(32.60001, 37.99997, 32.60003, 37.99999)
    mask = inside_mask(tiny_poly, grid)
    assert mask.shape == (5, 5)
    assert mask.dtype == bool
    assert mask.sum() >= 1


def test_inside_mask_multipolygon():
    # Two parts far apart in one grid -> both regions True, gap False
    tr = affine.Affine(1.0, 0, 0, 0, -1.0, 10)
    grid = TargetGrid(
        transform=tr,
        width=10,
        height=10,
        bounds=[[0, 0], [10, 10]],
    )
    p1 = shapely.geometry.box(1, 7, 3, 9)
    p2 = shapely.geometry.box(7, 1, 9, 3)
    mp = shapely.geometry.MultiPolygon([p1, p2])

    mask = inside_mask(mp, grid)
    assert mask.shape == (10, 10)
    assert mask[2, 2] is np.True_  # inside p1
    assert mask[8, 8] is np.True_  # inside p2
    assert mask[5, 5] is np.False_  # in gap between them


def test_classify_boundaries():
    # all_nodata -> "no_data"
    stats_nodata = SceneStats(
        valid=np.zeros((2, 2), dtype=bool),
        valid_fraction=0.0,
        mean_ndvi=None,
        all_nodata=True,
    )
    assert classify(stats_nodata, min_valid_fraction=0.5) == "no_data"

    # valid_fraction 0.49 -> "cloudy"
    stats_cloudy = SceneStats(
        valid=np.zeros((2, 2), dtype=bool),
        valid_fraction=0.49,
        mean_ndvi=0.4,
        all_nodata=False,
    )
    assert classify(stats_cloudy, min_valid_fraction=0.5) == "cloudy"

    # exactly 0.5 -> "frame"
    stats_frame = SceneStats(
        valid=np.ones((2, 2), dtype=bool),
        valid_fraction=0.5,
        mean_ndvi=0.5,
        all_nodata=False,
    )
    assert classify(stats_frame, min_valid_fraction=0.5) == "frame"

    # valid_fraction > 0.5 -> "frame"
    stats_frame_high = SceneStats(
        valid=np.ones((2, 2), dtype=bool),
        valid_fraction=0.85,
        mean_ndvi=0.6,
        all_nodata=False,
    )
    assert classify(stats_frame_high, min_valid_fraction=0.5) == "frame"


def test_colorize_endpoints_and_alpha():
    # ndvi -0.5 -> rgb of #8c510a (clamped) -> (140, 81, 10)
    # 0.9 and 1.2 -> #00441b -> (0, 68, 27)
    # 0.3 -> #f6e8c3 -> (246, 232, 195)
    # invalid pixel alpha 0; valid alpha 255; dtype uint8
    ndvi = np.array([
        [-0.5, 0.3],
        [0.9, 1.2],
        [np.nan, 0.5],
    ], dtype=np.float32)

    valid = np.array([
        [True, True],
        [False, True],
        [False, True],
    ], dtype=bool)

    rgba = colorize(ndvi, valid)
    assert rgba.shape == (3, 2, 4)
    assert rgba.dtype == np.uint8

    # -0.5 clamped to -0.2 stop (#8c510a)
    np.testing.assert_array_equal(rgba[0, 0, :3], [140, 81, 10])
    assert rgba[0, 0, 3] == 255

    # 0.3 exact stop (#f6e8c3)
    np.testing.assert_array_equal(rgba[0, 1, :3], [246, 232, 195])
    assert rgba[0, 1, 3] == 255

    # 0.9 stop (#00441b), invalid -> alpha 0
    np.testing.assert_array_equal(rgba[1, 0, :3], [0, 68, 27])
    assert rgba[1, 0, 3] == 0

    # 1.2 clamped to 0.9 stop (#00441b), valid -> alpha 255
    np.testing.assert_array_equal(rgba[1, 1, :3], [0, 68, 27])
    assert rgba[1, 1, 3] == 255

    # NaN ndvi, invalid -> alpha 0
    assert rgba[2, 0, 3] == 0

    # Check NDVI_COLOR_STOPS constant
    assert len(NDVI_COLOR_STOPS) == 6
    assert NDVI_COLOR_STOPS[0] == (-0.2, "#8c510a")
    assert NDVI_COLOR_STOPS[-1] == (0.9, "#00441b")
