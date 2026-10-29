"""Precision AgriTech - Satellite Service NDVI Math, Cloud Masking, and Colorization.

Pure array operations for Sentinel-2 Level-2A data:
- Surface reflectance conversion with BOA offset correction.
- Normalized Difference Vegetation Index (NDVI) computation.
- Parcel rasterization with sub-pixel fallback.
- Scene statistics calculation and threshold-based classification.
- RGBA colorization with linear colormap interpolation.
"""

from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
import rasterio.features

from geometry import TargetGrid

# SCL classes considered cloud/shadow/snow-free:
# 4 = Vegetation, 5 = Not-vegetated (bare soil), 6 = Water, 7 = Unclassified
SCL_VALID: frozenset[int] = frozenset({4, 5, 6, 7})

NDVI_COLOR_STOPS: list[tuple[float, str]] = [
    (-0.2, "#8c510a"),
    (0.1, "#d8b365"),
    (0.3, "#f6e8c3"),
    (0.5, "#a6d96a"),
    (0.7, "#1a9641"),
    (0.9, "#00441b"),
]


def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    """Parse a hex color string like '#8c510a' into (R, G, B) integer tuple."""
    hex_clean = hex_str.lstrip("#")
    return int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)


_COLORMAP_XP = [stop[0] for stop in NDVI_COLOR_STOPS]
_COLORMAP_R = [_hex_to_rgb(stop[1])[0] for stop in NDVI_COLOR_STOPS]
_COLORMAP_G = [_hex_to_rgb(stop[1])[1] for stop in NDVI_COLOR_STOPS]
_COLORMAP_B = [_hex_to_rgb(stop[1])[2] for stop in NDVI_COLOR_STOPS]


def boa_offset(properties: dict[str, Any]) -> int:
    """Determine radiometric BOA offset (0 or 1000) for Sentinel-2 L2A assets.

    Rule based on Task 1 data analysis (README.md Data notes):
    1. If 'earthsearch:boa_offset_applied' is True, Element 84 has already removed
       the radiometric offset in the published COG -> offset = 0.
    2. Else if processing baseline >= '04.00' (via 's2:processing_baseline' or
       'processing:baseline'), ESA added +1000 DN offset -> offset = 1000.
    3. Else (pre-04.00 legacy products, e.g. baseline 02.xx/03.xx) -> offset = 0.

    Evidence from Data Spike (Konya Plain point 32.601, 38.001):
    - S2B_36SVH_20210730_1_L2A: earthsearch:boa_offset_applied: True, baseline '05.00'
      Raw DNs: RED=1810, NIR=2744.
      offset 0 -> median NDVI 0.1992 (matches dry summer cropland phenology).
      offset 1000 -> median NDVI 0.3601 (unphysically high for harvested dry field).
    - S2B_36SVH_20230720_0_L2A: earthsearch:boa_offset_applied: True, baseline '05.09'
      Raw DNs: RED=1593, NIR=2555.
      offset 0 -> median NDVI 0.2198.
      offset 1000 -> median NDVI 0.4278.
    - S2B_36SVH_20210829_0_L2A: earthsearch:boa_offset_applied: False, baseline '03.01'
      Raw DNs: RED=1875, NIR=2672 -> offset 0 -> median NDVI 0.1730.
    """
    if properties.get("earthsearch:boa_offset_applied") is True:
        return 0
    elif (
        properties.get("s2:processing_baseline")
        or properties.get("processing:baseline")
        or ""
    ) >= "04.00":
        return 1000
    else:
        return 0


def reflectance(dn: np.ndarray, offset: int) -> np.ndarray:
    """Convert digital numbers (DN) to surface reflectance as float32.

    Formula: refl = (dn - offset) / 10000.0.
    DN == 0 indicates nodata and is mapped to NaN.
    """
    dn_float = np.asarray(dn, dtype=np.float32)
    refl = (dn_float - float(offset)) / 10000.0
    refl[dn_float == 0] = np.nan
    return refl


def compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Compute Normalized Difference Vegetation Index (NDVI) as float32.

    Formula: (nir - red) / (nir + red).
    Pixels where red + nir <= 0, or where either input is NaN, become NaN.
    """
    red_arr = np.asarray(red, dtype=np.float32)
    nir_arr = np.asarray(nir, dtype=np.float32)

    denom = nir_arr + red_arr
    numer = nir_arr - red_arr

    with np.errstate(divide="ignore", invalid="ignore"):
        invalid = (denom <= 0) | np.isnan(red_arr) | np.isnan(nir_arr)
        ndvi = np.where(invalid, np.nan, numer / np.where(invalid, 1.0, denom))

    return ndvi.astype(np.float32)


def inside_mask(geom: Any, grid: TargetGrid) -> np.ndarray:
    """Rasterize geometry onto target grid.

    Uses rasterio.features.geometry_mask with invert=True (inside polygon is True).
    If parcel is smaller than a grid cell (mask.sum() == 0), falls back to all_touched=True.
    """
    mask = rasterio.features.geometry_mask(
        [geom],
        out_shape=(grid.height, grid.width),
        transform=grid.transform,
        invert=True,
        all_touched=False,
    )
    if mask.sum() == 0:
        mask = rasterio.features.geometry_mask(
            [geom],
            out_shape=(grid.height, grid.width),
            transform=grid.transform,
            invert=True,
            all_touched=True,
        )
    return mask


@dataclass
class SceneStats:
    """Summary statistics for an acquired satellite scene over parcel extent."""

    valid: np.ndarray
    valid_fraction: float
    mean_ndvi: float | None
    all_nodata: bool


def scene_stats(ndvi: np.ndarray, scl: np.ndarray, inside: np.ndarray) -> SceneStats:
    """Compute validity mask and statistics for a scene over parcel geometry."""
    valid = inside & np.isin(scl, list(SCL_VALID)) & np.isfinite(ndvi)
    inside_count = int(inside.sum())
    valid_count = int(valid.sum())

    valid_fraction = float(valid_count / inside_count) if inside_count > 0 else 0.0
    mean_ndvi = float(np.nanmean(ndvi[valid])) if valid_count > 0 else None
    all_nodata = bool(np.isnan(ndvi[inside]).all()) if inside_count > 0 else True

    return SceneStats(
        valid=valid,
        valid_fraction=valid_fraction,
        mean_ndvi=mean_ndvi,
        all_nodata=all_nodata,
    )


def classify(
    stats: SceneStats, min_valid_fraction: float
) -> Literal["frame", "cloudy", "no_data"]:
    """Classify scene based on valid pixel fraction and nodata status."""
    if stats.all_nodata:
        return "no_data"
    elif stats.valid_fraction < min_valid_fraction:
        return "cloudy"
    else:
        return "frame"


def colorize(ndvi: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Colorize NDVI array to RGBA uint8 image.

    Interpolates RGB linearly between NDVI_COLOR_STOPS, clamping outside [-0.2, 0.9].
    Alpha is 255 where valid is True, 0 elsewhere.
    """
    r = np.nan_to_num(
        np.round(np.interp(ndvi, _COLORMAP_XP, _COLORMAP_R)), nan=0.0
    ).astype(np.uint8)
    g = np.nan_to_num(
        np.round(np.interp(ndvi, _COLORMAP_XP, _COLORMAP_G)), nan=0.0
    ).astype(np.uint8)
    b = np.nan_to_num(
        np.round(np.interp(ndvi, _COLORMAP_XP, _COLORMAP_B)), nan=0.0
    ).astype(np.uint8)

    alpha = np.where(valid, 255, 0).astype(np.uint8)
    return np.stack([r, g, b, alpha], axis=-1)
