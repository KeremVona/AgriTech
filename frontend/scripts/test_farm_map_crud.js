import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  saveParcel,
  updateParcelMetadata,
  deleteParcelBoundary,
} from '../src/services/farmMapService.ts';
import {
  updateParcelInCollection,
  formatParcelFeedback,
  mergeDrawnParcels,
  applyGeometryOverrides,
} from '../src/utils/farmMapPage.ts';

const sampleGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [32.8, 37.9],
      [32.85, 37.9],
      [32.85, 37.95],
      [32.8, 37.95],
      [32.8, 37.9],
    ],
  ],
};

const sampleParcelData = {
  name: 'North Tomato Plot',
  cropId: 'crop-tomato',
  cropName: 'Tomato',
  crop: 'Tomato',
  soilProfileId: 'soil-sandy-loam',
  soilProfileName: 'Sandy Loam',
  soil: 'Sandy Loam',
  plantingDate: '2026-04-15',
  fieldId: 'field-101',
};

const baseOptions = {
  apiBaseUrl: 'http://localhost:5051',
  parcelsPath: '/api/v1/spatial/geojson/parcels',
};

// 1. saveParcel tests
test('saveParcel in api mode sends POST with JSON payload and returns response feature', async () => {
  let calledUrl = '';
  let calledMethod = '';
  let calledHeaders = {};
  let calledBody = null;

  const mockFetch = async (url, init) => {
    calledUrl = String(url);
    calledMethod = init?.method ?? 'GET';
    calledHeaders = init?.headers ?? {};
    calledBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        type: 'Feature',
        id: 'parcel-api-1',
        geometry: sampleGeometry,
        properties: {
          id: 'parcel-api-1',
          name: 'North Tomato Plot',
          crop_name: 'Tomato',
          soil_profile_name: 'Sandy Loam',
          area_hectares: 2.5,
          field_id: 'field-101',
          planting_date: '2026-04-15',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const feature = await saveParcel({
    ...baseOptions,
    mode: 'api',
    parcel: sampleParcelData,
    geometry: sampleGeometry,
    areaHa: 2.5,
    fieldId: 'field-101',
    fetchImpl: mockFetch,
  });

  assert.equal(calledUrl, 'http://localhost:5051/api/v1/parcels');
  assert.equal(calledMethod, 'POST');
  assert.equal(calledHeaders['Content-Type'], 'application/json');
  assert.match(calledHeaders['Accept'], /application\/geo\+json/);
  assert.equal(calledBody.name, 'North Tomato Plot');
  assert.equal(calledBody.crop_type, 'Tomato');
  assert.equal(calledBody.soil_type, 'Sandy Loam');
  assert.equal(calledBody.planting_date, '2026-04-15');
  assert.equal(calledBody.field_id, 'field-101');
  assert.deepEqual(calledBody.geometry, sampleGeometry);
  assert.equal(calledBody.crop_name, undefined);
  assert.equal(calledBody.area_hectares, undefined);

  assert.equal(feature.type, 'Feature');
  assert.equal(feature.id, 'parcel-api-1');
  assert.equal(feature.properties?.name, 'North Tomato Plot');
  assert.equal(feature.properties?.crop_name, 'Tomato');
});

test('saveParcel in api mode throws on 404, 5xx and network errors', async () => {
  const mock404 = async () => new Response(null, { status: 404 });
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'api',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fetchImpl: mock404,
    }),
    /404/
  );

  const mock500 = async () => new Response(null, { status: 500 });
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'api',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fetchImpl: mock500,
    }),
    /500/
  );

  const mockOffline = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'api',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fetchImpl: mockOffline,
    }),
    /unreachable|network|fetch/i
  );
});

test('saveParcel in auto mode rejects on 404, 5xx or network error without fallback', async () => {
  const mock503 = async () => new Response(null, { status: 503 });
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'auto',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fieldId: 'field-101',
      fetchImpl: mock503,
    }),
    /503/
  );

  const mock404 = async () => new Response(null, { status: 404 });
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'auto',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fieldId: 'field-101',
      fetchImpl: mock404,
    }),
    /404/
  );

  const mockOffline = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'auto',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fetchImpl: mockOffline,
    }),
    /unreachable|network|fetch/i
  );
});

