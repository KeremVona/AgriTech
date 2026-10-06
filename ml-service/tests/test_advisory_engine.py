"""
Tests for TODO-105: Agronomic Advisory Engine

Covers:
- Knowledge base loads with all 12 classes
- get_advisory() returns correct types for high-confidence input
- get_advisory() returns LowConfidenceAdvisory for confidence < 0.60
- LowConfidenceAdvisory fields are correct (threshold, message, instructions)
- Advisory for each of the 12 classes has non-empty chemical_treatments or
  cultural_controls (healthy classes may have 0 chemical treatments)
- get_kb_version(), get_kb_class_count(), is_kb_loaded() work correctly
- Generic fallback for unknown label does not raise
- Boundary: confidence exactly at 0.60 is treated as high-confidence (>= threshold)
- Boundary: confidence exactly at 0.5999 is treated as low-confidence
"""

import pytest

from advisory import (
    LOW_CONFIDENCE_THRESHOLD,
    get_advisory,
    get_kb_class_count,
    get_kb_version,
    is_kb_loaded,
)
from inference import CLASS_LABELS
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


def test_kb_class_count_equals_12():
    """Knowledge base must cover all 12 Phase 1 target classes."""
    assert get_kb_class_count() == 12


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
    advisory, telemetry, low_conf = get_advisory("Tomato___Late_blight", 0.45)
    assert advisory is None
    assert telemetry is None
    assert isinstance(low_conf, LowConfidenceAdvisory)


def test_low_confidence_fields():
    """LowConfidenceAdvisory must contain correct metadata."""
    _, _, low_conf = get_advisory("Tomato___Early_blight", 0.35)
    assert low_conf.requires_rescan is True
    assert low_conf.confidence_score == pytest.approx(0.35, abs=1e-4)
    assert low_conf.threshold == LOW_CONFIDENCE_THRESHOLD
    assert "60%" in low_conf.message or "0.60" in low_conf.message or "60" in low_conf.message
    assert len(low_conf.rescan_instructions) >= 4


def test_low_confidence_zero_confidence():
    """Zero confidence must also trigger low-confidence path."""
    advisory, telemetry, low_conf = get_advisory("Tomato___healthy", 0.0)
    assert low_conf is not None
    assert advisory is None


def test_boundary_exactly_at_threshold():
    """Confidence exactly equal to 0.60 must be treated as HIGH-confidence (>= threshold)."""
    advisory, telemetry, low_conf = get_advisory("Tomato___Late_blight", 0.60)
    assert low_conf is None
    assert advisory is not None
    assert telemetry is not None


def test_boundary_just_below_threshold():
    """Confidence at 0.5999 must trigger low-confidence path."""
    advisory, telemetry, low_conf = get_advisory("Tomato___Late_blight", 0.5999)
    assert low_conf is not None
    assert advisory is None


# ---------------------------------------------------------------------------
# High-confidence path: return types
# ---------------------------------------------------------------------------

def test_high_confidence_returns_advisory_and_telemetry():
    advisory, telemetry, low_conf = get_advisory("Tomato___Late_blight", 0.9642)
    assert low_conf is None
    assert isinstance(advisory, AgronomicAdvisory)
    assert isinstance(telemetry, TelemetryLinkageHints)


def test_advisory_immediate_action_not_empty():
    advisory, _, _ = get_advisory("Tomato___Late_blight", 0.9642)
    assert advisory.immediate_action
    assert len(advisory.immediate_action) > 10


def test_advisory_environmental_risk_factors_string():
    advisory, _, _ = get_advisory("Tomato___Early_blight", 0.85)
    assert isinstance(advisory.environmental_risk_factors, str)
    assert len(advisory.environmental_risk_factors) > 0


# ---------------------------------------------------------------------------
# Chemical treatments coverage
# ---------------------------------------------------------------------------

# Disease classes (non-healthy) must have at least one chemical treatment
DISEASE_CLASSES = [lbl for lbl in CLASS_LABELS if "healthy" not in lbl.lower()]

@pytest.mark.parametrize("label", DISEASE_CLASSES)
def test_disease_class_has_chemical_treatments(label):
    """Every disease class must have at least 1 chemical treatment recommendation."""
    advisory, _, _ = get_advisory(label, 0.90)
    assert len(advisory.chemical_treatments) >= 1, (
        f"Class '{label}' has no chemical treatments in the knowledge base."
    )


@pytest.mark.parametrize("label", DISEASE_CLASSES)
def test_chemical_treatment_fields_populated(label):
    """Every ChemicalTreatment must have all required fields populated."""
    advisory, _, _ = get_advisory(label, 0.90)
    for treatment in advisory.chemical_treatments:
        assert treatment.product, f"Empty product in {label}"
        assert treatment.active_substance, f"Empty active_substance in {label}"
        assert treatment.dosage, f"Empty dosage in {label}"
        assert treatment.application_timing, f"Empty application_timing in {label}"
        assert treatment.pre_harvest_interval_days >= 0, f"Negative PHI in {label}"


