import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveFarmMapConfig,
  getLoadedFields,
  filterParcelsByField,
  mergeDrawnParcels,
  removeDrawnParcel,
  createDrawnParcelFeature,
  formatParcelFeedback,
} from '../src/utils/farmMapPage.ts';
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

test('mergeDrawnParcels merges locally drawn parcels without mutating base collection', () => {
  const base = structuredClone(sampleFarmMap);
  const before = structuredClone(base);
  const drawn = [
    {
      type: 'Feature',
      id: 'drawn-1',
      geometry: {
        type: 'Polygon',
        coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]],
      },
      properties: {
        id: 'drawn-1',
        name: 'New Parcel (1.50 ha)',
        area_ha: 1.5,
        field_id: null,
      },
    },
  ];

  const merged = mergeDrawnParcels(base, drawn);
  assert.equal(merged.features.length, base.features.length + 1);
  assert.equal(merged.features[merged.features.length - 1].id, 'drawn-1');
  assert.deepEqual(base, before);

  // When drawn is empty, returns original base collection reference
  assert.equal(mergeDrawnParcels(base, []), base);
});

test('field filtering preserves matching or unassigned drawn parcels and filters out others', () => {
  const base = structuredClone(sampleFarmMap);
  const drawnScoped = {
    type: 'Feature',
    id: 'drawn-field-10',
    geometry: { type: 'Polygon', coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]] },
    properties: { id: 'drawn-field-10', name: 'Field 10 Parcel', field_id: '20700000-0000-4000-8000-000000000010' },
  };
  const drawnOtherField = {
    type: 'Feature',
    id: 'drawn-field-99',
    geometry: { type: 'Polygon', coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]] },
    properties: { id: 'drawn-field-99', name: 'Field 99 Parcel', field_id: 'other-field-id' },
  };
  const drawnUnassigned = {
    type: 'Feature',
    id: 'drawn-unassigned',
    geometry: { type: 'Polygon', coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]] },
    properties: { id: 'drawn-unassigned', name: 'Global Parcel', field_id: null },
  };

  const allDrawn = [drawnScoped, drawnOtherField, drawnUnassigned];

  // Scoped to Field 10: drawnScoped and drawnUnassigned included, drawnOtherField excluded
  const scopedMerged = mergeDrawnParcels(base, allDrawn, '20700000-0000-4000-8000-000000000010');
  const mergedIds = scopedMerged.features.map(f => f.id);
  assert.ok(mergedIds.includes('drawn-field-10'));
  assert.ok(mergedIds.includes('drawn-unassigned'));
  assert.ok(!mergedIds.includes('drawn-field-99'));

  // All fields (undefined): all three included
  const allMerged = mergeDrawnParcels(base, allDrawn, undefined);
  assert.equal(allMerged.features.length, base.features.length + 3);
});

test('fallback resilience is maintained with drawn parcels across empty, sample, and live datasets', () => {
  const drawn = [
    {
      type: 'Feature',
      id: 'drawn-resilience',
      geometry: { type: 'Polygon', coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]] },
      properties: { id: 'drawn-resilience', name: 'Resilient Parcel', area_ha: 2.1 },
    },
  ];

  // 1. Empty collection (initial loading or backend outage) retains drawn parcels
  const empty = { type: 'FeatureCollection', features: [] };
  const mergedEmpty = mergeDrawnParcels(empty, drawn);
  assert.equal(mergedEmpty.features.length, 1);
  assert.equal(mergedEmpty.features[0].id, 'drawn-resilience');

  // 2. Sample fallback dataset preserves sample parcels + drawn parcels
  const mergedSample = mergeDrawnParcels(sampleFarmMap, drawn);
  assert.equal(mergedSample.features.length, sampleFarmMap.features.length + 1);

  // 3. Simulated live API recovery seamlessly combines new live data with drawn parcels
  const liveRecovery = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'live-p1',
        geometry: { type: 'Polygon', coordinates: [[[33.0, 38.0], [33.1, 38.0], [33.1, 38.1], [33.0, 38.1], [33.0, 38.0]]] },
        properties: { id: 'live-p1', name: 'Live Parcel 1', field_id: null, field_name: null, crop_id: null, crop_name: null, soil_profile_id: null, soil_profile_name: null, area_hectares: 10, planting_date: null },
      },
    ],
  };
  const mergedRecovered = mergeDrawnParcels(liveRecovery, drawn);
  assert.equal(mergedRecovered.features.length, 2);
  assert.equal(mergedRecovered.features[1].id, 'drawn-resilience');
});

