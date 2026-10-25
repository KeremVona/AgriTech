import assert from 'node:assert/strict';
import { getParcelBounds, parseParcelCollection } from '../src/utils/farmMapGeometry.ts';

const rectangle = [[28.9, 40.9], [29, 40.9], [29, 41], [28.9, 41], [28.9, 40.9]];
const feature = (geometry = { type: 'Polygon', coordinates: [rectangle] }, properties = { id: 'parcel-1' }) => ({
  type: 'Feature', properties, geometry,
});
const collection = (...features) => ({ type: 'FeatureCollection', features });
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

test('converts longitude/latitude extents to Leaflet latitude/longitude bounds', () => {
  assert.deepEqual(getParcelBounds(parseParcelCollection(collection(feature()))), [[40.9, 28.9], [41, 29]]);
});
test('includes zero and negative coordinates', () => {
  const ring = [[-1, -2], [0, -2], [0, 0], [-1, 0], [-1, -2]];
  assert.deepEqual(getParcelBounds(parseParcelCollection(collection(feature({ type: 'Polygon', coordinates: [ring] })))), [[-2, -1], [0, 0]]);
});
test('preserves holes without changing polygon extents', () => {
  const hole = [[28.92, 40.92], [28.92, 40.98], [28.98, 40.98], [28.98, 40.92], [28.92, 40.92]];
  const parsed = parseParcelCollection(collection(feature({ type: 'Polygon', coordinates: [rectangle, hole] })));
  assert.deepEqual(parsed.features[0].geometry.coordinates, [rectangle, hole]);
  assert.deepEqual(getParcelBounds(parsed), [[40.9, 28.9], [41, 29]]);
});
test('combines all parcels and every MultiPolygon component', () => {
  const west = [[-5, 1], [-4, 1], [-4, 2], [-5, 2], [-5, 1]];
  const south = [[2, -8], [3, -8], [3, -7], [2, -7], [2, -8]];
  const multi = feature({ type: 'MultiPolygon', coordinates: [[west], [south]] }, { id: 'parcel-2' });
  assert.deepEqual(getParcelBounds(parseParcelCollection(collection(feature(), multi))), [[-8, -5], [41, 29]]);
});
test('accepts an empty collection and returns no bounds', () => {
  const parsed = parseParcelCollection(collection());
  assert.deepEqual(parsed, collection());
  assert.equal(getParcelBounds(parsed), null);
});
test('ignores optional server bbox when framing coordinates', () => {
  const input = collection(feature());
  input.bbox = [-180, -90, 180, 90];
  input.features[0].bbox = [-180, -90, 180, 90];
  assert.deepEqual(getParcelBounds(parseParcelCollection(input)), [[40.9, 28.9], [41, 29]]);
});
test('fills absent metadata with null and uses an honest unnamed label', () => {
  assert.deepEqual(parseParcelCollection(collection(feature())).features[0].properties, {
    id: 'parcel-1', name: 'Unnamed parcel', field_id: null, field_name: null,
    crop_id: null, crop_name: null, soil_profile_id: null, soil_profile_name: null,
    area_hectares: null, planting_date: null,
  });
});
test('preserves canonical snake_case metadata and zero area without inventing values', () => {
  const properties = {
    id: 'parcel-1', name: 'North', field_id: 'field-1', field_name: 'Farm',
    crop_id: 'crop-1', crop_name: 'Wheat', soil_profile_id: 'soil-1', soil_profile_name: 'Loam',
    area_hectares: 0, planting_date: '2026-10-01',
  };
  assert.deepEqual(parseParcelCollection(collection(feature(undefined, properties))).features[0].properties, properties);
});
test('uses feature-level string and numeric IDs as fallback', () => {
  for (const id of ['feature-id', 0]) {
    const item = { ...feature(undefined, null), id };
    assert.equal(parseParcelCollection(collection(item)).features[0].properties?.id, String(id));
  }
});
test('prefers properties.id over feature-level ID', () => {
  const item = { ...feature(), id: 'other-id' };
  assert.equal(parseParcelCollection(collection(item)).features[0].properties.id, 'parcel-1');
});
test('does not mutate the input while normalizing metadata', () => {
  const input = collection(feature());
  const before = structuredClone(input);
  parseParcelCollection(input);
  assert.deepEqual(input, before);
});
test('accepts valid altitude positions and WGS84 boundary coordinates', () => {
  const ring = [[-180, -90, 0], [180, -90, 1], [180, 90, 2], [-180, 90, 3], [-180, -90, 0]];
  const parsed = parseParcelCollection(collection(feature({ type: 'Polygon', coordinates: [ring] })));
  assert.deepEqual(getParcelBounds(parsed), [[-90, -180], [90, 180]]);
});

