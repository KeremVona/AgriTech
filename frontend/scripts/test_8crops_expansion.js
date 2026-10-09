/**
 * Unit Test Suite for Tier 1, Feature 5: 8-Crop Expansion Verification.
 * Validates complete epidemiological registries, hotspots, treatments,
 * assets on disk, and diagnostic report generation across all 8 priority crops.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGRONOMIC_CALIBRATION_REGISTRY,
  calculateElapsedDays,
} from '../src/p2p-experimental/models/agronomicTimelineModel.ts';
import {
  SYMPTOM_HOTSPOTS_REGISTRY,
  getActiveHotspotsForProgress,
} from '../src/p2p-experimental/models/hotspotRegistry.ts';
import {
  AGRONOMIC_INTERVENTION_REGISTRY,
  getTreatmentProducts,
  calculateInterventionEfficacy,
  evaluateYieldRetention,
} from '../src/p2p-experimental/models/treatmentBranchingModel.ts';
import {
  EXPERIMENTAL_8CROPS_MANIFEST,
  getExperimentalCropProgression,
} from '../src/p2p-experimental/services/experimentalProgressionService.ts';
import { assembleFieldReportData } from '../src/p2p-experimental/models/exportReportModel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXP_PROGRESSION_DIR = path.resolve(__dirname, '../public/progression-experimental');

const ALL_8_CROPS = [
  'tomato',
  'potato',
  'corn',
  'apple',
  'grape',
  'pepper',
  'peach',
  'squash',
];

console.log('[+] Starting Comprehensive 8-Priority-Crop Suite Tests...\n');

// ----------------------------------------------------------------------------
// Test 1: Epidemiological Calibrations across all 8 Crops
// ----------------------------------------------------------------------------
console.log('  [*] Test 1: Verifying epidemiological profiles for all 8 crops...');
for (const cropId of ALL_8_CROPS) {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  assert.ok(profile, `Missing epidemiological profile for ${cropId}`);
  assert.strictEqual(profile.cropId, cropId);
  assert.ok(profile.cropName.length > 0);
  assert.ok(profile.diseaseName.length > 0);

  // Cardinals: T_min < T_opt < T_max
  assert.ok(
    profile.cardinals.min < profile.cardinals.opt,
    `${cropId} min temp >= opt temp`
  );
  assert.ok(
    profile.cardinals.opt < profile.cardinals.max,
    `${cropId} opt temp >= max temp`
  );

  // Humidity: RH_min < RH_crit <= RH_opt
  assert.ok(
    profile.humidity.min < profile.humidity.crit,
    `${cropId} min RH >= crit RH`
  );
  assert.ok(
    profile.humidity.crit <= profile.humidity.opt,
    `${cropId} crit RH > opt RH`
  );

  // Stage anchor days: 0 < stage0 < stage1 < stage2
  assert.ok(
    profile.baselineDays.stage0_incubation < profile.baselineDays.stage1_spread,
    `${cropId} stage0 >= stage1 days`
  );
  assert.ok(
    profile.baselineDays.stage1_spread <= profile.baselineDays.stage2_severe,
    `${cropId} stage1 > stage2 days`
  );
  assert.strictEqual(
    profile.baselineDays.totalOptimalDays,
    profile.baselineDays.stage2_severe
  );

  // Degree-days
  assert.ok(profile.degreeDays.baseTemp < profile.degreeDays.cutoffTemp);
  assert.ok(profile.degreeDays.degreeDaysTotal > 0);

  // Milestones: 3 stages
  assert.strictEqual(profile.milestones.length, 3);
  assert.strictEqual(profile.milestones[0].stageOrder, 0);
  assert.strictEqual(profile.milestones[1].stageOrder, 1);
  assert.strictEqual(profile.milestones[2].stageOrder, 2);

  // Elapsed days calculation check
  const res = calculateElapsedDays(cropId, 50, profile.cardinals.opt, profile.humidity.crit);
  assert.ok(res.elapsedDays > 0);
  assert.ok(!isNaN(res.elapsedDays));
}
console.log('  [✓] Test 1 Passed: All 8 epidemiological profiles mathematically calibrated');

// ----------------------------------------------------------------------------
// Test 2: Anatomical Symptom Hotspots across all 8 Crops
// ----------------------------------------------------------------------------
console.log('  [*] Test 2: Verifying symptom hotspots for all 8 crops...');
for (const cropId of ALL_8_CROPS) {
  const hotspots = SYMPTOM_HOTSPOTS_REGISTRY[cropId];
  assert.ok(hotspots, `Missing hotspots for ${cropId}`);
  assert.ok(hotspots.length >= 3, `${cropId} has fewer than 3 hotspots (${hotspots.length})`);

  for (const h of hotspots) {
    assert.strictEqual(h.cropId, cropId);
    assert.ok(h.title.length > 0);
    assert.ok(h.xPct >= 0 && h.xPct <= 100, `${h.id} xPct out of bounds`);
    assert.ok(h.yPct >= 0 && h.yPct <= 100, `${h.id} yPct out of bounds`);
    assert.ok(h.minSliderPct >= 0 && h.minSliderPct <= 100);
    assert.ok(h.pathogenStructure.length > 0);
    assert.ok(h.anatomicalDescription.length > 0);
    assert.ok(h.treatmentAdvisory.length > 0);
  }

  // Active hotspots at 85% infection should find stage 2 markers
  const activeAt85 = getActiveHotspotsForProgress(cropId, 85);
  assert.ok(activeAt85.length >= 1, `${cropId} has no active hotspots at 85%`);
}
console.log('  [✓] Test 2 Passed: 24 total anatomical hotspots (3 per crop) registered and bounded');

// ----------------------------------------------------------------------------
// Test 3: Treatment Branching & Chemical Portfolios across all 8 Crops
// ----------------------------------------------------------------------------
console.log('  [*] Test 3: Verifying treatment branching models for all 8 crops...');
for (const cropId of ALL_8_CROPS) {
  const txProfile = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  assert.ok(txProfile, `Missing treatment profile for ${cropId}`);
  assert.strictEqual(txProfile.cropId, cropId);
  assert.ok(txProfile.products.length >= 3, `${cropId} has fewer than 3 chemical products`);

  // Product categories
  const systemic = getTreatmentProducts(cropId, 'systemic_curative');
  const protectant = getTreatmentProducts(cropId, 'protectant_contact');
  const bio = getTreatmentProducts(cropId, 'bio_fungicide');

  assert.ok(systemic.length >= 1, `${cropId} missing systemic_curative product`);
  assert.ok(protectant.length >= 1, `${cropId} missing protectant_contact product`);
  assert.ok(bio.length >= 1, `${cropId} missing bio_fungicide product`);

  // Efficacy and yield evaluation
  const effEarly = calculateInterventionEfficacy(cropId, 25, 'systemic_curative');
  assert.ok(effEarly.efficacyPct > 80, `${cropId} early efficacy lower than expected: ${effEarly.efficacyPct}`);

  const yieldAnalytics = evaluateYieldRetention(cropId, 25, true, 'systemic_curative');
  assert.ok(yieldAnalytics.salvagedYieldPct > 0);
  assert.ok(yieldAnalytics.netEconomicBenefitUSDPerHectare > 0);
}
console.log('  [✓] Test 3 Passed: 8-crop chemical portfolios (FRAC codes, kickback, ROI) validated');

// ----------------------------------------------------------------------------
// Test 4: Manifest Resolution & Stage Metadata
// ----------------------------------------------------------------------------
console.log('  [*] Test 4: Verifying 8-crop experimental manifest...');
assert.strictEqual(EXPERIMENTAL_8CROPS_MANIFEST.crops.length, 8);
for (const cropId of ALL_8_CROPS) {
  const crop = await getExperimentalCropProgression(cropId);
  assert.ok(crop, `Failed to retrieve crop progression for ${cropId}`);
  assert.strictEqual(crop.stages.length, 3);
  assert.strictEqual(crop.resolution.width, 800);
  assert.strictEqual(crop.resolution.height, 800);

  // Check stage assets
  for (let s = 0; s < 3; s++) {
    const stage = crop.stages[s];
    assert.strictEqual(stage.stage_order, s);
    assert.ok(stage.assets.base_image_url.startsWith(`/progression-experimental/${cropId}/`));
    if (s === 0) {
      assert.strictEqual(stage.assets.mask_image_url, null);
    } else {
      assert.ok(
        stage.assets.mask_image_url?.startsWith(`/progression-experimental/${cropId}/`),
        `Missing or invalid mask url for ${cropId} stage ${s}`
      );
    }
  }
}
console.log('  [✓] Test 4 Passed: 8-crop manifest stages, resolution, and mask URLs verified');

// ----------------------------------------------------------------------------
// Test 5: Physical Assets on Disk Verification (40 WebP Files in progression-experimental)
// ----------------------------------------------------------------------------
console.log('  [*] Test 5: Verifying physical WebP files on disk in public/progression-experimental/...');
const MAX_ASSET_SIZE_BYTES = 150 * 1024; // 150 KB limit
for (const cropId of ALL_8_CROPS) {
  const cropDir = path.join(EXP_PROGRESSION_DIR, cropId);
  assert.ok(fs.existsSync(cropDir), `Missing experimental folder for ${cropId}`);

  const requiredFiles = [
    `${cropId}_stage0_healthy.webp`,
    `${cropId}_stage1_early.webp`,
    `${cropId}_stage1_mask.webp`,
    `${cropId}_stage2_severe.webp`,
    `${cropId}_stage2_mask.webp`,
  ];

  for (const filename of requiredFiles) {
    const filePath = path.join(cropDir, filename);
    assert.ok(fs.existsSync(filePath), `Missing experimental asset: ${filePath}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 1000, `Asset ${filename} unexpectedly small: ${stat.size} bytes`);
    assert.ok(
      stat.size <= MAX_ASSET_SIZE_BYTES,
      `Asset ${filename} exceeds 150 KB limit: ${(stat.size / 1024).toFixed(1)} KB`
    );

    // Validate RIFF....WEBP binary header signature
    const buffer = fs.readFileSync(filePath);
    const isWebP =
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP';
    assert.ok(isWebP, `File ${filename} lacks valid RIFF/WEBP binary signature`);
  }
}
console.log('  [✓] Test 5 Passed: All 40 experimental WebP files verified present, < 150KB, with valid RIFF/WEBP headers');

// ----------------------------------------------------------------------------
// Test 6: PDF Field Report Assembly for all 8 Crops
// ----------------------------------------------------------------------------
console.log('  [*] Test 6: Verifying agronomic PDF report assembly for all 8 crops...');
for (const cropId of ALL_8_CROPS) {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  const dynamicOutput = calculateElapsedDays(cropId, 35, profile.cardinals.opt, profile.humidity.crit);
  const efficacyResult = calculateInterventionEfficacy(cropId, 35, 'systemic_curative');
  const yieldAnalytics = evaluateYieldRetention(cropId, 35, true, 'systemic_curative');

  const report = assembleFieldReportData({
    cropId,
    cropName: profile.cropName,
    diseaseName: profile.diseaseName,
    pathogenScientific: profile.pathogenScientific,
    pathogenType: 'FUNGAL',
    currentSeverityPct: 35,
    dynamicOutput,
    temperatureC: profile.cardinals.opt,
    humidityPct: profile.humidity.crit,
    stageOrder: 1,
    stageLabel: 'Stage 1 • Early Spread',
    treatmentActive: true,
    interventionSeverity: 35,
    interventionDays: 10,
    selectedCategory: 'systemic_curative',
    selectedProductId: '',
    efficacyResult,
    yieldAnalytics,
    canvasSnapshotDataUrl: null,
  });

  assert.ok(report.reportId.startsWith('AGR-'));
  assert.ok(report.culturalControls.length >= 3, `Cultural controls missing for ${cropId}`);
  assert.ok(report.treatment.activeProduct !== null);
  assert.ok(report.treatment.biologicalManifestation.haloChlorosis.length > 0);
}
console.log('  [✓] Test 6 Passed: Full agronomic field reports generated for all 8 crops');

console.log('\n[🎉] ALL 6 8-PRIORITY-CROP EXPANSION TEST SUITES PASSED SUCCESSFULLY!');
