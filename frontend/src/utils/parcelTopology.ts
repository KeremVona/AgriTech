import { area } from '@turf/area';
import { kinks } from '@turf/kinks';
import { length } from '@turf/length';
import { polygon } from '@turf/helpers';
import type { ParcelMetrics, TopologyValidationResult } from '../types/farmMapDrawing.ts';

/**
 * Ensures the first and last coordinates of a linear ring are identical.
 */
export function normalizeClosedRing(coordinates: [number, number][]): [number, number][] {
  if (coordinates.length === 0) {
    return [];
  }
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return coordinates.map(([lng, lat]): [number, number] => [lng, lat]);
  }
  return [
    ...coordinates.map(([lng, lat]): [number, number] => [lng, lat]),
    [first[0], first[1]],
  ];
}

/**
 * Extracts unique vertices count excluding the duplicate closing vertex.
 */
function getUniqueVertexCount(coordinates: [number, number][]): number {
  if (coordinates.length === 0) {
    return 0;
  }
  const isClosed =
    coordinates.length > 1 &&
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1];
  const unclosed = isClosed ? coordinates.slice(0, -1) : coordinates;
  const uniquePoints = new Set(unclosed.map(([lng, lat]) => `${lng},${lat}`));
  return uniquePoints.size;
}

/**
 * Calculates geodesic surface area (m², hectares, acres), perimeter (meters),
 * and vertex count for a given polygon coordinate ring.
 */
export function calculateParcelMetrics(coordinates: [number, number][]): ParcelMetrics {
  const vertexCount = getUniqueVertexCount(coordinates);
  if (vertexCount < 3) {
    return {
      areaM2: 0,
      areaHa: 0,
      acres: 0,
      perimeterM: 0,
      vertexCount,
    };
  }

  const ring = normalizeClosedRing(coordinates);
  const poly = polygon([ring]);
  const rawAreaM2 = area(poly);
  const areaM2 = Math.round(rawAreaM2 * 100) / 100;
  const areaHa = Math.round((areaM2 / 10000) * 100) / 100;
  const acres = Math.round((areaM2 * 0.000247105) * 100) / 100;
  const rawPerimeterM = length(poly, { units: 'meters' });
  const perimeterM = Math.round(rawPerimeterM * 10) / 10;

  return {
    areaM2,
    areaHa,
    acres,
    perimeterM,
    vertexCount,
  };
}

/**
 * Validates the topological integrity of a parcel boundary.
 * Detects self-intersections (bowties/figure-8s) and rejects degenerate polygons (< 3 vertices).
 */
export function validateParcelTopology(coordinates: [number, number][]): TopologyValidationResult {
  const vertexCount = getUniqueVertexCount(coordinates);
  if (vertexCount < 3) {
    return {
      isValid: false,
      kinks: [],
      errorMessage: 'At least 3 vertices are required to form a parcel boundary.',
    };
  }

  const ring = normalizeClosedRing(coordinates);
  const poly = polygon([ring]);
  const kinksResult = kinks(poly);

  if (kinksResult.features.length > 0) {
    const kinkCoords = kinksResult.features.map(
      (f) => f.geometry.coordinates as [number, number]
    );
    return {
      isValid: false,
      kinks: kinkCoords,
      errorMessage: 'Self-intersecting polygon. Uncross boundary lines to complete parcel.',
    };
  }

  return {
    isValid: true,
    kinks: [],
    errorMessage: null,
  };
}
