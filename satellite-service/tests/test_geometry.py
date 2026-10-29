import math
from datetime import date
import pytest
from shapely.geometry import shape

from geometry import (
    GeometryError,
    geodesic_area_ha,
    job_id_for,
    parse_parcel_geometry,
    target_grid,
    time_window,
)

SQUARE = {
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


def test_rejects_non_polygon():
    with pytest.raises(GeometryError):
        parse_parcel_geometry({"type": "Point", "coordinates": [32.6, 38.0]})
    with pytest.raises(GeometryError):
        parse_parcel_geometry(
            {"type": "LineString", "coordinates": [[32.6, 38.0], [32.61, 38.01]]}
        )


def test_rejects_self_intersecting():
    bowtie = {
        "type": "Polygon",
        "coordinates": [
            [
                [32.6, 38.0],
                [32.602, 38.002],
                [32.6, 38.002],
                [32.602, 38.0],
                [32.6, 38.0],
            ]
        ],
    }
    with pytest.raises(GeometryError, match=r"(?i)invalid"):
        parse_parcel_geometry(bowtie)


def test_rejects_empty():
    with pytest.raises(GeometryError):
        parse_parcel_geometry({"type": "Polygon", "coordinates": []})


def test_rejects_over_area_limit():
    # ~0.05° square (~2000 ha) with max_area_ha=1000 → GeometryError, message mentions "1000"
    big_square = {
        "type": "Polygon",
        "coordinates": [
            [
                [32.6, 38.0],
                [32.65, 38.0],
                [32.65, 38.05],
                [32.6, 38.05],
                [32.6, 38.0],
            ]
        ],
    }
    with pytest.raises(GeometryError, match=r"1000"):
        parse_parcel_geometry(big_square, max_area_ha=1000)


def test_square_area():
    area = geodesic_area_ha(SQUARE)
    assert abs(area - 3.85) < 0.1


def test_multipolygon_accepted_and_area_summed():
    multi = {
        "type": "MultiPolygon",
        "coordinates": [
            [
                [
                    [32.6, 38.0],
                    [32.602, 38.0],
                    [32.602, 38.002],
                    [32.6, 38.002],
                    [32.6, 38.0],
                ]
            ],
            [
                [
                    [32.61, 38.0],
                    [32.612, 38.0],
                    [32.612, 38.002],
                    [32.61, 38.002],
                    [32.61, 38.0],
                ]
            ],
        ],
    }
    geom = parse_parcel_geometry(multi)
    area_single = geodesic_area_ha(SQUARE)
    area_multi = geodesic_area_ha(geom)
    assert abs(area_multi - 2 * area_single) < 0.05


def test_job_id_stable_under_ring_rotation_and_jitter():
    # same SQUARE with ring rotated by one vertex and coordinates +4e-7 → identical job_id; len == 16, all hex
    square_rot_jitter = {
        "type": "Polygon",
        "coordinates": [
            [
                [32.602 + 4e-7, 38.0 + 4e-7],
                [32.602 + 4e-7, 38.002 + 4e-7],
                [32.6 + 4e-7, 38.002 + 4e-7],
                [32.6 + 4e-7, 38.0 + 4e-7],
                [32.602 + 4e-7, 38.0 + 4e-7],
            ]
        ],
    }
    s = date(2025, 10, 27)
    e = date(2026, 10, 26)
    id1 = job_id_for(SQUARE, s, e)
    id2 = job_id_for(square_rot_jitter, s, e)
    assert id1 == id2
    assert len(id1) == 16
    assert all(c in "0123456789abcdef" for c in id1)


def test_job_id_changes_with_window():
    id1 = job_id_for(SQUARE, date(2025, 10, 27), date(2026, 10, 26))
    id2 = job_id_for(SQUARE, date(2025, 10, 20), date(2026, 10, 19))
    assert id1 != id2


def test_window_ends_on_most_recent_monday():
    assert time_window(date(2026, 10, 28), 365) == (
        date(2025, 10, 27),
        date(2026, 10, 26),
    )  # Wednesday
    assert time_window(date(2026, 10, 26), 365) == (
        date(2025, 10, 27),
        date(2026, 10, 26),
    )  # Monday itself


def test_target_grid_covers_buffered_bbox():
    g = target_grid(shape(SQUARE), buffer_m=20)
    # bounds south < 38.0 - 0.00017 and north > 38.002 + 0.00017; width, height in 20..30;
    # transform.a > 0, transform.e < 0; bounds recomputed from transform (north == transform.f)
    assert g.bounds[0][0] < 38.0 - 0.00017
    assert g.bounds[1][0] > 38.002 + 0.00017
    assert 20 <= g.width <= 30
    assert 20 <= g.height <= 30
    assert g.transform.a > 0
    assert g.transform.e < 0
    assert g.bounds[1][0] == g.transform.f


def test_rejects_non_dict_and_malformed():
    with pytest.raises(GeometryError, match=r"dictionary"):
        parse_parcel_geometry("not-a-dict")  # type: ignore
    with pytest.raises(GeometryError, match=r"Invalid GeoJSON"):
        parse_parcel_geometry({"type": "Polygon", "coordinates": "invalid"})


def test_target_grid_with_dict_and_defaults():
    g = target_grid(SQUARE)
    assert g.width > 0
    assert g.height > 0
    assert len(g.bounds) == 2


def test_job_id_with_geometry_and_string_dates():
    geom = shape(SQUARE)
    id1 = job_id_for(geom, "2025-10-27", "2026-10-26")
    id2 = job_id_for(SQUARE, date(2025, 10, 27), date(2026, 10, 26))
    assert id1 == id2
