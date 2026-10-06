"""
Precision AgriTech - Pydantic Schemas
Request/response models for the classify-leaf inference endpoint.
All models follow the Phase 1 API contract defined in PROJECT_DETAILS/Phase Plans/Phase 1.md.

Updated in TODO-105:
  - ChemicalTreatment, BiologicalControl, MicroclimatRisk added (advisory sub-models)
  - AgronomicAdvisory expanded with full advisory payload from the knowledge base
  - LowConfidenceAdvisory added for <60% confidence fallback
  - ClassifyLeafResponse updated with requires_rescan flag
"""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Advisory sub-models (TODO-105)
# ---------------------------------------------------------------------------


class ChemicalTreatment(BaseModel):
    """A single chemical or copper-based treatment recommendation."""

    product: str = Field(..., examples=["Mancozeb 80% WP"])
    active_substance: str = Field(..., examples=["Mancozeb (Dithiocarbamate)"])
    type: str = Field(..., examples=["PREVENTATIVE_FUNGICIDE"])
    dosage: str = Field(..., examples=["2.0 kg/ha"])
    application_timing: str
    pre_harvest_interval_days: int = Field(..., ge=0)
    is_organic_certified: bool


class BiologicalControl(BaseModel):
    """A biological control agent recommendation."""

    agent: str = Field(..., examples=["Bacillus subtilis QST 713"])
    product_example: str = Field(..., examples=["Serenade ASO"])
    dosage: str
    notes: str


class MicroclimatRisk(BaseModel):
    """Environmental threshold data linking disease risk to sensor telemetry."""

    fungal_risk: str = Field(..., examples=["HIGH"])
    bacterial_risk: str = Field(..., examples=["LOW"])
    optimal_humidity_pct_max: Optional[int] = Field(None, ge=0, le=100)
    optimal_temp_c_min: Optional[float] = None
    optimal_temp_c_max: Optional[float] = None
    consecutive_wet_hours_threshold: Optional[int] = Field(None, ge=0)


class TelemetryLinkageHints(BaseModel):
    """Hints surfaced to the irrigation engine for moisture risk correlation."""

    moisture_risk: bool
    leaf_wetness_threshold_hours: int = Field(..., ge=0)
    recommended_irrigation_restriction: bool


class AgronomicAdvisory(BaseModel):
    """
    Full structured agronomic advisory payload from the knowledge base.
    Populated by the AdvisoryEngine (TODO-105) using disease_advisories.json.
    """

    immediate_action: str
    chemical_treatments: list[ChemicalTreatment]
    cultural_controls: list[str]
    biological_controls: list[BiologicalControl]
    microclimate_risks: MicroclimatRisk
    environmental_risk_factors: str


# ---------------------------------------------------------------------------
# Low-confidence fallback schema (TODO-105 acceptance criterion)
# ---------------------------------------------------------------------------


class LowConfidenceAdvisory(BaseModel):
    """
    Returned when model confidence is below the LOW_CONFIDENCE_THRESHOLD (60%).
    Prompts the field operator to re-capture the image under better conditions.
    """

    requires_rescan: bool = True
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    threshold: float = Field(..., ge=0.0, le=1.0)
    message: str
    rescan_instructions: list[str]


# ---------------------------------------------------------------------------
# Core prediction and probability schemas
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


# ---------------------------------------------------------------------------
# Top-level response schemas
# ---------------------------------------------------------------------------


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

    # Low-confidence flag (None when confidence >= threshold)
    low_confidence: Optional[LowConfidenceAdvisory] = Field(
        None,
        description="Populated when confidence_score < 0.60. Prompts operator re-scan.",
    )


class ClassifyLeafLowConfidenceResponse(BaseModel):
    """
    Returned as the top-level response when confidence is below threshold.
    Shares inference_id and top_probabilities with the normal response
    for traceability, but advisory is replaced by rescan instructions.
    """

    inference_id: str
    requires_rescan: bool = True
    low_confidence_advisory: LowConfidenceAdvisory
    top_probabilities: list[TopProbability]
    execution_time_ms: float
    model_version: str
    model_loaded: bool


# ---------------------------------------------------------------------------
# Error schemas
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    """Standard error payload for 4xx responses."""

    error: str
    message: str
    field: Optional[str] = None
