import assert from 'node:assert/strict';
import {
  CROP_PALETTES,
  CROPS,
  SOILS,
  calculateDap,
  validateParcelForm,
  resolveCropPalette,
  buildParcelCreatePayload,
} from '../src/utils/parcelMetadataPolicy.ts';
import {
  calculatePolygonCentroid,
} from '../src/utils/parcelCentroid.ts';

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
// 1. calculateDap tests
// -----------------------------------------------------------------------------
test('calculateDap handles future date as Pre-Planting with negative days', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  const result = calculateDap('2026-06-01', refDate);
  assert.deepEqual(result, {
    days: -5,
    stage: 'Pre-Planting',
    formatted: 'Upcoming (In 5 days)',
  });
});

test('calculateDap handles 10 days ago as Early / Germination', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  const result = calculateDap('2026-05-17', refDate);
  assert.deepEqual(result, {
    days: 10,
    stage: 'Early / Germination',
    formatted: 'DAP: 10 Days (Early / Germination)',
  });
});

test('calculateDap handles 42 days ago as Development Stage', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  const result = calculateDap('2026-04-15', refDate);
  assert.deepEqual(result, {
    days: 42,
    stage: 'Development Stage',
    formatted: 'DAP: 42 Days (Development Stage)',
  });
});

test('calculateDap handles 75 days ago as Mid-Season / Flowering', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  // 75 days before May 27 2026 is March 13 2026
  const result = calculateDap('2026-03-13', refDate);
  assert.deepEqual(result, {
    days: 75,
    stage: 'Mid-Season / Flowering',
    formatted: 'DAP: 75 Days (Mid-Season / Flowering)',
  });
});

test('calculateDap handles 120 days ago as Late / Maturity', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  // 120 days before May 27 2026 is Jan 27 2026
  const result = calculateDap('2026-01-27', refDate);
  assert.deepEqual(result, {
    days: 120,
    stage: 'Late / Maturity',
    formatted: 'DAP: 120 Days (Late / Maturity)',
  });
});

test('calculateDap validates exact growth stage threshold boundaries', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');

  // Day 20 (Early / Germination) vs Day 21 (Development Stage)
  const day20 = calculateDap('2026-05-07', refDate);
  assert.equal(day20.days, 20);
  assert.equal(day20.stage, 'Early / Germination');

  const day21 = calculateDap('2026-05-06', refDate);
  assert.equal(day21.days, 21);
  assert.equal(day21.stage, 'Development Stage');

  // Day 60 (Development Stage) vs Day 61 (Mid-Season / Flowering)
  const day60 = calculateDap('2026-03-28', refDate);
  assert.equal(day60.days, 60);
  assert.equal(day60.stage, 'Development Stage');

  const day61 = calculateDap('2026-03-27', refDate);
  assert.equal(day61.days, 61);
  assert.equal(day61.stage, 'Mid-Season / Flowering');

  // Day 90 (Mid-Season / Flowering) vs Day 91 (Late / Maturity)
  const day90 = calculateDap('2026-02-26', refDate);
  assert.equal(day90.days, 90);
  assert.equal(day90.stage, 'Mid-Season / Flowering');

  const day91 = calculateDap('2026-02-25', refDate);
  assert.equal(day91.days, 91);
  assert.equal(day91.stage, 'Late / Maturity');
});

test('calculateDap returns Date required for invalid, malformed or empty date strings', () => {
  const refDate = new Date('2026-05-27T00:00:00Z');
  assert.deepEqual(calculateDap('', refDate), {
    days: 0,
    stage: 'Unknown',
    formatted: 'Date required',
  });
  assert.deepEqual(calculateDap('invalid-date', refDate), {
    days: 0,
    stage: 'Unknown',
    formatted: 'Date required',
  });
  assert.deepEqual(calculateDap(null, refDate), {
    days: 0,
    stage: 'Unknown',
    formatted: 'Date required',
  });
  assert.deepEqual(calculateDap(undefined, refDate), {
    days: 0,
    stage: 'Unknown',
    formatted: 'Date required',
  });
});

