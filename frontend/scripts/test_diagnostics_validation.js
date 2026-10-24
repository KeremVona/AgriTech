import assert from 'node:assert/strict';

// Directly import from production TypeScript source modules using Node experimental strip types
import {
  validateMimeType,
  validateFileSize,
  MAX_FILE_SIZE_BYTES,
  MIN_IMAGE_DIMENSION_PX,
} from '../src/utils/imageValidation.ts';

import {
  formatClassLabel,
  mapAgronomicSeverity,
  normalizeCropSpecies,
  CLINICAL_SAMPLE_PRESETS,
  presetToPrediction,
  LOW_CONFIDENCE_THRESHOLD,
} from '../src/services/diagnosticsService.ts';

console.log('🧪 Starting AI Leaf Diagnostics Unit Test Suite...');

// 1. MIME Validation Tests
console.log('1. Testing validateMimeType()...');
assert.equal(validateMimeType('image/jpeg').valid, true);
assert.equal(validateMimeType('image/png').valid, true);
assert.equal(validateMimeType('IMAGE/JPEG').valid, true);
assert.equal(validateMimeType('image/gif').valid, false);
assert.equal(validateMimeType('application/pdf').valid, false);
assert.equal(validateMimeType('').valid, false);

// 2. File Size Limit Tests
console.log('2. Testing validateFileSize()...');
assert.equal(validateFileSize(1024 * 1024).valid, true); // 1MB
assert.equal(validateFileSize(MAX_FILE_SIZE_BYTES).valid, true); // 10MB exact
assert.equal(validateFileSize(MAX_FILE_SIZE_BYTES + 1).valid, false); // 10MB + 1 byte
assert.equal(validateFileSize(0).valid, false); // Empty file
assert.equal(validateFileSize(-100).valid, false); // Negative bytes

// 3. Label Formatting Tests
console.log('3. Testing formatClassLabel()...');
assert.equal(formatClassLabel('Tomato___Late_blight'), 'Tomato — Late Blight');
assert.equal(formatClassLabel('Corn_(maize)___Common_rust_'), 'Corn (Maize) — Common Rust');
assert.equal(formatClassLabel('Apple___healthy'), 'Apple — Healthy');
assert.equal(formatClassLabel(''), 'Unknown Foliage');

// 4. Severity Mapping Tests
console.log('4. Testing mapAgronomicSeverity()...');
// Healthy -> Tier 0
assert.deepEqual(mapAgronomicSeverity('Healthy', 'healthy'), { severityTier: 'Tier 0', severityIndex: 'Healthy' });
assert.deepEqual(mapAgronomicSeverity('', 'Tomato Healthy'), { severityTier: 'Tier 0', severityIndex: 'Healthy' });

// Low / Watch / Rescan -> Tier 1
assert.deepEqual(mapAgronomicSeverity('Low', 'Early chlorosis'), { severityTier: 'Tier 1', severityIndex: 'Low' });
assert.deepEqual(mapAgronomicSeverity('watch', 'Spore watch'), { severityTier: 'Tier 1', severityIndex: 'Low' });
assert.deepEqual(mapAgronomicSeverity('', 'Low Confidence Foliage'), { severityTier: 'Tier 1', severityIndex: 'Low' });
assert.deepEqual(mapAgronomicSeverity('', 'Requires Rescan'), { severityTier: 'Tier 1', severityIndex: 'Low' });

// Moderate / Alert -> Tier 2
assert.deepEqual(mapAgronomicSeverity('Moderate', 'Leaf Spot'), { severityTier: 'Tier 2', severityIndex: 'Moderate' });
assert.deepEqual(mapAgronomicSeverity('medium', 'Alternaria solani'), { severityTier: 'Tier 2', severityIndex: 'Moderate' });
assert.deepEqual(mapAgronomicSeverity('', 'Moderate Powdery Mildew'), { severityTier: 'Tier 2', severityIndex: 'Moderate' });

// Critical / Outbreak -> Tier 3
assert.deepEqual(mapAgronomicSeverity('High', 'Late Blight'), { severityTier: 'Tier 3', severityIndex: 'Critical' });
assert.deepEqual(mapAgronomicSeverity('Critical', 'Severe Outbreak'), { severityTier: 'Tier 3', severityIndex: 'Critical' });
assert.deepEqual(mapAgronomicSeverity('', 'Late Blight Necrosis'), { severityTier: 'Tier 3', severityIndex: 'Critical' });

// Fallback for unclassified foliage -> Tier 1 (safe low warning)
assert.deepEqual(mapAgronomicSeverity('', ''), { severityTier: 'Tier 1', severityIndex: 'Low' });

// 5. Crop Species Normalization
console.log('5. Testing normalizeCropSpecies()...');
assert.equal(normalizeCropSpecies('tomato'), 'Tomato');
assert.equal(normalizeCropSpecies('Solanum lycopersicum'), 'Tomato');
assert.equal(normalizeCropSpecies('potato'), 'Potato');
assert.equal(normalizeCropSpecies('corn'), 'Corn');
assert.equal(normalizeCropSpecies('maize'), 'Corn');
assert.equal(normalizeCropSpecies('apple'), 'Apple');

// 6. Clinical Sample Presets Integrity Tests
console.log('6. Testing CLINICAL_SAMPLE_PRESETS...');
assert.equal(CLINICAL_SAMPLE_PRESETS.length, 4, 'Must provide 4 clinical specimen presets for evaluation');

const coveredCrops = new Set(CLINICAL_SAMPLE_PRESETS.map((p) => p.crop));
assert.equal(coveredCrops.has('Tomato'), true);
assert.equal(coveredCrops.has('Potato'), true);
assert.equal(coveredCrops.has('Corn'), true);
assert.equal(coveredCrops.has('Apple'), true);

const coveredTiers = new Set(CLINICAL_SAMPLE_PRESETS.map((p) => p.severityTier));
assert.equal(coveredTiers.has('Tier 0'), true, 'Presets must cover Tier 0');
assert.equal(coveredTiers.has('Tier 1'), true, 'Presets must cover Tier 1');
assert.equal(coveredTiers.has('Tier 2'), true, 'Presets must cover Tier 2');
assert.equal(coveredTiers.has('Tier 3'), true, 'Presets must cover Tier 3');

for (const preset of CLINICAL_SAMPLE_PRESETS) {
  assert.ok(preset.agronomicAdvisory.immediateAction.length > 0, `Preset ${preset.id} missing immediateAction`);
  assert.ok(preset.topProbabilities.length >= 3, `Preset ${preset.id} must have at least 3 top probabilities`);
  const probSum = preset.topProbabilities.reduce((acc, curr) => acc + curr.probability, 0);
  assert.ok(probSum <= 1.001, `Preset ${preset.id} probabilities sum > 1.0 (${probSum})`);

  // Test adapter conversion
  const prediction = presetToPrediction(preset);
  assert.equal(prediction.crop, preset.crop);
  assert.equal(prediction.severityTier, preset.severityTier);
  assert.equal(prediction.confidenceScore, preset.confidenceScore);
  assert.ok(prediction.inferenceId.startsWith('preset-'));
}

// 7. Low Confidence Threshold
console.log('7. Testing LOW_CONFIDENCE_THRESHOLD constant...');
assert.equal(LOW_CONFIDENCE_THRESHOLD, 0.70, 'SPEC-UI-006 §5 State 6 requires 0.70 (70%) low confidence gate');

console.log('✅ All AI Leaf Diagnostics validation and service unit tests passed cleanly!');
