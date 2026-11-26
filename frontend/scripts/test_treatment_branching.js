/**
 * Unit Test Suite for Agronomic Pathology Treatment Branching Engine
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 3)
 *
 * Runs via: node --experimental-strip-types scripts/test_treatment_branching.js
 */

import assert from 'node:assert';
import {
  AGRONOMIC_INTERVENTION_REGISTRY,
  calculateInterventionEfficacy,
  calculateTreatedSeverity,
  evaluateYieldRetention,
  getTreatmentProducts,
  simulateTreatment,
} from '../src/models/treatmentBranchingModel.ts';

console.log('[+] Starting Agronomic Treatment Branching Unit Tests...\n');

// ----------------------------------------------------------------------------
// Test 1: Registry Integrity for all 4 Staple Crops
// ----------------------------------------------------------------------------
const stapleCrops = ['tomato', 'potato', 'corn', 'apple'];

for (const cropId of stapleCrops) {
  const profile = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  assert(profile, `Profile missing for ${cropId}`);
  assert(profile.diseaseName, `Disease name missing for ${cropId}`);
  assert(profile.pathogenScientific, `Pathogen scientific name missing for ${cropId}`);
  assert(profile.apparentInfectionRate > 0, `Infection rate must be positive for ${cropId}`);
  assert(profile.carryingCapacity === 100, `Carrying capacity must be 100% for ${cropId}`);
  assert(profile.efficacyMax > profile.efficacyMin, `Efficacy max must exceed min for ${cropId}`);
  assert(profile.leakageRatio > 0 && profile.leakageRatio < 1, `Leakage ratio bounds for ${cropId}`);
  assert(profile.marketValuePerHectareUSD > 0, `Market value must be positive for ${cropId}`);
  assert(profile.sprayCostPerHectareUSD > 0, `Spray cost must be positive for ${cropId}`);

  // Biological manifestation checks
  const m = profile.manifestation;
  assert(m.haloChlorosisEffect.length > 20, `Chlorosis manifestation missing for ${cropId}`);
  assert(m.necroticDesiccationEffect.length > 20, `Necrosis manifestation missing for ${cropId}`);
  assert(m.sporulationSuppressionEffect.length > 20, `Sporulation manifestation missing for ${cropId}`);
  assert(m.marginMorphology.length > 20, `Margin morphology missing for ${cropId}`);

  // Products check
  assert(profile.products.length >= 3, `Must have at least 3 chemical/biological products for ${cropId}`);
  for (const product of profile.products) {
    assert(product.id, `Product id missing in ${cropId}`);
    assert(product.tradeName, `Trade name missing in ${cropId}`);
    assert(product.fracCode.includes('FRAC'), `FRAC code missing in ${product.tradeName}`);
    assert(['systemic_curative', 'protectant_contact', 'bio_fungicide'].includes(product.category));
    assert(product.modeOfAction.length > 10, `Mode of action missing in ${product.tradeName}`);
    assert(product.rainfastnessHours > 0, `Rainfastness must be positive in ${product.tradeName}`);
  }
}
console.log('  [✓] Test 1 Passed: Agronomic registry and product portfolio verified for all 4 staple crops');

// ----------------------------------------------------------------------------
// Test 2: Generalized Logistic Decay Curve & Window Tiers
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  // Early window (15% infection)
  const early = calculateInterventionEfficacy(cropId, 15.0, 'systemic_curative');
  assert.strictEqual(early.windowTier, 'early');
  assert(early.efficacy >= 0.85, `Early efficacy must be high for ${cropId}, got ${early.efficacy}`);

  // Mid window (42% infection)
  const mid = calculateInterventionEfficacy(cropId, 42.0, 'systemic_curative');
  assert.strictEqual(mid.windowTier, 'mid');
  assert(mid.efficacy < early.efficacy, `Mid efficacy must be lower than early for ${cropId}`);
  assert(mid.efficacy >= 0.40, `Mid efficacy must remain viable for ${cropId}, got ${mid.efficacy}`);

  // Late window (60% infection)
  const late = calculateInterventionEfficacy(cropId, 60.0, 'systemic_curative');
  assert.strictEqual(late.windowTier, 'late');
  assert(late.efficacy < mid.efficacy, `Late efficacy must be lower than mid for ${cropId}`);

  // Terminal window (80% infection)
  const terminal = calculateInterventionEfficacy(cropId, 80.0, 'systemic_curative');
  assert.strictEqual(terminal.windowTier, 'terminal');
  assert(terminal.efficacy <= 0.15, `Terminal efficacy must drop below 0.15 for ${cropId}`);

  // Modality hierarchy check
  const systemicEff = calculateInterventionEfficacy(cropId, 25.0, 'systemic_curative').efficacy;
  const protectantEff = calculateInterventionEfficacy(cropId, 25.0, 'protectant_contact').efficacy;
  const bioEff = calculateInterventionEfficacy(cropId, 25.0, 'bio_fungicide').efficacy;

  assert(systemicEff > protectantEff, `Systemic curative must exceed protectant in curative kickback (${cropId})`);
  assert(protectantEff > bioEff, `Protectant contact must exceed bio-fungicide in raw knockdown (${cropId})`);
}
console.log('  [✓] Test 2 Passed: Generalized logistic decay curve, window tiers, and modality hierarchy validated');

