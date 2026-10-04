"""
Precision AgriTech - Agronomic Advisory Engine (TODO-105)

Loads the disease_advisories.json knowledge base at module import time and
exposes a single public function: get_advisory(class_label, confidence_score).

Design decisions:
- The JSON file is loaded once at import time (not per-request) into an
  in-memory dict, making lookups O(1) with zero I/O per call.
- All 12 target class labels are covered; an unknown label falls back to a
  safe generic advisory rather than crashing.
- When confidence_score < LOW_CONFIDENCE_THRESHOLD (0.60), the engine returns
  a LowConfidenceAdvisory prompting the field operator to re-scan instead of
  acting on an unreliable prediction (Phase 1 acceptance criterion).
- The engine converts raw JSON dicts into the typed Pydantic models defined in
  schemas.py so callers never need to handle raw dicts.
"""

import json
import logging
from pathlib import Path
from typing import Union

from schemas import (
    AgronomicAdvisory,
    BiologicalControl,
    ChemicalTreatment,
    LowConfidenceAdvisory,
    MicroclimatRisk,
    TelemetryLinkageHints,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DATA_PATH = Path(__file__).parent / "data" / "disease_advisories.json"

# Acceptance criterion: confidence below this threshold triggers a rescan advisory
LOW_CONFIDENCE_THRESHOLD: float = 0.60

# Field operator rescan instructions shown in all low-confidence responses
_RESCAN_INSTRUCTIONS: list[str] = [
    "Ensure the leaf fills at least 60% of the camera frame with no background clutter.",
    "Photograph in natural daylight; avoid direct midday sun or deep shadow.",
    "Hold the camera steady — motion blur degrades model confidence significantly.",
    "Photograph the most visibly affected leaf, not a healthy adjacent leaf.",
    "Submit images as JPEG or PNG with minimum 224 × 224 pixel resolution.",
    "If symptoms are very early-stage, monitor for 24–48 hours and re-scan when lesions are more defined.",
]

# ---------------------------------------------------------------------------
# Knowledge base loader
# ---------------------------------------------------------------------------


def _load_knowledge_base(path: Path) -> dict:
    """Loads and validates the disease_advisories.json file at startup."""
    if not path.exists():
        raise FileNotFoundError(
            f"Advisory knowledge base not found at '{path}'. "
            "Ensure ml-service/data/disease_advisories.json is present."
        )
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    classes = data.get("classes", {})
    logger.info(
        "Advisory knowledge base loaded: %d classes from '%s'",
        len(classes),
        path.name,
    )
    return data


# Module-level singleton: loaded once at import time
try:
    _KB: dict = _load_knowledge_base(_DATA_PATH)
    _CLASSES: dict = _KB.get("classes", {})
    _KB_VERSION: str = _KB.get("version", "unknown")
except FileNotFoundError as _exc:
    logger.error("ADVISORY KB LOAD FAILURE: %s", _exc)
    _KB = {}
    _CLASSES = {}
    _KB_VERSION = "missing"


# ---------------------------------------------------------------------------
# Internal converters: raw dict → typed Pydantic models
# ---------------------------------------------------------------------------


def _build_chemical_treatments(raw: list[dict]) -> list[ChemicalTreatment]:
    return [ChemicalTreatment(**item) for item in raw]


def _build_biological_controls(raw: list[dict]) -> list[BiologicalControl]:
    return [BiologicalControl(**item) for item in raw]


def _build_microclimate_risk(raw: dict) -> MicroclimatRisk:
    return MicroclimatRisk(**raw)


def _build_telemetry_hints(raw: dict) -> TelemetryLinkageHints:
    return TelemetryLinkageHints(**raw)


def _build_advisory_from_entry(entry: dict) -> tuple[AgronomicAdvisory, TelemetryLinkageHints]:
    """Converts a raw knowledge base class entry into typed advisory objects."""
    microclimate = _build_microclimate_risk(entry["microclimate_risks"])

    # Derive the human-readable environmental_risk_factors string
    risk_parts: list[str] = []
    if microclimate.optimal_humidity_pct_max:
        risk_parts.append(
            f"Relative humidity >{microclimate.optimal_humidity_pct_max}%"
        )
    if microclimate.optimal_temp_c_min and microclimate.optimal_temp_c_max:
        risk_parts.append(
            f"temperatures {microclimate.optimal_temp_c_min}–{microclimate.optimal_temp_c_max}°C"
        )
    if microclimate.consecutive_wet_hours_threshold:
        risk_parts.append(
            f"leaf wetness >{microclimate.consecutive_wet_hours_threshold} consecutive hours"
        )

    env_risk_str = (
        "Favourable conditions: " + ", ".join(risk_parts) + "."
        if risk_parts
        else "No specific environmental risk factors identified."
    )

    advisory = AgronomicAdvisory(
        immediate_action=entry["immediate_action"],
        chemical_treatments=_build_chemical_treatments(entry.get("chemical_treatments", [])),
        cultural_controls=entry.get("cultural_controls", []),
        biological_controls=_build_biological_controls(entry.get("biological_controls", [])),
        microclimate_risks=microclimate,
        environmental_risk_factors=env_risk_str,
    )
    telemetry = _build_telemetry_hints(entry["telemetry_linkage"])
    return advisory, telemetry


def _generic_fallback_advisory(label: str) -> tuple[AgronomicAdvisory, TelemetryLinkageHints]:
    """
    Returns a safe generic advisory when the class label is not found in the KB.
    This should never happen in production (all 12 classes are present) but
    guards against future label additions during model updates.
    """
    logger.warning("Advisory KB: no entry found for label '%s'; using generic fallback.", label)
    advisory = AgronomicAdvisory(
        immediate_action=(
            "Consult a qualified agronomist for diagnosis. "
            "The detected condition is not yet in the advisory knowledge base."
        ),
        chemical_treatments=[],
        cultural_controls=[
            "Isolate the affected plant material.",
            "Document symptoms with multiple photographs for agronomist review.",
            "Avoid applying unverified chemical treatments.",
        ],
        biological_controls=[],
        microclimate_risks=MicroclimatRisk(
            fungal_risk="UNKNOWN",
            bacterial_risk="UNKNOWN",
        ),
        environmental_risk_factors="No environmental risk data available for this condition.",
    )
    telemetry = TelemetryLinkageHints(
        moisture_risk=False,
        leaf_wetness_threshold_hours=0,
        recommended_irrigation_restriction=False,
    )
    return advisory, telemetry


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_advisory(
    class_label: str,
    confidence_score: float,
) -> Union[
    tuple[AgronomicAdvisory, TelemetryLinkageHints, None],
    tuple[None, None, LowConfidenceAdvisory],
]:
    """
    Returns the advisory for the given class label and confidence score.

    When confidence_score >= LOW_CONFIDENCE_THRESHOLD (0.60):
        Returns (AgronomicAdvisory, TelemetryLinkageHints, None)

    When confidence_score < LOW_CONFIDENCE_THRESHOLD:
        Returns (None, None, LowConfidenceAdvisory)
        — The caller must use LowConfidenceAdvisory to prompt operator re-scan.
    """
    # ----------------------------------------------------------------
    # Low-confidence fallback (acceptance criterion)
    # ----------------------------------------------------------------
    if confidence_score < LOW_CONFIDENCE_THRESHOLD:
        low_conf = LowConfidenceAdvisory(
            requires_rescan=True,
            confidence_score=round(confidence_score, 4),
            threshold=LOW_CONFIDENCE_THRESHOLD,
            message=(
                f"Model confidence ({confidence_score:.1%}) is below the minimum "
                f"reliability threshold ({LOW_CONFIDENCE_THRESHOLD:.0%}). "
                "The prediction may be unreliable. Please re-capture the leaf image "
                "following the instructions below before taking any agronomic action."
            ),
            rescan_instructions=_RESCAN_INSTRUCTIONS,
        )
        return None, None, low_conf

    # ----------------------------------------------------------------
    # Normal path: look up class in knowledge base
    # ----------------------------------------------------------------
    entry = _CLASSES.get(class_label)
    if entry is None:
        advisory, telemetry = _generic_fallback_advisory(class_label)
        return advisory, telemetry, None

    advisory, telemetry = _build_advisory_from_entry(entry)
    return advisory, telemetry, None


def get_kb_version() -> str:
    """Returns the version string of the loaded knowledge base."""
    return _KB_VERSION


def get_kb_class_count() -> int:
    """Returns the number of classes covered by the knowledge base."""
    return len(_CLASSES)


def is_kb_loaded() -> bool:
    """Returns True if the knowledge base loaded successfully."""
    return bool(_CLASSES)
