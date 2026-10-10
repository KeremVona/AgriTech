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
} from '../src/p2p-experimental/models/treatmentBranchingModel.ts';

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
// Test 3: Asymptotic Branching Trajectory and Latency Buffer
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  const sInt = 25.0; // Intervene at 25%

  // Day 0 post intervention
  const t0 = calculateTreatedSeverity(cropId, sInt, 0.0, 'systemic_curative');
  assert.strictEqual(t0.currentSeverityPct, sInt, `At dt=0, severity must equal sInt (${cropId})`);
  assert(t0.plateauSeverityPct >= sInt, `Plateau must be >= sInt (${cropId})`);
  assert(!t0.isFullyArrested, `At dt=0, should not be fully arrested yet (${cropId})`);

  // Day 1 post intervention (partial arrest)
  const t1 = calculateTreatedSeverity(cropId, sInt, 1.0, 'systemic_curative');
  assert(t1.currentSeverityPct >= t0.currentSeverityPct, `Severity must be non-decreasing (${cropId})`);
  assert(t1.currentSeverityPct <= t1.plateauSeverityPct, `Severity must not overshoot plateau (${cropId})`);

  // Day 15 post intervention (full asymptotic plateau reached)
  const t15 = calculateTreatedSeverity(cropId, sInt, 15.0, 'systemic_curative');
  assert(t15.isFullyArrested, `At dt=15, progression must be fully arrested (${cropId})`);
  assert(
    Math.abs(t15.currentSeverityPct - t15.plateauSeverityPct) <= 0.2,
    `At dt=15, severity should equal plateau (${cropId})`
  );

  // Early window latency buffer should remain small (<= 4.0% extra spread)
  assert(
    t15.expansionDeltaPct <= 4.0,
    `Latency leakage in early window should be <= 4.0%, got ${t15.expansionDeltaPct}% for ${cropId}`
  );
}
console.log('  [✓] Test 3 Passed: Smooth asymptotic relaxation, time continuity, and latency buffer confirmed');

// ----------------------------------------------------------------------------
// Test 4: Quantitative Yield Salvage & Financial ROI Analytics
// ----------------------------------------------------------------------------
for (const cropId of stapleCrops) {
  // Untreated case
  const untreated = evaluateYieldRetention(cropId, 30.0, false);
  assert.strictEqual(untreated.salvagedYieldPct, 0.0, `Untreated must have 0 salvaged yield (${cropId})`);
  assert.strictEqual(untreated.greenLeafAreaPct, 0.0, `Untreated terminal GLA must be 0 (${cropId})`);
  assert.strictEqual(untreated.netEconomicBenefitUSDPerHectare, 0, `Untreated net benefit must be 0 (${cropId})`);

  // Early treated case (intervened at 20%)
  const treatedEarly = evaluateYieldRetention(cropId, 20.0, true, 'systemic_curative');
  assert(treatedEarly.salvagedYieldPct > 20.0, `Early intervention must salvage >20% yield for ${cropId}`);
  assert(treatedEarly.greenLeafAreaPct >= 70.0, `Early intervention must retain >=70% GLA for ${cropId}`);
  assert(treatedEarly.grossSavedUSDPerHectare > 0, `Gross saved revenue must be positive (${cropId})`);
  assert(treatedEarly.netEconomicBenefitUSDPerHectare > 0, `Net economic benefit must be positive (${cropId})`);
  assert(treatedEarly.returnOnInvestmentRatio >= 3.0, `Early intervention ROI must be >= 3.0x (${cropId})`);

  // Late treated case (intervened at 65%)
  const treatedLate = evaluateYieldRetention(cropId, 65.0, true, 'systemic_curative');
  assert(
    treatedLate.salvagedYieldPct < treatedEarly.salvagedYieldPct,
    `Late treatment must salvage significantly less yield than early treatment (${cropId})`
  );
}
console.log('  [✓] Test 4 Passed: Quantitative yield damage models and positive economic ROI validated');

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
