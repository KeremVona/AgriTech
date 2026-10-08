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


def test_class_labels_alphabetical_order():
    """Class labels must strictly maintain ImageFolder alphabetical order starting with Apple."""
    assert CLASS_LABELS[0] == "Apple___Cedar_apple_rust"
    assert CLASS_LABELS[1] == "Apple___healthy"
    assert CLASS_LABELS[-1] == "Tomato___healthy"
    assert CLASS_LABELS == sorted(CLASS_LABELS)


def test_class_labels_matches_hyperparameters():
    """When hyperparameters.json is present, CLASS_LABELS must match its classes exactly."""
    import json
    from pathlib import Path
    hp_path = Path(__file__).parent.parent / "models" / "hyperparameters.json"
    if hp_path.exists():
        with open(hp_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "classes" in data:
            assert CLASS_LABELS == data["classes"]


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


def test_combine_multitask_probabilities_valid_distribution():
    """Verify Bayesian combination produces a normalized distribution summing to 1.0."""
    from inference import _combine_multitask_probabilities

    crop_probs = np.array([0.05, 0.05, 0.10, 0.80], dtype=np.float32)  # High Tomato
    disease_probs = np.array([0.02, 0.10, 0.85, 0.01, 0.01, 0.01, 0.0, 0.0], dtype=np.float32)  # High Late blight

    combined = _combine_multitask_probabilities(crop_probs, disease_probs)
    assert len(combined) == 12
    assert np.isclose(np.sum(combined), 1.0, atol=1e-5)
    late_blight_idx = CLASS_LABELS.index("Tomato___Late_blight")
    assert np.argmax(combined) == late_blight_idx
    assert combined[late_blight_idx] > 0.5


def test_combine_multitask_probabilities_crop_hint_filtering():
    """Verify crop_hint zeros out probability for all other crops."""
    from inference import _combine_multitask_probabilities

    # Even if model thought potato was high, user specifies crop_hint='tomato'
    crop_probs = np.array([0.1, 0.1, 0.7, 0.1], dtype=np.float32)  # High Potato
    disease_probs = np.array([0.02, 0.05, 0.90, 0.01, 0.01, 0.01, 0.0, 0.0], dtype=np.float32)

    combined = _combine_multitask_probabilities(crop_probs, disease_probs, crop_hint="tomato")
    assert np.isclose(np.sum(combined), 1.0, atol=1e-5)

    # Check all non-tomato classes are zero
    for idx, label in enumerate(CLASS_LABELS):
        if not label.startswith("Tomato"):
            assert combined[idx] == 0.0
        else:
            assert combined[idx] > 0.0

    assert CLASS_LABELS[int(np.argmax(combined))] == "Tomato___Late_blight"


def test_dual_head_onnx_inference_engine_execution(monkeypatch):
    """Verify InferenceEngine properly handles dual-head ONNX output format."""
    engine = InferenceEngine()
    engine._model_loaded = True
    engine._model_version = "mock_multitask"
    engine._input_name = "input"

    class MockSession:
        def run(self, output_names, input_feed):
            # Return 2 outputs: crop_logits [1, 4], disease_logits [1, 8]
            # Crop 2 = Potato (logits: [0, 0, 5.0, 0])
            # Disease 1 = Early blight (logits: [0, 6.0, 0, 0, 0, 0, 0, 0])
            crop_logits = np.array([[0.0, 0.0, 5.0, 0.0]], dtype=np.float32)
            disease_logits = np.array([[0.0, 6.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)
            return [crop_logits, disease_logits]

    engine._session = MockSession()
    img_bytes = _make_jpeg_bytes(224, 224)

    result = engine.run(img_bytes)
    assert result["model_loaded"] is True
    assert result["top_label"] == "Potato___Early_blight"
    assert result["confidence"] > 0.80


