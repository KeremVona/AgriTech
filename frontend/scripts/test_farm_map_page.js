import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFarmMapConfig, getLoadedFields, filterParcelsByField } from '../src/utils/farmMapPage.ts';
import { sampleFarmMap } from '../src/data/sampleFarmMap.ts';

test('uses the actual backend launch port and live parcel endpoint by default', () => {
  assert.deepEqual(resolveFarmMapConfig({}), { config: {
    apiBaseUrl: 'http://localhost:5051', parcelsPath: '/api/v1/spatial/geojson/parcels', mode: 'auto',
  }, error: null });
});
test('GIS base overrides the existing API base without changing it', () => {
  const env = { VITE_API_BASE_URL: 'https://api.example.test', VITE_GIS_API_BASE_URL: 'https://gis.example.test',
    VITE_GIS_PARCELS_PATH: '/api/v1/fields/real-id/parcels', VITE_GIS_DATA_MODE: 'api' };
  assert.deepEqual(resolveFarmMapConfig(env).config, {
    apiBaseUrl: 'https://gis.example.test', parcelsPath: '/api/v1/fields/real-id/parcels', mode: 'api',
  });
  assert.equal(env.VITE_API_BASE_URL, 'https://api.example.test');
});
test('uses the existing API base when no GIS override is configured', () => {
  assert.equal(resolveFarmMapConfig({ VITE_API_BASE_URL: 'http://localhost:5000' }).config.apiBaseUrl, 'http://localhost:5000');
});
test('accepts each explicit data mode', () => {
  for (const mode of ['auto', 'api', 'sample']) assert.equal(resolveFarmMapConfig({ VITE_GIS_DATA_MODE: mode }).config.mode, mode);
});
test('rejects unknown and empty data modes as configuration errors', () => {
  for (const mode of ['', 'automatic', 'API']) {
    const result = resolveFarmMapConfig({ VITE_GIS_DATA_MODE: mode });
    assert.equal(result.config, null);
    assert.match(result.error, /VITE_GIS_DATA_MODE/);
  }
});
test('malformed API bases and paths are configuration errors, not sample fallback', () => {
  for (const env of [
    { VITE_GIS_API_BASE_URL: 'localhost:5051' },
    { VITE_GIS_API_BASE_URL: 'ftp://example.test' },
    { VITE_GIS_PARCELS_PATH: 'parcels' },
    { VITE_GIS_PARCELS_PATH: '//other.test/parcels' },
  ]) assert.equal(resolveFarmMapConfig(env).config, null);
});
test('field selector deduplicates the loaded collection and excludes missing field IDs', () => {
  const collection = structuredClone(sampleFarmMap);
  collection.features.push({ ...collection.features[0], properties: { ...collection.features[0].properties, field_id: null } });
  assert.deepEqual(getLoadedFields(collection), [{ id: '20700000-0000-4000-8000-000000000010', name: 'Fictional Konya Demo Farm' }]);
});
test('field selector uses an honest fallback name and a later available name', () => {
  const collection = structuredClone(sampleFarmMap);
  collection.features[0].properties.field_name = null;
  assert.equal(getLoadedFields(collection)[0].name, 'Fictional Konya Demo Farm');
  collection.features[1].properties.field_name = null;
  assert.match(getLoadedFields(collection)[0].name, /Unnamed field/);
});
test('all fields retains every loaded parcel including parcels with no field ID', () => {
  assert.equal(filterParcelsByField(sampleFarmMap), sampleFarmMap);
});
test('scoped routes include matching parcels only and never mutate loaded data', () => {
  const collection = structuredClone(sampleFarmMap);
  collection.features[1].properties.field_id = 'another-field';
  const before = structuredClone(collection);
  assert.deepEqual(filterParcelsByField(collection, 'another-field').features, [collection.features[1]]);
  assert.deepEqual(collection, before);
});
test('unknown field and empty loaded collections remain empty', () => {
  assert.deepEqual(filterParcelsByField(sampleFarmMap, 'unknown'), { type: 'FeatureCollection', features: [] });
  const empty = { type: 'FeatureCollection', features: [] };
  assert.deepEqual(getLoadedFields(empty), []);
  assert.deepEqual(filterParcelsByField(empty, 'unknown'), empty);
});
