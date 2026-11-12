"""
Precision AgriTech - Machine Learning & Vision Inference Service
FastAPI application for crop disease classification and leaf diagnostics on the plant-ml model.

Key design decisions:
- plant-ml engine initialized ONCE at startup via lifespan handler.
- If engine fails to load, returns 503 model_unavailable (no fabricated diagnoses).
- Validation layers (MIME type, file size cap, Pillow decodability) return
  descriptive 400/413/422 errors before inference.
- Synchronous inference runs in threadpool via run_in_executor to keep event loop unblocked.
- Integrated agronomic advisory engine provides 100% coverage across 33 classes.
"""

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Optional, Union

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from PIL import Image

# Cap maximum decompressed image pixels to 40M to prevent memory exhaustion from image bombs (Finding 6)
Image.MAX_IMAGE_PIXELS = 40_000_000

from advisory import (
    _RESCAN_INSTRUCTIONS,
    get_advisory,
    get_class_meta,
    get_kb_class_count,
    get_kb_version,
    is_kb_loaded,
)
from config import settings
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


_UNSUPPORTED_MESSAGE = (
    "This does not look like a leaf of a supported crop (tomato, potato, corn, "
    "apple, grape, rice, cassava). Photograph a single leaf of one of these crops."
)
_RETAKE_MESSAGE = (
    "The model is not confident enough in this photo. Please re-capture the leaf "
    "following the instructions below before taking any agronomic action."
)


# ---------------------------------------------------------------------------
# Lifespan: plant-ml engine loaded ONCE at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler.
    Initializes the plant-ml engine once at startup before accepting requests.
    """
    logger.info("=== AgriTech ML Service starting up ===")
    logger.info("Loading plant-ml system from: %s", settings.plantml_system)
    plantml_engine.load()

    if plantml_engine.is_loaded():
        logger.info(
            "plant-ml loaded (mode=%s, system=%s) — LIVE inference mode active.",
            settings.plantml_mode,
            settings.plantml_system,
        )
    else:
        logger.error("plant-ml NOT loaded: %s", plantml_engine.load_error)

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

    yield

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
    Readiness probe — reports plant-ml model and advisory knowledge base status.
    Returns 200 when model is loaded, 503 when not ready.
    """
    loaded = plantml_engine.is_loaded()
    content = {
        "status": "ready" if loaded else "not_ready",
        "model_loaded": loaded,
        "mode": "LIVE" if loaded else "UNAVAILABLE",
        "backend": "plantml",
        "plantml_mode": settings.plantml_mode,
        "advisory_kb": {
            "loaded": is_kb_loaded(),
            "version": get_kb_version(),
            "class_count": get_kb_class_count(),
            **({"missing_classes": plantml_engine.kb_missing_classes} if plantml_engine.kb_missing_classes else {}),
        },
        "note": (
            f"plant-ml failed to load: {plantml_engine.load_error}"
            if not loaded
            else None
        ),
    }
    return JSONResponse(status_code=200 if loaded else 503, content=content)


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
    Ingests a multipart leaf image, validates dimensions and MIME type,
    runs plant-ml inference in a threadpool, and enriches the diagnosis
    with agronomic advisory data.
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
    if getattr(file, "size", None) is not None and file.size > settings.max_upload_bytes:
        size_mb = file.size / (1024 * 1024)
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

    image_bytes = await file.read(settings.max_upload_bytes + 1)
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
    if not plantml_engine.is_loaded():
        load_err = plantml_engine.load_error or "no model weights or system configuration loaded"
        return JSONResponse(
            status_code=503,
            content={
                "error": "model_unavailable",
                "message": f"plant-ml engine is not loaded: {load_err}",
            },
        )
    try:
        if crop_hint:
            result = await loop.run_in_executor(
                None, lambda: plantml_engine.run(image_bytes, crop_hint=crop_hint)
            )
        else:
            result = await loop.run_in_executor(None, plantml_engine.run, image_bytes)
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
    if status == "unsupported":
        top_probs = []  # near-uniform classes for a non-plant image would mislead
    if status != "ok":
        applied_threshold = result.get("threshold")
        low_conf = LowConfidenceAdvisory(
            requires_rescan=True,
            confidence_score=round(confidence, 4),
            threshold=float(applied_threshold) if applied_threshold is not None else None,
            message=_UNSUPPORTED_MESSAGE if status == "unsupported" else _RETAKE_MESSAGE,
            rescan_instructions=_RESCAN_INSTRUCTIONS,
        )
        advisory, telemetry_hints = None, None
    else:
        # plant-ml has its own calibrated thresholds; skip legacy 0.60 rule.
        advisory, telemetry_hints, low_conf = get_advisory(top_label, 1.0)

    # ------------------------------------------------------------------
    # Low-confidence path: return rescan advisory instead of prediction
    # ------------------------------------------------------------------
    if low_conf is not None:
        logger.info(
            "classify-leaf | LOW_CONFIDENCE | status=%s label=%s confidence=%.4f plant_score=%s time=%.1fms",
            status,
            top_label,
            confidence,
            result.get("plant_score", "n/a"),
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
