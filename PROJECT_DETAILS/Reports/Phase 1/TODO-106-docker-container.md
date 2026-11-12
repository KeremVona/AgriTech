# TODO-106 Completion Report: Containerization & Health Check Instrumentation

**Status:** SUPERSEDED / DONE (Updated with 2026-10-29 Decision D2 Addendum)  
**Assignee:** DevOps / Backend Engineer  
**Component:** `ml-service/`, `docker-compose.yml`  
**Spec Reference:** `PROJECT_DETAILS/Phase Plans/Phase 1.md` (Track B: TODO-106)

---

## Summary

Implemented service health probing and lifecycle management for the ML inference microservice. While initial Phase 1 milestones drafted a containerized Docker configuration for the preliminary ONNX model, architectural review on 2026-10-29 resolved (Decision D2) to run `ml-service` directly in a local virtual environment alongside the private `plant-ml` framework. The health check instrumentation was hardened to accurately reflect model residency and knowledge-base integrity.

---

## Health Check Instrumentation

The microservice exposes two dedicated health endpoints conforming to standard container/orchestrator probing protocols:

### 1. `GET /health/live` (Liveness Probe)
- **Status:** HTTP 200 OK (`{"status": "alive"}`).
- **Purpose:** Verifies that the Uvicorn event loop and ASGI application are running and responsive to HTTP traffic.

### 2. `GET /health/ready` (Readiness Probe)
- **Status When Ready:** HTTP 200 OK:
  ```json
  {
    "status": "ready",
    "backend": "plantml",
    "model_loaded": true
  }
  ```
- **Status When Not Ready:** HTTP 503 Service Unavailable:
  ```json
  {
    "status": "not_ready",
    "backend": "plantml",
    "model_loaded": false,
    "note": "Plant-ML predictor not initialized: <error message>"
  }
  ```
- **Integrity Validation:**
  - Evaluates predictor residency in memory.
  - Startup verification check: inspects `predictor.active.class_names()` and validates that every predictable class has a corresponding, validated entry in the knowledge base. If any classes are missing, an error is logged and reported through the readiness probe.

---

## Addendum: Decision D2 & Execution Environment (2026-10-29)

> [!IMPORTANT]
> **Status: DRAFT — Pending Project Lead Approval**

### 1. Decision D2 (Option B): Removal of Docker Container
- **Context:** The original Phase 1 specification called for a lightweight multi-stage Docker image ($\le 450\text{ MB}$) based on `python:3.11-slim`.
- **Constraint:** The production `plant-ml` vision system requires Python 3.12, PyTorch / CUDA runtime libraries, and multi-gigabyte licensed model weights and checkpoints. Packing these dependencies into a Docker container would exceed bandwidth and storage limits and duplicate heavy local development environments.
- **Resolution:**
  - Removed the `ml-service` service block from `docker-compose.yml`.
  - Removed `ml-service/Dockerfile` and `ml-service/.dockerignore`.
  - Root `docker-compose.yml` manages PostgreSQL/PostGIS and frontend services, while `ml-service` runs directly in a host virtual environment.

### 2. Virtual Environment Run Procedure
To run the ML service with `plant-ml`:
```bash
# Activate plant-ml environment
source /path/to/plant-ml/.venv/bin/activate  # or Windows: .venv\Scripts\Activate.ps1

# Install ml-service dependencies into environment
pip install -r ml-service/requirements-prod.txt

# Start FastAPI server
uvicorn main:app --app-dir ml-service --host 0.0.0.0 --port 8000
```
