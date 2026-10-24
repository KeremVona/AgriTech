"""Tests for the optional plant-ml engine, using a fake predictor (no weights, no plantml import)."""

import io
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

import main
from config import settings
from inference import get_class_meta
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
def plantml(monkeypatch):
    monkeypatch.setattr(settings, "model_backend", "plantml")
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
    h = (await _get("/health/ready")).json()
    assert h["backend"] == "plantml" and h["model_loaded"] is True


async def test_crop_hint_unknown_is_ignored(plantml):
    fake = FakePredictor(status="ok")
    plantml_engine.load(lambda: fake)
    assert (await _post({"crop_hint": "Tomato"})).status_code == 200
    assert (await _post({"crop_hint": "banana"})).status_code == 200  # predictor ignores unknown crops
    assert (await _post()).status_code == 200
    assert fake.hints == ["tomato", "banana", None]


async def test_default_backend_unchanged():
    assert settings.model_backend == "onnx"
    assert main._engine() is main.inference_engine
    r = await _post()
    assert r.status_code == 200
    assert "status" not in r.json()
    h = (await _get("/health/ready")).json()
    assert h["backend"] == "onnx"


async def test_unloaded_plantml_returns_503_and_health_reports_error(plantml):
    def boom():
        raise FileNotFoundError("system.yaml missing")

    plantml_engine.load(boom)
    r = await _post()
    assert r.status_code == 503
    assert r.json()["error"] == "model_unavailable"
    assert "system.yaml missing" in r.json()["message"]
    h = (await _get("/health/ready")).json()
    assert h["backend"] == "plantml" and h["model_loaded"] is False and h["mode"] == "UNAVAILABLE"
    assert "plant-ml failed to load" in h["note"] and "ONNX" not in h["note"]