// -----------------------------------------------------------------------------
// 2. resolveCropPalette tests
// -----------------------------------------------------------------------------
test('resolveCropPalette maps Tomato to emerald palette', () => {
  const palette = resolveCropPalette('Tomato');
  assert.equal(palette.stroke, '#10B981');
  assert.equal(palette.fill, 'rgba(16, 185, 129, 0.18)');
  assert.equal(palette.selected, '#047857');
});

test('resolveCropPalette maps Corn or Zea mays to amber palette', () => {
  const cornPalette = resolveCropPalette('Corn');
  assert.equal(cornPalette.stroke, '#F59E0B');
  assert.equal(cornPalette.fill, 'rgba(245, 158, 11, 0.18)');
  assert.equal(cornPalette.selected, '#B45309');

  const maizePalette = resolveCropPalette('Corn (Maize)');
  assert.equal(maizePalette.stroke, '#F59E0B');

  const zeaPalette = resolveCropPalette('Zea mays');
  assert.equal(zeaPalette.stroke, '#F59E0B');
  assert.equal(zeaPalette.fill, 'rgba(245, 158, 11, 0.18)');
  assert.equal(zeaPalette.selected, '#B45309');
});

test('resolveCropPalette maps Potato to violet palette', () => {
  const palette = resolveCropPalette('Potato');
  assert.equal(palette.stroke, '#8B5CF6');
  assert.equal(palette.fill, 'rgba(139, 92, 246, 0.18)');
  assert.equal(palette.selected, '#6D28D9');

  const scientific = resolveCropPalette('Solanum tuberosum');
  assert.equal(scientific.stroke, '#8B5CF6');
});

test('resolveCropPalette maps Apple to pink palette', () => {
  const palette = resolveCropPalette('Apple');
  assert.equal(palette.stroke, '#EC4899');
  assert.equal(palette.fill, 'rgba(236, 72, 153, 0.18)');
  assert.equal(palette.selected, '#BE185D');

  const scientific = resolveCropPalette('Malus domestica');
  assert.equal(scientific.stroke, '#EC4899');
});

test('resolveCropPalette falls back to Bio-Teal palette for null, undefined or unknown crop', () => {
  const fallbackNull = resolveCropPalette(null);
  assert.equal(fallbackNull.stroke, '#0F766E');
  assert.equal(fallbackNull.fill, 'rgba(15, 118, 110, 0.18)');

  const fallbackUndef = resolveCropPalette(undefined);
  assert.equal(fallbackUndef.stroke, '#0F766E');
  assert.equal(fallbackUndef.fill, 'rgba(15, 118, 110, 0.18)');

  const fallbackUnknown = resolveCropPalette('Dragonfruit');
  assert.equal(fallbackUnknown.stroke, '#0F766E');
  assert.equal(fallbackUnknown.fill, 'rgba(15, 118, 110, 0.18)');
});