# ---------------------------------------------------------------------------
# Cultural controls coverage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("label", CLASS_LABELS)
def test_all_classes_have_cultural_controls(label):
    """Every class (including healthy) must have at least 1 cultural control."""
    advisory, _, _ = get_advisory(label, 0.90)
    assert len(advisory.cultural_controls) >= 1, (
        f"Class '{label}' has no cultural controls."
    )


# ---------------------------------------------------------------------------
# Healthy classes: no chemical treatments, no moisture risk
# ---------------------------------------------------------------------------

HEALTHY_CLASSES = [lbl for lbl in CLASS_LABELS if "healthy" in lbl.lower()]

@pytest.mark.parametrize("label", HEALTHY_CLASSES)
def test_healthy_classes_no_chemical_treatments(label):
    """Healthy classes should have 0 chemical treatments."""
    advisory, _, _ = get_advisory(label, 0.90)
    assert advisory.chemical_treatments == [], (
        f"Healthy class '{label}' unexpectedly has chemical treatments."
    )


@pytest.mark.parametrize("label", HEALTHY_CLASSES)
def test_healthy_classes_no_moisture_risk(label):
    """Healthy class telemetry linkage should show no moisture risk."""
    _, telemetry, _ = get_advisory(label, 0.90)
    assert telemetry.moisture_risk is False
    assert telemetry.leaf_wetness_threshold_hours == 0


# ---------------------------------------------------------------------------
# Telemetry linkage: disease classes must flag moisture risk
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("label", DISEASE_CLASSES)
def test_disease_classes_moisture_risk(label):
    """All disease classes must have moisture_risk=True in telemetry linkage."""
    _, telemetry, _ = get_advisory(label, 0.90)
    assert telemetry.moisture_risk is True, (
        f"Class '{label}' telemetry_linkage.moisture_risk should be True."
    )


# ---------------------------------------------------------------------------
# Microclimate risk data
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("label", DISEASE_CLASSES)
def test_disease_microclimate_thresholds_present(label):
    """Disease classes must have humidity and temperature thresholds in microclimate_risks."""
    advisory, _, _ = get_advisory(label, 0.90)
    risk = advisory.microclimate_risks
    assert risk.optimal_humidity_pct_max is not None, (
        f"Class '{label}' missing optimal_humidity_pct_max."
    )
    assert risk.optimal_temp_c_min is not None, (
        f"Class '{label}' missing optimal_temp_c_min."
    )
    assert risk.optimal_temp_c_max is not None, (
        f"Class '{label}' missing optimal_temp_c_max."
    )


# ---------------------------------------------------------------------------
# Unknown label: generic fallback must not crash
# ---------------------------------------------------------------------------

def test_unknown_label_generic_fallback():
    """An unknown label must return a fallback advisory without raising."""
    advisory, telemetry, low_conf = get_advisory("UnknownCrop___UnknownDisease", 0.90)
    assert low_conf is None
    assert advisory is not None
    assert telemetry is not None
    assert advisory.immediate_action  # Should have some guidance text


# ---------------------------------------------------------------------------
# Full 12-class coverage
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("label", CLASS_LABELS)
def test_full_12_class_coverage(label):
    """All 12 CLASS_LABELS must return a valid (non-None) advisory at high confidence."""
    advisory, telemetry, low_conf = get_advisory(label, 0.95)
    assert low_conf is None
    assert advisory is not None
    assert telemetry is not None


# ---------------------------------------------------------------------------
# Critical class: Potato___Late_blight should be CRITICAL risk
# ---------------------------------------------------------------------------

def test_potato_late_blight_critical_risk():
    advisory, _, _ = get_advisory("Potato___Late_blight", 0.95)
    assert advisory.microclimate_risks.fungal_risk == "CRITICAL"


def test_tomato_late_blight_critical_risk():
    advisory, _, _ = get_advisory("Tomato___Late_blight", 0.95)
    assert advisory.microclimate_risks.fungal_risk == "CRITICAL"


# ---------------------------------------------------------------------------
# Organic-certified treatment presence (healthy food system requirement)
# ---------------------------------------------------------------------------

def test_at_least_one_organic_option_for_critical_fungal_diseases():
    """Late Blight classes must offer at least one organic-certified copper-based treatment."""
    for label in ["Tomato___Late_blight", "Potato___Late_blight"]:
        advisory, _, _ = get_advisory(label, 0.95)
        organic_options = [t for t in advisory.chemical_treatments if t.is_organic_certified]
        assert len(organic_options) >= 1, (
            f"'{label}' must have at least one organic-certified treatment option."
        )
