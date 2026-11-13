"""
Tests for TODO-105 & plant-ml model update: Agronomic Advisory Engine

Covers:
- Knowledge base loads with all 33 plant-ml classes across 7 staple crops
- get_advisory() returns typed Pydantic models for high-confidence input
- get_advisory() returns LowConfidenceAdvisory for confidence < 0.60
- LowConfidenceAdvisory fields are correct (threshold, message, instructions)
- Advisory for every single one of the 33 classes is fully populated and sourced
- Healthy classes have 0 chemical treatments and moisture_risk=False
- Non-healthy disease classes have actionable treatments and risk evaluations
- Generic fallback for unrecognized labels
- Canonical get_class_meta() returns accurate metadata
"""

import pytest

from advisory import (
    LOW_CONFIDENCE_THRESHOLD,
    SUPPORTED_CLASSES,
    get_advisory,
    get_class_meta,
    get_kb_class_count,
    get_kb_version,
    has_kb_entry,
    is_kb_loaded,
)
from schemas import (
    AgronomicAdvisory,
    LowConfidenceAdvisory,
    TelemetryLinkageHints,
)


# ---------------------------------------------------------------------------
# KB health checks
# ---------------------------------------------------------------------------

def test_kb_is_loaded():
    assert is_kb_loaded() is True


def test_kb_class_count_equals_33():
    """Knowledge base must cover all 33 plant-ml model classes."""
    assert get_kb_class_count() == 33
    assert len(SUPPORTED_CLASSES) == 33


def test_kb_version_is_present():
    version = get_kb_version()
    assert isinstance(version, str)
    assert len(version) > 0
    assert version != "missing"


# ---------------------------------------------------------------------------
# Low-confidence fallback (acceptance criterion)
# ---------------------------------------------------------------------------

def test_low_confidence_below_threshold():
    """Confidence < 0.60 must return LowConfidenceAdvisory."""
    advisory, telemetry, low_conf = get_advisory("tomato/late_blight", 0.45)
    assert advisory is None
    assert telemetry is None
    assert isinstance(low_conf, LowConfidenceAdvisory)


def test_low_confidence_fields():
    """LowConfidenceAdvisory must contain correct metadata."""
    _, _, low_conf = get_advisory("tomato/early_blight", 0.35)
    assert low_conf.requires_rescan is True
    assert low_conf.confidence_score == pytest.approx(0.35, abs=1e-4)
    assert low_conf.threshold == LOW_CONFIDENCE_THRESHOLD
    assert "60%" in low_conf.message or "0.60" in low_conf.message or "60" in low_conf.message
    assert len(low_conf.rescan_instructions) >= 4


def test_low_confidence_zero_confidence():
    """Zero confidence must also trigger low-confidence path."""
    advisory, telemetry, low_conf = get_advisory("tomato/healthy", 0.0)
    assert low_conf is not None
    assert advisory is None


def test_boundary_exactly_at_threshold():
    """Confidence exactly equal to 0.60 must be treated as HIGH-confidence (>= threshold)."""
    advisory, telemetry, low_conf = get_advisory("tomato/late_blight", 0.60)
    assert low_conf is None
    assert advisory is not None
    assert telemetry is not None


def test_boundary_just_below_threshold():
    """Confidence at 0.5999 must trigger low-confidence path."""
    advisory, telemetry, low_conf = get_advisory("tomato/late_blight", 0.5999)
    assert low_conf is not None
    assert advisory is None


# ---------------------------------------------------------------------------
# High-confidence path: return types & 33 classes full coverage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("class_name", SUPPORTED_CLASSES)
def test_full_33_class_coverage_and_validation(class_name):
    """
    Parametrized test over all 33 class names:
    Each has a KB entry whose fields validate against Pydantic models,
    and no response uses the generic fallback.
    """
    assert has_kb_entry(class_name) is True
    advisory, telemetry, low_conf = get_advisory(class_name, 0.95)
    assert low_conf is None
    assert isinstance(advisory, AgronomicAdvisory)
    assert isinstance(telemetry, TelemetryLinkageHints)
    # Must NOT be the generic fallback
    assert "not yet in the advisory knowledge base" not in advisory.immediate_action
    assert advisory.immediate_action
    assert len(advisory.immediate_action) > 10
    assert len(advisory.cultural_controls) >= 1

    # Meta check
    meta = get_class_meta(class_name)
    assert meta["crop"]
    assert meta["condition"]
    assert meta["severity"] in ("None", "Low", "Medium", "High", "Critical")


DISEASE_CLASSES = [c for c in SUPPORTED_CLASSES if "healthy" not in c]
HEALTHY_CLASSES = [c for c in SUPPORTED_CLASSES if "healthy" in c]


@pytest.mark.parametrize("class_name", DISEASE_CLASSES)
def test_disease_classes_treatments_and_microclimate(class_name):
    """Every disease class must have chemical treatments and microclimate thresholds."""
    advisory, telemetry, _ = get_advisory(class_name, 0.95)
    assert len(advisory.chemical_treatments) >= 1, f"No chemical treatments for {class_name}"
    for t in advisory.chemical_treatments:
        assert t.product
        assert t.active_substance
        assert t.dosage
        assert t.application_timing
        assert t.pre_harvest_interval_days >= 0

    risk = advisory.microclimate_risks
    assert risk.optimal_humidity_pct_max is not None or risk.optimal_temp_c_min is not None


@pytest.mark.parametrize("class_name", HEALTHY_CLASSES)
def test_healthy_classes_no_chemical_treatments(class_name):
    """Healthy classes have 0 chemical treatments and no moisture risk."""
    advisory, telemetry, _ = get_advisory(class_name, 0.95)
    assert advisory.chemical_treatments == []
    assert telemetry.moisture_risk is False
    assert telemetry.leaf_wetness_threshold_hours == 0


def test_bacterial_spot_removed_from_kb():
    """Tomato___Bacterial_spot is no longer produced by plant-ml and should not be a primary class."""
    assert "tomato/bacterial_spot" not in SUPPORTED_CLASSES


def test_unknown_label_generic_fallback():
    """An unknown label must return a fallback advisory without raising."""
    advisory, telemetry, low_conf = get_advisory("unknown/unknown_disease", 0.90)
    assert low_conf is None
    assert advisory is not None
    assert telemetry is not None
    assert "not yet in the advisory knowledge base" in advisory.immediate_action