// -----------------------------------------------------------------------------
// 3. validateParcelForm tests
// -----------------------------------------------------------------------------
test('validateParcelForm passes valid parcel metadata data', () => {
  const validData = {
    name: 'Parcel 04 - East Valley Corn',
    cropId: 'crop-corn',
    cropName: 'Corn (Maize)',
    soilProfileId: 'sandy_loam',
    soilProfileName: 'Sandy Loam',
    plantingDate: '2026-04-15',
  };
  const result = validateParcelForm(validData);
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test('validateParcelForm rejects blank or whitespace-only name', () => {
  const res1 = validateParcelForm({
    name: '',
    cropId: 'crop-tomato',
    cropName: 'Tomato',
    soilProfileId: 'sand',
    soilProfileName: 'Sand',
    plantingDate: '2026-05-01',
  });
  assert.equal(res1.isValid, false);
  assert.equal(res1.errors.name, 'Parcel name is required');

  const res2 = validateParcelForm({
    name: '   ',
    cropId: 'crop-tomato',
    cropName: 'Tomato',
    soilProfileId: 'sand',
    soilProfileName: 'Sand',
    plantingDate: '2026-05-01',
  });
  assert.equal(res2.isValid, false);
  assert.equal(res2.errors.name, 'Parcel name is required');
});

test('validateParcelForm rejects invalid or missing crop', () => {
  const res = validateParcelForm({
    name: 'Field North',
    cropId: 'invalid-crop',
    cropName: 'Unknown Species',
    soilProfileId: 'sand',
    soilProfileName: 'Sand',
    plantingDate: '2026-05-01',
  });
  assert.equal(res.isValid, false);
  assert.equal(res.errors.cropId, 'Please select a valid crop');
});

test('validateParcelForm rejects invalid or missing soil profile', () => {
  const res = validateParcelForm({
    name: 'Field North',
    cropId: 'crop-potato',
    cropName: 'Potato',
    soilProfileId: 'moon_dust',
    soilProfileName: 'Moon Dust',
    plantingDate: '2026-05-01',
  });
  assert.equal(res.isValid, false);
  assert.equal(res.errors.soilProfileId, 'Please select a valid soil profile');
});

test('validateParcelForm rejects invalid planting date', () => {
  const res = validateParcelForm({
    name: 'Field North',
    cropId: 'crop-apple',
    cropName: 'Apple',
    soilProfileId: 'silt',
    soilProfileName: 'Silt',
    plantingDate: 'not-a-date',
  });
  assert.equal(res.isValid, false);
  assert.equal(res.errors.plantingDate, 'Please provide a valid planting date');
});

// -----------------------------------------------------------------------------
// 4. calculatePolygonCentroid tests
// -----------------------------------------------------------------------------
test('calculatePolygonCentroid computes accurate center for symmetrical rectangle', () => {
  const rect = [
    [27.14, 38.42],
    [27.16, 38.42],
    [27.16, 38.44],
    [27.14, 38.44],
    [27.14, 38.42],
  ];
  const centroid = calculatePolygonCentroid(rect);
  assert.deepEqual(centroid, { lng: 27.15, lat: 38.43 });
});

test('calculatePolygonCentroid handles nested GeoJSON polygon coordinate arrays', () => {
  const nested = [
    [
      [27.14, 38.42],
      [27.16, 38.42],
      [27.16, 38.44],
      [27.14, 38.44],
      [27.14, 38.42],
    ],
  ];
  const centroid = calculatePolygonCentroid(nested);
  assert.deepEqual(centroid, { lng: 27.15, lat: 38.43 });
});

test('calculatePolygonCentroid computes accurate triangle center of mass matching signed area', () => {
  const triangle = [
    [0, 0],
    [6, 0],
    [0, 6],
    [0, 0],
  ];
  const centroid = calculatePolygonCentroid(triangle);
  assert.deepEqual(centroid, { lng: 2, lat: 2 });
});

test('calculatePolygonCentroid handles unclosed polygon rings cleanly', () => {
  const unclosed = [
    [0, 0],
    [6, 0],
    [0, 6],
  ];
  const centroid = calculatePolygonCentroid(unclosed);
  assert.deepEqual(centroid, { lng: 2, lat: 2 });
});

test('calculatePolygonCentroid safely falls back to coordinate mean for collinear points or single vertex', () => {
  // Single vertex
  const single = [[27.15, 38.43]];
  assert.deepEqual(calculatePolygonCentroid(single), { lng: 27.15, lat: 38.43 });

  // Collinear points (zero polygon area)
  const collinear = [
    [10, 20],
    [20, 20],
    [30, 20],
  ];
  assert.deepEqual(calculatePolygonCentroid(collinear), { lng: 20, lat: 20 });

  // Empty coordinates
  assert.deepEqual(calculatePolygonCentroid([]), { lng: 0, lat: 0 });

  // Malformed nested empty arrays
  assert.deepEqual(calculatePolygonCentroid([[]]), { lng: 0, lat: 0 });
  assert.deepEqual(calculatePolygonCentroid([[[]]]), { lng: 0, lat: 0 });
});

// -----------------------------------------------------------------------------
// 5. buildParcelCreatePayload tests
// -----------------------------------------------------------------------------
test('buildParcelCreatePayload produces RFC 7946 compliant parcel creation DTO', () => {
  const formData = {
    name: 'P-04 - North Field Potato',
    cropId: 'crop-potato',
    cropName: 'Potato',
    soilProfileId: 'sandy_loam',
    soilProfileName: 'Sandy Loam',
    plantingDate: '2026-04-15',
    fieldId: 'field-1234',
  };
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [27.14, 38.42],
        [27.16, 38.42],
        [27.16, 38.44],
        [27.14, 38.44],
        [27.14, 38.42],
      ],
    ],
  };

  const payload = buildParcelCreatePayload(formData, geometry);

  assert.deepEqual(Object.keys(payload).sort(), [
    'crop_type',
    'field_id',
    'geometry',
    'name',
    'planting_date',
    'soil_type',
  ]);
  assert.equal(payload.field_id, 'field-1234');
  assert.equal(payload.name, 'P-04 - North Field Potato');
  assert.equal(payload.crop_type, 'Potato');
  assert.equal(payload.soil_type, 'Sandy Loam');
  assert.equal(payload.planting_date, '2026-04-15');
  assert.deepEqual(payload.geometry, geometry);
});

