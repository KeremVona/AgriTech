import assert from 'node:assert/strict';
import {
  resolveParcelFeatureStyle,
  extractParcelCentroidData,
} from '../src/utils/parcelStyling.ts';
import { calculatePolygonCentroid } from '../src/utils/parcelCentroid.ts';
import { CROP_PALETTES, DEFAULT_CROP_PALETTE } from '../src/utils/parcelMetadataPolicy.ts';

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
// Sample Polygons & FeatureCollections
// -----------------------------------------------------------------------------
const squareCoordinates = [
  [
    [35.0, 39.0],
    [35.02, 39.0],
    [35.02, 39.02],
    [35.0, 39.02],
    [35.0, 39.0],
  ],
];

const potatoFeature = {
  type: 'Feature',
  id: 'parcel-potato-1',
  geometry: {
    type: 'Polygon',
    coordinates: squareCoordinates,
  },
  properties: {
    id: 'parcel-potato-1',
    name: 'North Valley Potato Field',
    crop_name: 'Potato',
    crop_id: 'crop-potato',
    soil_profile_name: 'Clay',
    soil_profile_id: 'clay',
    area_hectares: 3.85,
    field_id: 'field-1',
    field_name: 'North Valley',
    planting_date: '2026-04-10',
  },
};

const tomatoFeature = {
  type: 'Feature',
  id: 'parcel-tomato-2',
  geometry: {
    type: 'Polygon',
    coordinates: squareCoordinates,
  },
  properties: {
    id: 'parcel-tomato-2',
    name: 'Greenhouse Block B',
    crop_name: 'Tomato',
    crop_id: 'crop-tomato',
    soil_profile_name: 'Sandy Loam',
    soil_profile_id: 'sandy_loam',
    area_hectares: 1.25,
    field_id: 'field-2',
    field_name: 'South Plain',
    planting_date: '2026-05-01',
  },
};

const unassignedFeature = {
  type: 'Feature',
  id: 'parcel-unassigned-3',
  geometry: {
    type: 'Polygon',
    coordinates: squareCoordinates,
  },
  properties: {
    id: 'parcel-unassigned-3',
    name: 'Plot 3 East',
    crop_name: null,
    crop_id: null,
    soil_profile_name: null,
    soil_profile_id: null,
    area_hectares: 0.95,
    field_id: null,
    field_name: null,
    planting_date: null,
  },
};

const sampleCollection = {
  type: 'FeatureCollection',
  features: [potatoFeature, tomatoFeature, unassignedFeature],
};

// -----------------------------------------------------------------------------
// 1. Feature Styling Resolution Tests
// -----------------------------------------------------------------------------
test('resolveParcelFeatureStyle maps properties.crop_name ("Potato") to stroke #8B5CF6, fill rgba(139, 92, 246, 0.18)', () => {
  const style = resolveParcelFeatureStyle(potatoFeature, false);
  assert.equal(style.color, '#8B5CF6');
  assert.equal(style.stroke, '#8B5CF6');
  assert.equal(style.fillColor, 'rgba(139, 92, 246, 0.18)');
  assert.equal(style.fill, 'rgba(139, 92, 246, 0.18)');
  assert.equal(style.weight, 2);
  assert.ok(style.className.includes('ag-parcel-polygon'));
  assert.ok(!style.className.includes('ag-parcel-polygon-selected'));
});

test('resolveParcelFeatureStyle selected state increases stroke weight to 3px and applies selected stroke hex', () => {
  // Via boolean flag
  const selectedStyleBool = resolveParcelFeatureStyle(potatoFeature, true);
  assert.equal(selectedStyleBool.weight, 3);
  assert.equal(selectedStyleBool.color, '#6D28D9');
  assert.equal(selectedStyleBool.stroke, '#6D28D9');
  assert.ok(selectedStyleBool.className.includes('ag-parcel-polygon-selected'));

  // Via matching selectedParcelId
  const selectedStyleId = resolveParcelFeatureStyle(potatoFeature, 'parcel-potato-1');
  assert.equal(selectedStyleId.weight, 3);
  assert.equal(selectedStyleId.color, '#6D28D9');
  assert.ok(selectedStyleId.className.includes('ag-parcel-polygon-selected'));

  // Non-matching selectedParcelId stays normal weight 2
  const unselectedStyle = resolveParcelFeatureStyle(potatoFeature, 'parcel-other');
  assert.equal(unselectedStyle.weight, 2);
  assert.equal(unselectedStyle.color, '#8B5CF6');
  assert.ok(!unselectedStyle.className.includes('ag-parcel-polygon-selected'));
});