test('saveParcel in auto mode rejects hard 4xx client errors without fallback', async () => {
  const mock400 = async () => new Response('Bad Request', { status: 400 });
  await assert.rejects(
    saveParcel({
      ...baseOptions,
      mode: 'auto',
      parcel: sampleParcelData,
      geometry: sampleGeometry,
      areaHa: 2.5,
      fetchImpl: mock400,
    }),
    /400/
  );
});

test('saveParcel in sample mode returns optimistic Feature immediately without network request', async () => {
  const feature = await saveParcel({
    ...baseOptions,
    mode: 'sample',
    parcel: sampleParcelData,
    geometry: sampleGeometry,
    areaHa: 2.5,
    fieldId: 'field-101',
    fetchImpl: () => assert.fail('Must not fetch in sample mode'),
  });

  assert.equal(feature.type, 'Feature');
  assert.ok(feature.id);
  assert.equal(feature.properties?.name, 'North Tomato Plot');
  assert.equal(feature.properties?.crop_name, 'Tomato');
  assert.equal(feature.properties?.soil_profile_name, 'Sandy Loam');
  assert.equal(feature.properties?.area_hectares, 2.5);
  assert.deepEqual(feature.geometry, sampleGeometry);
});

// 2. updateParcelMetadata tests
test('updateParcelMetadata in api mode sends PUT and returns updated feature', async () => {
  let calledUrl = '';
  let calledMethod = '';
  let calledBody = null;

  const updatedData = {
    name: 'Updated Corn Plot',
    cropId: 'crop-corn',
    cropName: 'Corn (Maize)',
    crop: 'Corn (Maize)',
    soilProfileId: 'soil-clay',
    soilProfileName: 'Clay',
    soil: 'Clay',
    plantingDate: '2026-05-01',
  };

  const mockFetch = async (url, init) => {
    calledUrl = String(url);
    calledMethod = init?.method ?? 'GET';
    calledBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        type: 'Feature',
        id: 'parcel-100',
        geometry: sampleGeometry,
        properties: {
          id: 'parcel-100',
          name: 'Updated Corn Plot',
          crop_name: 'Corn (Maize)',
          soil_profile_name: 'Clay',
          planting_date: '2026-05-01',
          area_hectares: 3.0,
        },
      }),
      { status: 200 }
    );
  };

  const feature = await updateParcelMetadata({
    ...baseOptions,
    mode: 'api',
    parcelId: 'parcel-100',
    data: updatedData,
    geometry: sampleGeometry,
    areaHa: 3.0,
    fetchImpl: mockFetch,
  });

  assert.equal(calledUrl, 'http://localhost:5051/api/v1/parcels/parcel-100');
  assert.equal(calledMethod, 'PUT');
  assert.equal(calledBody.name, 'Updated Corn Plot');
  assert.equal(calledBody.crop_type, 'Corn');
  assert.equal(calledBody.soil_type, 'Clay');
  assert.equal(calledBody.planting_date, '2026-05-01');
  assert.equal(calledBody.crop_name, undefined);
  assert.equal(calledBody.area_hectares, undefined);

  assert.equal(feature.id, 'parcel-100');
  assert.equal(feature.properties?.name, 'Updated Corn Plot');
  assert.equal(feature.properties?.crop_name, 'Corn (Maize)');
});

test('updateParcelMetadata in auto mode rejects on 5xx or offline', async () => {
  const updatedData = {
    name: 'Offline Updated Plot',
    cropId: 'crop-apple',
    cropName: 'Apple',
    crop: 'Apple',
    soilProfileId: 'soil-silt',
    soilProfileName: 'Silt',
    soil: 'Silt',
    plantingDate: '2026-03-20',
  };

  const mock500 = async () => new Response(null, { status: 500 });
  await assert.rejects(
    updateParcelMetadata({
      ...baseOptions,
      mode: 'auto',
      parcelId: 'parcel-200',
      data: updatedData,
      geometry: sampleGeometry,
      areaHa: 1.8,
      fetchImpl: mock500,
    }),
    /500/
  );

  const mockOffline = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(
    updateParcelMetadata({
      ...baseOptions,
      mode: 'auto',
      parcelId: 'parcel-200',
      data: updatedData,
      geometry: sampleGeometry,
      areaHa: 1.8,
      fetchImpl: mockOffline,
    }),
    /unreachable|network|fetch/i
  );
});

