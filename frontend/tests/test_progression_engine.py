"""
Mathematical and Algorithmic Validation Suite for WebGL/Canvas Progression Shader Engine (TODO-108).
Precision AgriTech Platform - Phase 1.

Validates:
1. Two-phase shader interpolation math across 0.0 -> 1.0 normalized domain.
2. Boundary continuity at u_progress = 0.5 (C^0 continuous transition).
3. Organic lesion reveal behavior: high mask regions emerge with accentuated contrast vs flat opacity fade.
4. Edge conditions: u_progress = 0.0 yields pure Stage 0, u_progress = 1.0 yields pure Stage 2.
"""

def clamp(val: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, val))


def mix(a: float, b: float, t: float) -> float:
    return a * (1.0 - t) + b * t


def compute_shader_blend(progress: float, mask: float) -> tuple:
    """
    Simulates the exact fragment shader blending formula from ProgressionShaderRenderer.ts:
    Returns (stage_from_weight, stage_to_weight, active_phase)
    """
    clamped_progress = clamp(progress, 0.0, 1.0)

    if clamped_progress <= 0.5:
        # Phase 1: Stage 0 -> Stage 1
        t = clamped_progress / 0.5
        organic_factor = clamp((t - (1.0 - mask) * 0.35) / 0.65, 0.0, 1.0)
        blend_alpha = mix(t, organic_factor, 0.65)
        return (1.0 - blend_alpha, blend_alpha, "PHASE_1_STAGE0_TO_STAGE1")
    else:
        # Phase 2: Stage 1 -> Stage 2
        t = (clamped_progress - 0.5) / 0.5
        organic_factor = clamp((t - (1.0 - mask) * 0.40) / 0.60, 0.0, 1.0)
        blend_alpha = mix(t, organic_factor, 0.70)
        return (1.0 - blend_alpha, blend_alpha, "PHASE_2_STAGE1_TO_STAGE2")


def test_boundary_endpoints():
    """Verify exact 0% and 100% boundary states."""
    # At 0.0: Must be 100% Stage 0
    w0, w1, phase = compute_shader_blend(0.0, mask=1.0)
    assert phase == "PHASE_1_STAGE0_TO_STAGE1"
    assert abs(w0 - 1.0) < 1e-5, f"Expected Stage 0 weight 1.0, got {w0}"
    assert abs(w1 - 0.0) < 1e-5, f"Expected Stage 1 weight 0.0, got {w1}"

    # At 1.0: Must be 100% Stage 2
    w1, w2, phase = compute_shader_blend(1.0, mask=1.0)
    assert phase == "PHASE_2_STAGE1_TO_STAGE2"
    assert abs(w1 - 0.0) < 1e-5, f"Expected Stage 1 weight 0.0, got {w1}"
    assert abs(w2 - 1.0) < 1e-5, f"Expected Stage 2 weight 1.0, got {w2}"


def test_transition_continuity_at_midpoint():
    """Verify that at progress = 0.5, both Phase 1 and Phase 2 evaluate to 100% Stage 1."""
    # From Phase 1 approach (progress = 0.5)
    w0, w1, phase = compute_shader_blend(0.5, mask=0.8)
    assert abs(w1 - 1.0) < 1e-5, f"Phase 1 endpoint must reach Stage 1 weight 1.0, got {w1}"
    assert abs(w0 - 0.0) < 1e-5

    # From Phase 2 start (progress = 0.500001)
    w1_start, w2_start, phase2 = compute_shader_blend(0.500001, mask=0.8)
    assert abs(w1_start - 1.0) < 1e-4, f"Phase 2 start must equal Stage 1 weight 1.0, got {w1_start}"
    assert abs(w2_start - 0.0) < 1e-4


def test_organic_lesion_emergence():
    """
    Verify that localized contrast masking causes lesion epicenters (high mask)
    to emerge faster than surrounding unaffected tissue (low mask).
    """
    # Mid-phase 1: progress = 0.25 (linear t = 0.5)
    _, weight_lesion_epicenter, _ = compute_shader_blend(0.25, mask=1.0)
    _, weight_unaffected_tissue, _ = compute_shader_blend(0.25, mask=0.0)

    # Lesion epicenter should lead the transition
    assert weight_lesion_epicenter > weight_unaffected_tissue, (
        f"Epicenter weight ({weight_lesion_epicenter:.3f}) should exceed "
        f"unaffected tissue weight ({weight_unaffected_tissue:.3f})"
    )

    # Mid-phase 2: progress = 0.75 (linear t = 0.5)
    _, weight_necrotic_core, _ = compute_shader_blend(0.75, mask=1.0)
    _, weight_necrotic_periphery, _ = compute_shader_blend(0.75, mask=0.0)

    assert weight_necrotic_core > weight_necrotic_periphery, (
        f"Necrotic core weight ({weight_necrotic_core:.3f}) should exceed "
        f"periphery weight ({weight_necrotic_periphery:.3f})"
    )


def test_monotonic_progression():
    """Verify that blend weights increase monotonically as progress advances."""
    mask = 0.7
    prev_w = 0.0

    # Step through Phase 1 (Stage 0 -> Stage 1)
    prev_w = -1.0
    for step in range(0, 51):
        p = step / 100.0
        _, w, phase = compute_shader_blend(p, mask)
        assert phase == "PHASE_1_STAGE0_TO_STAGE1"
        assert w >= prev_w - 1e-6, f"Non-monotonic progression at progress {p}"
        prev_w = w

    # Step through Phase 2 (Stage 1 -> Stage 2)
    prev_w = -1.0
    for step in range(51, 101):
        p = step / 100.0
        _, w, phase = compute_shader_blend(p, mask)
        assert phase == "PHASE_2_STAGE1_TO_STAGE2"
        assert w >= prev_w - 1e-6, f"Non-monotonic progression at progress {p}"
        prev_w = w


if __name__ == "__main__":
    print("Running WebGL/Canvas Progression Shader Engine Validation...")
    test_boundary_endpoints()
    print("  [PASS] test_boundary_endpoints passed (0% = Stage 0, 100% = Stage 2)")
    test_transition_continuity_at_midpoint()
    print("  [PASS] test_transition_continuity_at_midpoint passed (C^0 continuity at 50%)")
    test_organic_lesion_emergence()
    print("  [PASS] test_organic_lesion_emergence passed (Contrast-accentuated localized reveal)")
    test_monotonic_progression()
    print("  [PASS] test_monotonic_progression passed (Strictly monotonic blending)")
    print("\nALL PROGRESSION SHADER ENGINE TESTS PASSED!")
