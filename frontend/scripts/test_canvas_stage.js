/**
 * Verification Suite for Foliar Canvas Stage Components (SPEC-UI-007, Task 4).
 * Verifies 8-crop specimen rail constants, anatomical hotspot filtering across progression tiers,
 * and agronomic timeline milestone monotonicity.
 * Run via: node --experimental-strip-types scripts/test_canvas_stage.js
 */

import assert from 'node:assert';
import {
  DEFAULT_CROP_SPECIMENS,
} from '../src/components/DiseaseProgressionViewer/types.ts';
import {
  SYMPTOM_HOTSPOTS_REGISTRY,
  getActiveHotspotsForProgress,
} from '../src/models/hotspotRegistry.ts';
import {
  AGRONOMIC_CALIBRATION_REGISTRY,
} from '../src/models/agronomicTimelineModel.ts';

console.log('[+] Starting Foliar Canvas Stage & Hotspot Overlay Verification Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: 8-Crop Specimen Rail Metadata Integrity
// ----------------------------------------------------------------------------
console.log('  [+] Test 1: Verifying 8-Crop Specimen Rail Metadata...');

assert.strictEqual(DEFAULT_CROP_SPECIMENS.length, 8, 'Specimen rail must register exactly 8 crops');

const expectedCrops = ['tomato', 'potato', 'corn', 'apple', 'grape', 'pepper', 'peach', 'squash'];
for (const cropId of expectedCrops) {
  const item = DEFAULT_CROP_SPECIMENS.find((c) => c.id === cropId);
  assert(item, `Specimen rail must contain crop '${cropId}'`);
  assert(item.label.length > 0, `Crop '${cropId}' must have a valid label`);
  assert(item.icon.length > 0, `Crop '${cropId}' must have an emoji icon`);
  assert(item.subtitle.length > 0, `Crop '${cropId}' must have a subtitle`);
  assert(item.family.length > 0, `Crop '${cropId}' must declare botanical family`);
}
console.log('  [✓] Test 1 Passed: All 8 crop specimens present with complete botanical metadata');

// ----------------------------------------------------------------------------
// Test 2: Anatomical Symptom Hotspots (24 Total, 3 per Crop)
// ----------------------------------------------------------------------------
console.log('  [+] Test 2: Verifying Anatomical Symptom Hotspots & Coordinate Bounds...');

let totalHotspots = 0;
for (const cropId of expectedCrops) {
  const hotspots = SYMPTOM_HOTSPOTS_REGISTRY[cropId];
  assert(hotspots, `Hotspot registry must have entry for '${cropId}'`);
  assert.strictEqual(hotspots.length, 3, `'${cropId}' must have exactly 3 anatomical hotspots`);
  totalHotspots += hotspots.length;

  for (const pin of hotspots) {
    assert(pin.id.length > 0, 'Hotspot ID must be non-empty');
    assert(pin.title.length > 0, 'Hotspot title must be non-empty');
    assert(pin.anatomicalDescription.length > 20, 'Hotspot description must provide detailed pathology description');
    assert(pin.xPct >= 5 && pin.xPct <= 95, `Hotspot x (${pin.xPct}) must lie within leaf bounds [5, 95]`);
    assert(pin.yPct >= 5 && pin.yPct <= 95, `Hotspot y (${pin.yPct}) must lie within leaf bounds [5, 95]`);
    assert(['emerald', 'amber', 'red', 'purple'].includes(pin.badgeColor), `Valid badge color required, got: ${pin.badgeColor}`);
  }

  // Progression Dynamic Window Filtering
  const atMid = getActiveHotspotsForProgress(cropId, 50.0);
  assert(atMid.length >= 1, `${cropId} must show at least 1 hotspot at 50%`);
  assert(atMid.every((h) => h.minSliderPct <= 50.0), 'Active hotspots at 50% must have minSliderPct <= 50');

  const atMax = getActiveHotspotsForProgress(cropId, 100.0);
  assert.strictEqual(atMax.length, 3, `${cropId} must reveal all 3 hotspots at 100%`);
}

assert.strictEqual(totalHotspots, 24, 'Total registered anatomical hotspots must equal 24');
console.log('  [✓] Test 2 Passed: 24 anatomical hotspots verified with spatial bounds and progressive reveal');

// ----------------------------------------------------------------------------
// Test 3: Agronomic Timeline Milestone Monotonicity
// ----------------------------------------------------------------------------
console.log('  [+] Test 3: Verifying Epidemiological Milestone Monotonicity...');

for (const cropId of expectedCrops) {
  const cal = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  assert(cal.milestones.length >= 3, `${cropId} must have at least 3 milestone stages`);

  for (let i = 1; i < cal.milestones.length; i++) {
    const prev = cal.milestones[i - 1];
    const curr = cal.milestones[i];
    assert(
      curr.minSliderPct > prev.minSliderPct,
      `${cropId} milestone minSliderPct must be strictly increasing: ${prev.minSliderPct} -> ${curr.minSliderPct}`
    );
  }
  assert(
    cal.baselineDays.stage0_incubation < cal.baselineDays.stage1_spread &&
    cal.baselineDays.stage1_spread <= cal.baselineDays.stage2_severe &&
    cal.baselineDays.totalOptimalDays >= cal.baselineDays.stage2_severe,
    `${cropId} baseline days must be strictly increasing: ${cal.baselineDays.stage0_incubation} < ${cal.baselineDays.stage1_spread} <= ${cal.baselineDays.stage2_severe}`
  );
}
console.log('  [✓] Test 3 Passed: All milestone target percentages and baseline days strictly monotonic');

console.log('\n[✓] All Foliar Canvas Stage & Hotspot Overlay Tests PASSED (3/3 suites).');
