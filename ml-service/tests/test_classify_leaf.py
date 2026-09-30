"""
Tests for TODO-104: FastAPI application setup and inference endpoint.

Covers:
- MIME type validation → 400
- Empty file → 400
- File too large → 413
- Invalid image bytes → 400
- Valid image → 200 with correct response schema (stub mode)
- /health/live endpoint
- /health/ready endpoint (stub mode)
- Concurrent load: 5 simultaneous requests must all complete ≤ 150 ms turnaround
"""

import asyncio
import io
import time
import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image

from main import app


def _make_jpeg_bytes(width: int = 256, height: int = 256) -> bytes:
    """Creates a valid in-memory JPEG image."""
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(120, 80, 40))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width: int = 256, height: int = 256) -> bytes:
    """Creates a valid in-memory PNG image."""
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(60, 160, 90))
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_health_live(client):
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "version" in data


@pytest.mark.anyio
async def test_health_ready_stub_mode(client):
    """In test environment no ONNX model is present → stub mode → still 200."""
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    # model_loaded may be True or False depending on environment
    assert "model_loaded" in data
    assert "mode" in data


@pytest.mark.anyio
async def test_health_check_legacy(client):
    """Backwards-compatible /api/v1/health alias."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


# ---------------------------------------------------------------------------
# classify-leaf: validation errors
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_invalid_mime_type(client):
    """Non-image MIME type must return 400 with descriptive error."""
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("document.pdf", b"%PDF-1.4 content", "application/pdf")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "invalid_content_type"
    assert "file" in body["message"].lower() or "type" in body["message"].lower()
    assert body["field"] == "file"


@pytest.mark.anyio
async def test_classify_leaf_empty_file(client):
    """Empty file payload must return 400."""
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "empty_file"


@pytest.mark.anyio
async def test_classify_leaf_corrupt_image_bytes(client):
    """JPEG MIME type but corrupt bytes must return 400 (Pillow decode failure)."""
    corrupt_bytes = b"\xff\xd8\xff NOT_A_REAL_JPEG_PAYLOAD_GARBAGE"
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("fake.jpg", corrupt_bytes, "image/jpeg")},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "image_decode_failure"
    assert body["field"] == "file"


@pytest.mark.anyio
async def test_classify_leaf_file_too_large(client):
    """Payload exceeding 10 MB must return 413."""
    big_bytes = b"x" * (11 * 1024 * 1024)  # 11 MB
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("big.jpg", big_bytes, "image/jpeg")},
    )
    assert response.status_code == 413
    body = response.json()
    assert body["error"] == "file_too_large"


# ---------------------------------------------------------------------------
# classify-leaf: valid image (stub mode)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_valid_jpeg(client):
    """Valid JPEG must return 200 with a correctly-shaped response."""
    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()

    # Schema shape checks
    assert "inference_id" in data
    assert "prediction" in data
    assert "top_probabilities" in data
    assert "agronomic_advisory" in data
    assert "telemetry_linkage_hints" in data
    assert "execution_time_ms" in data
    assert "model_version" in data
    assert "model_loaded" in data

    # Prediction structure
    pred = data["prediction"]
    assert "crop" in pred
    assert "condition" in pred
    assert "confidence_score" in pred
    assert 0.0 <= pred["confidence_score"] <= 1.0
    assert "severity_index" in pred

    # Top probabilities: must have at least 1 entry, all probabilities in [0, 1]
    assert len(data["top_probabilities"]) >= 1
    for entry in data["top_probabilities"]:
        assert "label" in entry
        assert "probability" in entry
        assert 0.0 <= entry["probability"] <= 1.0

    # Execution time must be non-negative
    assert data["execution_time_ms"] >= 0


@pytest.mark.anyio
async def test_classify_leaf_valid_png(client):
    """Valid PNG must also be accepted and return 200."""
    png_bytes = _make_png_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.png", png_bytes, "image/png")},
    )
    assert response.status_code == 200


@pytest.mark.anyio
async def test_classify_leaf_inference_id_is_unique(client):
    """Each call must return a distinct inference_id UUID."""
    jpeg_bytes = _make_jpeg_bytes()
    ids = set()
    for _ in range(3):
        resp = await client.post(
            "/api/v1/classify-leaf",
            files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
        )
        assert resp.status_code == 200
        ids.add(resp.json()["inference_id"])
    assert len(ids) == 3, "inference_id should be unique per request"


# ---------------------------------------------------------------------------
# Acceptance criterion: concurrent load ≤ 150 ms
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_concurrent_load():
    """
    Acceptance criterion: end-to-end turnaround ≤ 150 ms under concurrent
    load of 5 simultaneous requests (Phase 1 spec).

    We measure wall-clock time for 5 concurrent requests. In stub mode the
    preprocessing (Pillow resize + normalise) is the main cost and should
    comfortably fit within 150 ms on modern hardware.
    """
    jpeg_bytes = _make_jpeg_bytes()

    async def single_request():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t0 = time.perf_counter()
            resp = await c.post(
                "/api/v1/classify-leaf",
                files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return resp.status_code, elapsed_ms

    # Fire 5 concurrent requests
    results = await asyncio.gather(*[single_request() for _ in range(5)])

    for status, elapsed_ms in results:
        assert status == 200, f"Expected 200, got {status}"
        assert elapsed_ms <= 150.0, (
            f"Request took {elapsed_ms:.1f} ms — exceeds 150 ms acceptance criterion"
        )
