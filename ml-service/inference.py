"""
Precision AgriTech - ONNX Inference Engine
Manages a single global OrtInferenceSession and exposes a typed run() method.

Design decisions:
- Session is loaded ONCE at application startup via the FastAPI lifespan handler.
- When the ONNX model artifact is absent (ML-102 / ML-103 not yet complete),
  the engine degrades to a deterministic stub that still exercises the full
  preprocessing pipeline, letting TODO-104 be validated independently.
- Image preprocessing exactly replicates the torchvision transform chain that
  the training pipeline (TODO-102) must use:
      Resize → CenterCrop(224) → ToTensor → Normalize(ImageNet mean/std)
"""

import io
import time
import logging
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, UnidentifiedImageError

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 12 target class labels (must stay in sync with TODO-102 training label order)
# PyTorch ImageFolder sorts classes alphabetically: Apple -> Corn -> Potato -> Tomato
# ---------------------------------------------------------------------------
DEFAULT_CLASS_LABELS: list[str] = [
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___healthy",
]


def _load_class_labels() -> list[str]:
    """
    Loads class labels from models/hyperparameters.json if available,
    guaranteeing runtime parity with the trained model checkpoint.
    Falls back to DEFAULT_CLASS_LABELS.
    """
    candidate_paths = [
        Path(settings.onnx_model_path).parent / "hyperparameters.json",
        Path(__file__).parent / "models" / "hyperparameters.json",
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                import json
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if "classes" in data and len(data["classes"]) == 12:
                    return list(data["classes"])
            except Exception as e:
                logger.warning("Failed to parse %s for class labels: %s", p, e)
    return DEFAULT_CLASS_LABELS


CLASS_LABELS: list[str] = _load_class_labels()

# Human-readable metadata keyed by class label
_CLASS_META: dict[str, dict] = {
    "Tomato___healthy":                      {"crop": "Tomato", "condition": "Healthy",              "scientific_name": None,                        "severity": "None",     "pathogen": "HEALTHY"},
    "Tomato___Early_blight":                 {"crop": "Tomato", "condition": "Early Blight",         "scientific_name": "Alternaria solani",          "severity": "Medium",   "pathogen": "FUNGAL"},
    "Tomato___Late_blight":                  {"crop": "Tomato", "condition": "Late Blight",          "scientific_name": "Phytophthora infestans",     "severity": "High",     "pathogen": "FUNGAL"},
    "Tomato___Bacterial_spot":               {"crop": "Tomato", "condition": "Bacterial Spot",       "scientific_name": "Xanthomonas campestris",     "severity": "Medium",   "pathogen": "BACTERIAL"},
    "Potato___healthy":                      {"crop": "Potato", "condition": "Healthy",              "scientific_name": None,                        "severity": "None",     "pathogen": "HEALTHY"},
    "Potato___Early_blight":                 {"crop": "Potato", "condition": "Early Blight",         "scientific_name": "Alternaria solani",          "severity": "Medium",   "pathogen": "FUNGAL"},
    "Potato___Late_blight":                  {"crop": "Potato", "condition": "Late Blight",          "scientific_name": "Phytophthora infestans",     "severity": "High",     "pathogen": "FUNGAL"},
    "Corn_(maize)___healthy":                {"crop": "Corn",   "condition": "Healthy",              "scientific_name": None,                        "severity": "None",     "pathogen": "HEALTHY"},
    "Corn_(maize)___Common_rust_":           {"crop": "Corn",   "condition": "Common Rust",          "scientific_name": "Puccinia sorghi",            "severity": "Medium",   "pathogen": "FUNGAL"},
    "Corn_(maize)___Northern_Leaf_Blight":   {"crop": "Corn",   "condition": "Northern Leaf Blight", "scientific_name": "Exserohilum turcicum",       "severity": "High",     "pathogen": "FUNGAL"},
    "Apple___healthy":                       {"crop": "Apple",  "condition": "Healthy",              "scientific_name": None,                        "severity": "None",     "pathogen": "HEALTHY"},
    "Apple___Cedar_apple_rust":              {"crop": "Apple",  "condition": "Cedar Apple Rust",     "scientific_name": "Gymnosporangium juniperi-virginianae", "severity": "Medium", "pathogen": "FUNGAL"},
}


# ---------------------------------------------------------------------------
# Image pre-processing (must match the training transform chain in TODO-102)
# ---------------------------------------------------------------------------

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Converts raw image bytes to a normalised float32 NCHW tensor (1, 3, 224, 224).

    Steps mirror torchvision.transforms:
        1. Decode & convert to RGB
        2. Resize shortest edge to 256 (bilinear)
        3. Center-crop to 224×224
        4. Scale to [0, 1] float32
        5. Normalise with ImageNet mean / std channel-wise
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValueError(f"Cannot decode image: {exc}") from exc

    # Step 2 – resize (shortest edge → 256, maintaining aspect ratio)
    w, h = img.size
    scale = 256 / min(w, h)
    new_w = max(int(round(w * scale)), 1)
    new_h = max(int(round(h * scale)), 1)
    img = img.resize((new_w, new_h), Image.BILINEAR)

    # Step 3 – centre crop to model input size
    input_size = settings.image_input_size  # 224
    left = (new_w - input_size) // 2
    top = (new_h - input_size) // 2
    img = img.crop((left, top, left + input_size, top + input_size))

    # Step 4 – to float32 [0, 1]
    arr = np.array(img, dtype=np.float32) / 255.0  # (H, W, C)

    # Step 5 – ImageNet normalisation
    mean = np.array(settings.imagenet_mean, dtype=np.float32)
    std = np.array(settings.imagenet_std, dtype=np.float32)
    arr = (arr - mean) / std

    # NCHW layout for ONNX Runtime
    arr = arr.transpose(2, 0, 1)        # (C, H, W)
    arr = np.expand_dims(arr, axis=0)   # (1, C, H, W)
    return arr


# ---------------------------------------------------------------------------
# Inference engine (singleton)
# ---------------------------------------------------------------------------

class InferenceEngine:
    """
    Wraps a single OrtInferenceSession and exposes a typed inference method.

    The engine operates in two modes:
    - LIVE: Real ONNX model loaded; full inference pipeline runs.
    - STUB: Model artifact absent (ML-102/103 pending); deterministic
            dummy probabilities are returned so the rest of the pipeline
            (validation, error handling, response shaping) can be exercised.
    """

    def __init__(self) -> None:
        self._session = None  # onnxruntime.InferenceSession | None
        self._input_name: Optional[str] = None
        self._model_version: str = "stub_no_model"
        self._model_loaded: bool = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def load(self, model_path: str) -> None:
        """
        Attempts to load the ONNX session from *model_path*.
        On failure (file missing / corrupt) the engine silently degrades to stub
        mode and logs a clear warning so operators know the model is absent.
        """
        path = Path(model_path)
        if not path.exists():
            logger.warning(
                "ONNX model not found at '%s'. "
                "Service will run in STUB mode until ML-102/ML-103 are complete "
                "and the model artifact is placed at this path.",
                model_path,
            )
            return

        try:
            import onnxruntime as ort

            # Use CPU execution provider (GPU optional in Phase 3+)
            session_options = ort.SessionOptions()
            session_options.inter_op_num_threads = 1
            session_options.intra_op_num_threads = 2

            self._session = ort.InferenceSession(
                str(path),
                sess_options=session_options,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self._session.get_inputs()[0].name
            self._model_version = path.stem  # e.g. "agritech_classifier"
            self._model_loaded = True
            logger.info("ONNX model loaded successfully: %s", path)

        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to load ONNX model: %s — falling back to STUB mode.", exc)

    def is_loaded(self) -> bool:
        return self._model_loaded

    # ------------------------------------------------------------------
    # Core inference
    # ------------------------------------------------------------------

    def run(self, image_bytes: bytes) -> dict:
        """
        Runs the full preprocessing → inference → postprocessing pipeline.

        Returns a dict with:
            top_label, confidence, probabilities, execution_time_ms, model_version, model_loaded
        """
        t0 = time.perf_counter()

        tensor = preprocess_image(image_bytes)  # raises ValueError on bad images

        if self._model_loaded and self._session is not None:
            raw_output = self._session.run(None, {self._input_name: tensor})
            logits = raw_output[0][0]           # shape: (12,)
            probabilities = _softmax(logits)
        else:
            # Stub: deterministic dummy distribution (index 0 = Tomato healthy)
            probabilities = _stub_probabilities()

        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        top_idx = int(np.argmax(probabilities))
        top_label = CLASS_LABELS[top_idx]
        confidence = float(probabilities[top_idx])

        # Build top-3 list sorted by probability descending
        ranked = sorted(
            enumerate(probabilities), key=lambda x: x[1], reverse=True
        )
        top_k = [
            {"label": CLASS_LABELS[i], "probability": float(p)}
            for i, p in ranked[:3]
        ]

        return {
            "top_label": top_label,
            "confidence": confidence,
            "top_probabilities": top_k,
            "all_probabilities": {CLASS_LABELS[i]: float(p) for i, p in enumerate(probabilities)},
            "execution_time_ms": round(elapsed_ms, 2),
            "model_version": self._model_version,
            "model_loaded": self._model_loaded,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _softmax(logits: np.ndarray) -> np.ndarray:
    e = np.exp(logits - np.max(logits))
    return e / e.sum()


def _stub_probabilities() -> np.ndarray:
    """
    Returns a deterministic dummy probability array for stub mode.
    Peaks at Tomato___Late_blight at ~89% to mimic a realistic
    high-confidence positive classification for integration testing.
    """
    probs = np.full(len(CLASS_LABELS), 0.005, dtype=np.float32)
    late_blight_idx = CLASS_LABELS.index("Tomato___Late_blight") if "Tomato___Late_blight" in CLASS_LABELS else 10
    early_blight_idx = CLASS_LABELS.index("Tomato___Early_blight") if "Tomato___Early_blight" in CLASS_LABELS else 9
    healthy_idx = CLASS_LABELS.index("Tomato___healthy") if "Tomato___healthy" in CLASS_LABELS else 11

    probs[late_blight_idx] = 0.8931  # Tomato___Late_blight
    probs[early_blight_idx] = 0.0612  # Tomato___Early_blight
    probs[healthy_idx] = 0.0201  # Tomato___healthy
    # Normalize so they sum to 1
    probs = probs / probs.sum()
    return probs


def get_class_meta(label: str) -> dict:
    """Returns human-readable metadata dict for a given class label string."""
    return _CLASS_META.get(label, {
        "crop": "Unknown",
        "condition": label,
        "scientific_name": None,
        "severity": "Unknown",
        "pathogen": "UNKNOWN",
    })


# ---------------------------------------------------------------------------
# Module-level singleton (imported by main.py lifespan handler)
# ---------------------------------------------------------------------------
inference_engine = InferenceEngine()