test('resolveParcelFeatureStyle maps Tomato, Corn, and Apple palettes correctly', () => {
  const cornFeature = {
    type: 'Feature',
    id: 'c1',
    properties: { crop_name: 'Corn' },
    geometry: { type: 'Polygon', coordinates: squareCoordinates },
  };
  const appleFeature = {
    type: 'Feature',
    id: 'a1',
    properties: { crop_name: 'Apple' },
    geometry: { type: 'Polygon', coordinates: squareCoordinates },
  };

  const tomatoStyle = resolveParcelFeatureStyle(tomatoFeature, false);
  assert.equal(tomatoStyle.color, CROP_PALETTES.Tomato.stroke);
  assert.equal(tomatoStyle.fillColor, CROP_PALETTES.Tomato.fill);

  const cornSelected = resolveParcelFeatureStyle(cornFeature, true);
  assert.equal(cornSelected.color, CROP_PALETTES.Corn.selected);
  assert.equal(cornSelected.weight, 3);

  const appleSelected = resolveParcelFeatureStyle(appleFeature, true);
  assert.equal(appleSelected.color, CROP_PALETTES.Apple.selected);
  assert.equal(appleSelected.weight, 3);
});

test('resolveParcelFeatureStyle handles features with null or unassigned properties with default Bio-Teal tokens', () => {
  const unassignedStyle = resolveParcelFeatureStyle(unassignedFeature, false);
  assert.equal(unassignedStyle.color, DEFAULT_CROP_PALETTE.stroke);
  assert.equal(unassignedStyle.fillColor, DEFAULT_CROP_PALETTE.fill);
  assert.equal(unassignedStyle.weight, 2);

  const unassignedSelected = resolveParcelFeatureStyle(unassignedFeature, true);
  assert.equal(unassignedSelected.color, DEFAULT_CROP_PALETTE.selected);
  assert.equal(unassignedSelected.weight, 3);
});

test('resolveParcelFeatureStyle handles null or undefined feature gracefully', () => {
  const nullStyle = resolveParcelFeatureStyle(null, false);
  assert.equal(nullStyle.color, DEFAULT_CROP_PALETTE.stroke);
  assert.equal(nullStyle.fillColor, DEFAULT_CROP_PALETTE.fill);
  assert.equal(nullStyle.weight, 2);

  const undefinedStyle = resolveParcelFeatureStyle(undefined, true);
  assert.equal(undefinedStyle.color, DEFAULT_CROP_PALETTE.selected);
  assert.equal(undefinedStyle.weight, 3);
});

// -----------------------------------------------------------------------------
// 2. Centroid Badge Extraction Tests
// -----------------------------------------------------------------------------
test('extractParcelCentroidData accurately pairs each feature in FeatureCollection with { lat, lng, name, crop, areaHa, soil }', () => {
  const items = extractParcelCentroidData(sampleCollection);
  assert.equal(items.length, 3);

  const potato = items[0];
  assert.equal(potato.name, 'North Valley Potato Field');
  assert.equal(potato.crop, 'Potato');
  assert.equal(potato.areaHa, 3.85);
  assert.equal(potato.soil, 'Clay');
  assert.equal(typeof potato.lat, 'number');
  assert.equal(typeof potato.lng, 'number');

  const tomato = items[1];
  assert.equal(tomato.name, 'Greenhouse Block B');
  assert.equal(tomato.crop, 'Tomato');
  assert.equal(tomato.areaHa, 1.25);
  assert.equal(tomato.soil, 'Sandy Loam');

  const unassigned = items[2];
  assert.equal(unassigned.name, 'Plot 3 East');
  assert.equal(unassigned.crop, 'Unassigned');
  assert.equal(unassigned.areaHa, 0.95);
  assert.equal(unassigned.soil, 'Unspecified');
});

test('extractParcelCentroidData matches calculatePolygonCentroid calculation', () => {
  const items = extractParcelCentroidData(sampleCollection);
  const expectedCentroid = calculatePolygonCentroid(squareCoordinates);

  assert.equal(items[0].lat, expectedCentroid.lat);
  assert.equal(items[0].lng, expectedCentroid.lng);
});

test('extractParcelCentroidData handles empty and null inputs safely', () => {
  assert.deepEqual(extractParcelCentroidData(null), []);
  assert.deepEqual(extractParcelCentroidData(undefined), []);
  assert.deepEqual(extractParcelCentroidData({ type: 'FeatureCollection', features: [] }), []);
  assert.deepEqual(extractParcelCentroidData([]), []);
});

test('extractParcelCentroidData supports MultiPolygon geometry', () => {
  const multiPolygonFeature = {
    type: 'Feature',
    id: 'multi-1',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [squareCoordinates],
    },
    properties: {
      id: 'multi-1',
      name: 'Divided Parcel',
      crop_name: 'Corn',
      area_hectares: 5.0,
      soil_profile_name: 'Silt',
    },
  };

  const items = extractParcelCentroidData([multiPolygonFeature]);
  assert.equal(items.length, 1);
  assert.equal(items[0].crop, 'Corn');
  assert.equal(items[0].soil, 'Silt');
  assert.equal(items[0].areaHa, 5.0);
  assert.equal(typeof items[0].lat, 'number');
  assert.equal(typeof items[0].lng, 'number');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log(`\nRan ${tests} tests: ${tests - failures} passed, ${failures} failed.`);
if (failures > 0) {
  process.exit(1);
}
