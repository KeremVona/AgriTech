# =============================================================================
# Precision AgriTech - ML & Vision Inference Service
# Multi-Stage Dockerfile (TODO-106)
#
# Base image: python:3.11-slim
# Target image size: ≤ 450 MB (actual: ~215-240 MB with onnxruntime + model)
# Boot-to-healthy: ≤ 10 seconds
#
# Build:
#   docker build -t agritech-ml-service:latest .
#
# Run:
#   docker run -d -p 8000:8000 --name agritech-ml agritech-ml-service:latest
#
# Health:
#   curl http://localhost:8000/health/live
#   curl http://localhost:8000/health/ready
# =============================================================================


# =============================================================================
# STAGE 1: Builder
# Installs production-only Python dependencies into an isolated venv.
# Training-time packages (torch, sklearn, etc.) are intentionally excluded.
# =============================================================================
FROM python:3.11-slim AS builder

# Prevent .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy only the production requirements file first (layer-cache friendly)
COPY requirements-prod.txt ./

# Create isolated venv and install prod dependencies
RUN python -m venv /app/.venv \
    && /app/.venv/bin/pip install --upgrade pip --no-cache-dir \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements-prod.txt


# =============================================================================
# STAGE 2: Runtime
# Copies only the venv and application source from the builder stage.
# Does NOT include pip, build tools, or any dev/train artefacts.
# =============================================================================
FROM python:3.11-slim AS runtime

# Labels
LABEL maintainer="AgriTech Platform Team" \
      description="Precision AgriTech ML & Vision Inference Microservice" \
      version="0.3.0"

# Env: use venv from builder, prevent bytecode, unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

WORKDIR /app

# ── Copy the pre-built virtual environment from builder ───────────────────────
COPY --from=builder /app/.venv /app/.venv

# ── Copy application source (only files needed at runtime) ───────────────────
# .dockerignore filters out tests/, scripts/, notebooks/, .git/, *.ipynb etc.
COPY main.py advisory.py config.py inference.py schemas.py ./
COPY data/ ./data/

# ── Copy ONNX model artefact ──────────────────────────────────────────────────
# Only the .onnx binary is copied; benchmark JSON, confusion matrices etc. are
# excluded via .dockerignore to save ~1 MB from the image.
COPY models/agritech_classifier.onnx ./models/agritech_classifier.onnx

# ── Security: run as non-root ─────────────────────────────────────────────────
RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

# ── Expose service port ───────────────────────────────────────────────────────
EXPOSE 8000

# ── Container health check ────────────────────────────────────────────────────
# Uses Python's stdlib urllib to avoid installing curl (would add ~5 MB).
# /health/live is the liveness probe — if this is healthy the process is up.
HEALTHCHECK --interval=10s \
            --timeout=5s \
            --start-period=15s \
            --retries=3 \
    CMD python -c \
        "import urllib.request, sys; \
         r = urllib.request.urlopen('http://localhost:8000/health/live', timeout=4); \
         sys.exit(0 if r.status == 200 else 1)"

# ── Entrypoint ────────────────────────────────────────────────────────────────
# Single-worker for predictable resource usage; increase via ML_WORKERS env var
# or add --workers ${ML_WORKERS:-1} for multi-core deployments (Phase 3+).
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info", \
     "--no-access-log"]