test('updateParcelMetadata in sample mode updates locally without network call', async () => {
  const updatedData = {
    name: 'Sample Updated Plot',
    cropId: 'crop-potato',
    cropName: 'Potato',
    crop: 'Potato',
    soilProfileId: 'soil-sand',
    soilProfileName: 'Sand',
    soil: 'Sand',
    plantingDate: '2026-04-01',
  };

  const feature = await updateParcelMetadata({
    ...baseOptions,
    mode: 'sample',
    parcelId: 'parcel-300',
    data: updatedData,
    geometry: sampleGeometry,
    areaHa: 4.2,
    fetchImpl: () => assert.fail('Must not fetch in sample mode'),
  });

  assert.equal(feature.id, 'parcel-300');
  assert.equal(feature.properties?.name, 'Sample Updated Plot');
  assert.equal(feature.properties?.crop_name, 'Potato');
  assert.equal(feature.properties?.soil_profile_name, 'Sand');
});

// 3. deleteParcelBoundary tests
test('deleteParcelBoundary in api mode sends DELETE and handles success', async () => {
  let calledUrl = '';
  let calledMethod = '';

  const mockFetch = async (url, init) => {
    calledUrl = String(url);
    calledMethod = init?.method ?? 'GET';
    return new Response(null, { status: 204 });
  };

  const result = await deleteParcelBoundary({
    ...baseOptions,
    mode: 'api',
    parcelId: 'parcel-del-1',
    fetchImpl: mockFetch,
  });

  assert.equal(calledUrl, 'http://localhost:5051/api/v1/parcels/parcel-del-1');
  assert.equal(calledMethod, 'DELETE');
  assert.equal(result.success, true);
  assert.equal(result.id, 'parcel-del-1');
});

test('deleteParcelBoundary in api mode throws on 500 error', async () => {
  const mock500 = async () => new Response(null, { status: 500 });
  await assert.rejects(
    deleteParcelBoundary({
      ...baseOptions,
      mode: 'api',
      parcelId: 'parcel-del-err',
      fetchImpl: mock500,
    }),
    /500/
  );
});

test('deleteParcelBoundary in auto mode rejects on network failure or 5xx', async () => {
  const mock500 = async () => new Response(null, { status: 500 });
  await assert.rejects(
    deleteParcelBoundary({
      ...baseOptions,
      mode: 'auto',
      parcelId: 'parcel-del-err',
      fetchImpl: mock500,
    }),
    /500/
  );

  const mockOffline = async () => {
    throw new TypeError('Failed to fetch');
  };

  await assert.rejects(
    deleteParcelBoundary({
      ...baseOptions,
      mode: 'auto',
      parcelId: 'parcel-del-offline',
      fetchImpl: mockOffline,
    }),
    /unreachable|network|fetch/i
  );
});

test('deleteParcelBoundary in sample mode returns success without network call', async () => {
  const result = await deleteParcelBoundary({
    ...baseOptions,
    mode: 'sample',
    parcelId: 'parcel-del-sample',
    fetchImpl: () => assert.fail('Must not fetch in sample mode'),
  });

  assert.equal(result.success, true);
  assert.equal(result.id, 'parcel-del-sample');
});

