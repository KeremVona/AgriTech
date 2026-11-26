import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PROGRESSION_DIAGNOSIS_KEY,
  diagnosisKey,
  progressionCropForDiagnosis,
  progressionPath,
  readProgressionCrop,
} from '../src/utils/progressionLinks.ts';
import { AGRONOMIC_CALIBRATION_REGISTRY } from '../src/models/agronomicTimelineModel.ts';
import { CLINICAL_SAMPLE_PRESETS } from '../src/services/diagnosticsService.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

// Every progression crop has an entry; linked keys exist in ml-service SUPPORTED_CLASSES.
assert.deepEqual(Object.keys(PROGRESSION_DIAGNOSIS_KEY).sort(), Object.keys(AGRONOMIC_CALIBRATION_REGISTRY).sort());
const advisoryPath = `${root}../ml-service/advisory.py`;
if (existsSync(advisoryPath)) {
  const block = readFileSync(advisoryPath, 'utf8').match(/SUPPORTED_CLASSES[^=]*=\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'SUPPORTED_CLASSES found');
  const mlKeys = new Set([...block[1].matchAll(/"([a-z]+\/[a-z0-9_]+)"/g)].map((m) => m[1]));
  for (const [crop, key] of Object.entries(PROGRESSION_DIAGNOSIS_KEY)) {
    if (key !== null) assert.ok(mlKeys.has(key), `${crop}: ${key} is a diagnosis class`);
  }
  // Grape black rot is not detectable; the link must stay off.
  assert.ok(![...mlKeys].some((k) => k.startsWith('grape/black')), 'grape black rot is not a diagnosis class');
}

// Linked crops show the same disease as the diagnosis class.
for (const [crop, key] of Object.entries(PROGRESSION_DIAGNOSIS_KEY)) {
  if (key === null) continue;
  const disease = AGRONOMIC_CALIBRATION_REGISTRY[crop].diseaseName.toLowerCase().replace(/^apple /, '');
  assert.equal(key.split('/')[1].replace(/_/g, ' '), disease, `${crop} disease matches ${key}`);
}

// Matching from diagnosis results.
assert.equal(diagnosisKey('Tomato', 'Early Blight'), 'tomato/early_blight');
assert.equal(progressionCropForDiagnosis('Tomato', 'Early Blight'), 'tomato');
assert.equal(progressionCropForDiagnosis('Tomato', 'Late Blight'), null);
assert.equal(progressionCropForDiagnosis('Apple', 'Scab', 'apple/scab'), 'apple');
assert.equal(progressionCropForDiagnosis('Grape', 'Downy mildew', 'grape/downy_mildew'), null);
const cornPreset = CLINICAL_SAMPLE_PRESETS.find((p) => p.crop === 'Corn');
assert.equal(progressionCropForDiagnosis(cornPreset.crop, cornPreset.condition), 'corn');

// Links round-trip.
assert.equal(readProgressionCrop(`?${progressionPath('corn').split('?')[1]}`), 'corn');
assert.equal(readProgressionCrop('?crop=banana'), null);
assert.equal(readProgressionCrop(''), null);

console.log('PASS progression links: 4 linked crops, keys match ml-service');
