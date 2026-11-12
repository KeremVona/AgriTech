# TODO-104 Completion Report: FastAPI Application Setup & Inference Endpoint

**Status:** DONE (Updated with 2026-10-29 plant-ml Addendum)  
**Assignee:** Backend Engineer / ML Engineer  
**Component:** `ml-service/` (FastAPI Microservice)  
**Spec Reference:** `PROJECT_DETAILS/Phase Plans/Phase 1.md` (Track B: TODO-104)

---

## Summary

Implemented the asynchronous FastAPI microservice (`ml-service`) providing high-throughput, typed foliar disease diagnosis via the `POST /api/v1/classify-leaf` endpoint. Following architectural review on 2026-10-29, the service transitioned from the preliminary ONNX single-model prototype to the production `plant-ml` engine. The service includes robust input validation, memory-safe multipart streaming checks, image decompression bomb guards, unconditional 503 service protection during cold boot/unloaded states, and full agronomic advisory synthesis.

---

## Key Features & Endpoints

### 1. `POST /api/v1/classify-leaf`
- **Payload:** Multipart form file upload (`file`).
- **Validation:**
  - MIME-type restriction: strictly `image/jpeg` or `image/png`.
  - Memory-safe early size rejection: verifies `UploadFile.size` upfront against `max_upload_bytes` (10 MB default) and streams at most `max_upload_bytes + 1` bytes (`await file.read(limit + 1)`) before decoding. Rejecting oversized uploads before memory buffering prevents RAM exhaustion.
  - Decompression bomb guard: `PIL.Image.MAX_IMAGE_PIXELS = 40_000_000` with explicit error trapping for `PIL.Image.DecompressionBombError`, returning HTTP 400 `image_decode_failure`.
- **Response Structure:**
  - Returns `DiagnosticResponse` with unique `inference_id` (UUIDv4), typed `prediction` details (`crop`, `condition`, `scientific_name`, `confidence_score`, `severity_index`), ranked `top_probabilities`, and contextual `agronomic_advisory`.
  - Propagates calibrated decision thresholds or `null` for low-confidence, retake, or out-of-distribution prompts.
- **Availability Enforcement:**
  - Returns HTTP 503 `model_unavailable` when the vision engine is uninitialized, guaranteeing that fake or stub predictions are never silently returned to production clients.

### 2. Dependency Tracking & Modern Packaging
- Dependencies standardized in `ml-service/pyproject.toml` and pinned in `ml-service/uv.lock`.
- Production requirements synchronized in `ml-service/requirements-prod.txt`.
- Python version aligned to `requires-python = ">=3.11"` (matching plant-ml runtime target).

---

## Verification & Test Suite

- Fully verified via `pytest ml-service/tests/test_classify_leaf.py` using in-memory mock predictor fixtures.
- Comprehensive coverage including:
  - Valid image diagnosis across high-confidence paths.
  - Low-confidence advisory generation with threshold reporting.
  - Early-rejection 413 payload handling and bounded chunk reads.
  - MIME-type enforcement (415), empty file rejection (400), corrupt image handling (400).
  - Decompression bomb protection (400 `image_decode_failure`).
  - Unconditional 503 rejection when the engine is unloaded.
  - Concurrency resilience and service latency under load.

---

## Addendum: plant-ml Model Migration (2026-10-29)

> [!IMPORTANT]
> **Status: DRAFT — Pending Project Lead Approval**

1. **Taxonomy & Scope Expansion:**
   - Expanded from 12 classes across 4 crops to 33 classes across 7 crops (Tomato, Potato, Corn, Apple, Grape, Rice, Cassava).
2. **Inference Latency Benchmark:**
   - Original ONNX spec: $\le 150\text{ ms}$ under 5 concurrent requests on CPU.
   - Updated plant-ml target:
     - `light` mode latency: `TBD [lead]`
     - `best` mode latency: `TBD [lead]`
   - Latency benchmarks on physical hardware are pending final lead verification.
