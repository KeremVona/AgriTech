import assert from 'node:assert/strict';
import {
  calculateParcelMetrics,
  validateParcelTopology,
  normalizeClosedRing,
} from '../src/utils/parcelTopology.ts';
import {
  toggleDrawingMode,
  cancelDrawingMode,
  handleDrawingKeydown,
  isDrawingActionLocked,
  getDrawingState,
  extractCoordinates,
} from '../src/utils/drawingState.ts';
import {
  formatDrawingHudMetrics,
  getDrawingHudMicrocopy,
  canSubmitPolygon,
} from '../src/utils/drawingHudPolicy.ts';

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

// 4. Drawing toolbar mode toggling and transitions
test('toggleDrawingMode toggles tool on when idle', () => {
  assert.equal(toggleDrawingMode('idle', 'draw'), 'draw');
  assert.equal(toggleDrawingMode('idle', 'edit'), 'edit');
  assert.equal(toggleDrawingMode('idle', 'drag'), 'drag');
  assert.equal(toggleDrawingMode('idle', 'delete'), 'delete');
});

test('toggleDrawingMode toggles active tool off back to idle', () => {
  assert.equal(toggleDrawingMode('draw', 'draw'), 'idle');
  assert.equal(toggleDrawingMode('edit', 'edit'), 'idle');
  assert.equal(toggleDrawingMode('drag', 'drag'), 'idle');
  assert.equal(toggleDrawingMode('delete', 'delete'), 'idle');
});

test('toggleDrawingMode switches directly between different active tools', () => {
  assert.equal(toggleDrawingMode('draw', 'edit'), 'edit');
  assert.equal(toggleDrawingMode('edit', 'drag'), 'drag');
  assert.equal(toggleDrawingMode('drag', 'delete'), 'delete');
  assert.equal(toggleDrawingMode('delete', 'draw'), 'draw');
});

test('cancelDrawingMode resets any mode to idle', () => {
  assert.equal(cancelDrawingMode(), 'idle');
});

// 5. Action lockout during active drawing/editing
test('isDrawingActionLocked restricts actions during any active mode', () => {
  assert.equal(isDrawingActionLocked('idle'), false);
  assert.equal(isDrawingActionLocked('draw'), true);
  assert.equal(isDrawingActionLocked('edit'), true);
  assert.equal(isDrawingActionLocked('drag'), true);
  assert.equal(isDrawingActionLocked('delete'), true);
});

// 6. Keyboard handling (Escape cancels active mode)
test('handleDrawingKeydown maps Escape to idle transition', () => {
  assert.equal(handleDrawingKeydown('Escape', 'draw'), 'idle');
  assert.equal(handleDrawingKeydown('Escape', 'edit'), 'idle');
  assert.equal(handleDrawingKeydown('Escape', 'drag'), 'idle');
  assert.equal(handleDrawingKeydown('Escape', 'delete'), 'idle');
  assert.equal(handleDrawingKeydown('Escape', 'idle'), 'idle');
});

test('handleDrawingKeydown leaves mode intact for non-Escape keys', () => {
  assert.equal(handleDrawingKeydown('Enter', 'draw'), 'draw');
  assert.equal(handleDrawingKeydown('Space', 'edit'), 'edit');
  assert.equal(handleDrawingKeydown('Tab', 'drag'), 'drag');
});

// 7. Drawing state machine resolution
test('getDrawingState resolves state accurately across drawing lifecycles', () => {
  assert.equal(getDrawingState('idle', 0, false), 'IDLE_MAP');
  assert.equal(getDrawingState('draw', 0, false), 'DRAWING_ACTIVE');
  assert.equal(getDrawingState('draw', 2, false), 'DRAWING_INVALID_KINK');
  assert.equal(getDrawingState('draw', 0, true), 'POLYGON_COMPLETED');
  assert.equal(getDrawingState('idle', 0, true), 'POLYGON_COMPLETED');
  assert.equal(getDrawingState('edit', 1, false), 'DRAWING_INVALID_KINK');
  assert.equal(getDrawingState('edit', 0, false), 'DRAWING_ACTIVE');
});

// 8. Coordinate extraction from Leaflet layers
test('extractCoordinates handles null, empty, flat and nested latlng structures', () => {
  assert.deepEqual(extractCoordinates(null), []);
  assert.deepEqual(extractCoordinates({}), []);

  // Flat latlng array (Polyline / simple Polygon)
  const flatLayer = {
    getLatLngs: () => [
      { lat: 38.420, lng: 27.140 },
      { lat: 38.420, lng: 27.150 },
      { lat: 38.430, lng: 27.145 },
    ],
  };
  assert.deepEqual(extractCoordinates(flatLayer), [
    [27.140, 38.420],
    [27.150, 38.420],
    [27.145, 38.430],
  ]);

  // Nested latlng array (Polygon outer ring)
  const nestedLayer = {
    getLatLngs: () => [[
      { lat: 38.420, lng: 27.140 },
      { lat: 38.420, lng: 27.150 },
      { lat: 38.430, lng: 27.145 },
    ]],
  };
  assert.deepEqual(extractCoordinates(nestedLayer), [
    [27.140, 38.420],
    [27.150, 38.420],
    [27.145, 38.430],
  ]);

  // GeoJSON layer fallback
  const geojsonLayer = {
    toGeoJSON: () => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [27.140, 38.420],
          [27.150, 38.420],
          [27.145, 38.430],
          [27.140, 38.420],
        ]],
      },
    }),
  };
  assert.deepEqual(extractCoordinates(geojsonLayer), [
    [27.140, 38.420],
    [27.150, 38.420],
    [27.145, 38.430],
    [27.140, 38.420],
  ]);
});

