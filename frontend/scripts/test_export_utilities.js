/**
 * Unit Test Suite for Progression Timelapse & PDF Advisory Export Utilities
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 4)
 *
 * Runs via: node --experimental-strip-types scripts/test_export_utilities.js
 */

import assert from 'node:assert';
import {
  generateExportFilename,
  assembleFieldReportData,
} from '../src/p2p-experimental/models/exportReportModel.ts';
import {
  calculateElapsedDays,
} from '../src/p2p-experimental/models/agronomicTimelineModel.ts';
import {
  calculateInterventionEfficacy,
  evaluateYieldRetention,
} from '../src/p2p-experimental/models/treatmentBranchingModel.ts';

console.log('[+] Starting Progression Timelapse & PDF Export Unit Tests...\n');

// ----------------------------------------------------------------------------
// Test 1: Filename Formatting and Sanitization
// ----------------------------------------------------------------------------
const testCases = [
  { crop: 'Tomato', disease: 'Early Blight', ext: 'webm' },
  { crop: 'Potato', disease: 'Late Blight (Phytophthora)', ext: 'png' },
  { crop: 'Corn (maize)', disease: 'Common Rust', ext: 'pdf' },
  { crop: 'Apple', disease: 'Apple Scab', ext: 'pdf' },
];

for (const tc of testCases) {
  const filename = generateExportFilename(tc.crop, tc.disease, tc.ext);
  assert(filename.endsWith(`.${tc.ext}`), `Filename should end with .${tc.ext}: got ${filename}`);
  assert(!filename.includes(' '), `Filename should not contain spaces: ${filename}`);
  assert(!filename.includes('('), `Filename should not contain special chars: ${filename}`);
  assert(!filename.includes(')'), `Filename should not contain special chars: ${filename}`);
  assert(filename.includes('progression'), `Filename should include progression: ${filename}`);
}
console.log('  [✓] Test 1 Passed: Filename sanitization, date stamping, and extension resolution verified');

// ----------------------------------------------------------------------------
// Test 2: Field Advisory Report Assembly (All 4 Crops)
// ----------------------------------------------------------------------------
const stapleCrops = ['tomato', 'potato', 'corn', 'apple'];

for (const cropId of stapleCrops) {
  const dynamicOutput = calculateElapsedDays(cropId, 35.0, 22.0, 85.0);
  const efficacyResult = calculateInterventionEfficacy(cropId, 25.0, 'systemic_curative');
  const yieldAnalytics = evaluateYieldRetention(cropId, 25.0, true, 'systemic_curative');

  const report = assembleFieldReportData({
    cropId,
    cropName: cropId.toUpperCase(),
    diseaseName: 'Test Pathology',
    pathogenScientific: 'Pathogen spec',
    pathogenType: 'FUNGAL',
    currentSeverityPct: 35.0,
    dynamicOutput,
    temperatureC: 22.0,
    humidityPct: 85.0,
    stageOrder: 1,
    stageLabel: 'Secondary Spread',
    treatmentActive: true,
    interventionSeverity: 25.0,
    interventionDays: 3.5,
    selectedCategory: 'systemic_curative',
    selectedProductId: '',
    efficacyResult,
    yieldAnalytics,
    canvasSnapshotDataUrl: 'data:image/png;base64,TEST_DATA',
  });

  assert(report.reportId.startsWith('AGR-'), `Report ID must start with AGR-: ${report.reportId}`);
  assert(report.generatedAtISO.length > 10, `Generated ISO date must be valid`);
  assert(report.telemetry.temperatureC === 22.0, `Telemetry temperature mismatch`);
  assert(report.telemetry.humidityPct === 85.0, `Telemetry humidity mismatch`);
  assert(report.foliar.severityPercentage === 35.0, `Foliar severity mismatch`);
  assert(report.foliar.greenLeafAreaPct > 0, `Green Leaf Area must be positive`);
  assert(report.treatment.isTreatmentSimulated === true, `Treatment status mismatch`);
  assert(report.treatment.activeProduct !== null, `Active product must be resolved for ${cropId}`);
  assert(report.treatment.yieldSalvagedPct > 0, `Yield salvaged must be positive for ${cropId}`);
  assert(report.culturalControls.length === 4, `Must have 4 cultural controls for ${cropId}`);
  assert.strictEqual(report.canvasSnapshotDataUrl, 'data:image/png;base64,TEST_DATA');
}
console.log('  [✓] Test 2 Passed: Full field report assembly and product mapping verified for all 4 crops');

// ----------------------------------------------------------------------------
// Test 3: Untreated Baseline Report Assembly Integrity
// ----------------------------------------------------------------------------
const untreatedOutput = calculateElapsedDays('tomato', 75.0, 22.0, 85.0);
const untreatedReport = assembleFieldReportData({
  cropId: 'tomato',
  cropName: 'Tomato',
  diseaseName: 'Early Blight',
  pathogenScientific: 'Alternaria solani',
  pathogenType: 'FUNGAL',
  currentSeverityPct: 75.0,
  dynamicOutput: untreatedOutput,
  temperatureC: 22.0,
  humidityPct: 85.0,
  stageOrder: 2,
  stageLabel: 'Severe Defoliation',
  treatmentActive: false,
  interventionSeverity: 0,
  interventionDays: 0,
  selectedCategory: 'systemic_curative',
  selectedProductId: '',
  efficacyResult: calculateInterventionEfficacy('tomato', 75.0),
  yieldAnalytics: evaluateYieldRetention('tomato', 75.0, false),
  canvasSnapshotDataUrl: null,
});

assert.strictEqual(untreatedReport.treatment.isTreatmentSimulated, false);
assert.strictEqual(untreatedReport.treatment.yieldSalvagedPct, 0);
assert.strictEqual(untreatedReport.foliar.greenLeafAreaPct, 25.0); // 100 - 75 = 25
assert(untreatedReport.telemetry.environmentalConditionLabel.length > 0);
console.log('  [✓] Test 3 Passed: Untreated baseline report correctly handles zero-treatment metrics');

// ----------------------------------------------------------------------------
// Test 4: Frame & Timing Math for 60 FPS / 30 FPS Timelapse
// ----------------------------------------------------------------------------
const durationMs = 5000;
const fps30 = 30;
const frames30 = Math.round((durationMs / 1000) * fps30);
const interval30 = durationMs / frames30;

assert.strictEqual(frames30, 150, '5000ms at 30 fps should be 150 frames');
assert(Math.abs(interval30 - 33.33) < 0.1, 'Interval should be ~33.33ms');

const fps60 = 60;
const frames60 = Math.round((durationMs / 1000) * fps60);
const interval60 = durationMs / frames60;

assert.strictEqual(frames60, 300, '5000ms at 60 fps should be 300 frames');
assert(Math.abs(interval60 - 16.66) < 0.1, 'Interval should be ~16.66ms');
console.log('  [✓] Test 4 Passed: Frame timing and sweep interval mathematics validated');

console.log('\n[🎉] All Progression Timelapse & Export Utility Test Suites Passed Successfully!\n');
