# [Feature ID / Code]: [Feature Name] — Engineering & System Architecture Report

> **System Component:** `[e.g., Spatial GIS Engine | FAO-56 Irrigation Engine | CV Disease Pipeline | WebGL 3D Explorer | Regional Risk Engine]`  
> **Target Phase:** `[e.g., Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6]`  
> **Status:** `[PLANNED | IMPLEMENTED | VALIDATED | PRODUCTION-READY]`  
> **Author(s):** `[Principal Systems Engineer / Author Name]`  
> **Reviewers:** `[Technical Committee / Academic Evaluator / Lead Architect]`  
> **Repository Target:** `[Branch: feat/... | PR #... | Commit Hash ...]`  
> **Date:** `YYYY-MM-DD`

---

## 1. Executive Summary & Operational Intent

### 1.1 Problem Statement
- **Operational Deficit:** State clearly what operational capability was missing, unoptimized, or mathematically deficient in the baseline architecture.
- **Root Cause / Technical Bottleneck:** Explain the systemic or algorithmic root cause (e.g., lack of spatial boundary validation, CPU inference latency bottlenecks, unbounded water allocation heuristics).

### 1.2 Technical Solution & Outcome
- **Core Engineering Deliverable:** Describe the concrete architectural mechanism implemented to solve the operational deficit.
- **Primary Operational Impact:** Summarize measurable throughput, latency, spatial precision, or agronomic accuracy improvements in 2–3 sharp, high-signal bullet points. Avoid filler adjectives.

---

## 2. System Architecture & Component Decomposition

### 2.1 Topology & Boundary Interactions
Provide a high-signal architectural or sequence diagram illustrating boundary contracts, data flows, protocols, and persistence layers.

```
[ Client / Field Worker / Sensor Node ]
               │
          (Protocol: e.g., HTTPS REST / GeoJSON / MQTT / WSS)
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Subsystem / Microservice Gateway                            │
│ - Component A (Ingestion / Validation / Sanitization)       │
│ - Component B (Business Logic / Mathematical Kernel)        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
         (Query / Write)               (Inference / RPC)
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ Relational + Spatial DB      │ │ External Microservice      │
│ (PostgreSQL 16 + PostGIS)    │ │ (e.g., FastAPI ONNX Runtime│
│ - SRID 4326 / Spatial Index  │ │  Open-Meteo REST API)      │
└──────────────────────────────┘ └────────────────────────────┘
```

### 2.2 Subsystem Responsibilities & Interface Contracts
| Subsystem / Module | Responsibility | Inbound Contract | Outbound Contract | Failure Handling Mode |
| :--- | :--- | :--- | :--- | :--- |
| `[e.g., IrrigationWorker]` | Computes 24h soil moisture depletion | Cron tick / EF Core state | Valve actuation MQTT message | Fallback to historical $ET_0$ averages |
| `[e.g., LeafClassifier]` | Runs dual-head inference on foliar image | Multipart JPEG/PNG + `crop_hint` | JSON `{disease, confidence, bbox}` | Graceful 422 with validation telemetry |

### 2.3 Architectural Trade-Off Analysis
Document architectural decisions evaluated, selected, and rejected, with explicit trade-off rationale.

| Decision Candidate | Selected? | Pros | Cons / Constraints | Decision Rationale |
| :--- | :---: | :--- | :--- | :--- |
| **Option A (Chosen):** `[e.g., Dual-Head ONNX Runtime with INT8]` | **YES** | Sub-30ms CPU latency, 12MB footprint | Quantization noise $<0.4\%$ | Eliminates GPU operational cost on edge |
| **Option B:** `[e.g., Cloud TorchServe GPU Instance]` | **NO** | Native FP32 precision | \$150/mo idle cost, 180ms network RTT | Incompatible with low-connectivity fields |

---

## 3. Mathematical & Algorithmic Formulation

Document all physical, biological, statistical, or geometrical mathematical formulas. Formulate all equations in standard LaTeX/KaTeX syntax.

### 3.1 Governing Equations
Define the core mathematical model driving this feature (e.g., FAO-56 Penman-Monteith, Bayesian probability fusion, spatial clustering).

$$ET_c = K_c \times ET_0$$

$$\mathcal{L}_{\text{total}} = \alpha \cdot \mathcal{L}_{\text{head1}} + (1 - \alpha) \cdot \mathcal{L}_{\text{head2}}$$

