import type { ParcelCentroid } from '../types/parcelMetadata.ts';

/**
 * Calculates the 2D polygon geometric centroid (center of mass) using signed area formulas:
 *
 * A = 0.5 * sum(x_i * y_{i+1} - x_{i+1} * y_i)
 * C_x = (1 / 6A) * sum((x_i + x_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i))
 * C_y = (1 / 6A) * sum((y_i + y_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i))
 *
 * Safely handles GeoJSON coordinate tuples [lng, lat], unclosed linear rings,
 * nested polygon rings, collinear points, and single-vertex coordinates with
 * coordinate-mean fallbacks.
 *
 * Pure mathematical implementation free of browser DOM and Leaflet runtime dependencies.
 */
export function calculatePolygonCentroid(
  coordinates: [number, number][] | [number, number][][],
): ParcelCentroid {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return { lng: 0, lat: 0 };
  }

  // Handle nested GeoJSON Polygon coordinates array: [[[lng, lat], ...]]
  const ring: [number, number][] =
    Array.isArray(coordinates[0]) && Array.isArray((coordinates[0] as any)[0])
      ? (coordinates[0] as [number, number][])
      : (coordinates as [number, number][]);

  if (!ring || !ring[0] || ring[0].length < 2) {
    return { lng: 0, lat: 0 };
  }

  if (ring.length === 1) {
    return {
      lng: Number(ring[0][0].toFixed(6)),
      lat: Number(ring[0][1].toFixed(6)),
    };
  }

  if (ring.length === 2) {
    return {
      lng: Number(((ring[0][0] + ring[1][0]) / 2).toFixed(6)),
      lat: Number(((ring[0][1] + ring[1][1]) / 2).toFixed(6)),
    };
  }

  const isClosed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];

  const closedRing: [number, number][] = isClosed
    ? ring
    : [...ring, [ring[0][0], ring[0][1]]];

  let signedArea = 0;
  let cxSum = 0;
  let cySum = 0;

  for (let i = 0; i < closedRing.length - 1; i++) {
    const [x0, y0] = closedRing[i];
    const [x1, y1] = closedRing[i + 1];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cxSum += (x0 + x1) * cross;
    cySum += (y0 + y1) * cross;
  }

  signedArea = signedArea * 0.5;

  // For collinear points or zero-area degenerate polygons, fall back to coordinate mean
  if (Math.abs(signedArea) < 1e-12) {
    const uniquePoints = isClosed ? ring.slice(0, -1) : ring;
    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of uniquePoints) {
      sumLng += lng;
      sumLat += lat;
    }
    return {
      lng: Number((sumLng / uniquePoints.length).toFixed(6)),
      lat: Number((sumLat / uniquePoints.length).toFixed(6)),
    };
  }

  const cx = cxSum / (6 * signedArea);
  const cy = cySum / (6 * signedArea);

  return {
    lng: Number(cx.toFixed(6)),
    lat: Number(cy.toFixed(6)),
  };
}
