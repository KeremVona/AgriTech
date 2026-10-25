import assert from 'node:assert/strict';
import {
  calculateParcelMetrics,
  validateParcelTopology,
  normalizeClosedRing,
} from '../src/utils/parcelTopology.ts';

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

// 1. normalizeClosedRing tests
test('normalizeClosedRing closes an unclosed ring', () => {
  const unclosed = [[27.1, 38.4], [27.2, 38.4], [27.2, 38.5]];
  const closed = normalizeClosedRing(unclosed);
  assert.equal(closed.length, 4);
  assert.deepEqual(closed, [
    [27.1, 38.4],
    [27.2, 38.4],
    [27.2, 38.5],
    [27.1, 38.4],
  ]);
  // Input array not mutated
  assert.equal(unclosed.length, 3);
});

test('normalizeClosedRing does not duplicate an already-closed ring', () => {
  const ring = [
    [27.1, 38.4],
    [27.2, 38.4],
    [27.2, 38.5],
    [27.1, 38.4],
  ];
  const normalized = normalizeClosedRing(ring);
  assert.equal(normalized.length, 4);
  assert.deepEqual(normalized, ring);
});

test('normalizeClosedRing returns empty array for empty coordinates', () => {
  assert.deepEqual(normalizeClosedRing([]), []);
});

// 2. calculateParcelMetrics tests
test('calculateParcelMetrics calculates accurate metrics for rectangular parcel', () => {
  // ~111m x ~111m box at equator gives ~12,321 m2
  const rect = [
    [0.0, 0.0],
    [0.001, 0.0],
    [0.001, 0.001],
    [0.0, 0.001],
    [0.0, 0.0],
  ];
  const metrics = calculateParcelMetrics(rect);

  assert.ok(metrics.areaM2 > 12000 && metrics.areaM2 < 12500, `areaM2 should be ~12321 m2, got ${metrics.areaM2}`);
  assert.equal(metrics.areaHa, Math.round((metrics.areaM2 / 10000) * 100) / 100);
  assert.equal(metrics.acres, Math.round((metrics.areaM2 * 0.000247105) * 100) / 100);
  assert.ok(metrics.perimeterM > 440 && metrics.perimeterM < 450, `perimeterM should be ~444m, got ${metrics.perimeterM}`);
  assert.equal(metrics.vertexCount, 4);
});

test('calculateParcelMetrics accepts unclosed coordinates with identical results', () => {
  const unclosed = [
    [27.140, 38.420],
    [27.145, 38.420],
    [27.145, 38.425],
    [27.140, 38.425],
  ];
  const closed = [
    ...unclosed,
    [27.140, 38.420],
  ];

  const m1 = calculateParcelMetrics(unclosed);
  const m2 = calculateParcelMetrics(closed);

  assert.equal(m1.areaM2, m2.areaM2);
  assert.equal(m1.areaHa, m2.areaHa);
  assert.equal(m1.acres, m2.acres);
  assert.equal(m1.perimeterM, m2.perimeterM);
  assert.equal(m1.vertexCount, 4);
  assert.equal(m2.vertexCount, 4);
});

test('calculateParcelMetrics calculates irregular 5-vertex polygon metrics', () => {
  const pentagon = [
    [27.140, 38.420],
    [27.148, 38.421],
    [27.150, 38.426],
    [27.144, 38.429],
    [27.139, 38.425],
    [27.140, 38.420],
  ];
  const metrics = calculateParcelMetrics(pentagon);

  assert.ok(metrics.areaM2 > 0);
  assert.equal(metrics.areaHa, Math.round((metrics.areaM2 / 10000) * 100) / 100);
  assert.equal(metrics.acres, Math.round((metrics.areaM2 * 0.000247105) * 100) / 100);
  assert.ok(metrics.perimeterM > 0);
  assert.equal(metrics.perimeterM, Math.round(metrics.perimeterM * 10) / 10);
  assert.equal(metrics.vertexCount, 5);
});

