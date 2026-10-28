import assert from 'node:assert/strict';
import {
  getInitialDrawerFormData,
  formatAreaSummary,
  validateDrawerForm,
  buildDrawerSubmitData,
  handleDrawerSubmit,
  getTodayDateString,
} from '../src/utils/parcelDrawerState.ts';
import { CROPS, SOILS, CROP_PALETTES } from '../src/utils/parcelMetadataPolicy.ts';

let failures = 0;
let tests = 0;

function test(name, run) {
  tests++;
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// Test Suite 1: Initial Data Population
// -----------------------------------------------------------------------------
test('Initial Data: pre-fills existing parcel properties in edit mode', () => {
  const existingProps = {
    name: 'North Potato',
    crop_name: 'Potato',
    soil_profile_name: 'Sandy Loam',
    planting_date: '2026-04-15',
    field_id: 'field-101',
  };

  const formData = getInitialDrawerFormData('edit', existingProps);

  assert.equal(formData.name, 'North Potato');
  assert.equal(formData.cropName, 'Potato');
  assert.equal(formData.cropId, 'crop-potato');
  assert.equal(formData.crop, 'Potato');
  assert.equal(formData.soilProfileName, 'Sandy Loam');
  assert.equal(formData.soilProfileId, 'sandy_loam');
  assert.equal(formData.soil, 'Sandy Loam');
  assert.equal(formData.plantingDate, '2026-04-15');
  assert.equal(formData.fieldId, 'field-101');
});

test('Initial Data: supports camelCase parcel properties in edit mode', () => {
  const camelData = {
    name: 'South Tomato Block',
    cropId: 'crop-tomato',
    cropName: 'Tomato',
    soilProfileId: 'silt',
    soilProfileName: 'Silt',
    plantingDate: '2026-05-01',
    fieldId: 'field-202',
  };

  const formData = getInitialDrawerFormData('edit', camelData);

  assert.equal(formData.name, 'South Tomato Block');
  assert.equal(formData.cropId, 'crop-tomato');
  assert.equal(formData.cropName, 'Tomato');
  assert.equal(formData.crop, 'Tomato');
  assert.equal(formData.soilProfileId, 'silt');
  assert.equal(formData.soilProfileName, 'Silt');
  assert.equal(formData.soil, 'Silt');
  assert.equal(formData.plantingDate, '2026-05-01');
  assert.equal(formData.fieldId, 'field-202');
});

test('Initial Data: provides sensible defaults in create mode when empty', () => {
  const today = getTodayDateString();
  const formData = getInitialDrawerFormData('create', null, 'field-default');

  assert.equal(formData.name, '');
  assert.equal(formData.cropName, 'Tomato');
  assert.equal(formData.cropId, 'crop-tomato');
  assert.equal(formData.crop, 'Tomato');
  assert.equal(formData.soilProfileName, 'Sandy Loam');
  assert.equal(formData.soilProfileId, 'sandy_loam');
  assert.equal(formData.soil, 'Sandy Loam');
  assert.equal(formData.plantingDate, today);
  assert.equal(formData.fieldId, 'field-default');
});

test('Initial Data: respects partial overrides in create mode', () => {
  const partial = {
    name: 'East Corn Field',
    crop: 'Corn (Maize)',
  };

  const formData = getInitialDrawerFormData('create', partial);

  assert.equal(formData.name, 'East Corn Field');
  assert.equal(formData.cropName, 'Corn (Maize)');
  assert.equal(formData.cropId, 'crop-corn');
  assert.equal(formData.crop, 'Corn (Maize)');
  assert.equal(formData.soilProfileName, 'Sandy Loam');
  assert.equal(formData.soilProfileId, 'sandy_loam');
  assert.equal(formData.plantingDate, getTodayDateString());
});

// -----------------------------------------------------------------------------
// Test Suite 2: Area Summary Calculations
// -----------------------------------------------------------------------------
test('Area Summary: formats parcel metrics into required human-readable strings', () => {
  const metrics = {
    areaM2: 24500,
    areaHa: 2.45,
    acres: 6.054,
    perimeterM: 624.2,
    vertexCount: 5,
  };

  const summary = formatAreaSummary(metrics);

  assert.equal(summary.areaText, '2.45 ha (6.05 acres)');
  assert.equal(summary.perimeterText, 'Perimeter: 624 m');
  assert.equal(summary.verticesText, 'Vertices: 5');
});

test('Area Summary: handles null or undefined metrics gracefully with fallbacks', () => {
  const nullSummary = formatAreaSummary(null);

  assert.equal(nullSummary.areaText, '0.00 ha (0.00 acres)');
  assert.equal(nullSummary.perimeterText, 'Perimeter: 0 m');
  assert.equal(nullSummary.verticesText, 'Vertices: 0');

  const undefSummary = formatAreaSummary(undefined);
  assert.equal(undefSummary.areaText, '0.00 ha (0.00 acres)');
  assert.equal(undefSummary.perimeterText, 'Perimeter: 0 m');
  assert.equal(undefSummary.verticesText, 'Vertices: 0');
});

test('Area Summary: rounds area and perimeter cleanly according to standards', () => {
  const metrics = {
    areaM2: 12345.67,
    areaHa: 1.2345,
    acres: 3.0505,
    perimeterM: 456.78,
    vertexCount: 8,
  };

  const summary = formatAreaSummary(metrics);

  assert.equal(summary.areaText, '1.23 ha (3.05 acres)');
  assert.equal(summary.perimeterText, 'Perimeter: 457 m');
  assert.equal(summary.verticesText, 'Vertices: 8');
});

// -----------------------------------------------------------------------------
// Test Suite 3: Validation and Submission Gates
// -----------------------------------------------------------------------------
test('Validation & Gate: validateDrawerForm flags missing required fields', () => {
  const invalidData = {
    name: '',
    cropId: '',
    cropName: '',
    soilProfileId: '',
    soilProfileName: '',
    plantingDate: '',
  };

  const validation = validateDrawerForm(invalidData);
  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.name, 'Parcel name is required');
  assert.ok(validation.errors.cropId || validation.errors.cropName || validation.errors.crop);
  assert.ok(validation.errors.soilProfileId || validation.errors.soilProfileName || validation.errors.soil);
  assert.equal(validation.errors.plantingDate, 'Please provide a valid planting date');
});

