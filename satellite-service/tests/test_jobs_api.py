"""Tests for Satellite NDVI Job Registry and HTTP API."""

import concurrent.futures
from datetime import date
import json
from pathlib import Path
import threading
import time
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from geometry import job_id_for, parse_parcel_geometry, time_window
from jobs import JobRegistry
from main import create_app
from schemas import Frame, JobStatus, Progress, Skipped, Window

SQUARE = {
    "type": "Polygon",
    "coordinates": [
        [
            [29.0, 41.0],
            [29.01, 41.0],
            [29.01, 41.01],
            [29.0, 41.01],
            [29.0, 41.0],
        ]
    ],
}


def _write_dummy_png(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGBA", (2, 2), (34, 139, 34, 255))
    img.save(path, format="PNG")


def _wait_done(client: TestClient, job_id: str, timeout: float = 5.0) -> dict:
    start_t = time.monotonic()
    while time.monotonic() - start_t < timeout:
        r = client.get(f"/api/v1/ndvi/jobs/{job_id}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        if data["status"] in ("done", "failed"):
            return data
        time.sleep(0.02)
    raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")


def test_post_202_then_200_same_job(tmp_path: Path):
    items = [SimpleNamespace(id="scene1", date="2026-05-14")]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.6123,
            valid_fraction=0.93,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    # 1st POST -> 202
    r1 = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE, "parcel_id": "p1"})
    assert r1.status_code == 202
    data1 = r1.json()
    assert data1["window"] == {"start": "2025-10-27", "end": "2026-10-26"}
    assert data1["parcel_id"] == "p1"
    job_id = data1["job_id"]

    # 2nd POST -> 200 with same job_id
    r2 = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE, "parcel_id": "p1"})
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["job_id"] == job_id
    assert data2["window"] == {"start": "2025-10-27", "end": "2026-10-26"}

    final_data = _wait_done(client, job_id)
    assert final_data["status"] == "done"


def test_progress_grows_and_done_writes_manifest(tmp_path: Path):
    dates = ["2026-05-01", "2026-05-05", "2026-05-10", "2026-05-15"]
    items = [SimpleNamespace(id=f"scene_{d}", date=d) for d in dates]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        time.sleep(0.05)
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.5,
            valid_fraction=0.8,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    r = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    observed_processed = set()
    start_t = time.monotonic()
    while time.monotonic() - start_t < 3.0:
        status_resp = client.get(f"/api/v1/ndvi/jobs/{job_id}")
        assert status_resp.status_code == 200
        p = status_resp.json()["progress"]["processed"]
        observed_processed.add(p)
        if status_resp.json()["status"] == "done":
            break
        time.sleep(0.02)

    final_data = _wait_done(client, job_id)
    assert final_data["status"] == "done"
    assert final_data["progress"]["processed"] == 4
    assert final_data["progress"]["total"] == 4
    assert len(observed_processed) > 1, f"Observed counts: {observed_processed}"

    # manifest.json exists and contains done status
    manifest_file = tmp_path / job_id / "manifest.json"
    assert manifest_file.is_file()
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    assert manifest["status"] == "done"
    assert manifest["progress"]["processed"] == 4
    assert len(manifest["frames"]) == 4

    # Frames in manifest are sorted by date ascending
    frame_dates = [f["date"] for f in manifest["frames"]]
    assert frame_dates == sorted(frame_dates)


def test_cache_hit_after_restart(tmp_path: Path):
    items = [SimpleNamespace(id="scene1", date="2026-05-14")]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.6,
            valid_fraction=0.9,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    reg1 = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app1 = create_app(registry=reg1, today=lambda: date(2026, 10, 28))
    client1 = TestClient(app1)

    r1 = client1.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r1.status_code == 202
    job_id = r1.json()["job_id"]
    _wait_done(client1, job_id)

    # Build brand new registry on same tmp_path simulating service restart
    reg2 = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app2 = create_app(registry=reg2, today=lambda: date(2026, 10, 28))
    client2 = TestClient(app2)

    # POST returns 200 with status done
    r2 = client2.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["job_id"] == job_id
    assert data2["status"] == "done"

    # GET returns 200 with status done
    r_get = client2.get(f"/api/v1/ndvi/jobs/{job_id}")
    assert r_get.status_code == 200
    assert r_get.json()["status"] == "done"