// 4. updateParcelInCollection tests
test('updateParcelInCollection immutably updates matching parcel properties', () => {
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'p-1',
        geometry: sampleGeometry,
        properties: {
          id: 'p-1',
          name: 'Old Parcel Name',
          crop_name: 'Tomato',
          crop_id: 'crop-tomato',
          soil_profile_name: 'Sandy Loam',
          soil_profile_id: 'soil-sandy-loam',
          area_hectares: 2.0,
          field_id: 'f-1',
          planting_date: '2026-03-01',
        },
      },
      {
        type: 'Feature',
        id: 'p-2',
        geometry: sampleGeometry,
        properties: {
          id: 'p-2',
          name: 'Parcel 2',
          crop_name: 'Corn',
          crop_id: 'crop-corn',
          soil_profile_name: 'Clay',
          soil_profile_id: 'soil-clay',
          area_hectares: 3.5,
          field_id: 'f-1',
          planting_date: '2026-03-15',
        },
      },
    ],
  };

  const originalClone = structuredClone(collection);

  const updated = updateParcelInCollection(collection, 'p-1', {
    name: 'Renamed Tomato Field',
    cropName: 'Apple',
    cropId: 'crop-apple',
    soilProfileName: 'Silt',
    soilProfileId: 'soil-silt',
    plantingDate: '2026-04-10',
  });

  // Check immutability
  assert.deepEqual(collection, originalClone);
  assert.notEqual(updated, collection);

  // Check updated properties on p-1
  const p1 = updated.features.find((f) => f.id === 'p-1');
  assert.ok(p1);
  assert.equal(p1.properties?.name, 'Renamed Tomato Field');
  assert.equal(p1.properties?.crop_name, 'Apple');
  assert.equal(p1.properties?.crop_id, 'crop-apple');
  assert.equal(p1.properties?.soil_profile_name, 'Silt');
  assert.equal(p1.properties?.soil_profile_id, 'soil-silt');
  assert.equal(p1.properties?.planting_date, '2026-04-10');
  assert.equal(p1.properties?.area_hectares, 2.0); // preserved
  assert.deepEqual(p1.geometry, sampleGeometry); // geometry preserved

  // Check p-2 untouched
  const p2 = updated.features.find((f) => f.id === 'p-2');
  assert.deepEqual(p2, originalClone.features[1]);
});

test('updateParcelInCollection matches target parcel by properties.id or numeric id', () => {
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 42,
        geometry: sampleGeometry,
        properties: {
          id: 'prop-uuid-99',
          name: 'Numeric ID Feature',
          crop_name: null,
          crop_id: null,
          soil_profile_name: null,
          soil_profile_id: null,
          area_hectares: 1.0,
          field_id: null,
          planting_date: null,
        },
      },
    ],
  };

  // Match by numeric id 42
  const updatedByNum = updateParcelInCollection(collection, 42, { name: 'Matched by number' });
  assert.equal(updatedByNum.features[0].properties?.name, 'Matched by number');

  // Match by string coercion "42"
  const updatedByStr = updateParcelInCollection(collection, '42', { name: 'Matched by str 42' });
  assert.equal(updatedByStr.features[0].properties?.name, 'Matched by str 42');

  // Match by properties.id "prop-uuid-99"
  const updatedByProp = updateParcelInCollection(collection, 'prop-uuid-99', { name: 'Matched by prop id' });
  assert.equal(updatedByProp.features[0].properties?.name, 'Matched by prop id');
});

test('applyGeometryOverrides updates matching parcel geometries by id and properties.id', () => {
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'parcel-1',
        geometry: sampleGeometry,
        properties: { id: 'parcel-1', name: 'Parcel 1' },
      },
      {
        type: 'Feature',
        id: 'feat-2',
        geometry: sampleGeometry,
        properties: { id: 'prop-2', name: 'Parcel 2' },
      },
    ],
  };

  const newGeom1 = {
    type: 'Polygon',
    coordinates: [[[30, 40], [31, 40], [31, 41], [30, 41], [30, 40]]],
  };
  const newGeom2 = {
    type: 'Polygon',
    coordinates: [[[35, 42], [36, 42], [36, 43], [35, 43], [35, 42]]],
  };

  const updated = applyGeometryOverrides(collection, {
    'parcel-1': newGeom1,
    'prop-2': newGeom2,
  });

  assert.deepEqual(updated.features[0].geometry, newGeom1);
  assert.deepEqual(updated.features[1].geometry, newGeom2);
  assert.deepEqual(collection.features[0].geometry, sampleGeometry, 'Must be immutable');
});