test('Validation & Gate: blocks save when required fields are missing', () => {
  const invalidData = {
    name: '   ',
    cropId: '',
    cropName: '',
    crop: '',
    soilProfileId: '',
    soilProfileName: '',
    soil: '',
    plantingDate: '',
  };

  let saved = false;
  const result = handleDrawerSubmit(invalidData, () => {
    saved = true;
  });

  assert.equal(saved, false);
  assert.equal(result.success, false);
  assert.equal(result.errors.name, 'Parcel name is required');
  assert.ok(result.errors.cropId || result.errors.cropName || result.errors.crop);
  assert.ok(result.errors.soilProfileId || result.errors.soilProfileName || result.errors.soil);
  assert.equal(result.errors.plantingDate, 'Please provide a valid planting date');
});

test('Validation & Gate: validates form data and emits valid ParcelFormData on save', () => {
  const validData = {
    name: '   West Apple Orchard   ',
    cropId: 'crop-apple',
    cropName: 'Apple',
    soilProfileId: 'clay',
    soilProfileName: 'Clay',
    plantingDate: '2026-03-20',
    fieldId: 'field-orchard-1',
  };

  let emittedData = null;
  const result = handleDrawerSubmit(validData, (data) => {
    emittedData = data;
  });

  assert.equal(result.success, true);
  assert.ok(emittedData);
  assert.equal(emittedData.name, 'West Apple Orchard');
  assert.equal(emittedData.cropId, 'crop-apple');
  assert.equal(emittedData.cropName, 'Apple');
  assert.equal(emittedData.crop, 'Apple');
  assert.equal(emittedData.soilProfileId, 'clay');
  assert.equal(emittedData.soilProfileName, 'Clay');
  assert.equal(emittedData.soil, 'Clay');
  assert.equal(emittedData.plantingDate, '2026-03-20');
  assert.equal(emittedData.fieldId, 'field-orchard-1');
});

test('Validation & Gate: buildDrawerSubmitData normalizes crop and soil identifiers', () => {
  const data = {
    name: 'East Corn',
    cropId: '',
    cropName: 'Corn (Maize)',
    soilProfileId: '',
    soilProfileName: 'Clay',
    plantingDate: '2026-05-15',
  };

  const normalized = buildDrawerSubmitData(data);

  assert.equal(normalized.name, 'East Corn');
  assert.equal(normalized.cropId, 'crop-corn');
  assert.equal(normalized.cropName, 'Corn (Maize)');
  assert.equal(normalized.crop, 'Corn (Maize)');
  assert.equal(normalized.soilProfileId, 'clay');
  assert.equal(normalized.soilProfileName, 'Clay');
  assert.equal(normalized.soil, 'Clay');
});