def test_unknown_job_404(tmp_path: Path):
    registry = JobRegistry(tmp_path, lambda g, s, e: [], lambda *args: None, workers=1)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    r = client.get("/api/v1/ndvi/jobs/0123456789abcdef")
    assert r.status_code == 404
    assert r.json() == {"detail": "Unknown job"}


def test_bad_geometry_422(tmp_path: Path):
    registry = JobRegistry(tmp_path, lambda g, s, e: [], lambda *args: None, workers=1)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    # LineString geometry -> 422
    bad_geom = {"type": "LineString", "coordinates": [[0.0, 0.0], [1.0, 1.0]]}
    r = client.post("/api/v1/ndvi/jobs", json={"geometry": bad_geom})
    assert r.status_code == 422
    assert "detail" in r.json()


def test_search_failure_marks_failed_and_retry_restarts(tmp_path: Path):
    fail_search = True

    def toggleable_search(geom, start, end):
        if fail_search:
            raise RuntimeError("STAC connection failure")
        return [SimpleNamespace(id="s1", date="2026-05-14")]

    def fake_process(item, geom, grid, frames_dir, job_id):
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.6,
            valid_fraction=0.9,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, toggleable_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    r = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    failed_data = _wait_done(client, job_id)
    assert failed_data["status"] == "failed"
    assert failed_data["error"] == "Satellite search failed: STAC connection failure"

    # Now make search succeed and retry
    fail_search = False
    r2 = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r2.status_code == 202
    assert r2.json()["job_id"] == job_id

    success_data = _wait_done(client, job_id)
    assert success_data["status"] == "done"
    assert success_data["error"] is None


def test_frame_route_rejects_traversal(tmp_path: Path):
    registry = JobRegistry(tmp_path, lambda g, s, e: [], lambda *args: None, workers=1)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    # Path traversals and invalid regex strings
    traversal_urls = [
        "/api/v1/ndvi/frames/..%2F..%2Fsecret/2026-01-01.png",
        "/api/v1/ndvi/frames/0123456789abcdef/../../x.png",
        "/api/v1/ndvi/frames/invalid_job_id/2026-01-01.png",
        "/api/v1/ndvi/frames/0123456789abcdef/not-a-date.png",
    ]
    for url in traversal_urls:
        r = client.get(url)
        assert r.status_code == 404


def test_frame_route_serves_png(tmp_path: Path):
    items = [SimpleNamespace(id="scene1", date="2026-05-14")]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.6,
            valid_fraction=0.9,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    r = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    job_id = r.json()["job_id"]
    _wait_done(client, job_id)

    frame_resp = client.get(f"/api/v1/ndvi/frames/{job_id}/2026-05-14.png")
    assert frame_resp.status_code == 200
    assert frame_resp.headers["content-type"] == "image/png"
    assert "public, max-age=604800" in frame_resp.headers["cache-control"]
    assert len(frame_resp.content) > 0


def test_concurrent_posts_create_one_job(tmp_path: Path):
    items = [SimpleNamespace(id="scene1", date="2026-05-14")]
    process_calls = 0
    lock = threading.Lock()

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        nonlocal process_calls
        with lock:
            process_calls += 1
        time.sleep(0.05)
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.6,
            valid_fraction=0.9,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    def do_post():
        return client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(do_post) for _ in range(8)]
        responses = [f.result() for f in futures]

    for resp in responses:
        assert resp.status_code in (200, 202)

    job_ids = {resp.json()["job_id"] for resp in responses}
    assert len(job_ids) == 1
    job_id = job_ids.pop()

    _wait_done(client, job_id)
    assert process_calls == 1


