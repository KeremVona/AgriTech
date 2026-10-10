/**
 * Canonical Verification Suite for Agronomic Timeline Model (P2P Experimental Tier 1, Feature 1).
 * Directly tests the production TypeScript module without code duplication.
 * Run via: node --experimental-strip-types scripts/test_agronomic_model.js
 */

import assert from 'node:assert';
import {
  AGRONOMIC_CALIBRATION_REGISTRY,
  calculateTemperatureFactor,
  calculateHumidityFactor,
  calculateElapsedDays,
  calculateSliderFromDays,
  evaluateMicroclimate,
} from '../src/p2p-experimental/models/agronomicTimelineModel.ts';

console.log('[+] Starting Canonical Agronomic Model Unit Tests (Imported directly from source TS module)...\n');

// Test 1: Temperature Beta curve peaks at T_opt and zeroes at bounds
const tFactorOpt = calculateTemperatureFactor(25.0, AGRONOMIC_CALIBRATION_REGISTRY.tomato.cardinals);
assert(Math.abs(tFactorOpt - 1.0) < 1e-4, 'Tomato T_opt (25C) must evaluate to 1.0');
assert.strictEqual(calculateTemperatureFactor(7.0, AGRONOMIC_CALIBRATION_REGISTRY.tomato.cardinals), 0.0, 'T <= T_min must evaluate to 0.0');
assert.strictEqual(calculateTemperatureFactor(36.0, AGRONOMIC_CALIBRATION_REGISTRY.tomato.cardinals), 0.0, 'T >= T_max must evaluate to 0.0');
assert.strictEqual(calculateTemperatureFactor(NaN, AGRONOMIC_CALIBRATION_REGISTRY.tomato.cardinals), 0.0, 'NaN temperature must evaluate safely to 0.0');
console.log('  [✓] Test 1 Passed: Temperature Beta curve correctly peaks at T_opt, zeroes at boundaries, and guards against NaN');

// Test 2: Potato Late Blight thermal arrest
const potatoHot = calculateTemperatureFactor(29.0, AGRONOMIC_CALIBRATION_REGISTRY.potato.cardinals);
assert.strictEqual(potatoHot, 0.0, 'Potato Late Blight must halt at 29C (T_max = 28C)');
const potatoOpt = calculateTemperatureFactor(18.0, AGRONOMIC_CALIBRATION_REGISTRY.potato.cardinals);
assert(Math.abs(potatoOpt - 1.0) < 1e-4, 'Potato Late Blight must peak at 18C');
console.log('  [✓] Test 2 Passed: Potato Late Blight thermal arrest above 28C validated');

// Test 2b: Humidity saturation factor
const hOpt = calculateHumidityFactor(95.0, AGRONOMIC_CALIBRATION_REGISTRY.tomato.humidity);
assert(Math.abs(hOpt - 1.0) < 1e-4, 'RH >= opt (95%) must evaluate to 1.0');
const hDry = calculateHumidityFactor(50.0, AGRONOMIC_CALIBRATION_REGISTRY.tomato.humidity);
assert.strictEqual(hDry, 0.03, 'RH < min (65%) must evaluate to dormant baseline (0.03)');
console.log('  [✓] Test 2b Passed: Humidity saturation model reaches 1.0 at opt and dormant baseline when dry');

// Test 3: Realistic elapsed days matching empirical epidemiology
const tomatoOpt = calculateElapsedDays('tomato', 100, 25.0, 95.0);
assert(tomatoOpt.elapsedDays >= 21.0 && tomatoOpt.elapsedDays <= 24.0, `Tomato optimal days (${tomatoOpt.elapsedDays}) should be ~21-24 days`);

const potatoWet = calculateElapsedDays('potato', 100, 18.0, 98.0);
assert(potatoWet.elapsedDays >= 12.0 && potatoWet.elapsedDays <= 13.0, `Potato optimal days (${potatoWet.elapsedDays}) should be ~12 days`);

const appleCold = calculateElapsedDays('apple', 100, 9.0, 95.0);
assert(appleCold.elapsedDays > 75.0, `Apple in 9C cold rain should stretch to >75 days (got ${appleCold.elapsedDays})`);
console.log('  [✓] Test 3 Passed: Forward timeline projections match empirical pathology baselines');

// Test 4: Denominator clipping protection
assert(appleCold.dayTimelineMax >= appleCold.elapsedDays, `dayTimelineMax (${appleCold.dayTimelineMax}) must be >= elapsedDays (${appleCold.elapsedDays})`);
console.log('  [✓] Test 4 Passed: Denominator clipping protection guaranteed under extended timelines');

// Test 5: Combined environmental stall alert fallback
const combinedStall = evaluateMicroclimate('tomato', 9.0, 70.0);
assert(combinedStall.isStalled, 'Combined cold and moderate humidity must stall (composite <= 0.05)');
assert(combinedStall.agronomicAlert && combinedStall.agronomicAlert.length > 0, 'Combined stall must produce a non-empty agronomicAlert banner');
console.log('  [✓] Test 5 Passed: Combined environmental stall triggers active warning alert');

// Test 6: Bi-directional consistency (Severity % <-> Days round-trip)
for (const testPct of [15, 30, 50, 70, 85, 100]) {
  const dynamic = calculateElapsedDays('tomato', testPct, 22.0, 85.0);
  const recoveredPct = calculateSliderFromDays('tomato', dynamic.elapsedDays, 22.0, 85.0);
  assert(Math.abs(recoveredPct - testPct) <= 1.0, `Bi-directional conversion mismatch: ${testPct}% -> ${dynamic.elapsedDays}d -> ${recoveredPct}%`);
}
console.log('  [✓] Test 6 Passed: Bi-directional translation (Severity % <-> Days) verified within ±1.0% accuracy across all milestone tiers');

console.log('\n[🎉] All 6 Canonical Agronomic Engine Test Suites Passed Successfully!');