test('calculateParcelMetrics handles degenerate inputs (< 3 vertices) safely', () => {
  assert.deepEqual(calculateParcelMetrics([]), {
    areaM2: 0,
    areaHa: 0,
    acres: 0,
    perimeterM: 0,
    vertexCount: 0,
  });

  assert.deepEqual(calculateParcelMetrics([[27.1, 38.4]]), {
    areaM2: 0,
    areaHa: 0,
    acres: 0,
    perimeterM: 0,
    vertexCount: 1,
  });

  assert.deepEqual(calculateParcelMetrics([[27.1, 38.4], [27.2, 38.4]]), {
    areaM2: 0,
    areaHa: 0,
    acres: 0,
    perimeterM: 0,
    vertexCount: 2,
  });
});

// 3. validateParcelTopology tests
test('validateParcelTopology approves clean convex polygon', () => {
  const convex = [
    [27.140, 38.420],
    [27.150, 38.420],
    [27.150, 38.430],
    [27.140, 38.430],
    [27.140, 38.420],
  ];
  const result = validateParcelTopology(convex);
  assert.deepEqual(result, {
    isValid: true,
    kinks: [],
    errorMessage: null,
  });
});

test('validateParcelTopology approves clean concave polygon', () => {
  // L-shaped parcel
  const concave = [
    [0, 0],
    [3, 0],
    [3, 1],
    [1, 1],
    [1, 3],
    [0, 3],
    [0, 0],
  ];
  const result = validateParcelTopology(concave);
  assert.deepEqual(result, {
    isValid: true,
    kinks: [],
    errorMessage: null,
  });
});

test('validateParcelTopology detects self-intersecting bowtie (figure-8) polygon', () => {
  // Classic bowtie intersecting at [1, 1]
  const bowtie = [
    [0, 0],
    [2, 2],
    [0, 2],
    [2, 0],
    [0, 0],
  ];
  const result = validateParcelTopology(bowtie);
  assert.equal(result.isValid, false);
  assert.equal(result.errorMessage, 'Self-intersecting polygon. Uncross boundary lines to complete parcel.');
  assert.equal(result.kinks.length, 1);
  assert.deepEqual(result.kinks[0], [1, 1]);
});

test('validateParcelTopology rejects degenerate polygons with < 3 unique vertices', () => {
  const expectedMsg = 'At least 3 vertices are required to form a parcel boundary.';

  const empty = validateParcelTopology([]);
  assert.deepEqual(empty, {
    isValid: false,
    kinks: [],
    errorMessage: expectedMsg,
  });

  const onePoint = validateParcelTopology([[27.1, 38.4]]);
  assert.deepEqual(onePoint, {
    isValid: false,
    kinks: [],
    errorMessage: expectedMsg,
  });

  const twoPoints = validateParcelTopology([[27.1, 38.4], [27.2, 38.4]]);
  assert.deepEqual(twoPoints, {
    isValid: false,
    kinks: [],
    errorMessage: expectedMsg,
  });

  const closedTwoPoints = validateParcelTopology([[27.1, 38.4], [27.2, 38.4], [27.1, 38.4]]);
  assert.deepEqual(closedTwoPoints, {
    isValid: false,
    kinks: [],
    errorMessage: expectedMsg,
  });
});

test('validateParcelTopology automatically normalizes unclosed valid polygon', () => {
  const unclosedTriangle = [
    [27.140, 38.420],
    [27.150, 38.420],
    [27.145, 38.430],
  ];
  const result = validateParcelTopology(unclosedTriangle);
  assert.deepEqual(result, {
    isValid: true,
    kinks: [],
    errorMessage: null,
  });
});

assert.equal(failures, 0, `${failures} of ${tests} farm map drawing tests failed`);
console.log(`All ${tests} farm map drawing tests passed.`);
