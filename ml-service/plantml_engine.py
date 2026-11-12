"""
Optional plant-ml engine (local use only). Selected with MODEL_BACKEND=plantml.

``plantml`` is imported lazily, only inside ``load`` when no predictor factory
is injected, so the default ONNX backend never needs torch.
"""

import logging
import threading
from pathlib import Path
from typing import Callable, Optional

from PIL import Image

from config import settings

logger = logging.getLogger(__name__)

# plant-ml class -> AgriTech label for the classes both systems know.
AGRITECH_LABELS: dict[str, str] = {
    "tomato/healthy": "Tomato___healthy",
    "tomato/early_blight": "Tomato___Early_blight",
    "tomato/late_blight": "Tomato___Late_blight",
    "potato/healthy": "Potato___healthy",
    "potato/early_blight": "Potato___Early_blight",
    "potato/late_blight": "Potato___Late_blight",
    "corn/healthy": "Corn_(maize)___healthy",
    "corn/common_rust": "Corn_(maize)___Common_rust_",
    "corn/northern_leaf_blight": "Corn_(maize)___Northern_Leaf_Blight",
    "apple/healthy": "Apple___healthy",
    "apple/cedar_apple_rust": "Apple___Cedar_apple_rust",
}




def agritech_label(class_name: str) -> str:
    """Map a plant-ml "crop/disease" class to an AgriTech label."""
    if class_name in AGRITECH_LABELS:
        return AGRITECH_LABELS[class_name]
    crop, disease = class_name.split("/", 1)
    return f"{crop.capitalize()}___{disease.capitalize()}"


class PlantmlEngine:
    def __init__(self) -> None:
        self._predictor = None
        self._lock = threading.Lock()
        self.load_error: Optional[str] = None
        self.kb_missing_classes: list[str] = []

    def load(self, predictor_factory: Optional[Callable[[], object]] = None) -> None:
        """Build the predictor once. Failures leave the engine unloaded (logged)."""
        try:
            self._predictor = (predictor_factory or self._default_factory)()
            self.load_error = None
            self.kb_missing_classes = []
            active = getattr(self._predictor, "active", None)
            if active is not None and hasattr(active, "class_names"):
                from advisory import has_kb_entry
                missing = [n for n in active.class_names() if not has_kb_entry(n)]
                if missing:
                    logger.error("Classes from loaded model missing from advisory KB: %s", missing)
                    self.kb_missing_classes = missing
        except Exception as exc:  # noqa: BLE001
            logger.error("plant-ml engine failed to load: %s", exc)
            self._predictor = None
            self.load_error = f"{type(exc).__name__}: {exc}"
            self.kb_missing_classes = []

    @staticmethod
    def _default_factory():
        from plantml.infer.predictor import Predictor  # lazy: needs torch + PYTHONPATH

        kwargs = {}
        if settings.plantml_runs_dir:
            kwargs["runs_dir"] = Path(settings.plantml_runs_dir)
        if settings.plantml_thresholds:
            kwargs["thresholds"] = Path(settings.plantml_thresholds)
        predictor = Predictor.from_system(
            Path(settings.plantml_system), mode=settings.plantml_mode,
            device=settings.plantml_device or None, **kwargs
        )
        predictor.load()
        return predictor

    def is_loaded(self) -> bool:
        return self._predictor is not None

    def run(self, image_bytes: bytes, crop_hint: Optional[str] = None) -> dict:
        if self._predictor is None:
            raise RuntimeError("plant-ml engine is not loaded")
        hint = (crop_hint or "").lower().strip() or None  # unknown hints are ignored by the predictor
        with self._lock:  # torch inference is not guaranteed thread-safe
            try:
                pred = self._predictor.predict(image_bytes, crop_hint=hint)
            except (OSError, Image.DecompressionBombError) as exc:  # PIL decode failures & decompression bombs
                raise ValueError(f"Cannot decode image: {exc}") from exc
        top = [{"label": agritech_label(n), "probability": float(p)} for n, p in pred.top_k]
        return {
            "top_label": agritech_label(pred.class_name),
            "confidence": float(pred.confidence),
            "top_probabilities": top,
            "all_probabilities": {t["label"]: t["probability"] for t in top},
            "execution_time_ms": round(float(pred.elapsed_ms), 2),
            "model_version": f"plantml-{pred.mode}",
            "model_loaded": True,
            "status": pred.status,
            "plant_score": float(pred.plant_score),
            "threshold": getattr(pred, "threshold", None),
        }

    def meta(self, label: str) -> dict:
        """Metadata for any label this engine returns (canonical source: advisory KB)."""
        from advisory import get_class_meta
        return get_class_meta(label)


plantml_engine = PlantmlEngine()
