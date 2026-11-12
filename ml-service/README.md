# AgriTech - Machine Learning & Vision Service

The computer vision and disease diagnostics microservice for the **Precision AgriTech Platform**, built with **Python** and **FastAPI**.

## Overview

- **Leaf Disease Classification**: Multi-crop plant leaf diagnostics powered by the `plant-ml` model (33 classes across Tomato, Potato, Corn, Apple, Grape, Rice, Cassava).
- **Agronomic Advisory Engine**: Returns chemical treatments, cultural controls, biological agents, and microclimate risk data per detected condition across all 33 supported classes.
- **Local Venv Execution**: Runs locally in a Python 3.12 virtual environment with `plantml` package support (Docker ML container removed per Decision D2).

## Project Structure

```
ml-service/
├── main.py                 # FastAPI app with lifespan loader & health checks
├── plantml_engine.py       # plant-ml model inference engine adapter
├── schemas.py              # Pydantic request/response models
├── advisory.py             # Agronomic advisory lookup engine
├── config.py               # pydantic-settings (.env support)
├── pyproject.toml          # uv / PEP 517 dependencies
├── requirements-prod.txt   # Production requirements for plant-ml venv
├── pytest.ini              # pytest async config
├── data/
│   └── disease_advisories.json  # 33-class agronomic knowledge base
├── scripts/
│   └── p2p/                # Prompt-to-Prompt Disease Progression scripts
└── tests/
    ├── test_classify_leaf.py     # Endpoint tests
    ├── test_plantml_engine.py    # plant-ml engine tests (fake predictor)
    ├── test_advisory_engine.py   # Advisory engine tests
    └── test_p2p_cli.py           # Disease progression CLI tests
```

## Prerequisites

- Python 3.11+ (Python 3.12 recommended for `plant-ml`)
- [`uv`](https://github.com/astral-sh/uv) (recommended) or `pip`

## Getting Started (Venv Execution)

Per project lead review (Decision D2), the ML service container has been removed from Docker Compose because the production model runs on the `plant-ml` system (which requires multi-gigabyte weights, Python 3.12, PyTorch, and the private `plantml` package). The service runs locally inside a dedicated Python virtual environment.

### 1. Environment Setup

To run with the real `plant-ml` model:
1. Create a Python 3.12 virtual environment:
   ```bash
   uv venv --python 3.12
   source .venv/bin/activate  # or .\.venv\Scripts\activate on Windows
   ```
2. Install `plant-ml` and runtime requirements:
   ```bash
   pip install -e <path-to-plant-ml>
   pip install -r requirements-prod.txt
   ```
3. Configure environment variables in `ml-service/.env` (git-ignored):
   ```env
   PLANTML_SYSTEM=<path>/configs/final_system.yaml
   PLANTML_RUNS_DIR=<path>/runs
   PLANTML_THRESHOLDS=<path>/configs/inference.yaml
   PLANTML_MODE=best        # or 'light' for single-model fast inference
   PLANTML_DEVICE=          # empty for auto, or 'cpu'
   ```

> ⚠️ **Licence notice:** Model weights and `plant-ml` configurations are non-redistributable and must never be committed to git. Always use local placeholders and keep `.env` git-ignored.

### 2. Running the Server

Activate your environment and run Uvicorn from the `ml-service/` directory:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Verify service status:
```bash
curl http://localhost:8000/health/live    # → {"status":"alive"}
curl http://localhost:8000/health/ready   # → reports model readiness ("backend": "plantml")
```

| Endpoint | Description |
|----------|-------------|
| `GET /docs` | Swagger UI |
| `GET /health/live` | Liveness probe |
| `GET /health/ready` | Readiness probe (reports engine readiness) |
| `POST /api/v1/classify-leaf` | Leaf disease classification + advisory |

## Running Tests

Tests run against in-memory fake predictors without requiring weights or the private `plantml` package:

```bash
pytest -v
```
