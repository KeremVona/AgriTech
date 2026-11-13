"""
Precision AgriTech - Agronomic Advisory Engine (TODO-105 & plant-ml update)

Loads the disease_advisories.json knowledge base at module import time and
exposes typed advisory lookups and canonical class metadata.

Design decisions:
- The JSON file is loaded once at import time into an in-memory dict, making lookups O(1).
- Keyed by plant-ml class names (crop/disease), with alias resolution for AgriTech labels.
- Covers all 33 plant-ml classes across tomato, potato, corn, apple, grape, rice, and cassava.
- Provides canonical get_class_meta() replacing duplicate metadata tables.
- When confidence_score < LOW_CONFIDENCE_THRESHOLD (0.60), returns LowConfidenceAdvisory.
"""

import json
import logging
from pathlib import Path
from typing import Optional, Union

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

# Canonical list of 33 plant-ml model output classes
SUPPORTED_CLASSES: list[str] = [
    # Tomato (4)
    "tomato/healthy",
    "tomato/early_blight",
    "tomato/late_blight",
    "tomato/septoria_leaf_spot",
    # Potato (3)
    "potato/healthy",
    "potato/early_blight",
    "potato/late_blight",
    # Corn (7)
    "corn/healthy",
    "corn/northern_leaf_blight",
    "corn/gray_leaf_spot",
    "corn/common_rust",
    "corn/northern_leaf_spot",
    "corn/maize_streak_virus",
    "corn/maize_lethal_necrosis",
    # Apple (5)
    "apple/healthy",
    "apple/scab",
    "apple/cedar_apple_rust",
    "apple/frog_eye_leaf_spot",
    "apple/powdery_mildew",
    # Grape (3)
    "grape/healthy",
    "grape/esca",
    "grape/downy_mildew",
    # Rice (6)
    "rice/healthy",
    "rice/blast",
    "rice/brown_spot",
    "rice/bacterial_leaf_blight",
    "rice/tungro",
    "rice/hispa",
    # Cassava (5)
    "cassava/healthy",
    "cassava/mosaic",
    "cassava/brown_streak",
    "cassava/green_mite",
    "cassava/bacterial_blight",
]


def _to_agritech_label(class_name: str) -> str:
    """Map plant-ml crop/disease format to AgriTech label format."""
    crop, _, disease = class_name.partition("/")
    if not disease:
        return class_name
    return f"{crop.capitalize()}___{disease.capitalize()}"


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

# Build alias map resolving both crop/disease and Crop___Disease formats
_ALIAS_TO_KEY: dict[str, str] = {}
for _k, _v in _CLASSES.items():
    _ALIAS_TO_KEY[_k] = _k
    if "class_label" in _v:
        _ALIAS_TO_KEY[_v["class_label"]] = _k
    _ALIAS_TO_KEY[_to_agritech_label(_k)] = _k
# Known legacy overrides
_ALIAS_TO_KEY["Corn_(maize)___Common_rust_"] = "corn/common_rust"
_ALIAS_TO_KEY["Corn_(maize)___Northern_Leaf_Blight"] = "corn/northern_leaf_blight"
_ALIAS_TO_KEY["Corn_(maize)___healthy"] = "corn/healthy"


def _normalize_key(label_or_key: str) -> str:
    """Map an incoming label or class key to canonical plant-ml key."""
    return _ALIAS_TO_KEY.get(label_or_key, label_or_key)


def has_kb_entry(label_or_key: str) -> bool:
    """Returns True if the class has a corresponding knowledge base entry."""
    return _normalize_key(label_or_key) in _CLASSES


def get_class_meta(label_or_key: str) -> dict:
    """
    Returns canonical metadata (crop, condition, scientific_name, severity, pathogen)
    derived directly from the knowledge base, avoiding duplicated tables.
    """
    key = _normalize_key(label_or_key)
    entry = _CLASSES.get(key)
    if entry is not None:
        return {
            "crop": entry["crop"],
            "condition": entry["condition"],
            "scientific_name": entry.get("scientific_name"),
            "severity": entry.get("severity", "None" if "healthy" in key else "Medium"),
            "pathogen": entry.get("pathogen") or entry.get("pathogen_type", "UNKNOWN"),
        }
    crop, _, disease = label_or_key.replace("/", "___").partition("___")
    d_lower = disease.lower()
    healthy = d_lower == "healthy"
    hints = {
        "rust": "FUNGAL", "blight": "FUNGAL", "mildew": "FUNGAL", "rot": "FUNGAL",
        "scab": "FUNGAL", "mold": "FUNGAL", "bacterial": "BACTERIAL", "virus": "VIRAL",
    }
    pathogen = "HEALTHY" if healthy else next((v for k, v in hints.items() if k in d_lower), "UNKNOWN")
    return {
        "crop": crop.capitalize(),
        "condition": "Healthy" if healthy else disease.replace("_", " ").title() if disease else "Unknown",
        "scientific_name": None,
        "severity": "None" if healthy else "Medium",
        "pathogen": pathogen,
    }


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
    """
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

    key = _normalize_key(class_label)
    entry = _CLASSES.get(key)
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
