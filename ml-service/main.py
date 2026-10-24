"""
Precision AgriTech - Machine Learning & Vision Inference Service
FastAPI application for crop disease classification and leaf diagnostics.

Key design decisions for TODO-104:
- lifespan handler loads the ONNX session ONCE at startup; never per-request.
- If the model file is absent (ML-102/ML-103 pending) the service starts in
  STUB mode and documents this clearly in /health/ready and classify-leaf responses.
- Validation layers (MIME type, file size, Pillow decodability) return
  descriptive 400/422 JSON errors before any inference is attempted.
- All heavy I/O (file.read()) is awaited; inference runs synchronously in a
  threadpool via run_in_executor so the async event loop is never blocked.

Updates for TODO-105:
- Advisory engine (advisory.py) integrated into classify-leaf response.
- Low-confidence path (<60%) returns ClassifyLeafLowConfidenceResponse
  with operator rescan instructions instead of a potentially unreliable advisory.
- /health/ready now reports advisory KB status alongside model status.
"""

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Optional, Union

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from advisory import _RESCAN_INSTRUCTIONS, get_advisory, get_kb_version, get_kb_class_count, is_kb_loaded
from config import settings
from inference import get_class_meta, inference_engine
from plantml_engine import plantml_engine
from schemas import (
    LowConfidenceAdvisory,
    ClassifyLeafLowConfidenceResponse,
    ClassifyLeafResponse,
    ErrorDetail,
    PredictionDetail,
    TopProbability,
)

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _engine():
    """Active inference engine for the configured MODEL_BACKEND."""
    return plantml_engine if settings.model_backend == "plantml" else inference_engine


_UNSUPPORTED_MESSAGE = (
    "This does not look like a leaf of a supported crop (tomato, potato, corn, "
    "apple, grape, rice, cassava). Photograph a single leaf of one of these crops."
)
_RETAKE_MESSAGE = (
    "The model is not confident enough in this photo. Please re-capture the leaf "
    "following the instructions below before taking any agronomic action."
)


