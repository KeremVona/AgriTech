"""Precision AgriTech - Satellite Service STAC Client & Deduplication.

Handles searching Earth Search Sentinel-2 L2A STAC items and filtering to
one deterministic best item per UTC day.
"""

from collections.abc import Iterable
from datetime import date, datetime, timezone
from typing import Any

import pystac
import pystac_client
from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

from config import settings


def _extract_utc_date(item: Any) -> str:
    """Extract UTC YYYY-MM-DD date string from STAC Item or compatible object."""
    dt = getattr(item, "datetime", None)
    if dt is None and hasattr(item, "properties") and isinstance(item.properties, dict):
        dt = item.properties.get("datetime")

    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%d")
    elif isinstance(dt, date):
        return dt.strftime("%Y-%m-%d")
    elif isinstance(dt, str):
        try:
            cleaned = dt.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(cleaned)
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc)
            return parsed.strftime("%Y-%m-%d")
        except Exception:
            return dt[:10]

    raise ValueError(f"Unable to extract datetime from item: {item}")


def search_items(
    geom: dict | BaseGeometry,
    start: date | str,
    end: date | str,
) -> list[pystac.Item]:
    """Search Earth Search STAC for Sentinel-2 L2A items intersecting geometry and date window.

    Filters scenes with eo:cloud_cover < settings.scene_cloud_max.
    """
    intersects = mapping(geom) if isinstance(geom, BaseGeometry) else geom

    start_str = start.isoformat() if hasattr(start, "isoformat") else str(start)
    end_str = end.isoformat() if hasattr(end, "isoformat") else str(end)
    datetime_range = f"{start_str}/{end_str}"

    client = pystac_client.Client.open(settings.stac_url)
    search = client.search(
        collections=[settings.stac_collection],
        intersects=intersects,
        datetime=datetime_range,
        query={"eo:cloud_cover": {"lt": settings.scene_cloud_max}},
    )
    return list(search.items())


def one_per_day(items: Iterable[Any]) -> list[Any]:
    """Group items by UTC acquisition date, keeping the one with lowest cloud cover.

    Ties are broken deterministically by lexicographically smallest item.id.
    Returns the selected items sorted by UTC date ascending.
    """
    best_per_day: dict[str, Any] = {}

    for item in items:
        day_str = _extract_utc_date(item)
        props = getattr(item, "properties", {}) or {}
        cloud = float(props.get("eo:cloud_cover", 0.0))
        item_id = str(getattr(item, "id", ""))

        current_best = best_per_day.get(day_str)
        if current_best is None:
            best_per_day[day_str] = item
        else:
            curr_props = getattr(current_best, "properties", {}) or {}
            curr_cloud = float(curr_props.get("eo:cloud_cover", 0.0))
            curr_id = str(getattr(current_best, "id", ""))

            if (cloud, item_id) < (curr_cloud, curr_id):
                best_per_day[day_str] = item

    sorted_days = sorted(best_per_day.keys())
    return [best_per_day[day] for day in sorted_days]
