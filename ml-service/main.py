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
"""

import asyncio
import io
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from inference import get_class_meta, inference_engine
from schemas import (
    AgronomicAdvisory,
    ClassifyLeafResponse,
    ErrorDetail,
    PredictionDetail,
    TelemetryLinkageHints,
    TopProbability,
)

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


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
    logger.info("Loading ONNX model from: %s", settings.onnx_model_path)

    # Model loading is synchronous but runs only once; safe in startup context
    inference_engine.load(settings.onnx_model_path)

    if inference_engine.is_loaded():
        logger.info("ONNX model loaded successfully — LIVE inference mode active.")
    else:
        logger.warning(
            "ONNX model NOT loaded — running in STUB mode. "
            "Complete ML-102 and ML-103, then place the model at: %s",
            settings.onnx_model_path,
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
# Health endpoints (TODO-106 will extend these; basic versions provided here)
# ---------------------------------------------------------------------------

@app.get("/health/live", tags=["Health"])
async def health_live():
    """Liveness probe — confirms the process is running."""
    return {"status": "alive", "service": "agritech-ml-service", "version": settings.app_version}


@app.get("/health/ready", tags=["Health"])
async def health_ready():
    """
    Readiness probe — reports whether the ONNX model is resident in memory.
    Returns 200 in both LIVE and STUB modes; clients should inspect model_loaded.
    """
    return {
        "status": "ready",
        "model_loaded": inference_engine.is_loaded(),
        "mode": "LIVE" if inference_engine.is_loaded() else "STUB",
        "note": (
            None
            if inference_engine.is_loaded()
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
    response_model=ClassifyLeafResponse,
    responses={
        400: {"model": ErrorDetail, "description": "Malformed or unsupported image file"},
        413: {"description": "File exceeds the 10 MB upload limit"},
        422: {"model": ErrorDetail, "description": "Invalid request — missing file or wrong content-type"},
    },
    tags=["Inference"],
    summary="Classify leaf disease from an uploaded image",
)
async def classify_leaf(request: Request, file: UploadFile = File(...)):
    """
    Ingests a multipart leaf image, preprocesses it with Pillow, runs ONNX
    inference, and returns a fully-typed diagnostic response.

    Validation layers (in order):
    1. MIME type check  → 400 if not image/jpeg, image/png, or image/webp
    2. File size check  → 413 if > 10 MB
    3. Pillow decodability → 400 if bytes cannot be decoded as an image
    4. Inference         → 500 if model raises an unexpected runtime error
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
    # Layer 2: File size validation (read into memory with cap)
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
                    f"Maximum allowed size is {settings.max_upload_bytes // (1024*1024)} MB."
                ),
                "field": "file",
            },
        )

    if len(image_bytes) == 0:
        return JSONResponse(
            status_code=400,
            content={
                "error": "empty_file",
                "message": "The uploaded file is empty.",
                "field": "file",
            },
        )

    # ------------------------------------------------------------------
    # Layer 3 + 4: Preprocessing & Inference (offloaded to threadpool)
    # Keeps the async event loop unblocked during CPU-bound work.
    # ------------------------------------------------------------------
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, inference_engine.run, image_bytes)
    except ValueError as exc:
        # Raised by preprocess_image() when Pillow cannot decode the bytes
        return JSONResponse(
            status_code=400,
            content={
                "error": "image_decode_failure",
                "message": str(exc),
                "field": "file",
            },
        )

    # ------------------------------------------------------------------
    # Build response
    # ------------------------------------------------------------------
    top_label = result["top_label"]
    meta = get_class_meta(top_label)
    is_high_moisture_risk = meta.get("pathogen") in ("FUNGAL", "BACTERIAL")

    # Stub agronomic advisory (TODO-105 will populate a real knowledge base)
    advisory = AgronomicAdvisory(
        immediate_action=(
            "Isolate affected perimeter; restrict overhead irrigation."
            if meta["condition"] != "Healthy"
            else "No immediate action required. Continue routine monitoring."
        ),
        fungicide_treatments=(
            ["Copper-based preventative spray", "Mancozeb or Chlorothalonil application"]
            if meta.get("pathogen") == "FUNGAL"
            else []
        ),
        environmental_risk_factors=(
            "High humidity (>85%) with moderate temperatures (15°C–24°C)."
            if is_high_moisture_risk
            else "No significant environmental risk factors identified."
        ),
    )

    response = ClassifyLeafResponse(
        inference_id=str(uuid.uuid4()),
        prediction=PredictionDetail(
            crop=meta["crop"],
            condition=meta["condition"],
            scientific_name=meta.get("scientific_name"),
            confidence_score=result["confidence"],
            severity_index=meta["severity"],
        ),
        top_probabilities=[
            TopProbability(label=p["label"], probability=p["probability"])
            for p in result["top_probabilities"]
        ],
        agronomic_advisory=advisory,
        telemetry_linkage_hints=TelemetryLinkageHints(
            leaf_wetness_threshold_hours=6 if is_high_moisture_risk else 0,
            moisture_risk=is_high_moisture_risk,
        ),
        execution_time_ms=result["execution_time_ms"],
        model_version=result["model_version"],
        model_loaded=result["model_loaded"],
    )

    logger.info(
        "classify-leaf | label=%s confidence=%.4f time=%.1fms model_loaded=%s",
        top_label,
        result["confidence"],
        result["execution_time_ms"],
        result["model_loaded"],
    )
    return response


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
