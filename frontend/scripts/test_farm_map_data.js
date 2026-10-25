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

async function testAsync(name, run) {
  tests++;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const { loadParcelMapData } = await import('../src/services/farmMapService.ts');
const options = { apiBaseUrl: 'http://localhost:5051/', parcelsPath: '/api/v1/spatial/geojson/parcels', mode: 'auto' };
const response = (body = collection(feature()), status = 200) => new Response(JSON.stringify(body), { status });
const load = (fetchImpl, extra = {}) => loadParcelMapData({ ...options, fetchImpl, ...extra });

await testAsync('loads live parcels and canonical metadata from the configured endpoint', async () => {
  const data = await load(async (url, init) => {
    assert.equal(url, 'http://localhost:5051/api/v1/spatial/geojson/parcels');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.headers.Accept, 'application/geo+json, application/json');
    return response();
  });
  assert.equal(data.source, 'api');
  assert.equal(data.fallbackReason, null);
  assert.equal(data.collection.features[0].properties.id, 'parcel-1');
  assert.equal(data.collection.features[0].properties.crop_name, null);
});
await testAsync('keeps successful empty data live in auto mode', async () => {
  assert.deepEqual(await load(async () => response(collection())), {
    source: 'api', fallbackReason: null, collection: collection(),
  });
});
await testAsync('sample mode makes no request and returns two adjacent fictional parcels', async () => {
  const data = await load(() => assert.fail('sample mode must not fetch'), { mode: 'sample' });
  assert.equal(data.source, 'sample');
  assert.equal(data.fallbackReason, null);
  assert.equal(data.collection.features.length, 2);
  const [west, east] = data.collection.features;
  assert.match(west.properties.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(west.properties.id, east.properties.id);
  assert.equal(west.properties.field_name, 'Fictional Konya Demo Farm');
  assert.equal(west.properties.field_id, east.properties.field_id);
  assert.equal(west.geometry.coordinates[0][1][0], east.geometry.coordinates[0][0][0]);
  assert.deepEqual(parseParcelCollection(data.collection), data.collection);
  const live = await load(async () => response(data.collection));
  assert.deepEqual(live.collection, data.collection);
  assert.equal(live.source, 'api');
});
for (const status of [404, 500, 501, 503, 599]) {
  await testAsync(`auto falls back for availability HTTP ${status}`, async () => {
    const data = await load(async () => response(null, status));
    assert.equal(data.source, 'sample');
    assert.match(data.fallbackReason, new RegExp(String(status)));
    assert.equal(data.collection.features.length, 2);
  });
  await testAsync(`api mode rejects HTTP ${status} without sample fallback`, async () => {
    await assert.rejects(load(async () => response(null, status), { mode: 'api' }), new RegExp(String(status)));
  });
}
for (const status of [400, 401, 403, 408, 409, 422, 429]) {
  await testAsync(`auto rejects hard HTTP ${status}`, async () => {
    await assert.rejects(load(async () => response(null, status)), new RegExp(String(status)));
  });
}
await testAsync('network failure falls back only in auto mode with an explicit reason', async () => {
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  const data = await load(offline);
  assert.equal(data.source, 'sample');
  assert.match(data.fallbackReason, /network|unreachable/i);
  await assert.rejects(load(offline, { mode: 'api' }), /network|unreachable/i);
});
await testAsync('invalid JSON and malformed contracts stay errors', async () => {
  await assert.rejects(load(async () => new Response('{broken')), /JSON|Unexpected|Expected/i);
  await assert.rejects(load(async () => response({ type: 'FeatureCollection', features: [feature(), feature(null)] })), /geometry/i);
  await assert.rejects(load(async () => ({ ok: true, json: async () => { throw new TypeError('body failed'); } })), /body failed/);
});
await testAsync('retry replaces sample parcels atomically with recovered live data', async () => {
  const sample = await load(async () => response(null, 503));
  const live = await load(async () => response());
  assert.equal(sample.source, 'sample');
  assert.equal(live.source, 'api');
  assert.deepEqual(live.collection.features.map((item) => item.properties.id), ['parcel-1']);
  assert.equal(live.fallbackReason, null);
});
await testAsync('timeout ends even an uncooperative fetch at 5000ms and cleans resources', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  globalThis.setTimeout = (callback, ms) => { assert.equal(ms, 5000); timers.set(1, callback); return 1; };
  globalThis.clearTimeout = (id) => timers.delete(id);
  try {
    for (const mode of ['auto', 'api']) {
      const pending = load(() => new Promise(() => {}), { mode });
      timers.get(1)();
      if (mode === 'auto') {
        const data = await pending;
        assert.equal(data.source, 'sample');
        assert.match(data.fallbackReason, /5000|5,000/);
      } else {
        await assert.rejects(pending, /5000|5,000/);
      }
      assert.equal(timers.size, 0);
    }
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
await testAsync('caller cancellation never produces samples and removes its listener', async () => {
  const controller = new AbortController();
  let listeners = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => { listeners++; return add(...args); };
  controller.signal.removeEventListener = (...args) => { listeners--; return remove(...args); };
  const pending = load(() => new Promise(() => {}), { signal: controller.signal });
  controller.abort('navigation');
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(listeners, 0);
  await assert.rejects(load(() => assert.fail('pre-aborted request must not fetch'), { signal: controller.signal }), { name: 'AbortError' });
});
await testAsync('successful and rejected requests remove caller listeners', async () => {
  for (const fetchImpl of [async () => response(), async () => response(null, 401), async () => response(null, 503)]) {
    const controller = new AbortController();
    let listeners = 0;
    const add = controller.signal.addEventListener.bind(controller.signal);
    const remove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.addEventListener = (...args) => { listeners++; return add(...args); };
    controller.signal.removeEventListener = (...args) => { listeners--; return remove(...args); };
    await load(fetchImpl, { signal: controller.signal }).catch(() => {});
    assert.equal(listeners, 0);
  }
});

assert.equal(failures, 0, `${failures} of ${tests} farm map data tests failed`);
console.log(`All ${tests} farm map data tests passed.`);
