"""Precision AgriTech - Satellite Service Pydantic Data Models.

Defines the schemas for NDVI processing jobs, status responses, frames, and errors
matching the HTTP contract in the design specification.
"""

from typing import Literal
from pydantic import BaseModel, Field


class Frame(BaseModel):
    """Processed satellite frame over the parcel boundary."""

    date: str
    scene_id: str
    mean_ndvi: float
    valid_fraction: float
    png_url: str


class Skipped(BaseModel):
    """Skipped scene with classification reason."""

    date: str
    scene_id: str
    reason: Literal["cloudy", "no_data", "read_error"]
    valid_fraction: float | None = None


class Progress(BaseModel):
    """Job progress counts."""

    processed: int
    total: int | None = None


class Window(BaseModel):
    """Date window for satellite search."""

    start: str
    end: str


class JobStatus(BaseModel):
    """Complete NDVI job status response."""

    job_id: str
    parcel_id: str | None = None
    status: Literal["queued", "running", "done", "failed"]
    window: Window
    bounds: list[list[float]]
    progress: Progress
    frames: list[Frame] = Field(default_factory=list)
    skipped: list[Skipped] = Field(default_factory=list)
    error: str | None = None


class JobRequest(BaseModel):
    """Payload to trigger an NDVI processing job."""

    geometry: dict
    parcel_id: str | None = None