// 5. formatParcelFeedback tests
test('formatParcelFeedback formats register, update and delete messages accurately', () => {
  const registerNotice = formatParcelFeedback('register');
  assert.equal(registerNotice.type, 'success');
  assert.equal(registerNotice.message, 'Parcel successfully registered.');

  const updateNotice = formatParcelFeedback('update');
  assert.equal(updateNotice.type, 'success');
  assert.equal(updateNotice.message, 'Parcel metadata updated.');

  const deleteNotice = formatParcelFeedback('delete');
  assert.equal(deleteNotice.type, 'info');
  assert.equal(deleteNotice.message, 'Parcel boundary removed.');

  const registerSampleNotice = formatParcelFeedback('register', { localOnly: true });
  assert.equal(registerSampleNotice.type, 'success');
  assert.match(registerSampleNotice.message, /sample data/i);

  const updateSampleNotice = formatParcelFeedback('update', { localOnly: true });
  assert.equal(updateSampleNotice.type, 'success');
  assert.match(updateSampleNotice.message, /sample data/i);

  const deleteSampleNotice = formatParcelFeedback('delete', { localOnly: true });
  assert.equal(deleteSampleNotice.type, 'info');
  assert.match(deleteSampleNotice.message, /sample data/i);
});

// 6. Edge cases and reconciliation
test('saveParcel handles empty 201 response safely without throwing SyntaxError', async () => {
  const mockEmpty201 = async () => new Response('', { status: 201 });
  const feature = await saveParcel({
    ...baseOptions,
    mode: 'api',
    parcel: sampleParcelData,
    geometry: sampleGeometry,
    areaHa: 2.5,
    fieldId: 'field-101',
    fetchImpl: mockEmpty201,
  });

  assert.equal(feature.type, 'Feature');
  assert.ok(feature.id);
  assert.equal(feature.properties?.name, 'North Tomato Plot');
  assert.equal(feature.properties?.crop_name, 'Tomato');
  assert.equal(feature.properties?.area_hectares, 2.5);
  assert.deepEqual(feature.geometry, sampleGeometry);
});

test('mergeDrawnParcels reconciles newly created parcels into the collection', () => {
  const baseCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'base-1',
        geometry: sampleGeometry,
        properties: { id: 'base-1', name: 'Base Parcel', area_hectares: 1.0, field_id: 'field-1' },
      },
    ],
  };

  const newParcel = {
    type: 'Feature',
    id: 'created-1',
    geometry: sampleGeometry,
    properties: { id: 'created-1', name: 'Newly Created Parcel', area_hectares: 2.5, field_id: 'field-1' },
  };

  const merged = mergeDrawnParcels(baseCollection, [newParcel], 'field-1');
  assert.equal(merged.features.length, 2);
  assert.equal(merged.features[0].id, 'base-1');
  assert.equal(merged.features[1].id, 'created-1');
  assert.equal(merged.features[1].properties.name, 'Newly Created Parcel');
});

test('saveParcel normalizes fieldId from options fallback when parcel.fieldId is absent', async () => {
  let requestPayload = null;
  const mockFetch = async (_url, init) => {
    requestPayload = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ id: 'p-new-77' }), { status: 201 });
  };

  const parcelWithoutFieldId = {
    name: 'Apple Orchard',
    cropId: 'crop-apple',
    cropName: 'Apple',
    soilProfileId: 'silt',
    soilProfileName: 'Silt',
    plantingDate: '2026-03-01',
  };

  const feature = await saveParcel({
    ...baseOptions,
    mode: 'api',
    parcel: parcelWithoutFieldId,
    geometry: sampleGeometry,
    areaHa: 1.8,
    fieldId: 'fallback-field-42',
    fetchImpl: mockFetch,
  });

  assert.equal(requestPayload.field_id, 'fallback-field-42');
  assert.equal(feature.properties?.field_id, 'fallback-field-42');
});

test('updateParcelMetadata accepts MultiPolygon geometry and preserves it', async () => {
  const multiPolyGeom = {
    type: 'MultiPolygon',
    coordinates: [
      sampleGeometry.coordinates,
    ],
  };

  const feature = await updateParcelMetadata({
    ...baseOptions,
    mode: 'sample',
    parcelId: 'parcel-multi-1',
    data: sampleParcelData,
    geometry: multiPolyGeom,
    areaHa: 3.2,
  });

  assert.equal(feature.geometry.type, 'MultiPolygon');
  assert.equal(feature.properties?.area_hectares, 3.2);
});
