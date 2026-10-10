/**
 * Verification test suite for Symptom Hotspot Registry (Tier 1, Feature 2).
 * Run via: node --experimental-strip-types scripts/test_hotspot_registry.js
 */

import assert from 'node:assert';
import {
  SYMPTOM_HOTSPOTS_REGISTRY,
  getActiveHotspotsForProgress,
} from '../src/p2p-experimental/models/hotspotRegistry.ts';

console.log('[+] Starting Symptom Hotspots Registry Unit Tests...\n');

const CROPS = ['tomato', 'potato', 'corn', 'apple'];

// Test 1: Completeness of all 4 crops
for (const cropId of CROPS) {
  const hotspots = SYMPTOM_HOTSPOTS_REGISTRY[cropId];
  assert(Array.isArray(hotspots), `Crop ${cropId} must have an array of hotspots`);
  assert(hotspots.length >= 3, `Crop ${cropId} must have at least 3 registered hotspots (got ${hotspots.length})`);
}
console.log('  [✓] Test 1 Passed: All 4 staple crops have at least 3 registered anatomical symptom hotspots');

// Test 2: Coordinate boundaries and stage bounds
for (const cropId of CROPS) {
  const hotspots = SYMPTOM_HOTSPOTS_REGISTRY[cropId];
  for (const h of hotspots) {
    assert(h.xPct >= 10 && h.xPct <= 90, `Hotspot ${h.id} xPct (${h.xPct}%) must be within [10, 90]% of leaf viewport`);
    assert(h.yPct >= 10 && h.yPct <= 90, `Hotspot ${h.id} yPct (${h.yPct}%) must be within [10, 90]% of leaf viewport`);
    assert(h.minSliderPct >= 0 && h.minSliderPct <= 100, `Hotspot ${h.id} minSliderPct (${h.minSliderPct}) must be within [0, 100]`);

    // Verify stageOrder alignment
    if (h.stageOrder === 0) {
      assert(h.minSliderPct <= 30.0, `Stage 0 hotspot ${h.id} must emerge at or below 30%`);
    } else if (h.stageOrder === 1) {
      assert(h.minSliderPct >= 30.0 && h.minSliderPct <= 70.0, `Stage 1 hotspot ${h.id} must emerge within [30, 70]%`);
    } else if (h.stageOrder === 2) {
      assert(h.minSliderPct >= 70.0, `Stage 2 hotspot ${h.id} must emerge at or above 70%`);
    }

    // Verify non-empty pathology descriptions
    assert(h.title.length > 0, `Hotspot ${h.id} must have title`);
    assert(h.pathogenStructure.length > 0, `Hotspot ${h.id} must have pathogenStructure`);
    assert(h.anatomicalDescription.length > 0, `Hotspot ${h.id} must have anatomicalDescription`);
    assert(h.physiologicalImpact.length > 0, `Hotspot ${h.id} must have physiologicalImpact`);
    assert(h.treatmentAdvisory.length > 0, `Hotspot ${h.id} must have treatmentAdvisory`);
  }
}
console.log('  [✓] Test 2 Passed: Coordinate boundaries, stage alignments, and metadata integrity validated');

// Test 3: getActiveHotspotsForProgress filtering logic
for (const cropId of CROPS) {
  // At 10%: only stage 0 hotspots should appear (if any)
  const low = getActiveHotspotsForProgress(cropId, 10.0);
  assert(low.every((h) => h.minSliderPct <= 10.0), `All hotspots at 10% must have minSliderPct <= 10`);

  // At 50%: stage 1 hotspots should be visible
  const mid = getActiveHotspotsForProgress(cropId, 50.0);
  assert(mid.some((h) => h.stageOrder === 1), `Crop ${cropId} must have at least one active stage 1 hotspot at 50%`);

  // At 100%: all hotspots must be visible
  const max = getActiveHotspotsForProgress(cropId, 100.0);
  const total = SYMPTOM_HOTSPOTS_REGISTRY[cropId].length;
  assert.strictEqual(max.length, total, `At 100% infection, all ${total} hotspots for ${cropId} must be active`);
}
console.log('  [✓] Test 3 Passed: Dynamic active hotspot filtering by progression percentage verified');

console.log('\n[🎉] All Symptom Hotspot Registry Unit Tests Passed Successfully!');
