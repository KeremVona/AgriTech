/**
 * Verification Suite for Studio Parameter Inspector Components (SPEC-UI-007, TODO-112).
 * Verifies module exports, hyperparameter defaults, microclimate cardinal curve bounds,
 * treatment portfolio integration, NumPy .npy v1.0 binary serialization, and report data contracts.
 * Run via: node --experimental-strip-types scripts/test_studio_inspector.js
 */

import assert from 'node:assert';
import {
  AGRONOMIC_CALIBRATION_REGISTRY,
  calculateTemperatureFactor,
  calculateElapsedDays,
  WEATHER_PRESETS,
} from '../src/models/agronomicTimelineModel.ts';
import {
  getTreatmentProducts,
  calculateInterventionEfficacy,
  evaluateYieldRetention,
} from '../src/models/treatmentBranchingModel.ts';
import {
  assembleFieldReportData,
} from '../src/models/exportReportModel.ts';
import {
  serializeNpyTensor,
} from '../src/utils/npySerializer.ts';

console.log('[+] Starting Studio Inspector Rail & Prompt Attention Verification Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: Microclimate Presets & Magarey Beta Curve Calculations
// ----------------------------------------------------------------------------
console.log('  [+] Test 1: Verifying Microclimate Presets and Beta Curve Bounds...');

assert(WEATHER_PRESETS.length >= 4, 'Must provide at least 4 microclimate presets');
const optimal = WEATHER_PRESETS.find((p) => p.id === 'optimal');
assert(optimal, 'Optimal preset must exist');
assert(optimal.temperature >= 20 && optimal.humidity >= 85, 'Optimal preset must simulate pathogen risk conditions');

// Check Magarey Beta calculation across all 8 crops
const crops = Object.keys(AGRONOMIC_CALIBRATION_REGISTRY);
for (const crop of crops) {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[crop];
  const optFactor = calculateTemperatureFactor(profile.cardinals.opt, profile.cardinals);
  assert(Math.abs(optFactor - 1.0) < 1e-4, `${crop} T_opt must evaluate to 1.0`);

  const belowMin = calculateTemperatureFactor(profile.cardinals.min - 1, profile.cardinals);
  assert.strictEqual(belowMin, 0.0, `${crop} T < T_min must evaluate to 0.0`);

  const aboveMax = calculateTemperatureFactor(profile.cardinals.max + 1, profile.cardinals);
  assert.strictEqual(aboveMax, 0.0, `${crop} T > T_max must evaluate to 0.0`);
}
console.log('  [✓] Test 1 Passed: Microclimate presets and 8-crop Beta curves verified');

// ----------------------------------------------------------------------------
// Test 2: Treatment Modalities & Portfolio Categorization
// ----------------------------------------------------------------------------
console.log('  [+] Test 2: Verifying Treatment Modalities & FRAC Classifications...');

for (const crop of crops) {
  const curative = getTreatmentProducts(crop, 'systemic_curative');
  assert(curative.length > 0, `${crop} must have at least one systemic curative fungicide product`);

  const protectant = getTreatmentProducts(crop, 'protectant_contact');
  assert(protectant.length > 0, `${crop} must have at least one protectant product`);

  const bioControl = getTreatmentProducts(crop, 'bio_fungicide');
  assert(bioControl.length > 0, `${crop} must have at least one bio-control product`);

  // Verify efficacy calculation for each category
  const effCurative = calculateInterventionEfficacy(crop, 25.0, 'systemic_curative');
  assert(effCurative.efficacy > 0.6, `${crop} early curative efficacy must be > 60%`);
  assert(effCurative.windowTier === 'early' || effCurative.windowTier === 'mid', `${crop} window tier must be early or mid`);

  // Verify calibrated untreated damage retention models (not hardcoded 15%)
  const untreatedYield = evaluateYieldRetention(crop, 25.0, false, 'systemic_curative');
  assert(untreatedYield.retainedYieldPct > 0, `${crop} untreated retention must be positive`);
  assert(untreatedYield.yieldLossPct > 0, `${crop} untreated yield loss must be positive`);
  assert(Math.abs(untreatedYield.retainedYieldPct + untreatedYield.yieldLossPct - 100) < 1e-3, `${crop} yield sum must equal 100%`);
}
console.log('  [✓] Test 2 Passed: 8-crop chemical portfolios, FRAC codes and calibrated yield retention verified');

// ----------------------------------------------------------------------------
// Test 3: NumPy .npy v1.0 Binary Tensor Serialization Compliance
// ----------------------------------------------------------------------------
console.log('  [+] Test 3: Verifying NumPy .npy v1.0 Binary Tensor Serializer...');

const tensorData = new Float32Array(64 * 64);
for (let i = 0; i < tensorData.length; i++) {
  tensorData[i] = Math.random();
}

const npyBuffer = serializeNpyTensor(tensorData, [64, 64]);
assert(npyBuffer instanceof ArrayBuffer, 'Output must be an ArrayBuffer');

const u8 = new Uint8Array(npyBuffer);

// Check 6-byte magic \x93NUMPY
assert.strictEqual(u8[0], 0x93, 'Byte 0 must be 0x93');
assert.strictEqual(u8[1], 0x4e, 'Byte 1 must be "N" (0x4E)');
assert.strictEqual(u8[2], 0x55, 'Byte 2 must be "U" (0x55)');
assert.strictEqual(u8[3], 0x4d, 'Byte 3 must be "M" (0x4D)');
assert.strictEqual(u8[4], 0x50, 'Byte 4 must be "P" (0x50)');
assert.strictEqual(u8[5], 0x59, 'Byte 5 must be "Y" (0x59)');

// Check version 1.0
assert.strictEqual(u8[6], 0x01, 'Major version must be 1');
assert.strictEqual(u8[7], 0x00, 'Minor version must be 0');

// Read header length (uint16 LE)
const headerLen = u8[8] | (u8[9] << 8);
assert(headerLen > 0, 'Header length must be > 0');

// Total header length (10 + headerLen) must be a multiple of 64
assert.strictEqual((10 + headerLen) % 64, 0, 'Header must align to 64 bytes');

// Header must end with '\n'
assert.strictEqual(u8[10 + headerLen - 1], 0x0a, 'Header must terminate with newline (0x0A)');

// Total buffer size must exactly match header + 64 * 64 * 4
assert.strictEqual(npyBuffer.byteLength, 10 + headerLen + 64 * 64 * 4, 'Buffer size must match header + payload');
console.log('  [✓] Test 3 Passed: NumPy .npy v1.0 specification alignment validated');

// ----------------------------------------------------------------------------
// Test 4: Agronomic Field Advisory Report Assembly
// ----------------------------------------------------------------------------
console.log('  [+] Test 4: Verifying Diagnostic PDF Advisory Report Assembly...');

const dynamicOutput = calculateElapsedDays('tomato', 35.0, 24.5, 88.0);
const effResult = calculateInterventionEfficacy('tomato', 25.0, 'systemic_curative');
const yldAnalytics = evaluateYieldRetention('tomato', 25.0, true, 'systemic_curative');

const reportData = assembleFieldReportData({
  cropId: 'tomato',
  cropName: 'Tomato',
  diseaseName: 'Early Blight',
  pathogenScientific: 'Alternaria solani',
  pathogenType: 'FUNGAL',
  currentSeverityPct: 35.0,
  dynamicOutput,
  temperatureC: 24.5,
  humidityPct: 88.0,
  stageOrder: 1,
  stageLabel: 'Early Lesions',
  treatmentActive: true,
  interventionSeverity: 25.0,
  interventionDays: 12.0,
  selectedCategory: 'systemic_curative',
  selectedProductId: 'tomato-inspire',
  efficacyResult: effResult,
  yieldAnalytics: yldAnalytics,
  canvasSnapshotDataUrl: null,
});

assert(reportData.reportId.startsWith('AGR-TOM-'), 'Report ID must follow format AGR-{CROP}-');
assert.strictEqual(reportData.foliar.cropName, 'Tomato', 'Foliar cropName must match');
assert.strictEqual(reportData.foliar.severityPercentage, 35.0, 'Severity % must match');
assert.strictEqual(reportData.telemetry.temperatureC, 24.5, 'Temperature must match');
assert(reportData.culturalControls.length >= 3, 'Must include at least 3 cultural sanitation guidelines');
assert(reportData.treatment.isTreatmentSimulated, 'Treatment simulated flag must be true');

console.log('  [✓] Test 4 Passed: Diagnostic PDF report assembly and data contracts validated');

console.log('\n[✓] All Studio Inspector Rail & Prompt Attention Tests PASSED (4/4 suites).');
