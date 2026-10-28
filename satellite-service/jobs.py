"""Precision AgriTech - Satellite Service Job Registry.

Manages in-memory and on-disk NDVI processing jobs, concurrency, status snapshots,
and frame path resolution with traversal protections.
"""

from collections.abc import Callable
import concurrent.futures
from dataclasses import dataclass, field
from datetime import date
import json
import logging
from pathlib import Path
import re
import threading
from typing import Any, Literal

from shapely.geometry.base import BaseGeometry

from geometry import TargetGrid, job_id_for
from schemas import Frame, JobStatus, Progress, Skipped, Window

logger = logging.getLogger(__name__)

SearchFn = Callable[[BaseGeometry, date, date], list]
ProcessFn = Callable[[Any, BaseGeometry, TargetGrid, Path, str], Frame | Skipped]

JOB_ID_RE = re.compile(r"^[0-9a-f]{16}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class _Job:
    job_id: str
    parcel_id: str | None
    status: Literal["queued", "running", "done", "failed"]
    window: Window
    bounds: list[list[float]]
    progress: Progress
    frames: list[Frame] = field(default_factory=list)
    skipped: list[Skipped] = field(default_factory=list)
    error: str | None = None
    lock: threading.RLock = field(default_factory=threading.RLock)

    def to_status(self) -> JobStatus:
        with self.lock:
            sorted_frames = sorted(self.frames, key=lambda f: f.date)
            sorted_skipped = sorted(self.skipped, key=lambda s: s.date)
            return JobStatus(
                job_id=self.job_id,
                parcel_id=self.parcel_id,
                status=self.status,
                window=Window(start=self.window.start, end=self.window.end),
                bounds=self.bounds,
                progress=Progress(
                    processed=self.progress.processed,
                    total=self.progress.total,
                ),
                frames=list(sorted_frames),
                skipped=list(sorted_skipped),
                error=self.error,
            )


class JobRegistry:
    """In-memory and disk-backed NDVI job registry and orchestrator."""

    def __init__(
        self,
        cache_dir: Path | str,
        search: SearchFn,
        process: ProcessFn,
        workers: int = 4,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self._search = search
        self._process = process
        self.workers = workers
        self._lock = threading.RLock()
        self._jobs: dict[str, _Job] = {}
        self._outer_pool = concurrent.futures.ThreadPoolExecutor()

    def submit(
        self,
        geom: BaseGeometry,
        parcel_id: str | None,
        start: date,
        end: date,
        grid: TargetGrid,
    ) -> tuple[JobStatus, bool]:
        """Submit a parcel for NDVI timeline processing.

        Returns:
            Tuple of (JobStatus, is_new_run).
        """
        job_id = job_id_for(geom, start, end)

        with self._lock:
            # 1. Check in-memory registry
            if job_id in self._jobs:
                job = self._jobs[job_id]
                with job.lock:
                    if parcel_id is not None:
                        job.parcel_id = parcel_id
                    if job.status in ("queued", "running", "done"):
                        return (job.to_status(), False)
                # If status == "failed", fall through to restart

            # 2. Check on-disk cache if not in memory (or restarted)
            manifest_file = self.cache_dir / job_id / "manifest.json"
            if job_id not in self._jobs and manifest_file.is_file():
                try:
                    data = json.loads(manifest_file.read_text(encoding="utf-8"))
                    cached_status = JobStatus.model_validate(data)
                    if parcel_id is not None:
                        cached_status.parcel_id = parcel_id
                    job = _Job(
                        job_id=cached_status.job_id,
                        parcel_id=cached_status.parcel_id,
                        status=cached_status.status,
                        window=cached_status.window,
                        bounds=cached_status.bounds,
                        progress=cached_status.progress,
                        frames=list(cached_status.frames),
                        skipped=list(cached_status.skipped),
                        error=cached_status.error,
                    )
                    self._jobs[job_id] = job
                    return (cached_status, False)
                except Exception as exc:
                    logger.warning("Corrupt manifest for job %s: %s", job_id, exc)

            # 3. New run or restart of failed/interrupted run
            frames_dir = self.cache_dir / job_id / "frames"
            frames_dir.mkdir(parents=True, exist_ok=True)

            window = Window(
                start=start.isoformat() if hasattr(start, "isoformat") else str(start),
                end=end.isoformat() if hasattr(end, "isoformat") else str(end),
            )
            job = _Job(
                job_id=job_id,
                parcel_id=parcel_id,
                status="queued",
                window=window,
                bounds=grid.bounds,
                progress=Progress(processed=0, total=None),
                frames=[],
                skipped=[],
                error=None,
            )
            self._jobs[job_id] = job

            # Submit processing to outer executor
            self._outer_pool.submit(
                self._run_job, job, geom, grid, start, end, frames_dir
            )
            return (job.to_status(), True)

    def _run_job(
        self,
        job: _Job,
        geom: BaseGeometry,
        grid: TargetGrid,
        start: date,
        end: date,
        frames_dir: Path,
    ) -> None:
        """Execute STAC search and scene processing pipeline in background."""
        try:
            items = self._search(geom, start, end)
        except Exception as exc:
            with job.lock:
                job.status = "failed"
                job.error = f"Satellite search failed: {exc}"
            return

        with job.lock:
            job.progress.total = len(items)
            if len(items) == 0:
                job.status = "done"
                snapshot = job.to_status()
            else:
                job.status = "running"

        if len(items) == 0:
            self._write_manifest(job.job_id, snapshot)
            return

        def _process_one(item: Any) -> None:
            try:
                res = self._process(item, geom, grid, frames_dir, job.job_id)
            except Exception as exc:
                logger.warning("Error processing scene %s: %s", getattr(item, "id", ""), exc)
                date_str = getattr(item, "date", "") or ""
                scene_id = str(getattr(item, "id", ""))
                res = Skipped(
                    date=date_str,
                    scene_id=scene_id,
                    reason="read_error",
                    valid_fraction=None,
                )

            with job.lock:
                if isinstance(res, Frame):
                    job.frames.append(res)
                elif isinstance(res, Skipped):
                    job.skipped.append(res)
                job.progress.processed += 1

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as inner_pool:
                futures = [inner_pool.submit(_process_one, item) for item in items]
                concurrent.futures.wait(futures)

            with job.lock:
                job.status = "done"
                snapshot = job.to_status()

            self._write_manifest(job.job_id, snapshot)
        except Exception as exc:
            logger.exception("Job %s failed during scene processing: %s", job.job_id, exc)
            with job.lock:
                job.status = "failed"
                job.error = f"Job processing failed: {exc}"

    def _write_manifest(self, job_id: str, status: JobStatus) -> None:
        """Atomically persist manifest.json to disk."""
        job_folder = self.cache_dir / job_id
        job_folder.mkdir(parents=True, exist_ok=True)
        tmp_path = job_folder / "manifest.json.tmp"
        final_path = job_folder / "manifest.json"
        tmp_path.write_text(status.model_dump_json(indent=2), encoding="utf-8")
        tmp_path.replace(final_path)

    def get(self, job_id: str) -> JobStatus | None:
        """Retrieve JobStatus from memory or disk cache."""
        with self._lock:
            if job_id in self._jobs:
                return self._jobs[job_id].to_status()

        manifest_file = self.cache_dir / job_id / "manifest.json"
        if manifest_file.is_file():
            try:
                data = json.loads(manifest_file.read_text(encoding="utf-8"))
                status = JobStatus.model_validate(data)
                with self._lock:
                    if job_id not in self._jobs:
                        self._jobs[job_id] = _Job(
                            job_id=status.job_id,
                            parcel_id=status.parcel_id,
                            status=status.status,
                            window=status.window,
                            bounds=status.bounds,
                            progress=status.progress,
                            frames=list(status.frames),
                            skipped=list(status.skipped),
                            error=status.error,
                        )
                return status
            except Exception as exc:
                logger.warning("Corrupt manifest for job %s: %s", job_id, exc)
                return None

        return None

    def frame_path(self, job_id: str, date: str) -> Path | None:
        """Resolve path to frame PNG if inputs are valid and file exists."""
        if not JOB_ID_RE.match(job_id) or not DATE_RE.match(date):
            return None
        candidate = self.cache_dir / job_id / "frames" / f"{date}.png"
        if candidate.is_file():
            return candidate
        return None
