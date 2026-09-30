"""
Precision AgriTech - Pydantic Schemas
Request/response models for the classify-leaf inference endpoint.
All models follow the Phase 1 API contract defined in PROJECT_DETAILS/Phase Plans/Phase 1.md.
"""

import uuid
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class PredictionDetail(BaseModel):
    """Core classification result from the ONNX inference engine."""

    crop: str = Field(..., examples=["Tomato"])
    condition: str = Field(..., examples=["Late Blight"])
    scientific_name: Optional[str] = Field(None, examples=["Phytophthora infestans"])
    confidence_score: float = Field(..., ge=0.0, le=1.0, examples=[0.9642])
    severity_index: str = Field(..., examples=["High"])


class TopProbability(BaseModel):
    """Single class probability entry in the top-k output list."""

    label: str = Field(..., examples=["Tomato___Late_blight"])
    probability: float = Field(..., ge=0.0, le=1.0, examples=[0.9642])


class AgronomicAdvisory(BaseModel):
    """Structured agronomic intervention guidance (populated by TODO-105)."""

    immediate_action: str
    fungicide_treatments: list[str]
    environmental_risk_factors: str


class TelemetryLinkageHints(BaseModel):
    """Hints surfaced to the irrigation engine for moisture risk correlation."""

    leaf_wetness_threshold_hours: int
    moisture_risk: bool


class ClassifyLeafResponse(BaseModel):
    """
    Full classify-leaf endpoint response matching Phase 1 API contract.
    Mirrors the JSON structure in Phase 1.md §2 FastAPI Inference Service Schema.
    """

    inference_id: str = Field(..., examples=["c7a9b1c2-3d4e-4f5a-8b9c-0d1e2f3a4b5c"])
    prediction: PredictionDetail
    top_probabilities: list[TopProbability]
    agronomic_advisory: AgronomicAdvisory
    telemetry_linkage_hints: TelemetryLinkageHints
    execution_time_ms: float = Field(..., ge=0, examples=[64.2])

    # Indicates whether live ONNX model was used or the stub fallback
    model_version: str = Field(..., examples=["mobilenetv3_small_v1.0.0"])
    model_loaded: bool = Field(
        ...,
        description="True when a real ONNX model is resident in memory; "
        "False when running in stub mode (ML-102/ML-103 pending).",
    )


# ---------------------------------------------------------------------------
# Error schemas
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    """Standard error payload for 4xx responses."""

    error: str
    message: str
    field: Optional[str] = None