test('buildParcelCreatePayload resolves shorthand crop and soil fields', () => {
  const shorthandData = {
    name: 'Shorthand Parcel',
    crop: 'Tomato',
    soil: 'Sandy Loam',
    plantingDate: '2026-05-01',
    fieldId: 'field-5678',
  };
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [27.14, 38.42],
        [27.16, 38.42],
        [27.16, 38.44],
        [27.14, 38.44],
        [27.14, 38.42],
      ],
    ],
  };
  const payload = buildParcelCreatePayload(shorthandData, geometry);
  assert.deepEqual(Object.keys(payload).sort(), [
    'crop_type',
    'field_id',
    'geometry',
    'name',
    'planting_date',
    'soil_type',
  ]);
  assert.equal(payload.name, 'Shorthand Parcel');
  assert.equal(payload.crop_type, 'Tomato');
  assert.equal(payload.soil_type, 'Sandy Loam');
});

// -----------------------------------------------------------------------------
// 6. Constants integrity tests (CROPS, SOILS, CROP_PALETTES)
// -----------------------------------------------------------------------------
test('CROP_PALETTES contains valid color definitions for all 4 canonical crops', () => {
  const crops = ['Tomato', 'Corn', 'Potato', 'Apple'];
  for (const crop of crops) {
    assert.ok(CROP_PALETTES[crop], `Missing palette for ${crop}`);
    assert.ok(CROP_PALETTES[crop].stroke.startsWith('#'), `${crop} stroke must be hex`);
    assert.ok(CROP_PALETTES[crop].fill.startsWith('rgba'), `${crop} fill must be rgba`);
    assert.ok(CROP_PALETTES[crop].selected.startsWith('#'), `${crop} selected must be hex`);
  }
});

test('CROPS catalog contains all 4 canonical crops with emoji, family and palette', () => {
  assert.equal(CROPS.length, 4);
  const categories = CROPS.map((c) => c.category);
  assert.ok(categories.includes('Tomato'));
  assert.ok(categories.includes('Corn'));
  assert.ok(categories.includes('Potato'));
  assert.ok(categories.includes('Apple'));

  for (const crop of CROPS) {
    assert.ok(crop.id);
    assert.ok(crop.name);
    assert.ok(crop.scientificName);
    assert.ok(crop.family);
    assert.ok(crop.emoji);
    assert.ok(crop.palette);
  }
});

test('SOILS catalog contains all 4 canonical soils with theta_fc and description', () => {
  assert.equal(SOILS.length, 4);
  const types = SOILS.map((s) => s.type);
  assert.ok(types.includes('Sand'));
  assert.ok(types.includes('Sandy Loam'));
  assert.ok(types.includes('Silt'));
  assert.ok(types.includes('Clay'));

  for (const soil of SOILS) {
    assert.ok(soil.id);
    assert.ok(soil.name);
    assert.ok(typeof soil.thetaFc === 'number' && soil.thetaFc > 0);
    assert.ok(soil.description.length > 5);
  }
});

assert.equal(failures, 0, `${failures} of ${tests} parcel metadata tests failed`);
console.log(`All ${tests} parcel metadata tests passed.`);
