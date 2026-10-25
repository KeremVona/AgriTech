import type { MultiPolygon, Polygon, Position } from 'geojson';
import type { ParcelFeatureCollection, ParcelMapProperties } from '../types/farmMap.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown, key: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`Invalid parcel ${key}: expected a string or null.`);
  return value;
}

function parsePosition(value: unknown): Position {
  if (!Array.isArray(value) || value.length < 2 || !value.every((part) => typeof part === 'number' && Number.isFinite(part))) {
    throw new Error('Invalid parcel coordinate: expected finite longitude/latitude numbers.');
  }
  if (value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
    throw new Error('Invalid parcel coordinate: outside WGS 84 longitude/latitude ranges.');
  }
  return [...value];
}

function parsePolygonCoordinates(value: unknown): Position[][] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid parcel polygon: at least one ring is required.');
  return value.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error('Invalid parcel ring: at least four positions are required.');
    const positions = ring.map(parsePosition);
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (first.length !== last.length || first.some((part, index) => part !== last[index])) {
      throw new Error('Invalid parcel ring: first and last positions must match.');
    }
    return positions;
  });
}

function parseGeometry(value: unknown): Polygon | MultiPolygon {
  if (!isRecord(value)) throw new Error('Invalid parcel geometry.');
  if (value.type === 'Polygon') {
    return { type: 'Polygon', coordinates: parsePolygonCoordinates(value.coordinates) };
  }
  if (value.type === 'MultiPolygon') {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      throw new Error('Invalid parcel MultiPolygon: at least one polygon is required.');
    }
    return { type: 'MultiPolygon', coordinates: value.coordinates.map(parsePolygonCoordinates) };
  }
  throw new Error('Invalid parcel geometry: expected Polygon or MultiPolygon.');
}

function parseProperties(value: unknown, featureId: unknown): ParcelMapProperties {
  if (value != null && !isRecord(value)) throw new Error('Invalid parcel properties.');
  const properties = isRecord(value) ? value : {};
  const propertyId = nullableString(properties.id, 'id')?.trim();
  const fallbackId = typeof featureId === 'string' ? featureId.trim()
    : typeof featureId === 'number' && Number.isFinite(featureId) ? String(featureId) : '';
  const id = propertyId || fallbackId;
  if (!id) throw new Error('Invalid parcel: a nonempty parcel ID is required.');
  const area = properties.area_hectares;
  if (area != null && (typeof area !== 'number' || !Number.isFinite(area))) {
    throw new Error('Invalid parcel area_hectares: expected a finite number or null.');
  }
  return {
    id,
    name: nullableString(properties.name, 'name')?.trim() || 'Unnamed parcel',
    field_id: nullableString(properties.field_id, 'field_id'),
    field_name: nullableString(properties.field_name, 'field_name'),
    crop_id: nullableString(properties.crop_id, 'crop_id'),
    crop_name: nullableString(properties.crop_name, 'crop_name'),
    soil_profile_id: nullableString(properties.soil_profile_id, 'soil_profile_id'),
    soil_profile_name: nullableString(properties.soil_profile_name, 'soil_profile_name'),
    area_hectares: typeof area === 'number' ? area : null,
    planting_date: nullableString(properties.planting_date, 'planting_date'),
  };
}

/** Validate the display contract atomically; never synthesize crop or area data. */
export function parseParcelCollection(value: unknown): ParcelFeatureCollection {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('Invalid GeoJSON: expected a parcel FeatureCollection with a features array.');
  }
  return {
    type: 'FeatureCollection',
    features: value.features.map((feature) => {
      if (!isRecord(feature) || feature.type !== 'Feature') throw new Error('Invalid parcel GeoJSON Feature.');
      return {
        type: 'Feature',
        properties: parseProperties(feature.properties, feature.id),
        geometry: parseGeometry(feature.geometry),
      };
    }),
  };
}

/** Convert WGS 84 positions to Leaflet bounds only at this viewport boundary. */
export function getParcelBounds(collection: ParcelFeatureCollection): [[number, number], [number, number]] | null {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const { geometry } of collection.features) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [longitude, latitude] of ring) {
          west = Math.min(west, longitude);
          east = Math.max(east, longitude);
          south = Math.min(south, latitude);
          north = Math.max(north, latitude);
        }
      }
    }
  }
  return west === Infinity ? null : [[south, west], [north, east]];
}
