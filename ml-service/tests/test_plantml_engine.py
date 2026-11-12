"""Tests for the optional plant-ml engine, using a fake predictor (no weights, no plantml import)."""

import io
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

import main
from config import settings
from advisory import get_class_meta
from plantml_engine import AGRITECH_LABELS, PlantmlEngine, agritech_label, plantml_engine
from schemas import ClassifyLeafLowConfidenceResponse, ClassifyLeafResponse


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (10, 120, 30)).save(buf, format="JPEG")
    return buf.getvalue()


class FakePredictor:
    def __init__(self, class_name="tomato/late_blight", confidence=0.4, status="ok"):
        self.class_name, self.confidence, self.status = class_name, confidence, status
        self.hints = []

    def predict(self, image, crop_hint=None):
        self.hints.append(crop_hint)
        return SimpleNamespace(
            crop=self.class_name.split("/")[0], disease=self.class_name.split("/")[1],
            class_name=self.class_name, confidence=self.confidence, plant_score=0.9,
            top_k=[(self.class_name, self.confidence), ("grape/black_rot", 0.1), ("rice/blast", 0.05)],
            status=self.status, mode="best", elapsed_ms=12.3,
        )


@pytest.fixture
def plantml():
    yield
    plantml_engine._predictor = None


async def _get(path):
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as c:
        return await c.get(path)


async def _post(data=None):
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as c:
        return await c.post("/api/v1/classify-leaf", files={"file": ("l.jpg", _jpeg(), "image/jpeg")}, data=data or {})


def test_label_mapping_shared_and_new_classes():
    assert len(AGRITECH_LABELS) == 11
    assert agritech_label("corn/common_rust") == "Corn_(maize)___Common_rust_"
    assert agritech_label("apple/cedar_apple_rust") == "Apple___Cedar_apple_rust"
    assert agritech_label("grape/black_rot") == "Grape___Black_rot"
    eng = PlantmlEngine()
    assert eng.meta("Tomato___Late_blight") == get_class_meta("Tomato___Late_blight")
    new = eng.meta("Grape___Black_rot")
    assert new["crop"] == "Grape" and new["condition"] == "Black Rot" and new["pathogen"] == "FUNGAL"
    assert eng.meta("Rice___healthy")["severity"] == "None"


def test_status_routing_ok_retake_unsupported(plantml):
    eng = PlantmlEngine()
    for status in ("ok", "retake", "unsupported"):
        eng.load(lambda s=status: FakePredictor(status=s))
        out = eng.run(b"x")
        assert out["status"] == status and out["top_label"] == "Tomato___Late_blight"
        assert out["top_probabilities"][1]["label"] == "Grape___Black_rot"
    assert not PlantmlEngine().is_loaded()


@pytest.mark.parametrize("status,conf", [("ok", 0.4), ("retake", 0.8), ("unsupported", 0.2)])
async def test_responses_validate_for_each_status(plantml, status, conf):
    plantml_engine.load(lambda: FakePredictor(confidence=conf, status=status))
    r = await _post()
    assert r.status_code == 200
    body = r.json()
    if status == "ok":  # AgriTech's 0.60 rule is skipped for plantml
        ClassifyLeafResponse.model_validate(body)
        assert body["prediction"]["condition"] == "Late Blight"
        assert body["low_confidence"] is None
    else:
        ClassifyLeafLowConfidenceResponse.model_validate(body)
        msg = body["low_confidence_advisory"]["message"]
        assert ("supported crop" in msg) == (status == "unsupported")
        assert (body["top_probabilities"] == []) == (status == "unsupported")
    h = (await _get("/health/ready")).json()
    assert h["backend"] == "plantml" and h["model_loaded"] is True
    assert h["plantml_mode"] == settings.plantml_mode


async def test_crop_hint_unknown_is_ignored(plantml):
    fake = FakePredictor(status="ok")
    plantml_engine.load(lambda: fake)
    assert (await _post({"crop_hint": "Tomato"})).status_code == 200
    assert (await _post({"crop_hint": "banana"})).status_code == 200  # predictor ignores unknown crops
    assert (await _post()).status_code == 200
    assert fake.hints == ["tomato", "banana", None]





async def test_unloaded_plantml_returns_503_and_health_reports_error(plantml):
    def boom():
        raise FileNotFoundError("system.yaml missing")

    plantml_engine.load(boom)
    r = await _post()
    assert r.status_code == 503
    assert r.json()["error"] == "model_unavailable"
    assert "system.yaml missing" in r.json()["message"]
    h_resp = await _get("/health/ready")
    assert h_resp.status_code == 503
    h = h_resp.json()
    assert h["status"] == "not_ready"
    assert h["backend"] == "plantml" and h["model_loaded"] is False and h["mode"] == "UNAVAILABLE"
    assert "plant-ml failed to load" in h["note"]


async def test_decompression_bomb_returns_400(plantml):
    """Image decompression bomb raises DecompressionBombError, converted to 400 image_decode_failure."""
    class BombPredictor:
        def predict(self, image_bytes, crop_hint=None):
            raise Image.DecompressionBombError("Decompression bomb detected: image exceeds pixel cap")

    plantml_engine.load(lambda: BombPredictor())
    r = await _post()
    assert r.status_code == 400
    assert r.json()["error"] == "image_decode_failure"
    assert "Decompression bomb detected" in r.json()["message"]


async def test_startup_check_flags_missing_kb_classes(plantml):
    """When predictor exposes active.class_names(), any missing KB classes are logged and reported in /health/ready."""
    class PredictorWithActive:
        class Active:
            def class_names(self):
                return ["tomato/late_blight", "fictional_crop/mystery_disease"]

        active = Active()

        def predict(self, image_bytes, crop_hint=None):
            pass

    plantml_engine.load(lambda: PredictorWithActive())
    assert "fictional_crop/mystery_disease" in plantml_engine.kb_missing_classes
    h = (await _get("/health/ready")).json()
    assert "missing_classes" in h["advisory_kb"]
    assert "fictional_crop/mystery_disease" in h["advisory_kb"]["missing_classes"]


async def test_retake_unsupported_reports_null_or_applied_threshold(plantml):
    """Retake and unsupported responses should return predictor applied threshold or null, not 0.0."""
    class PredictorWithThreshold:
        def predict(self, image_bytes, crop_hint=None):
            return SimpleNamespace(
                crop="tomato", disease="late_blight", class_name="tomato/late_blight",
                confidence=0.45, plant_score=0.9, top_k=[("tomato/late_blight", 0.45)],
                status="retake", mode="light", elapsed_ms=10.0, threshold=0.65,
            )

    plantml_engine.load(lambda: PredictorWithThreshold())
    r = await _post()
    assert r.status_code == 200
    body = r.json()
    assert body["low_confidence_advisory"]["threshold"] == 0.65

    # Without threshold exposed by predictor, should return None (null in JSON)
    fake_no_th = FakePredictor(confidence=0.5, status="retake")
    plantml_engine.load(lambda: fake_no_th)
    r2 = await _post()
    assert r2.status_code == 200
    assert r2.json()["low_confidence_advisory"]["threshold"] is None