### 3.2 Parameter Definitions & Dimensional Units
| Parameter | Symbol | Mathematical Domain | Engineering Units | Source / Acquisition Method |
| :--- | :---: | :---: | :---: | :--- |
| Crop Coefficient | $K_c$ | $[0.2, 1.35]$ | Dimensionless | FAO-56 Table lookup keyed by crop growth stage |
| Reference Evapotranspiration | $ET_0$ | $[0.0, 15.0]$ | $\text{mm} \cdot \text{day}^{-1}$ | Open-Meteo hourly radiation and vapor pressure integration |
| Readily Available Water | $RAW$ | $[0.0, TAW]$ | $\text{mm}$ | $RAW = p \cdot TAW$ ($p$: soil depletion fraction) |

### 3.3 Algorithmic Execution Steps
1. **Input Normalization:** `[Describe data scrubbing, unit conversion, coordinate transformation]`
2. **Deterministic Evaluation:** `[Step-by-step state transition or numeric evaluation]`
3. **Threshold Enforcement & Clamping:** `[Boundary condition checks, safety clamps, exception triggers]`

---

## 4. Geospatial Data Handling & Coordinate Geometry

*Note: Skip or mark N/A if this feature has no GIS/spatial component.*

### 4.1 Spatial Reference Systems & Projections
- **Storage & Ingestion CRS:** `EPSG:4326` (WGS 84 Ellipsoidal 2D Coordinate Reference System, `[Longitude, Latitude]`).
- **Planar Computation CRS:** `EPSG:3857` (Spherical Mercator) or dynamic UTM zone projection via PostGIS `geography` type.
- **Geodesic Calculations:** All field area, perimeter, and valve radius distances are calculated over the WGS 84 spheroid ($a = 6378137.0\text{ m}$, $1/f = 298.257223563$).

### 4.2 PostGIS Schema & Spatial Predicates
```sql
-- Spatial schema definition and indexing
CREATE TABLE field_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    area_hectares NUMERIC(10, 4) GENERATED ALWAYS AS (
        ST_Area(boundary::geography) / 10000.0
    ) STORED,
    centroid GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
        ST_Centroid(boundary)
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast bounding-box and containment indexing
CREATE INDEX idx_parcels_boundary_gist ON field_parcels USING GIST(boundary);
CREATE INDEX idx_parcels_centroid_gist ON field_parcels USING GIST(centroid);
```

### 4.3 Spatial Validation & Topology Rules
- **Strict Simple Polygon Enforcement:** Disallow self-intersections (`ST_IsValid(geom) = true`).
- **Winding Order:** Outer rings must follow counter-clockwise (CCW) orientation according to OGC SFS specifications.
- **Containment & Intersection Queries:**
  ```sql
  -- Spatial query: Locate parcel enclosing GPS observation
  SELECT id, crop_type 
  FROM field_parcels 
  WHERE ST_Contains(boundary, ST_SetSRID(ST_Point(:longitude, :latitude), 4326));
  ```

---

## 5. Implementation Artifacts & Code Delta

### 5.1 File Delta Manifest
| Action | File Path | Subsystem | Description |
| :--- | :--- | :--- | :--- |
| `[CREATED]` | `backend/src/Irrigation/Fao56Engine.cs` | Backend Service | Implements Penman-Monteith daily depletion calculation |
| `[MODIFIED]` | `frontend/src/features/map/ParcelEditor.tsx` | UI Layer | Integrates Turf.js polygon validation before GeoJSON save |
| `[DEPRECATED]`| `backend/src/Legacy/SimpleWateringLogic.cs` | Backend Service | Superseded by deterministic FAO-56 balance model |

### 5.2 Core Code Excerpt (Critical Path)
Highlight only the central algorithmic or architectural primitive ($<50$ lines). Do not dump entire classes.

```csharp
// Example: Core Penman-Monteith depletion balancing loop
public IrrigationDecision CalculateDailyWaterBalance(ParcelTelemetry telemetry, WeatherForecast forecast)
{
    double etc = telemetry.CropCoefficient * forecast.ReferenceEvapotranspiration;
    double effectiveRain = forecast.PrecipitationMm * 0.80; // USDA SCS runoff adjustment
    double dailyDeficit = etc - effectiveRain;
    
    double updatedRootZoneDepletion = Math.Max(0, telemetry.CurrentDepletionMm + dailyDeficit);
    bool triggerActuation = updatedRootZoneDepletion >= telemetry.ManagementAllowedDepletionMm;
    
    return new IrrigationDecision(triggerActuation, updatedRootZoneDepletion, etc);
}
```