# ---------------------------------------------------------------------------
# Lifespan: ONNX session loaded ONCE at startup (acceptance criterion)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.
    Loads the ONNX model into the global inference_engine singleton before
    the server begins accepting requests, ensuring zero cold-start latency
    per request (TODO-104 acceptance criterion).
    """
    logger.info("=== AgriTech ML Service starting up ===")
    if settings.model_backend == "plantml":
        logger.info("Loading plant-ml system from: %s", settings.plantml_system)
        plantml_engine.load()
    else:
        logger.info("Loading ONNX model from: %s", settings.onnx_model_path)
        # Model loading is synchronous but runs only once; safe in startup context
        inference_engine.load(settings.onnx_model_path)

    if settings.model_backend == "plantml":
        if plantml_engine.is_loaded():
            logger.info(
                "plant-ml loaded (mode=%s, system=%s) — LIVE inference mode active.",
                settings.plantml_mode, settings.plantml_system,
            )
        else:
            logger.error("plant-ml NOT loaded: %s", plantml_engine.load_error)
    elif _engine().is_loaded():
        logger.info("ONNX model loaded successfully — LIVE inference mode active.")
    else:
        logger.warning(
            "ONNX model NOT loaded — running in STUB mode. "
            "Complete ML-102 and ML-103, then place the model at: %s",
            settings.onnx_model_path,
        )

    # Advisory KB is loaded at advisory.py import time; log its status here
    if is_kb_loaded():
        logger.info(
            "Advisory knowledge base loaded: %d classes (version %s)",
            get_kb_class_count(),
            get_kb_version(),
        )
    else:
        logger.error(
            "Advisory knowledge base FAILED to load. "
            "Ensure ml-service/data/disease_advisories.json exists."
        )

    yield  # Application runs here

    logger.info("=== AgriTech ML Service shutting down ===")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.app_name,
    description=(
        "Inference API for leaf disease detection and crop health diagnostics. "
        "Part of the Precision AgriTech Platform — Phase 1."
    ),
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler for unexpected errors
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "An unexpected error occurred."},
    )


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------

@app.get("/health/live", tags=["Health"])
async def health_live():
    """Liveness probe — confirms the process is running."""
    return {"status": "alive", "service": "agritech-ml-service", "version": settings.app_version}


@app.get("/health/ready", tags=["Health"])
async def health_ready():
    """
    Readiness probe — reports ONNX model and advisory knowledge base status.
    Returns 200 in both LIVE and STUB modes; clients should inspect model_loaded.
    """
    return {
        "status": "ready",
        "model_loaded": _engine().is_loaded(),
        "mode": "LIVE" if _engine().is_loaded() else ("UNAVAILABLE" if settings.model_backend == "plantml" else "STUB"),
        "backend": settings.model_backend,
        "advisory_kb": {
            "loaded": is_kb_loaded(),
            "version": get_kb_version(),
            "class_count": get_kb_class_count(),
        },
        "note": (
            f"plant-ml failed to load: {plantml_engine.load_error}"
            if settings.model_backend == "plantml" and not plantml_engine.is_loaded()
            else None
            if _engine().is_loaded()
            else "Running in stub mode — ML-102 (training) and ML-103 (ONNX export) are pending."
        ),
    }


# Backwards-compatible alias
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "agritech-ml-service", "version": settings.app_version}


# ---------------------------------------------------------------------------
# Core classify-leaf endpoint
# ---------------------------------------------------------------------------

@app.post(
    "/api/v1/classify-leaf",
    response_model=Union[ClassifyLeafResponse, ClassifyLeafLowConfidenceResponse],
    responses={
        400: {"model": ErrorDetail, "description": "Malformed or unsupported image file"},
        413: {"description": "File exceeds the 10 MB upload limit"},
        422: {"model": ErrorDetail, "description": "Invalid request — missing file or wrong content-type"},
    },
    tags=["Inference"],
    summary="Classify leaf disease from an uploaded image",
)
async def classify_leaf(
    request: Request,
    file: UploadFile = File(...),
    crop_hint: Optional[str] = Form(None),
) -> Union[ClassifyLeafResponse, ClassifyLeafLowConfidenceResponse]:
    """
    Ingests a multipart leaf image, preprocesses it with Pillow, runs ONNX
    inference, enriches the result with agronomic advisory data from the
    knowledge base, and returns a fully-typed diagnostic response.

    Validation layers (in order):
    1. MIME type check  → 400 if not image/jpeg, image/png, or image/webp
    2. File size check  → 413 if > 10 MB
    3. Empty file check → 400
    4. Pillow decodability → 400 if bytes cannot be decoded
    5. Inference → threadpool (run_in_executor, non-blocking)
    6. Advisory lookup → O(1) in-memory dict; low-confidence path if score < 60%
    """

    # ------------------------------------------------------------------
    # Layer 1: MIME type validation
    # ------------------------------------------------------------------
    content_type = file.content_type or ""
    if content_type not in settings.allowed_mime_types:
        return JSONResponse(
            status_code=400,
            content={
                "error": "invalid_content_type",
                "message": (
                    f"Unsupported file type '{content_type}'. "
                    f"Accepted types: {', '.join(settings.allowed_mime_types)}"
                ),
                "field": "file",
            },
        )

    # ------------------------------------------------------------------
    # Layer 2: File size validation
    # ------------------------------------------------------------------
    image_bytes = await file.read()
    if len(image_bytes) > settings.max_upload_bytes:
        size_mb = len(image_bytes) / (1024 * 1024)
        return JSONResponse(
            status_code=413,
            content={
                "error": "file_too_large",
                "message": (
                    f"Uploaded file is {size_mb:.1f} MB. "
                    f"Maximum allowed size is {settings.max_upload_bytes // (1024 * 1024)} MB."
                ),
                "field": "file",
            },
        )

    # ------------------------------------------------------------------
    # Layer 3: Empty file check
    # ------------------------------------------------------------------
    if len(image_bytes) == 0:
        return JSONResponse(
            status_code=400,
            content={
                "error": "empty_file",
                "message": "The uploaded file is empty.",
                "field": "file",
            },
        )

    loop = asyncio.get_running_loop()
    engine = _engine()
    if settings.model_backend == "plantml" and not engine.is_loaded():
        return JSONResponse(
            status_code=503,
            content={
                "error": "model_unavailable",
                "message": f"plant-ml engine is not loaded: {plantml_engine.load_error}",
            },
        )
    try:
        if crop_hint:
            result = await loop.run_in_executor(
                None, lambda: engine.run(image_bytes, crop_hint=crop_hint)
            )
        else:
            result = await loop.run_in_executor(None, engine.run, image_bytes)
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": "image_decode_failure",
                "message": str(exc),
                "field": "file",
            },
        )

    # ------------------------------------------------------------------
    # Layer 6: Advisory lookup (includes low-confidence fallback)
    # ------------------------------------------------------------------
    top_label: str = result["top_label"]
    confidence: float = result["confidence"]
    inference_id: str = str(uuid.uuid4())

    top_probs = [
        TopProbability(label=p["label"], probability=p["probability"])
        for p in result["top_probabilities"]
    ]

    status: str = result.get("status", "ok")
    if status != "ok":
        low_conf = LowConfidenceAdvisory(
            requires_rescan=True,
            confidence_score=round(confidence, 4),
            threshold=0.0,
            message=_UNSUPPORTED_MESSAGE if status == "unsupported" else _RETAKE_MESSAGE,
            rescan_instructions=_RESCAN_INSTRUCTIONS,
        )
        advisory, telemetry_hints = None, None
    elif settings.model_backend == "plantml":
        # plant-ml has its own calibrated thresholds; skip AgriTech's 0.60 rule.
        advisory, telemetry_hints, low_conf = get_advisory(top_label, 1.0)
    else:
        advisory, telemetry_hints, low_conf = get_advisory(top_label, confidence)

    # ------------------------------------------------------------------
    # Low-confidence path: return rescan advisory instead of prediction
    # ------------------------------------------------------------------
    if low_conf is not None:
        logger.info(
            "classify-leaf | LOW_CONFIDENCE | label=%s confidence=%.4f time=%.1fms",
            top_label,
            confidence,
            result["execution_time_ms"],
        )
        return ClassifyLeafLowConfidenceResponse(
            inference_id=inference_id,
            requires_rescan=True,
            low_confidence_advisory=low_conf,
            top_probabilities=top_probs,
            execution_time_ms=result["execution_time_ms"],
            model_version=result["model_version"],
            model_loaded=result["model_loaded"],
        )

    # ------------------------------------------------------------------
    # High-confidence path: full diagnostic response
    # ------------------------------------------------------------------
    meta = get_class_meta(top_label)

    response = ClassifyLeafResponse(
        inference_id=inference_id,
        prediction=PredictionDetail(
            crop=meta["crop"],
            condition=meta["condition"],
            scientific_name=meta.get("scientific_name"),
            confidence_score=confidence,
            severity_index=meta["severity"],
        ),
        top_probabilities=top_probs,
        agronomic_advisory=advisory,
        telemetry_linkage_hints=telemetry_hints,
        execution_time_ms=result["execution_time_ms"],
        model_version=result["model_version"],
        model_loaded=result["model_loaded"],
        low_confidence=None,
    )

    logger.info(
        "classify-leaf | label=%s confidence=%.4f time=%.1fms model_loaded=%s advisory_kb=%s",
        top_label,
        confidence,
        result["execution_time_ms"],
        result["model_loaded"],
        get_kb_version(),
    )
    return response


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