test('createDrawnParcelFeature assigns stable ID, formatted area, and field association', () => {
  const metrics = { areaM2: 25000, areaHa: 2.5, acres: 6.18, perimeterM: 650, vertexCount: 5 };
  const raw = {
    geometry: { type: 'Polygon', coordinates: [[[32.8, 37.9], [32.85, 37.9], [32.85, 37.95], [32.8, 37.95], [32.8, 37.9]]] },
  };

  const created = createDrawnParcelFeature(raw, metrics, 'field-test-123');
  assert.ok(created.id.startsWith('drawn-parcel-'));
  assert.equal(created.properties.name, 'New Parcel (2.50 ha)');
  assert.equal(created.properties.area_ha, 2.5);
  assert.equal(created.properties.field_id, 'field-test-123');

  // Preserves existing ID and explicit properties
  const existing = {
    id: 'custom-id',
    geometry: raw.geometry,
    properties: { name: 'Custom Name', field_id: 'preserve-field' },
  };
  const createdExisting = createDrawnParcelFeature(existing, metrics, 'other-field');
  assert.equal(createdExisting.id, 'custom-id');
  assert.equal(createdExisting.properties.field_id, 'preserve-field');
});

test('formatParcelFeedback formats completion and deletion notices accurately', () => {
  const metrics = { areaM2: 24500, areaHa: 2.45, acres: 6.05, perimeterM: 630, vertexCount: 5 };
  const completeNotice = formatParcelFeedback('complete', metrics);
  assert.equal(completeNotice.type, 'success');
  assert.equal(
    completeNotice.message,
    'Parcel boundary recorded: 2.45 ha (6.05 acres). Ready for metadata registration.'
  );

  const deleteNotice = formatParcelFeedback('delete');
  assert.equal(deleteNotice.type, 'info');
  assert.equal(deleteNotice.message, 'Parcel boundary removed.');
});

test('removeDrawnParcel removes parcels cleanly by string ID, numeric Leaflet ID, and property ID', () => {
  const drawn = [
    {
      type: 'Feature',
      id: 'drawn-parcel-100',
      geometry: { type: 'Polygon', coordinates: [[[30, 40], [31, 40], [31, 41], [30, 41], [30, 40]]] },
      properties: { id: 'drawn-parcel-100', name: 'Parcel A', area_ha: 1 },
    },
    {
      type: 'Feature',
      id: 62,
      geometry: { type: 'Polygon', coordinates: [[[31, 40], [32, 40], [32, 41], [31, 41], [31, 40]]] },
      properties: { id: 62, name: 'Parcel B', area_ha: 2 },
    },
    {
      type: 'Feature',
      id: 'drawn-parcel-200',
      geometry: { type: 'Polygon', coordinates: [[[32, 40], [33, 40], [33, 41], [32, 41], [32, 40]]] },
      properties: { id: 'prop-match-only', name: 'Parcel C', area_ha: 3 },
    },
  ];

  // 1. Remove by exact string ID
  const afterStringRemove = removeDrawnParcel(drawn, 'drawn-parcel-100');
  assert.equal(afterStringRemove.length, 2);
  assert.equal(afterStringRemove[0].id, 62);
  assert.equal(afterStringRemove[1].id, 'drawn-parcel-200');

  // 2. Remove by numeric Leaflet ID passed as number
  const afterNumRemove = removeDrawnParcel(drawn, 62);
  assert.equal(afterNumRemove.length, 2);
  assert.equal(afterNumRemove[0].id, 'drawn-parcel-100');
  assert.equal(afterNumRemove[1].id, 'drawn-parcel-200');

  // 3. Remove by numeric Leaflet ID passed as string coercion ("62")
  const afterNumCoercedRemove = removeDrawnParcel(drawn, '62');
  assert.equal(afterNumCoercedRemove.length, 2);
  assert.equal(afterNumCoercedRemove[0].id, 'drawn-parcel-100');

  // 4. Remove by matching properties.id
  const afterPropRemove = removeDrawnParcel(drawn, 'prop-match-only');
  assert.equal(afterPropRemove.length, 2);
  assert.equal(afterPropRemove[0].id, 'drawn-parcel-100');
  assert.equal(afterPropRemove[1].id, 62);

  // 5. Handles empty and unmatched gracefully
  assert.deepEqual(removeDrawnParcel([], 'any-id'), []);
  assert.equal(removeDrawnParcel(drawn, 'non-existent').length, 3);
});

test('createDrawnParcelFeature adheres to ParcelMapProperties schema with id and area_hectares', () => {
  const metrics = { areaM2: 15000, areaHa: 1.5, acres: 3.71, perimeterM: 500, vertexCount: 4 };
  const raw = {
    geometry: { type: 'Polygon', coordinates: [[[30, 40], [31, 40], [31, 41], [30, 41], [30, 40]]] },
  };

  const feature = createDrawnParcelFeature(raw, metrics, 'f-1');
  assert.ok(feature.id);
  assert.equal(feature.properties.id, feature.id);
  assert.equal(feature.properties.area_ha, 1.5);
  assert.equal(feature.properties.area_hectares, 1.5);
  assert.equal(feature.properties.field_id, 'f-1');
});
