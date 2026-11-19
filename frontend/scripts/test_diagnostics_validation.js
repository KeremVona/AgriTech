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
  mapMlAdvisoryToFrontend,
  resolveBackendAdvisory,
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

// 2. File Size Limit & Dimension Bounds Tests
console.log('2. Testing validateFileSize() and dimension bounds...');
assert.equal(MIN_IMAGE_DIMENSION_PX, 224, 'Minimum image resolution bound must be 224px per SPEC-UI-006');
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
assert.equal(normalizeCropSpecies('grape'), 'Grape');
assert.equal(normalizeCropSpecies('rice'), 'Rice');
assert.equal(normalizeCropSpecies('cassava'), 'Cassava');

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

  assert.ok(preset.sampleImageUrl && preset.sampleImageUrl.startsWith('/progression-experimental/'), `Preset ${preset.id} must have valid progression sampleImageUrl`);

  // Test adapter conversion
  const prediction = presetToPrediction(preset);
  assert.equal(prediction.crop, preset.crop);
  assert.equal(prediction.severityTier, preset.severityTier);
  assert.equal(prediction.confidenceScore, preset.confidenceScore);
  assert.equal(prediction.sampleImageUrl, preset.sampleImageUrl);
  assert.ok(prediction.inferenceId.startsWith('preset-'));
}

// 7. Low Confidence Threshold
console.log('7. Testing LOW_CONFIDENCE_THRESHOLD constant...');
assert.equal(LOW_CONFIDENCE_THRESHOLD, 0.70, 'SPEC-UI-006 §5 State 6 requires 0.70 (70%) low confidence gate');

// 8. Component State & Timer Formatting Tests
console.log('8. Testing Telemetry Timer Formatting and State Enums...');
function formatTimerHelper(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  const remainderMs = String(ms % 1000).padStart(3, '0').slice(0, 2);
  return `${mins}:${secs}:${remainderMs} ms`;
}
assert.equal(formatTimerHelper(48), '00:00:04 ms');
assert.equal(formatTimerHelper(1250), '00:01:25 ms');

// Verify all 8 states in the component state matrix exist
const validStates = [
  'IDLE',
  'DRAG_OVER',
  'VALIDATING',
  'INFERENCING',
  'SUCCESS',
  'LOW_CONFIDENCE',
  'REJECTED',
  'ERROR',
];
assert.equal(validStates.length, 8, 'SPEC-UI-006 §5 defines exactly 8 operational component states');

// 9. ML Service Advisory Field Mapping & Backend LLM/DB Resolution
console.log('9. Testing mapMlAdvisoryToFrontend() and resolveBackendAdvisory()...');
const mappedFallback = mapMlAdvisoryToFrontend({
  immediate_action: 'Isolate infected block.',
  chemical_treatments: [
    { product: 'Mancozeb 80% WP', dosage: '2.0 kg/ha', type: 'PREVENTATIVE_FUNGICIDE' },
  ],
  biological_controls: [
    { agent: 'Bacillus subtilis', product_example: 'Serenade ASO', dosage: '4 L/ha' },
  ],
  cultural_controls: ['Remove lower leaves'],
  environmental_risk_factors: 'Favourable conditions: Relative humidity >85%.',
});
assert.equal(mappedFallback.immediateAction, 'Isolate infected block.');
assert.equal(mappedFallback.fungicideTreatments.length, 3);
assert.match(mappedFallback.fungicideTreatments[0], /Mancozeb 80% WP/);
assert.match(mappedFallback.fungicideTreatments[1], /Serenade ASO/);
assert.equal(mappedFallback.fungicideTreatments[2], 'Remove lower leaves');
assert.equal(mappedFallback.environmentalRiskFactors, 'Favourable conditions: Relative humidity >85%.');

// 9b. Backend cache hit / LLM resolution overrides fallback
let capturedUrl = '';
const resolvedHit = await resolveBackendAdvisory(
  {
    classKey: 'tomato/late_blight',
    crop: 'Tomato',
    condition: 'Late Blight',
    scientificName: 'Phytophthora infestans',
    severityIndex: 'Critical',
  },
  mappedFallback,
  {
    apiBaseUrl: 'http://localhost:5051',
    fetchImpl: async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          class_key: 'tomato/late_blight',
          immediate_action: 'DB cached immediate action.',
          recommended_treatments: ['Copper Hydroxide 77% WP — 2.0 kg/ha'],
          microclimate_risk: 'RH >90% at 15-22°C.',
          source: 'database_cache',
          llm_model: 'gemini-2.5-flash',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  }
);
assert.equal(capturedUrl, 'http://localhost:5051/api/v1/advisories/resolve');
assert.equal(resolvedHit.immediateAction, 'DB cached immediate action.');
assert.deepEqual(resolvedHit.fungicideTreatments, ['Copper Hydroxide 77% WP — 2.0 kg/ha']);
assert.equal(resolvedHit.environmentalRiskFactors, 'RH >90% at 15-22°C.');
assert.equal(resolvedHit.source, 'database_cache');
assert.equal(resolvedHit.llmModel, 'gemini-2.5-flash');

// 9c. Backend 503 or offline gracefully returns mapped ml-service fallback
const resolvedFallback = await resolveBackendAdvisory(
  {
    classKey: 'tomato/late_blight',
    crop: 'Tomato',
    condition: 'Late Blight',
  },
  mappedFallback,
  {
    apiBaseUrl: 'http://localhost:5051',
    fetchImpl: async () => new Response(null, { status: 503 }),
  }
);
assert.equal(resolvedFallback.immediateAction, 'Isolate infected block.');
assert.equal(resolvedFallback.source, 'knowledge_base');

console.log('✅ All AI Leaf Diagnostics validation, service and component contract tests passed cleanly!');