// -----------------------------------------------------------------------------
// Test Suite 4: Crop Selector Catalog Integrity
// -----------------------------------------------------------------------------
test('Crop Selector Catalog: contains 4 canonical crops with emoji, family, and colors', () => {
  const expectedCrops = [
    {
      category: 'Tomato',
      emoji: '🍅',
      scientificName: 'Solanum lycopersicum',
      family: 'Solanaceae',
      color: '#10B981',
    },
    {
      category: 'Corn',
      emoji: '🌽',
      scientificName: 'Zea mays',
      family: 'Poaceae',
      color: '#F59E0B',
    },
    {
      category: 'Potato',
      emoji: '🥔',
      scientificName: 'Solanum tuberosum',
      family: 'Solanaceae',
      color: '#8B5CF6',
    },
    {
      category: 'Apple',
      emoji: '🍏',
      scientificName: 'Malus domestica',
      family: 'Rosaceae',
      color: '#EC4899',
    },
  ];

  assert.equal(CROPS.length, 4);

  for (const exp of expectedCrops) {
    const crop = CROPS.find((c) => c.category === exp.category);
    assert.ok(crop, `Crop category ${exp.category} not found in CROPS`);
    assert.equal(crop.emoji, exp.emoji, `Emoji mismatch for ${exp.category}`);
    assert.equal(crop.scientificName, exp.scientificName, `Scientific name mismatch for ${exp.category}`);
    assert.equal(crop.family, exp.family, `Botanical family mismatch for ${exp.category}`);
    assert.equal(crop.palette.stroke.toUpperCase(), exp.color.toUpperCase(), `Stroke color mismatch for ${exp.category}`);
    assert.equal(CROP_PALETTES[exp.category].stroke.toUpperCase(), exp.color.toUpperCase());
  }
});

// -----------------------------------------------------------------------------
// Test Suite 5: Soil Selector Catalog Integrity
// -----------------------------------------------------------------------------
test('Soil Selector Catalog: contains 4 canonical soils with thetaFc and description', () => {
  const expectedSoils = [
    {
      type: 'Sand',
      thetaFc: 0.12,
      descriptionMatch: /low water retention.*drainage/i,
    },
    {
      type: 'Sandy Loam',
      thetaFc: 0.22,
      descriptionMatch: /agronomic balance.*drainage/i,
    },
    {
      type: 'Silt',
      thetaFc: 0.31,
      descriptionMatch: /high moisture retention.*aeration/i,
    },
    {
      type: 'Clay',
      thetaFc: 0.38,
      descriptionMatch: /very high retention.*compaction/i,
    },
  ];

  assert.equal(SOILS.length, 4);

  for (const exp of expectedSoils) {
    const soil = SOILS.find((s) => s.type === exp.type);
    assert.ok(soil, `Soil type ${exp.type} not found in SOILS`);
    assert.equal(soil.thetaFc, exp.thetaFc, `thetaFc mismatch for ${exp.type}`);
    assert.ok(
      exp.descriptionMatch.test(soil.description),
      `Soil description for ${exp.type} does not match expected agronomic note: ${soil.description}`,
    );
  }
});

// -----------------------------------------------------------------------------
test('Initial Data: matches live database UUID crop/soil and non-catalog IDs by readable name', () => {
  const liveDbParcel = {
    crop_id: '6f1c2b1e-0000-4000-8000-000000000001',
    crop_name: 'Tomato',
    soil_profile_id: 'silt_loam',
    soil_profile_name: 'Silt',
    planting_date: '2026-04-15',
    name: 'P1',
  };

  const formData = getInitialDrawerFormData('edit', liveDbParcel);
  assert.equal(formData.cropId, 'crop-tomato');
  assert.equal(formData.cropName, 'Tomato');
  assert.equal(formData.soilProfileId, 'silt');
  assert.equal(formData.soilProfileName, 'Silt');

  let savedData = null;
  const result = handleDrawerSubmit(formData, (data) => {
    savedData = data;
  });
  assert.equal(result.success, true);
  assert.ok(savedData);
  assert.equal(savedData.cropId, 'crop-tomato');
  assert.equal(savedData.soilProfileId, 'silt');
});

test('Initial Data: matches crop_name Corn without Maize suffix through category', () => {
  const cornParcel = {
    crop_name: 'Corn',
    soil_profile_name: 'Clay',
    name: 'Corn Plot',
  };

  const formData = getInitialDrawerFormData('edit', cornParcel);
  assert.equal(formData.cropId, 'crop-corn');
  assert.equal(formData.cropName, 'Corn (Maize)');
});

// Final Report
// -----------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\nFAILED: ${failures} of ${tests} tests failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${tests} parcel drawer tests passed.`);
}

