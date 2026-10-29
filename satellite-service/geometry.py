"""Precision AgriTech - Satellite Service Geometry Validation and Grid Utilities.

Provides parcel geometry validation, geodesic area calculation, time windowing,
canonical job identifier generation, and target grid construction.
"""

from dataclasses import dataclass
from datetime import date, timedelta
import hashlib
import math

import affine
import pyproj
import rasterio.transform
import shapely
import shapely.validation
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from config import settings

GEOD = pyproj.Geod(ellps="WGS84")


class GeometryError(ValueError):
    """Raised when a parcel geometry is invalid, empty, wrong type, or over area limit."""

    pass


@dataclass(frozen=True)
class TargetGrid:
    """Target raster grid specification for warp and NDVI computation.

    Attributes:
        transform: Affine transform from pixel coordinates to EPSG:4326.
        width: Raster width in pixels.
        height: Raster height in pixels.
        bounds: Extent [[south, west], [north, east]] matching pixels exactly.
    """

    transform: affine.Affine
    width: int
    height: int
    bounds: list[list[float]]


def geodesic_area_ha(geom: BaseGeometry | dict) -> float:
    """Calculate geodesic area of a geometry in hectares on WGS84 ellipsoid."""
    if isinstance(geom, dict):
        geom = shape(geom)
    area, _ = GEOD.geometry_area_perimeter(geom)
    return abs(area) / 10_000.0


def parse_parcel_geometry(
    geojson: dict,
    max_area_ha: float | None = None,
) -> BaseGeometry:
    """Parse and validate a GeoJSON parcel geometry.

    Args:
        geojson: GeoJSON geometry dict.
        max_area_ha: Maximum allowed geodesic area in hectares. Defaults to settings.max_area_ha.

    Returns:
        Validated Shapely geometry (Polygon or MultiPolygon).

    Raises:
        GeometryError: If input is invalid, not a Polygon/MultiPolygon, empty, or exceeds max_area_ha.
    """
    if max_area_ha is None:
        max_area_ha = settings.max_area_ha

    if not isinstance(geojson, dict):
        raise GeometryError("Geometry must be a dictionary")

    try:
        geom = shape(geojson)
    except Exception as exc:
        raise GeometryError(f"Invalid GeoJSON geometry: {exc}") from exc

    if geom.geom_type not in {"Polygon", "MultiPolygon"}:
        raise GeometryError(
            f"Geometry must be Polygon or MultiPolygon, got {geom.geom_type}"
        )

    if geom.is_empty:
        raise GeometryError("Geometry is empty")

    if not geom.is_valid:
        reason = shapely.validation.explain_validity(geom)
        raise GeometryError(f"Geometry is invalid: {reason}")

    area_ha = geodesic_area_ha(geom)
    if area_ha <= 0:
        raise GeometryError("Geometry has zero area")

    if area_ha > max_area_ha:
        raise GeometryError(
            f"Geometry area ({area_ha:.2f} ha) exceeds limit of {max_area_ha} ha"
        )

    return geom


def time_window(today: date, window_days: int) -> tuple[date, date]:
    """Calculate date window ending on the most recent Monday on or before today."""
    # shortcut: weekly cache granularity, newest pass can be up to 7 days old; switch to incremental appends if fresher data is needed
    end = today - timedelta(days=today.weekday())
    start = end - timedelta(days=window_days - 1)
    return (start, end)


def job_id_for(geom: BaseGeometry | dict, start: date | str, end: date | str) -> str:
    """Generate a canonical deterministic 16-hex job ID from geometry and date window."""
    if isinstance(geom, dict):
        geom = shape(geom)

    canonical = shapely.normalize(shapely.set_precision(geom, 1e-6))
    canonical_wkb_hex = shapely.to_wkb(canonical, hex=True)

    start_str = start.isoformat() if hasattr(start, "isoformat") else str(start)
    end_str = end.isoformat() if hasattr(end, "isoformat") else str(end)

    payload = f"{canonical_wkb_hex}|{start_str}|{end_str}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def target_grid(
    geom: BaseGeometry | dict,
    buffer_m: float | None = None,
    pixel_m: float = 10.0,
) -> TargetGrid:
    """Build TargetGrid covering parcel bounding box buffered by buffer_m in EPSG:4326.

    Args:
        geom: Parcel geometry (Shapely geometry or GeoJSON dict).
        buffer_m: Buffer distance in metres around parcel bounding box.
        pixel_m: Pixel size in metres (default 10.0m for Sentinel-2).

    Returns:
        TargetGrid with transform, pixel dimensions, and pixel-aligned bounds.
    """
    if buffer_m is None:
        buffer_m = settings.grid_buffer_m

    if isinstance(geom, dict):
        geom = shape(geom)

    minx, miny, maxx, maxy = geom.bounds
    centroid_lat = geom.centroid.y
    lat_rad = math.radians(centroid_lat)
    cos_lat = math.cos(lat_rad)

    dy = pixel_m / 111320.0
    dx = pixel_m / (111320.0 * cos_lat)

    buf_lat = buffer_m / 111320.0
    buf_lon = buffer_m / (111320.0 * cos_lat)

    west_init = minx - buf_lon
    east_init = maxx + buf_lon
    south_init = miny - buf_lat
    north_init = maxy + buf_lat

    width = math.ceil((east_init - west_init) / dx)
    height = math.ceil((north_init - south_init) / dy)

    transform = rasterio.transform.from_origin(west_init, north_init, dx, dy)

    # Bounds recomputed from transform so it matches pixels exactly:
    # transform.f is north; transform.e is negative (-dy), so south = north + height * transform.e
    south = transform.f + height * transform.e
    north = transform.f
    west = transform.c
    east = transform.c + width * transform.a

    bounds = [[south, west], [north, east]]

    return TargetGrid(
        transform=transform,
        width=width,
        height=height,
        bounds=bounds,
    )
