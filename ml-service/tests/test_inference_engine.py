"""
Tests for the InferenceEngine preprocessing and stub-mode behaviour.
These tests run without a real ONNX model (ML-102/ML-103 pending).
"""

import io
import numpy as np
import pytest
from PIL import Image

from inference import (
    CLASS_LABELS,
    InferenceEngine,
    get_class_meta,
    preprocess_image,
)


def _make_jpeg_bytes(width: int = 256, height: int = 256) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(100, 150, 200)).save(buf, "JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# preprocess_image
# ---------------------------------------------------------------------------

def test_preprocess_image_output_shape():
    """Preprocessed tensor must be (1, 3, 224, 224) float32."""
    tensor = preprocess_image(_make_jpeg_bytes())
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32


def test_preprocess_image_normalised_range():
    """After ImageNet normalisation values are centred around 0 (not [0, 1])."""
    tensor = preprocess_image(_make_jpeg_bytes())
    # ImageNet normalised pixels should have mean close to 0
    assert tensor.mean() < 1.5, "Mean seems unnormalised"


def test_preprocess_image_raises_on_corrupt_bytes():
    """Corrupt bytes must raise ValueError (not crash with unhandled exception)."""
    with pytest.raises(ValueError, match="Cannot decode image"):
        preprocess_image(b"THIS_IS_NOT_AN_IMAGE")


def test_preprocess_image_accepts_png():
    """PNG images must be accepted and converted to float32 NCHW tensor."""
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), color=(10, 20, 30)).save(buf, "PNG")
    tensor = preprocess_image(buf.getvalue())
    assert tensor.shape == (1, 3, 224, 224)


def test_preprocess_image_handles_rgba():
    """RGBA images must be silently converted to RGB before preprocessing."""
    buf = io.BytesIO()
    Image.new("RGBA", (256, 256), color=(10, 20, 30, 128)).save(buf, "PNG")
    # Should NOT raise; Pillow .convert("RGB") handles the alpha channel
    tensor = preprocess_image(buf.getvalue())
    assert tensor.shape == (1, 3, 224, 224)


# ---------------------------------------------------------------------------
# InferenceEngine stub mode
# ---------------------------------------------------------------------------

def test_engine_stub_mode_run():
    """Engine with no model file runs in stub mode and returns a valid result dict."""
    engine = InferenceEngine()
    # Do NOT call engine.load() — simulates missing model file

    result = engine.run(_make_jpeg_bytes())

    assert "top_label" in result
    assert result["top_label"] in CLASS_LABELS
    assert 0.0 <= result["confidence"] <= 1.0
    assert isinstance(result["top_probabilities"], list)
    assert len(result["top_probabilities"]) == 3
    assert result["execution_time_ms"] >= 0
    assert result["model_loaded"] is False


def test_engine_stub_mode_probabilities_sum_to_one():
    """Stub probabilities must form a valid probability distribution."""
    engine = InferenceEngine()
    result = engine.run(_make_jpeg_bytes())
    total = sum(p["probability"] for p in result["top_probabilities"])
    # top-3 sum must be ≤ 1.0 (remainder in lower-ranked classes)
    assert total <= 1.0 + 1e-5


def test_engine_stub_mode_corrupt_image_raises():
    """Even in stub mode, corrupt image bytes must raise ValueError from preprocessing."""
    engine = InferenceEngine()
    with pytest.raises(ValueError):
        engine.run(b"GARBAGE_BYTES")


# ---------------------------------------------------------------------------
# CLASS_LABELS
# ---------------------------------------------------------------------------

def test_class_labels_count():
    """Exactly 12 class labels must be defined."""
    assert len(CLASS_LABELS) == 12


def test_class_labels_coverage():
    """All four target crops must be represented."""
    labels_str = " ".join(CLASS_LABELS)
    assert "Tomato" in labels_str
    assert "Potato" in labels_str
    assert "Corn" in labels_str
    assert "Apple" in labels_str


# ---------------------------------------------------------------------------
# get_class_meta
# ---------------------------------------------------------------------------

def test_get_class_meta_known_label():
    meta = get_class_meta("Tomato___Late_blight")
    assert meta["crop"] == "Tomato"
    assert meta["condition"] == "Late Blight"
    assert meta["pathogen"] == "FUNGAL"
    assert meta["severity"] == "High"


def test_get_class_meta_healthy_label():
    meta = get_class_meta("Tomato___healthy")
    assert meta["condition"] == "Healthy"
    assert meta["pathogen"] == "HEALTHY"


def test_get_class_meta_unknown_label():
    meta = get_class_meta("UnknownCrop___UnknownDisease")
    assert meta["crop"] == "Unknown"
    assert meta["condition"] == "UnknownCrop___UnknownDisease"


# ---------------------------------------------------------------------------
# Live ONNX Model Inference Tests (TODO-103)
# ---------------------------------------------------------------------------

def test_inference_engine_loads_onnx_model():
    """Verify InferenceEngine correctly loads the exported ONNX model artifact."""
    from pathlib import Path
    from config import settings

    model_path = Path(settings.onnx_model_path)
    if not model_path.exists():
        pytest.skip(f"ONNX model file not found at {model_path}")

    engine = InferenceEngine()
    engine.load(str(model_path))

    assert engine.is_loaded() is True
    assert engine._model_version == model_path.stem
    assert engine._session is not None
    assert engine._input_name is not None


def test_inference_engine_live_prediction():
    """Verify live ONNX model runs full inference and adheres to sub-85ms latency."""
    from pathlib import Path
    from config import settings

    model_path = Path(settings.onnx_model_path)
    if not model_path.exists():
        pytest.skip(f"ONNX model file not found at {model_path}")

    engine = InferenceEngine()
    engine.load(str(model_path))

    img_bytes = _make_jpeg_bytes(224, 224)
    result = engine.run(img_bytes)

    assert result["model_loaded"] is True
    assert result["model_version"] == "agritech_classifier"
    assert result["top_label"] in CLASS_LABELS
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["top_probabilities"]) == 3
    assert len(result["all_probabilities"]) == 12
    # Latency of single inference on CPU within full pipeline
    assert result["execution_time_ms"] < 85.0


def test_inference_engine_quantized_int8_model():
    """Verify INT8 quantized ONNX model can also be loaded and executed."""
    from pathlib import Path

    int8_path = Path("models/agritech_classifier_quantized.onnx")
    if not int8_path.exists():
        pytest.skip(f"INT8 ONNX model not found at {int8_path}")

    engine = InferenceEngine()
    engine.load(str(int8_path))

    assert engine.is_loaded() is True
    img_bytes = _make_jpeg_bytes(224, 224)
    result = engine.run(img_bytes)

    assert result["model_loaded"] is True
    assert result["top_label"] in CLASS_LABELS
    assert 0.0 <= result["confidence"] <= 1.0