// 9. formatDrawingHudMetrics tests
test('formatDrawingHudMetrics formats parcel metrics into standardized HUD copy', () => {
  const metrics = {
    areaM2: 18400,
    areaHa: 1.84,
    acres: 4.55,
    perimeterM: 542.4,
    vertexCount: 5,
  };
  const result = formatDrawingHudMetrics(metrics);
  assert.equal(result, '1.84 ha (4.55 acres) • 5 Vertices • Perimeter: 542m');
});

test('formatDrawingHudMetrics rounds perimeter and formats decimals cleanly', () => {
  const metrics = {
    areaM2: 125000,
    areaHa: 12.5,
    acres: 30.89,
    perimeterM: 1450.7,
    vertexCount: 8,
  };
  const result = formatDrawingHudMetrics(metrics);
  assert.equal(result, '12.50 ha (30.89 acres) • 8 Vertices • Perimeter: 1451m');
});

test('formatDrawingHudMetrics handles zero metrics safely', () => {
  const metrics = {
    areaM2: 0,
    areaHa: 0,
    acres: 0,
    perimeterM: 0,
    vertexCount: 0,
  };
  const result = formatDrawingHudMetrics(metrics);
  assert.equal(result, '0.00 ha (0.00 acres) • 0 Vertices • Perimeter: 0m');
});

// 10. getDrawingHudMicrocopy tests
test('getDrawingHudMicrocopy prioritizes DRAWING_INVALID_KINK error prompt', () => {
  const kinkState = getDrawingHudMicrocopy('DRAWING_INVALID_KINK');
  assert.deepEqual(kinkState, {
    prompt: 'Self-intersecting polygon. Uncross boundary lines to complete parcel.',
    isError: true,
  });

  // Even if mode is edit/drag/draw, kink error takes precedence
  const kinkWithMode = getDrawingHudMicrocopy('DRAWING_INVALID_KINK', 'edit');
  assert.deepEqual(kinkWithMode, {
    prompt: 'Self-intersecting polygon. Uncross boundary lines to complete parcel.',
    isError: true,
  });
});

test('getDrawingHudMicrocopy provides instructions for active modes', () => {
  const drawMode = getDrawingHudMicrocopy('DRAWING_ACTIVE', 'draw');
  assert.deepEqual(drawMode, {
    prompt: 'Click initial vertex to complete polygon • Press ESC to cancel.',
    isError: false,
  });

  const activeNoMode = getDrawingHudMicrocopy('DRAWING_ACTIVE');
  assert.deepEqual(activeNoMode, {
    prompt: 'Click initial vertex to complete polygon • Press ESC to cancel.',
    isError: false,
  });

  const editMode = getDrawingHudMicrocopy('DRAWING_ACTIVE', 'edit');
  assert.deepEqual(editMode, {
    prompt: 'Drag vertices to reshape • Click midpoint to add vertex • Click Finish when done.',
    isError: false,
  });

  const dragMode = getDrawingHudMicrocopy('DRAWING_ACTIVE', 'drag');
  assert.deepEqual(dragMode, {
    prompt: 'Click and drag parcel to reposition • Click Finish when done.',
    isError: false,
  });

  const deleteMode = getDrawingHudMicrocopy('DRAWING_ACTIVE', 'delete');
  assert.deepEqual(deleteMode, {
    prompt: 'Click any parcel to delete • Click Finish when done.',
    isError: false,
  });
});

test('getDrawingHudMicrocopy handles completion and idle states', () => {
  const completed = getDrawingHudMicrocopy('POLYGON_COMPLETED');
  assert.deepEqual(completed, {
    prompt: 'Parcel boundary recorded. Ready for metadata.',
    isError: false,
  });

  const idle = getDrawingHudMicrocopy('IDLE_MAP', 'idle');
  assert.deepEqual(idle, {
    prompt: '',
    isError: false,
  });
});

// 11. canSubmitPolygon tests
test('canSubmitPolygon allows submission only for valid non-intersecting polygons with >= 3 vertices and positive area', () => {
  const validMetrics = {
    areaM2: 10000,
    areaHa: 1.0,
    acres: 2.47,
    perimeterM: 400,
    vertexCount: 4,
  };

  // Valid parcel
  assert.equal(canSubmitPolygon(validMetrics, false), true);

  // Self-intersecting polygon blocked
  assert.equal(canSubmitPolygon(validMetrics, true), false);

  // Null metrics blocked
  assert.equal(canSubmitPolygon(null, false), false);

  // Degenerate vertex count (< 3) blocked
  assert.equal(canSubmitPolygon({ ...validMetrics, vertexCount: 2 }, false), false);

  // Zero or negative area blocked
  assert.equal(canSubmitPolygon({ ...validMetrics, areaHa: 0 }, false), false);
  assert.equal(canSubmitPolygon({ ...validMetrics, areaHa: -1 }, false), false);
});

assert.equal(failures, 0, `${failures} of ${tests} farm map drawing tests failed`);
console.log(`All ${tests} farm map drawing tests passed.`);