// ----------------------------------------------------------------------------
// Test 3: Protection wears off; re-spraying keeps the disease lower
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  const sInt = 25.0;

  const t0 = calculateTreatedSeverity(cropId, sInt, 0.0, 'systemic_curative');
  assert(Math.abs(t0.currentSeverityPct - sInt) <= 0.2, `At the spray moment severity equals sInt (${cropId})`);

  const t1 = calculateTreatedSeverity(cropId, sInt, 1.0, 'systemic_curative');
  const t5 = calculateTreatedSeverity(cropId, sInt, 5.0, 'systemic_curative');
  assert(t1.currentSeverityPct >= t0.currentSeverityPct, `Severity must be non-decreasing (${cropId})`);
  assert(t5.currentSeverityPct >= t1.currentSeverityPct, `Severity must be non-decreasing (${cropId})`);

  const untreatedLater = calculateTreatedSeverity(cropId, 100, 0, 'systemic_curative'); // spray never takes effect
  assert(untreatedLater.plateauSeverityPct === 100, `Spraying at 100% changes nothing (${cropId})`);

  // Short protection so every crop's season spans several spray intervals.
  const keep = simulateTreatment(cropId, sInt, 100, 'systemic_curative', { keepSpraying: true, protectionDays: 3 });
  const once = simulateTreatment(cropId, sInt, 100, 'systemic_curative', { keepSpraying: false, protectionDays: 3 });
  assert(keep.plateauSeverityPct < once.plateauSeverityPct, `Re-spraying must end lower than one spray (${cropId})`);
  assert(once.plateauSeverityPct < 100, `One spray still slows the disease a little (${cropId})`);
  assert(once.plateauSeverityPct > keep.plateauSeverityPct + 5, `One spray must wear off (${cropId})`);
  assert(keep.spraysSeason >= 1 && once.spraysSeason === 1, `Spray counts (${cropId})`);

  // Longer protection per spray means fewer sprays
  const shortCover = simulateTreatment(cropId, sInt, 100, 'systemic_curative', { protectionDays: 3 });
  const longCover = simulateTreatment(cropId, sInt, 100, 'systemic_curative', { protectionDays: 14 });
  assert(shortCover.spraysSeason > longCover.spraysSeason, `Shorter protection needs more sprays (${cropId})`);
}
console.log('  [✓] Test 3 Passed: protection wears off, re-spraying and protection length matter');

// ----------------------------------------------------------------------------
// Test 4: Season outcome and spray cost
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  const untreated = evaluateYieldRetention(cropId, 30.0, false);
  assert.strictEqual(untreated.salvagedYieldPct, 0.0, `Untreated must have 0 salvaged yield (${cropId})`);
  assert.strictEqual(untreated.netEconomicBenefitUSDPerHectare, 0, `Untreated net benefit must be 0 (${cropId})`);
  assert.strictEqual(untreated.sprayCount, 0, `Untreated means no sprays (${cropId})`);

  const treatedEarly = evaluateYieldRetention(cropId, 20.0, true, 'systemic_curative');
  assert(treatedEarly.salvagedYieldPct > 0, `Early spraying saves some yield for ${cropId}`);
  assert(treatedEarly.sprayCount >= 1, `Treated means at least one spray (${cropId})`);
  assert.strictEqual(
    treatedEarly.sprayCostUSDPerHectare,
    treatedEarly.sprayCount * AGRONOMIC_INTERVENTION_REGISTRY[cropId].sprayCostPerHectareUSD,
    `Spray cost counts every spray (${cropId})`,
  );

  const treatedLate = evaluateYieldRetention(cropId, 80.0, true, 'systemic_curative');
  assert(treatedLate.salvagedYieldPct < treatedEarly.salvagedYieldPct, `Late spraying saves less (${cropId})`);
  assert(treatedLate.netEconomicBenefitUSDPerHectare <= 0, `Spraying at 80% must not show a gain (${cropId})`);
}
console.log('  [✓] Test 4 Passed: season outcome, per-spray cost and late-spray loss validated');

// ----------------------------------------------------------------------------
// Test 5: Chemical Product Filtering Utility
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  const allProducts = getTreatmentProducts(cropId);
  const curatives = getTreatmentProducts(cropId, 'systemic_curative');
  const protectants = getTreatmentProducts(cropId, 'protectant_contact');
  const bios = getTreatmentProducts(cropId, 'bio_fungicide');

  assert(allProducts.length === curatives.length + protectants.length + bios.length, `Count mismatch in ${cropId}`);
  assert(curatives.length >= 1, `Must have at least 1 systemic curative for ${cropId}`);
  assert(protectants.length >= 1, `Must have at least 1 protectant for ${cropId}`);
  assert(bios.length >= 1, `Must have at least 1 bio-fungicide for ${cropId}`);
}
console.log('  [✓] Test 5 Passed: Product categorization and lookup filtering confirmed');

console.log('\n[🎉] All 5 Agronomic Treatment Branching Test Suites Passed Successfully!\n');