### 5.3 Database Mutations & Migration Signatures
- **Migration ID:** `20261015_AddSpatialParcelTopology`
- **Breaking Changes:** `[None | Requires re-indexing of field_parcels table]`
- **Data Backfill Strategy:** `[N/A or detail single-pass SQL script]`

---

## 6. Verification, Benchmarks & Operational Results

### 6.1 Automated Test Execution Suite
| Test Suite / Category | Target Class / Module | Test Count | Pass Rate | Assertion Target |
| :--- | :--- | :---: | :---: | :--- |
| **Unit Tests** | `Fao56EngineTests` | 24 | 100% | Zero-rain, extreme $ET_0$, negative moisture edge cases |
| **Spatial Invariance** | `NetTopologySuiteGeometryTests` | 16 | 100% | Multi-polygon holes, clockwise winding normalization |
| **Integration Tests** | `LeafInferenceApiTests` | 12 | 100% | Multipart form parsing, INT8 ONNX inference parity |

### 6.2 Empirical Performance Benchmarks
Compare baseline behavior vs target threshold vs achieved operational measurement.

| Metric | Baseline | Target SLA | Achieved Result | Evaluation Method |
| :--- | :---: | :---: | :---: | :--- |
| **Inference Latency (p95)** | $240\text{ ms}$ (GPU RTT) | $\le 100\text{ ms}$ | **$28.4\text{ ms}$** | Single-thread CPU benchmark (ONNX Runtime, 1000 iter) |
| **Spatial Query Time** | $145\text{ ms}$ (Full scan) | $\le 15\text{ ms}$ | **$1.8\text{ ms}$** | PostGIS `ST_Contains` across 10,000 synthetic polygons |
| **Model Size / Footprint** | $45.2\text{ MB}$ (PyTorch) | $\le 20.0\text{ MB}$ | **$12.6\text{ MB}$** | Dynamic INT8 quantization |
| **Memory Consumption** | $850\text{ MB}$ | $\le 256\text{ MB}$ | **$142\text{ MB}$** | Container cgroup working set memory under load |

### 6.3 Edge Cases & Degraded Operations
- **Network Failure / External API Outage:** `[Fallback to local 14-day running average when Open-Meteo returns HTTP 5xx]`
- **Extreme Telemetry Values:** `[Sensors reporting soil moisture > 100% or < 0% are clamped and flagged as hardware faults]`
- **Sliver Geometries:** `[Parcels with geodesic area < 5 m² are rejected by backend validation filter]`

---

## 7. Deployment, Security & Operations Guide

### 7.1 Configuration & Secrets Manifest
| Environment Variable | Type | Default Value | Description |
| :--- | :---: | :---: | :--- |
| `POSTGIS_CONNECTION_STRING` | Secret | — | PostgreSQL connection URI with spatial driver enabled |
| `WEATHER_API_BASE_URL` | String | `https://api.open-meteo.com/v1/` | Meteorological telemetry ingestion endpoint |
| `ONNX_MODEL_PATH` | Path | `/app/models/multitask_quant.onnx` | Path to containerized dual-head INT8 model |

### 7.2 Runbook & Health Checks
- **Startup Sequence:** `docker compose up -d postgres backend ml-service`
- **Liveness Endpoint:** `GET /health/live` (Returns HTTP 200 within 50ms)
- **Readiness Endpoint:** `GET /health/ready` (Asserts DB connectivity, PostGIS extension active, ONNX session loaded)
- **Rollback Procedure:** `[Detail automated rollback command or database migration down-script]`

---

## 8. Stakeholder & Academic Sign-Off Matrix

| Review Dimension | Verification Standard | Reviewer Sign-Off | Status |
| :--- | :--- | :--- | :---: |
| **Architectural Integrity** | Decoupled boundaries, appropriate patterns, no leaky abstractions | Systems Architect | `[ APPROVED ]` |
| **Mathematical Correctness** | Validated against peer-reviewed agronomical / statistical literature | Academic Evaluator | `[ APPROVED ]` |
| **Spatial Precision** | Complies with OGC standards, SRID 4326/geography, valid topologies | GIS Specialist | `[ APPROVED ]` |
| **Security & Operations** | Parameterized queries, least-privilege DB role, container isolation | Security Lead | `[ APPROVED ]` |
