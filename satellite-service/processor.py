"""Precision AgriTech - Satellite Service Scene Processor.

Warp-reads band assets from Sentinel-2 L2A scenes, calculates NDVI and cloud mask,
and saves colorized PNG frames or classifies scenes as skipped.
"""

import logging
import os
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT

from config import settings
from geometry import TargetGrid
from ndvi import boa_offset, classify, colorize, compute_ndvi, inside_mask, reflectance, scene_stats
from schemas import Frame, Skipped
from stac import _extract_utc_date

# GDAL environment defaults for S3 / COG HTTP streaming
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")

logger = logging.getLogger(__name__)


def _get_asset_href(item: Any, band: str) -> str:
    """Retrieve the URL href for a band asset ('red', 'nir', 'scl') with fallback aliases."""
    aliases = {
        "red": ["red", "B04", "b04"],
        "nir": ["nir", "B08", "b08"],
        "scl": ["scl", "SCL"],
    }
    assets = getattr(item, "assets", {}) or {}
    candidates = aliases.get(band, [band])

    for key in candidates:
        if key in assets:
            asset = assets[key]
            href = getattr(asset, "href", None)
            if href:
                return href
            if isinstance(asset, str):
                return asset

    raise KeyError(f"Band asset '{band}' not found in STAC item assets: {list(assets.keys())}")


def _read_band(
    href: str,
    grid: TargetGrid,
    resampling: Resampling,
) -> np.ndarray:
    """Read a band raster asset warped onto the TargetGrid as float32."""
    with rasterio.open(href) as src:
        with WarpedVRT(
            src,
            crs="EPSG:4326",
            transform=grid.transform,
            width=grid.width,
            height=grid.height,
            resampling=resampling,
        ) as vrt:
            return vrt.read(1).astype(np.float32)


def process_scene(
    item: Any,
    geom: Any,
    grid: TargetGrid,
    frames_dir: Path | str,
    job_id: str,
) -> Frame | Skipped:
    """Process a single Sentinel-2 STAC item over the parcel geometry.

    Retries once on read/computation errors before returning a Skipped(reason="read_error").
    """
    date_str = _extract_utc_date(item)
    scene_id = str(getattr(item, "id", ""))
    frames_path = Path(frames_dir)

    for attempt in range(2):
        try:
            red_href = _get_asset_href(item, "red")
            nir_href = _get_asset_href(item, "nir")
            scl_href = _get_asset_href(item, "scl")

            red_dn = _read_band(red_href, grid, Resampling.bilinear)
            nir_dn = _read_band(nir_href, grid, Resampling.bilinear)
            scl = _read_band(scl_href, grid, Resampling.nearest)

            props = getattr(item, "properties", {}) or {}
            offset = boa_offset(props)
            red_refl = reflectance(red_dn, offset)
            nir_refl = reflectance(nir_dn, offset)

            ndvi = compute_ndvi(red_refl, nir_refl)
            inside = inside_mask(geom, grid)
            stats = scene_stats(ndvi, scl, inside)

            cls = classify(stats, settings.min_valid_fraction)
            if cls == "no_data":
                return Skipped(
                    date=date_str,
                    scene_id=scene_id,
                    reason="no_data",
                    valid_fraction=round(stats.valid_fraction, 2),
                )
            elif cls == "cloudy":
                return Skipped(
                    date=date_str,
                    scene_id=scene_id,
                    reason="cloudy",
                    valid_fraction=round(stats.valid_fraction, 2),
                )
            else:  # "frame"
                rgba = colorize(ndvi, stats.valid)
                frames_path.mkdir(parents=True, exist_ok=True)
                img = Image.fromarray(rgba)
                frame_file = frames_path / f"{date_str}.png"
                img.save(frame_file, format="PNG")

                mean_val = round(stats.mean_ndvi, 4) if stats.mean_ndvi is not None else 0.0
                valid_val = round(stats.valid_fraction, 2)
                png_url = f"/api/v1/ndvi/frames/{job_id}/{date_str}.png"

                return Frame(
                    date=date_str,
                    scene_id=scene_id,
                    mean_ndvi=mean_val,
                    valid_fraction=valid_val,
                    png_url=png_url,
                )
        except Exception as exc:
            if attempt == 0:
                logger.info(
                    "Retrying scene %s (%s) after error: %s", scene_id, date_str, exc
                )
                continue
            logger.warning(
                "Failed to process scene %s (%s) after 2 attempts: %s",
                scene_id,
                date_str,
                exc,
            )
            return Skipped(
                date=date_str,
                scene_id=scene_id,
                reason="read_error",
                valid_fraction=None,
            )
