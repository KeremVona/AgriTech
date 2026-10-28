"""Precision AgriTech - Satellite Service Live Smoke Test.

Connects to the real Earth Search STAC endpoint, retrieves Sentinel-2 L2A COG bands,
and verifies end-to-end NDVI processing over a sample Konya parcel.
"""

from datetime import date
from pathlib import Path

import pytest

from geometry import target_grid
from processor import process_scene
from schemas import Frame
from stac import one_per_day, search_items


@pytest.mark.live
def test_live_sentinel2_smoke(tmp_path: Path):
    """End-to-end smoke test verifying STAC search, dedupe, and scene processing."""
    geom = {
        "type": "Polygon",
        "coordinates": [
            [
                [32.6, 38.0],
                [32.602, 38.0],
                [32.602, 38.002],
                [32.6, 38.002],
                [32.6, 38.0],
            ]
        ],
    }
    start = date(2023, 7, 1)
    end = date(2023, 7, 31)

    items = search_items(geom, start, end)
    assert len(items) > 0, "Expected at least one Sentinel-2 scene from Earth Search"

    daily_items = one_per_day(items)
    assert len(daily_items) > 0

    clear_items = [
        item
        for item in daily_items
        if float(item.properties.get("eo:cloud_cover", 100.0)) < 20.0
    ]
    assert len(clear_items) > 0, "Expected at least one scene with eo:cloud_cover < 20%"

    chosen_item = clear_items[0]
    grid = target_grid(geom)
    job_id = "live_smoke_job_id"

    result = process_scene(chosen_item, geom, grid, tmp_path, job_id)

    assert isinstance(result, Frame), f"Expected Frame result, got {type(result)}: {result}"
    frame_png = tmp_path / f"{result.date}.png"
    assert frame_png.exists(), f"Expected frame PNG at {frame_png}"
    assert frame_png.stat().st_size > 0

    assert -0.2 <= result.mean_ndvi <= 1.0, f"mean_ndvi {result.mean_ndvi} out of range"
    assert 0.5 <= result.valid_fraction <= 1.0, f"valid_fraction {result.valid_fraction} out of range"
    assert result.png_url == f"/api/v1/ndvi/frames/{job_id}/{result.date}.png"
