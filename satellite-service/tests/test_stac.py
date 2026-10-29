"""Precision AgriTech - Satellite Service STAC & Processing Tests.

Tests deduplication, tie-breaking, UTC date handling, schemas, and scene processor.
"""

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pytest

from config import settings
from geometry import target_grid
from schemas import Frame, JobRequest, JobStatus, Progress, Skipped, Window
from stac import one_per_day
import processor


def test_one_per_day_keeps_lowest_cloud():
    """Two items on the same UTC date with clouds 30 and 10 -> chooses the 10 one."""
    dt = datetime(2026, 5, 14, 10, 0, tzinfo=timezone.utc)
    item_cloud30 = SimpleNamespace(
        id="S2A_scene_30",
        datetime=dt,
        properties={"eo:cloud_cover": 30.0},
    )
    item_cloud10 = SimpleNamespace(
        id="S2B_scene_10",
        datetime=dt,
        properties={"eo:cloud_cover": 10.0},
    )

    result = one_per_day([item_cloud30, item_cloud10])
    assert len(result) == 1
    assert result[0].id == "S2B_scene_10"
    assert result[0].properties["eo:cloud_cover"] == 10.0


def test_one_per_day_tie_breaks_on_id():
    """Same date, same cloud cover -> chooses lexicographically smaller id."""
    dt = datetime(2026, 5, 14, 10, 0, tzinfo=timezone.utc)
    item_b = SimpleNamespace(
        id="S2B_scene",
        datetime=dt,
        properties={"eo:cloud_cover": 15.0},
    )
    item_a = SimpleNamespace(
        id="S2A_scene",
        datetime=dt,
        properties={"eo:cloud_cover": 15.0},
    )

    result = one_per_day([item_b, item_a])
    assert len(result) == 1
    assert result[0].id == "S2A_scene"


def test_one_per_day_sorted_and_uses_utc_date():
    """Item at 2026-05-14T23:30Z and 2026-05-15T00:10Z -> two dates, ascending."""
    item1 = SimpleNamespace(
        id="item-day1",
        datetime=datetime(2026, 5, 14, 23, 30, tzinfo=timezone.utc),
        properties={"eo:cloud_cover": 20.0},
    )
    item2 = SimpleNamespace(
        id="item-day2",
        datetime=datetime(2026, 5, 15, 0, 10, tzinfo=timezone.utc),
        properties={"eo:cloud_cover": 25.0},
    )

    result = one_per_day([item2, item1])
    assert len(result) == 2
    assert result[0].id == "item-day1"
    assert result[1].id == "item-day2"


def test_schemas_job_status_validation():
    """JobStatus and its child schemas validate correctly."""
    frame = Frame(
        date="2026-05-14",
        scene_id="S2B_35TPF_20260514_0_L2A",
        mean_ndvi=0.6123,
        valid_fraction=0.93,
        png_url="/api/v1/ndvi/frames/3f9a0c1b2d4e5f60/2026-05-14.png",
    )
    skipped = Skipped(
        date="2026-05-09",
        scene_id="S2A_35TPF_20260509_0_L2A",
        reason="cloudy",
        valid_fraction=0.12,
    )
    status = JobStatus(
        job_id="3f9a0c1b2d4e5f60",
        parcel_id="abc",
        status="running",
        window=Window(start="2025-10-27", end="2026-10-26"),
        bounds=[[38.0, 32.6], [38.002, 32.602]],
        progress=Progress(processed=34, total=82),
        frames=[frame],
        skipped=[skipped],
    )
    assert status.job_id == "3f9a0c1b2d4e5f60"
    assert status.frames[0].mean_ndvi == 0.6123
    assert status.skipped[0].reason == "cloudy"
    assert status.error is None

    req = JobRequest(
        geometry={"type": "Polygon", "coordinates": [[[32.6, 38.0], [32.602, 38.0], [32.602, 38.002], [32.6, 38.0]]]},
        parcel_id="parcel-1",
    )
    assert req.parcel_id == "parcel-1"


def test_processor_retries_and_returns_read_error_on_failure(tmp_path: Path):
    """Processor retries on read exception and returns Skipped(reason='read_error') on 2nd failure."""
    geom = {
        "type": "Polygon",
        "coordinates": [[[32.6, 38.0], [32.602, 38.0], [32.602, 38.002], [32.6, 38.002], [32.6, 38.0]]],
    }
    grid = target_grid(geom)
    item = SimpleNamespace(
        id="bad_scene",
        datetime=datetime(2026, 5, 14, 10, 0, tzinfo=timezone.utc),
        properties={"eo:cloud_cover": 5.0},
        assets={
            "red": SimpleNamespace(href="https://example.com/red.tif"),
            "nir": SimpleNamespace(href="https://example.com/nir.tif"),
            "scl": SimpleNamespace(href="https://example.com/scl.tif"),
        },
    )

    with patch("processor._read_band", side_effect=RuntimeError("Network timeout")):
        result = processor.process_scene(item, geom, grid, tmp_path, "test_job_123")

    assert isinstance(result, Skipped)
    assert result.date == "2026-05-14"
    assert result.scene_id == "bad_scene"
    assert result.reason == "read_error"
    assert result.valid_fraction is None


def test_processor_success_produces_frame(tmp_path: Path):
    """Processor successfully reads bands, computes NDVI, and saves PNG."""
    geom = {
        "type": "Polygon",
        "coordinates": [[[32.6, 38.0], [32.602, 38.0], [32.602, 38.002], [32.6, 38.002], [32.6, 38.0]]],
    }
    grid = target_grid(geom)
    item = SimpleNamespace(
        id="good_scene",
        datetime=datetime(2026, 5, 14, 10, 0, tzinfo=timezone.utc),
        properties={"earthsearch:boa_offset_applied": True, "eo:cloud_cover": 5.0},
        assets={
            "red": SimpleNamespace(href="https://example.com/red.tif"),
            "nir": SimpleNamespace(href="https://example.com/nir.tif"),
            "scl": SimpleNamespace(href="https://example.com/scl.tif"),
        },
    )

    H, W = grid.height, grid.width
    red_data = np.full((H, W), 1000.0, dtype=np.float32)
    nir_data = np.full((H, W), 3000.0, dtype=np.float32)
    scl_data = np.full((H, W), 4.0, dtype=np.float32)

    def fake_read_band(href, g, resampling):
        if "red" in href:
            return red_data
        elif "nir" in href:
            return nir_data
        else:
            return scl_data

    with patch("processor._read_band", side_effect=fake_read_band):
        result = processor.process_scene(item, geom, grid, tmp_path, "test_job_123")

    assert isinstance(result, Frame)
    assert result.date == "2026-05-14"
    assert result.scene_id == "good_scene"
    assert result.mean_ndvi == 0.5
    assert result.valid_fraction == 1.0
    assert result.png_url == "/api/v1/ndvi/frames/test_job_123/2026-05-14.png"
    assert (tmp_path / "2026-05-14.png").exists()
