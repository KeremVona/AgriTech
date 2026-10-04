"""
Tests for TODO-104 + TODO-105: FastAPI application setup, inference endpoint,
and agronomic advisory integration.

Covers:
- MIME type validation → 400
- Empty file → 400
- File too large → 413
- Invalid image bytes → 400
- Valid image → 200 with correct response schema (stub mode)
- Advisory fields present in classify-leaf response (TODO-105)
- Low-confidence endpoint path returns ClassifyLeafLowConfidenceResponse (TODO-105)
- /health/live endpoint
- /health/ready endpoint with advisory_kb field (TODO-105)
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
    """In test environment no ONNX model is present → stub mode → still 200.
    TODO-105: advisory_kb field must be present and loaded."""
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    # model_loaded may be True or False depending on environment
    assert "model_loaded" in data
    assert "mode" in data
    # TODO-105: advisory_kb status must be included
    assert "advisory_kb" in data
    assert data["advisory_kb"]["loaded"] is True
    assert data["advisory_kb"]["class_count"] == 12



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
    """Valid JPEG must return 200 with a correctly-shaped response
    including the TODO-105 expanded advisory fields."""
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

    # TODO-105: advisory must have expanded fields
    advisory = data["agronomic_advisory"]
    assert "immediate_action" in advisory
    assert "chemical_treatments" in advisory
    assert "cultural_controls" in advisory
    assert "biological_controls" in advisory
    assert "microclimate_risks" in advisory
    assert "environmental_risk_factors" in advisory
    assert isinstance(advisory["cultural_controls"], list)
    assert len(advisory["cultural_controls"]) >= 1

    # TODO-105: telemetry_linkage_hints must have recommended_irrigation_restriction
    hints = data["telemetry_linkage_hints"]
    assert "moisture_risk" in hints
    assert "leaf_wetness_threshold_hours" in hints
    assert "recommended_irrigation_restriction" in hints


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
# TODO-105: Advisory integration tests on the endpoint level
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_stub_mode_high_confidence_advisory_populated(client):
    """
    Stub mode always returns Tomato___Late_blight at ~89% confidence.
    Advisory for this class should contain ≥1 chemical treatment (CRITICAL disease).
    """
    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()

    # Stub: confidence is ~89%, well above 60% → should get full advisory
    advisory = data["agronomic_advisory"]
    # Late blight should be CRITICAL with ≥1 chemical treatment
    assert len(advisory["chemical_treatments"]) >= 1
    assert advisory["microclimate_risks"]["fungal_risk"] in ("HIGH", "CRITICAL")


@pytest.mark.anyio
async def test_classify_leaf_low_confidence_returns_rescan_advisory(client, monkeypatch):
    """
    When the inference engine returns a confidence below 0.60,
    the endpoint must return ClassifyLeafLowConfidenceResponse
    with requires_rescan=True and rescan_instructions.
    """
    # Monkeypatch inference_engine.run to return a low-confidence result
    from inference import inference_engine, CLASS_LABELS
    import numpy as np

    original_run = inference_engine.run

    def low_confidence_run(image_bytes: bytes):
        # Build a flat distribution (confidence ≈ 1/12 ≈ 8.3% per class)
        probs = np.full(len(CLASS_LABELS), 1.0 / len(CLASS_LABELS), dtype=np.float32)
        return {
            "top_label": CLASS_LABELS[0],
            "confidence": float(probs[0]),       # ≈ 0.083 — well below 0.60
            "top_probabilities": [
                {"label": CLASS_LABELS[i], "probability": float(probs[i])}
                for i in range(3)
            ],
            "all_probabilities": {CLASS_LABELS[i]: float(probs[i]) for i in range(len(CLASS_LABELS))},
            "execution_time_ms": 12.5,
            "model_version": "stub_low_confidence_test",
            "model_loaded": False,
        }

    monkeypatch.setattr(inference_engine, "run", low_confidence_run)

    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()

    # Must be the low-confidence response shape
    assert data.get("requires_rescan") is True
    assert "low_confidence_advisory" in data
    low_conf = data["low_confidence_advisory"]
    assert low_conf["requires_rescan"] is True
    assert low_conf["confidence_score"] < 0.60
    assert low_conf["threshold"] == 0.60
    assert "message" in low_conf
    assert isinstance(low_conf["rescan_instructions"], list)
    assert len(low_conf["rescan_instructions"]) >= 4

    # Must NOT contain the normal advisory (no chemical_treatments at top level)
    assert "agronomic_advisory" not in data


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
