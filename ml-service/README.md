# AgriTech - Machine Learning & Vision Service

The computer vision and disease diagnostics microservice for the **Precision AgriTech Platform**, built with **Python** and **FastAPI**.

## Overview

- **Leaf Disease Classification**: Dual-Head Multi-Task **MobileNetV3-Large** trained on PlantVillage + PlantDoc hybrid dataset (12 classes: Tomato, Potato, Corn, Apple).
- **Low-Latency Inference**: ONNX Runtime CPU inference — ~14.8 MB model, ~40–70 ms median latency.
- **Agronomic Advisory Engine**: Returns chemical treatments, cultural controls, and microclimate risk data per detected class.
- **LIVE / STUB Dual Mode**: Operates with the ONNX model or gracefully degrades when artifact is absent.
- **Docker Ready**: Multi-stage `python:3.11-slim` image ≤ 450 MB, boots healthy in < 10 seconds (TODO-106).

## Project Structure

```
ml-service/
├── Dockerfile              # Multi-stage production container (TODO-106)
├── .dockerignore           # Build context filter — keeps image lean
├── main.py                 # FastAPI app with lifespan ONNX loader
├── inference.py            # Dual-head InferenceEngine + preprocessing
├── schemas.py              # Pydantic request/response models
├── advisory.py             # Agronomic advisory lookup engine (TODO-105)
├── config.py               # pydantic-settings (.env support)
├── predict.py              # CLI single-image prediction tool
├── pyproject.toml          # uv / PEP 517 dependencies
├── requirements.txt        # Full dev/train requirements (includes torch etc.)
├── requirements-prod.txt   # Production-only requirements (used in Dockerfile)
├── pytest.ini              # pytest async config
├── data/
│   └── disease_advisories.json  # 12-class agronomic knowledge base (TODO-105)
├── models/
│   └── agritech_classifier.onnx ← LIVE mode model (~14.8 MB, dual-head)
├── scripts/
│   ├── prepare_dataset.py        # TODO-101: PlantVillage ingestion
│   ├── prepare_hybrid_dataset.py # TODO-110: PlantDoc hybrid merger
│   ├── model_multitask.py        # TODO-110: Dual-head PyTorch architecture
│   └── export_multitask_onnx.py  # TODO-110: ONNX export & benchmarking
└── tests/
    ├── test_classify_leaf.py         # Endpoint tests (TODO-104/105)
    ├── test_inference_engine.py      # Preprocessing & engine tests
    ├── test_advisory_engine.py       # Advisory engine tests (TODO-105)
    ├── test_prepare_dataset.py       # Dataset pipeline (TODO-101)
    ├── test_hybrid_dataset.py        # Hybrid dataset merger (TODO-110)
    ├── test_model_multitask.py       # Multi-task architecture (TODO-110)
    └── test_export_multitask_onnx.py # ONNX export & latency (TODO-110)
```

## Prerequisites

- Python 3.10+ (local development)
- [`uv`](https://github.com/astral-sh/uv) (recommended) **or** `pip`
- **Docker** (for containerised deployment)

## Getting Started

### Option A — Docker (recommended for deployment)

```bash
# Build and start from project root
docker compose build ml-service
docker compose up ml-service

# Or standalone from the ml-service directory
docker build -t agritech-ml-service:latest .
docker run -d -p 8000:8000 --name agritech-ml agritech-ml-service:latest
```

Verify it is healthy:
```bash
curl http://localhost:8000/health/live    # → {"status":"alive"}
curl http://localhost:8000/health/ready  # → {"model_loaded":true,"mode":"LIVE"}
```

### Option B — uv (local development)

```powershell
pip install uv
uv venv
uv pip install -e ".[dev]"
.\.venv\Scripts\Activate.ps1     # Windows
source .venv/bin/activate         # macOS/Linux
```

### Option C — pip

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Running the Server (Local)

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

| Endpoint | Description |
|----------|-------------|
| `GET /docs` | Swagger UI |
| `GET /health/live` | Liveness probe |
| `GET /health/ready` | Readiness probe (ONNX memory residency) |
| `POST /api/v1/classify-leaf` | Leaf disease classification + advisory |

## Configuration

Create a `.env` file in `ml-service/` to override defaults:

```env
ONNX_MODEL_PATH=models/agritech_classifier.onnx
CORS_ORIGINS=["http://localhost:5173"]
DEBUG=false
```

## LIVE vs STUB Mode

| Condition | Mode | `model_loaded` |
|-----------|------|----------------|
| `models/agritech_classifier.onnx` exists & valid | **LIVE** | `true` |
| Model file absent or corrupt | **STUB** | `false` |

STUB mode returns deterministic dummy probabilities so the full API pipeline (validation, advisory engine, response shaping) can be exercised without a model.

## Optional plant-ml backend

`MODEL_BACKEND=plantml` swaps the ONNX model for the plant-ml classifier (33 crop/disease classes, with
"retake" / "unsupported" answers). The default stays `onnx`. The plant-ml code and model weights are **not part of this
repository** and are supplied separately (they must never be committed). With them available, set in `.env`:

```env
MODEL_BACKEND=plantml
PLANTML_SYSTEM=<path>/configs/final_system.yaml
PLANTML_RUNS_DIR=<path>/runs
PLANTML_THRESHOLDS=<path>/configs/inference.yaml
PLANTML_MODE=best        # or light (single model, faster)
PLANTML_DEVICE=          # empty = auto, or cpu
```

and run the service with a Python environment that has `torch` and the `plantml` package importable. If the model
cannot be loaded, `/api/v1/classify-leaf` returns 503 and `/health/ready` reports the error.

## Docker Image Details (TODO-106)

| Property | Value |
|----------|-------|
| Base image | `python:3.11-slim` |
| Build strategy | Multi-stage (builder + runtime) |
| Target size | ≤ 450 MB (actual ~215–240 MB) |
| Boot-to-healthy | ≤ 10 seconds |
| Health check | `GET /health/live` via stdlib `urllib` (no curl dependency) |
| Security | Non-root `appuser` |
| Training packages | Excluded from image (torch / sklearn not installed) |

## Running Tests

```powershell
pytest -v
```

| Test file | Scope |
|-----------|-------|
| `test_classify_leaf.py` | Endpoint validation, schema, concurrent load ≤ 150 ms |
| `test_inference_engine.py` | Preprocessing correctness, dual-head, crop_hint |
| `test_advisory_engine.py` | 12-class KB coverage, low-confidence fallback |
| `test_prepare_dataset.py` | Dataset pipeline (TODO-101) |
| `test_hybrid_dataset.py` | Hybrid dataset merger (TODO-110) |
| `test_model_multitask.py` | Multi-task architecture (TODO-110) |
| `test_export_multitask_onnx.py` | ONNX export & latency (TODO-110) |