def test_frames_sorted_when_completed_out_of_order(tmp_path: Path):
    # Earlier dates take longer to process so later dates finish first
    items = [
        SimpleNamespace(id="s1", date="2026-05-01", delay=0.12),
        SimpleNamespace(id="s2", date="2026-05-10", delay=0.06),
        SimpleNamespace(id="s3", date="2026-05-20", delay=0.01),
    ]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        time.sleep(item.delay)
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.5,
            valid_fraction=0.8,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=3)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    r = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    # Poll status as frames arrive out of order
    start_t = time.monotonic()
    while time.monotonic() - start_t < 3.0:
        resp = client.get(f"/api/v1/ndvi/jobs/{job_id}")
        assert resp.status_code == 200
        data = resp.json()
        current_dates = [f["date"] for f in data["frames"]]
        assert current_dates == sorted(current_dates), f"Unsorted frames: {current_dates}"
        if data["status"] == "done":
            break
        time.sleep(0.01)

    final_data = _wait_done(client, job_id)
    assert final_data["status"] == "done"
    assert [f["date"] for f in final_data["frames"]] == [
        "2026-05-01",
        "2026-05-10",
        "2026-05-20",
    ]


def test_interrupted_run_is_restarted(tmp_path: Path):
    start_d, end_d = time_window(date(2026, 10, 28), 365)
    parsed_geom = parse_parcel_geometry(SQUARE)
    job_id = job_id_for(parsed_geom, start_d, end_d)

    # Pre-create interrupted frames directory with no manifest.json
    frames_dir = tmp_path / job_id / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    interrupted_frame = frames_dir / "2026-05-14.png"
    interrupted_frame.write_bytes(b"partial-data")

    manifest_file = tmp_path / job_id / "manifest.json"
    assert not manifest_file.exists()

    items = [SimpleNamespace(id="scene1", date="2026-05-14")]

    def fake_search(geom, start, end):
        return items

    def fake_process(item, geom, grid, frames_dir, job_id):
        _write_dummy_png(Path(frames_dir) / f"{item.date}.png")
        return Frame(
            date=item.date,
            scene_id=item.id,
            mean_ndvi=0.7,
            valid_fraction=0.95,
            png_url=f"/api/v1/ndvi/frames/{job_id}/{item.date}.png",
        )

    registry = JobRegistry(tmp_path, fake_search, fake_process, workers=2)
    app = create_app(registry=registry, today=lambda: date(2026, 10, 28))
    client = TestClient(app)

    # Interrupted run should return 202 (new run started)
    r = client.post("/api/v1/ndvi/jobs", json={"geometry": SQUARE})
    assert r.status_code == 202
    assert r.json()["job_id"] == job_id

    final_data = _wait_done(client, job_id)
    assert final_data["status"] == "done"
    assert manifest_file.is_file()


def test_get_job_rejects_non_hex_job_id(tmp_path: Path):
    # put a valid-looking manifest OUTSIDE the cache dir, reachable via ".."
    cache = tmp_path / "cache"
    cache.mkdir()
    outside = tmp_path / "manifest.json"
    dummy_status = JobStatus(
        job_id="0123456789abcdef",
        parcel_id="p1",
        status="done",
        window=Window(start="2025-10-27", end="2026-10-26"),
        bounds=[[29.0, 41.0], [29.01, 41.01]],
        progress=Progress(processed=1, total=1),
        frames=[
            Frame(
                date="2026-05-14",
                scene_id="s1",
                mean_ndvi=0.7,
                valid_fraction=0.9,
                png_url="/api/v1/ndvi/frames/0123456789abcdef/2026-05-14.png",
            )
        ],
        skipped=[],
        error=None,
    )
    outside.write_text(dummy_status.model_dump_json(indent=2), encoding="utf-8")
    registry = JobRegistry(cache, lambda g, s, e: [], lambda *args: None, workers=1)
    assert registry.get("..") is None
    assert registry.get("..\\x") is None
    assert registry.get("ABCDEF0123456789") is None  # uppercase is not allowed
    client = TestClient(create_app(registry=registry, today=lambda: date(2026, 10, 28)))
    assert client.get("/api/v1/ndvi/jobs/..%5Cx").status_code == 404

