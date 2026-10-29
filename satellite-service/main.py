"""Precision AgriTech - Satellite Service HTTP API.

FastAPI entrypoint providing NDVI timeline processing job submission,
status polling, and colorized PNG frame retrieval.
"""

from collections.abc import Callable
from datetime import date, datetime, timezone
import os
from pathlib import Path

# GDAL environment defaults must be set before any rasterio import
os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")

from fastapi import FastAPI, HTTPException, Response, status as status_code
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from config import settings
from geometry import GeometryError, parse_parcel_geometry, target_grid, time_window
from jobs import JobRegistry
from processor import process_scene
from schemas import JobRequest, JobStatus
from stac import one_per_day, search_items


def create_app(
    registry: JobRegistry | None = None,
    today: Callable[[], date] | None = None,
) -> FastAPI:
    """Create and configure the FastAPI application."""
    if registry is None:
        registry = JobRegistry(
            cache_dir=Path(settings.cache_dir),
            search=lambda g, s, e: one_per_day(search_items(g, s, e)),
            process=process_scene,
            workers=settings.workers,
        )

    if today is None:
        today = lambda: datetime.now(timezone.utc).date()

    app = FastAPI(title="Precision AgriTech - Satellite NDVI Service")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health/live")
    def health_live():
        return {"status": "ok"}

    @app.post("/api/v1/ndvi/jobs", response_model=JobStatus)
    def post_ndvi_job(req: JobRequest, response: Response):
        try:
            geom = parse_parcel_geometry(req.geometry, max_area_ha=settings.max_area_ha)
        except GeometryError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        start_date, end_date = time_window(today(), settings.window_days)
        grid = target_grid(geom, buffer_m=settings.grid_buffer_m)

        job_status, is_new = registry.submit(
            geom=geom,
            parcel_id=req.parcel_id,
            start=start_date,
            end=end_date,
            grid=grid,
        )

        if is_new:
            response.status_code = status_code.HTTP_202_ACCEPTED
        else:
            response.status_code = status_code.HTTP_200_OK

        return job_status

    @app.get("/api/v1/ndvi/jobs/{job_id}", response_model=JobStatus)
    def get_ndvi_job(job_id: str):
        job_status = registry.get(job_id)
        if job_status is None:
            raise HTTPException(status_code=404, detail="Unknown job")
        return job_status

    @app.get("/api/v1/ndvi/frames/{job_id}/{date}.png")
    def get_ndvi_frame(job_id: str, date: str):
        frame_file = registry.frame_path(job_id, date)
        if frame_file is None:
            raise HTTPException(status_code=404, detail="Frame not found")
        return FileResponse(
            path=frame_file,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=604800"},
        )

    return app


app = create_app()