for (const [name, value] of [
  ['null collection', null],
  ['wrong collection type', { type: 'Feature', features: [] }],
  ['missing features', { type: 'FeatureCollection' }],
  ['nonarray features', { type: 'FeatureCollection', features: {} }],
  ['null feature', collection(null)],
  ['non-Feature item', collection({ ...feature(), type: 'Polygon' })],
  ['null geometry', collection(feature(null))],
  ['point geometry', collection(feature({ type: 'Point', coordinates: [29, 41] }))],
  ['missing parcel ID', collection(feature(undefined, {}))],
  ['blank parcel ID', collection(feature(undefined, { id: ' ' }))],
  ['invalid properties', collection(feature(undefined, []))],
  ['nonstring parcel name', collection(feature(undefined, { id: 'parcel-1', name: 12 }))],
  ['invalid field metadata', collection(feature(undefined, { id: 'parcel-1', field_id: 3 }))],
  ['invalid area metadata', collection(feature(undefined, { id: 'parcel-1', area_hectares: '2' }))],
  ['nonfinite area', collection(feature(undefined, { id: 'parcel-1', area_hectares: NaN }))],
]) {
  test(`rejects ${name}`, () => assert.throws(() => parseParcelCollection(value), /parcel|GeoJSON|FeatureCollection/i));
}

for (const [name, coordinates] of [
  ['missing coordinates', undefined],
  ['empty polygon', []],
  ['empty ring', [[]]],
  ['too-short ring', [[[0, 0], [1, 0], [0, 0]]]],
  ['unclosed ring', [[[0, 0], [1, 0], [1, 1], [0, 1]]]],
  ['flat polygon nesting', rectangle],
  ['extra polygon nesting', [[rectangle]]],
  ['null position', [[null, ...rectangle.slice(1)]]],
  ['one-dimensional position', [[[28.9], ...rectangle.slice(1)]]],
  ['nonnumeric position', [[['28.9', 40.9], ...rectangle.slice(1)]]],
  ['NaN longitude', [[[NaN, 40.9], ...rectangle.slice(1)]]],
  ['infinite latitude', [[[28.9, Infinity], ...rectangle.slice(1)]]],
  ['nonfinite altitude', [[[28.9, 40.9, Infinity], ...rectangle.slice(1)]]],
  ['longitude above 180', [[[181, 40.9], ...rectangle.slice(1)]]],
  ['longitude below -180', [[[-181, 40.9], ...rectangle.slice(1)]]],
  ['latitude above 90', [[[28.9, 91], ...rectangle.slice(1)]]],
  ['latitude below -90', [[[28.9, -91], ...rectangle.slice(1)]]],
  ['invalid hole', [rectangle, [[28.92, 40.92]]]],
]) {
  test(`rejects ${name}`, () => assert.throws(() => parseParcelCollection(collection(feature({ type: 'Polygon', coordinates }))), /parcel|coordinate|ring/i));
}
for (const [name, coordinates] of [
  ['empty MultiPolygon', []],
  ['empty MultiPolygon component', [[]]],
  ['missing MultiPolygon nesting', [rectangle]],
  ['malformed later MultiPolygon component', [[rectangle], [null]]],
]) {
  test(`rejects ${name}`, () => assert.throws(() => parseParcelCollection(collection(feature({ type: 'MultiPolygon', coordinates }))), /parcel|coordinate|ring/i));
}

assert.equal(failures, 0, `${failures} of ${tests} farm map data tests failed`);
console.log(`All ${tests} farm map data tests passed.`);
