"""
Precision AgriTech - Leaf Diagnostics Endpoint Tests (TODO-104 & plant-ml)

Covers:
- Early input validation (MIME, empty, size cap, decode failures)
- Full inference response shaping with fake plant-ml predictor
- Advisory integration and low-confidence rescan responses
- Verification of 503 when model is unloaded (no fabricated diagnoses)
- Health endpoints (/health/live, /health/ready)
- Concurrency and service overhead under concurrent requests
"""

import asyncio
import io
import time
from types import SimpleNamespace
import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image

from main import app
from config import settings
from plantml_engine import plantml_engine


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


class FakePredictor:
    def __init__(self, class_name="tomato/late_blight", confidence=0.89, status="ok", plant_score=0.9, elapsed_ms=12.5):
        self.class_name = class_name
        self.confidence = confidence
        self.status = status
        self.plant_score = plant_score
        self.elapsed_ms = elapsed_ms
        self.hints = []

    def predict(self, image_bytes, crop_hint=None):
        self.hints.append(crop_hint)
        # Validate that image_bytes is decodable
        try:
            Image.open(io.BytesIO(image_bytes)).verify()
        except Exception as exc:
            raise OSError(f"Cannot decode image: {exc}") from exc

        return SimpleNamespace(
            crop=self.class_name.split("/")[0],
            disease=self.class_name.split("/")[1],
            class_name=self.class_name,
            confidence=self.confidence,
            plant_score=self.plant_score,
            top_k=[
                (self.class_name, self.confidence),
                ("tomato/early_blight", 0.08),
                ("tomato/healthy", 0.03),
            ],
            status=self.status,
            mode="best",
            elapsed_ms=self.elapsed_ms,
        )


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


@pytest.fixture(autouse=True)
def setup_fake_predictor(monkeypatch):
    """Default fixture configuring plantml backend and injecting a loaded fake predictor."""
    monkeypatch.setattr(settings, "model_backend", "plantml")
    fake = FakePredictor()
    plantml_engine.load(lambda: fake)
    yield fake
    plantml_engine._predictor = None


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
async def test_health_ready_unloaded(client):
    """When model is unloaded, /health/ready returns 503 not_ready."""
    plantml_engine._predictor = None
    response = await client.get("/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["model_loaded"] is False
    assert "mode" in data
    assert "advisory_kb" in data
    assert data["advisory_kb"]["loaded"] is True
    assert data["advisory_kb"]["class_count"] == 33
    assert "note" in data


@pytest.mark.anyio
async def test_health_ready_loaded(client):
    """When model is loaded, /health/ready returns 200 ready."""
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["model_loaded"] is True
    assert data["backend"] == "plantml"


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


@pytest.mark.anyio
async def test_classify_leaf_file_too_large_bounded_read(client, monkeypatch):
    """Verify that file size check rejects early or reads at most max_upload_bytes + 1 bytes."""
    from fastapi import UploadFile

    max_bytes = settings.max_upload_bytes
    requested_sizes = []
    original_read = UploadFile.read

    async def spy_read(self, size=-1):
        requested_sizes.append(size)
        return await original_read(self, size)

    monkeypatch.setattr(UploadFile, "read", spy_read)

    payload = b"x" * (max_bytes + 1)
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("toobig.jpg", payload, "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["error"] == "file_too_large"
    for sz in requested_sizes:
        assert sz != -1, "UploadFile.read was called with unbounded size=-1"
        assert sz <= max_bytes + 1


# ---------------------------------------------------------------------------
# Finding 2: Unloaded engine returns 503 (no fabricated stub diagnoses)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_unloaded_returns_503(client):
    """When engine is unloaded, classify-leaf returns 503 model_unavailable with no fake prediction."""
    plantml_engine._predictor = None
    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "model_unavailable"
    assert "not loaded" in body["message"].lower()
    assert "prediction" not in body
    assert "top_probabilities" not in body


# ---------------------------------------------------------------------------
# classify-leaf: valid images (with fake plant-ml predictor)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_valid_jpeg(client):
    """Valid JPEG must return 200 with correctly-shaped response including advisory."""
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
    assert data["model_loaded"] is True

    # Prediction structure
    pred = data["prediction"]
    assert pred["crop"] == "Tomato"
    assert pred["condition"] == "Late Blight"
    assert pred["confidence_score"] == pytest.approx(0.89, abs=1e-4)
    assert pred["severity_index"] in ("High", "Critical")

    # Top probabilities
    assert len(data["top_probabilities"]) >= 1
    for entry in data["top_probabilities"]:
        assert "label" in entry
        assert "probability" in entry
        assert 0.0 <= entry["probability"] <= 1.0

    # Advisory
    advisory = data["agronomic_advisory"]
    assert "immediate_action" in advisory
    assert len(advisory["chemical_treatments"]) >= 1
    assert len(advisory["cultural_controls"]) >= 1

    hints = data["telemetry_linkage_hints"]
    assert "moisture_risk" in hints
    assert "leaf_wetness_threshold_hours" in hints


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


@pytest.mark.anyio
async def test_classify_leaf_low_confidence_retake(client):
    """When status is retake, returns ClassifyLeafLowConfidenceResponse."""
    plantml_engine.load(lambda: FakePredictor(class_name="tomato/late_blight", confidence=0.45, status="retake"))
    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("requires_rescan") is True
    assert "low_confidence_advisory" in data
    low_conf = data["low_confidence_advisory"]
    assert low_conf["requires_rescan"] is True
    assert low_conf["confidence_score"] == pytest.approx(0.45, abs=1e-4)
    assert isinstance(low_conf["rescan_instructions"], list)
    assert "agronomic_advisory" not in data


@pytest.mark.anyio
async def test_classify_leaf_with_crop_hint(client):
    """Verify endpoint accepts crop_hint and forwards it to predictor."""
    fake = FakePredictor()
    plantml_engine.load(lambda: fake)
    jpeg_bytes = _make_jpeg_bytes()
    response = await client.post(
        "/api/v1/classify-leaf",
        files={"file": ("leaf.jpg", jpeg_bytes, "image/jpeg")},
        data={"crop_hint": "tomato"},
    )
    assert response.status_code == 200
    assert fake.hints == ["tomato"]
    data = response.json()
    assert data["prediction"]["crop"] == "Tomato"


# ---------------------------------------------------------------------------
# Acceptance criterion: service overhead under concurrent requests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_classify_leaf_concurrent_load():
    """
    Measures end-to-end service overhead under 5 concurrent requests with the fake predictor.
    Validates that FastAPI, validation layers, threadpool routing, and advisory assembly
    execute comfortably under 150 ms turnaround.
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

    results = await asyncio.gather(*[single_request() for _ in range(5)])

    for status, elapsed_ms in results:
        assert status == 200, f"Expected 200, got {status}"
        assert elapsed_ms <= 150.0, (
            f"Request took {elapsed_ms:.1f} ms — exceeds 150 ms acceptance criterion"
        )
