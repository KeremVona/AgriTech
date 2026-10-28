import { calculateParcelMetrics } from './parcelTopology.ts';
import type { GisDataMode, ParcelFeatureCollection } from '../types/farmMap.ts';
import type { ParcelMetrics } from '../types/farmMapDrawing.ts';
import type { ParcelFormData } from '../types/parcelMetadata.ts';

export type FarmMapConfig = { apiBaseUrl: string; parcelsPath: string; mode: GisDataMode };
type Environment = Partial<Record<'VITE_GIS_API_BASE_URL' | 'VITE_API_BASE_URL' | 'VITE_GIS_PARCELS_PATH' | 'VITE_GIS_DATA_MODE', string>>;

export function resolveFarmMapConfig(env: Environment): { config: FarmMapConfig; error: null } | { config: null; error: string } {
  const mode = env.VITE_GIS_DATA_MODE ?? 'auto';
  if (mode !== 'auto' && mode !== 'api' && mode !== 'sample') {
    return { config: null, error: 'Invalid VITE_GIS_DATA_MODE. Choose auto, api, or sample in frontend/.env.local.' };
  }
  const apiBaseUrl = env.VITE_GIS_API_BASE_URL?.trim() || env.VITE_API_BASE_URL?.trim() || 'http://localhost:5051';
  const parcelsPath = env.VITE_GIS_PARCELS_PATH?.trim() ?? '/api/v1/spatial/geojson/parcels';
  try {
    const url = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error();
  } catch {
    return { config: null, error: 'Invalid GIS API base URL. Set VITE_GIS_API_BASE_URL to an absolute HTTP or HTTPS URL in frontend/.env.local.' };
  }
  if (!parcelsPath.startsWith('/') || parcelsPath.startsWith('//')) {
    return { config: null, error: 'Invalid VITE_GIS_PARCELS_PATH. Set a path beginning with a single / in frontend/.env.local.' };
  }
  return { config: { apiBaseUrl, parcelsPath, mode }, error: null };
}

export function getLoadedFields(collection: ParcelFeatureCollection): { id: string; name: string }[] {
  const fields = new Map<string, string | null>();
  for (const { properties } of collection.features) {
    if (properties.field_id && !fields.get(properties.field_id)) fields.set(properties.field_id, properties.field_name);
  }
  return Array.from(fields, ([id, name]) => ({ id, name: name || `Unnamed field (${id})` }));
}

export function filterParcelsByField(collection: ParcelFeatureCollection, fieldId?: string): ParcelFeatureCollection {
  return fieldId === undefined ? collection : {
    type: 'FeatureCollection', features: collection.features.filter(({ properties }) => properties.field_id === fieldId),
  };
}

/**
 * Merges locally drawn vector parcels into an existing feature collection.
 * When fieldId is provided, filters drawn parcels to preserve matching or unassigned parcels.
 * If drawnParcels is empty, returns original collection reference.
 */
export function mergeDrawnParcels(
  collection: ParcelFeatureCollection,
  drawnParcels: GeoJSON.Feature<GeoJSON.Polygon>[],
  fieldId?: string
): ParcelFeatureCollection {
  if (!drawnParcels || drawnParcels.length === 0) {
    return collection;
  }
  const filteredDrawn = fieldId === undefined
    ? drawnParcels
    : drawnParcels.filter((p) => {
        const pFieldId = p.properties?.field_id;
        return pFieldId === fieldId || pFieldId === undefined || pFieldId === null;
      });

  return {
    ...collection,
    features: [...collection.features, ...(filteredDrawn as any)],
  };
}

/**
 * Removes a drawn parcel by matching ID across string, numeric, or property-level IDs.
 */
export function removeDrawnParcel(
  drawnParcels: GeoJSON.Feature<GeoJSON.Polygon>[],
  parcelId: string | number
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  if (!drawnParcels || drawnParcels.length === 0) {
    return [];
  }
  const targetIdStr = String(parcelId);
  return drawnParcels.filter((p) => {
    const pId = p.id !== undefined && p.id !== null ? String(p.id) : null;
    const propId = p.properties?.id !== undefined && p.properties?.id !== null ? String(p.properties.id) : null;
    return pId !== targetIdStr && propId !== targetIdStr;
  });
}

/**
 * Creates or normalizes a completed vector parcel feature with assigned ID,
 * calculated metrics metadata, and field scoping compliant with ParcelMapProperties schema.
 */
export function createDrawnParcelFeature(
  rawFeature: Partial<GeoJSON.Feature<GeoJSON.Polygon>> & { geometry: GeoJSON.Polygon },
  metrics: ParcelMetrics,
  fieldId?: string
): GeoJSON.Feature<GeoJSON.Polygon> {
  const id = String(rawFeature.id || (rawFeature.properties as any)?.id || `drawn-parcel-${Date.now()}`);
  return {
    ...rawFeature,
    type: 'Feature',
    id,
    geometry: rawFeature.geometry,
    properties: {
      ...rawFeature.properties,
      id,
      name: rawFeature.properties?.name ?? `New Parcel (${metrics.areaHa.toFixed(2)} ha)`,
      area_ha: metrics.areaHa,
      area_hectares: metrics.areaHa,
      field_id: rawFeature.properties?.field_id ?? fieldId ?? null,
    },
  };
}

/**
 * Immutably updates metadata properties of a matching parcel in a FeatureCollection.
 * Matches across string, numeric, or properties.id identifiers.
 */
export function updateParcelInCollection(
  collection: ParcelFeatureCollection,
  parcelId: string | number,
  data: Partial<ParcelFormData> & Record<string, any>
): ParcelFeatureCollection {
  if (!collection || !collection.features) {
    return collection;
  }
  const targetId = String(parcelId);
  const updatedFeatures = collection.features.map((feature) => {
    const featId = feature.id !== undefined && feature.id !== null ? String(feature.id) : null;
    const propId = feature.properties?.id !== undefined && feature.properties?.id !== null ? String(feature.properties.id) : null;
    if (featId !== targetId && propId !== targetId) {
      return feature;
    }

    const cropName = data.cropName ?? data.crop_name ?? data.crop;
    const cropId = data.cropId ?? data.crop_id;
    const soilProfileName = data.soilProfileName ?? data.soil_profile_name ?? data.soil;
    const soilProfileId = data.soilProfileId ?? data.soil_profile_id;
    const plantingDate = data.plantingDate ?? data.planting_date;
    const name = data.name;
    const fieldId = data.fieldId ?? data.field_id;
    const areaHa = data.area_hectares ?? data.areaHa ?? data.area_ha;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...(name !== undefined && { name }),
        ...(cropName !== undefined && { crop_name: cropName }),
        ...(cropId !== undefined && { crop_id: cropId }),
        ...(soilProfileName !== undefined && { soil_profile_name: soilProfileName }),
        ...(soilProfileId !== undefined && { soil_profile_id: soilProfileId }),
        ...(plantingDate !== undefined && { planting_date: plantingDate }),
        ...(fieldId !== undefined && { field_id: fieldId }),
        ...(areaHa !== undefined && { area_hectares: areaHa }),
      },
    };
  });

  return {
    ...collection,
    features: updatedFeatures,
  };
}

/**
 * Pure helper that calculates the area in hectares for a Polygon or MultiPolygon.
 */
export function geometryAreaHa(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  if (!geometry || !geometry.coordinates) return 0;
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    if (!ring || !Array.isArray(ring)) return 0;
    return calculateParcelMetrics(ring as [number, number][]).areaHa;
  }
  if (geometry.type === 'MultiPolygon') {
    let total = 0;
    for (const poly of geometry.coordinates) {
      const ring = poly?.[0];
      if (ring && Array.isArray(ring)) {
        total += calculateParcelMetrics(ring as [number, number][]).areaHa;
      }
    }
    return Math.round(total * 10000) / 10000;
  }
  return 0;
}

/**
 * Immutably applies geometry overrides to matching features in a FeatureCollection.
 * Matches across string, numeric, or properties.id identifiers.
 */
export function applyGeometryOverrides(
  collection: ParcelFeatureCollection,
  overrides: Record<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>
): ParcelFeatureCollection {
  if (!collection || !collection.features || !overrides || Object.keys(overrides).length === 0) {
    return collection;
  }
  const updatedFeatures = collection.features.map((feature) => {
    const featId = feature.id !== undefined && feature.id !== null ? String(feature.id) : null;
    const propId = feature.properties?.id !== undefined && feature.properties?.id !== null ? String(feature.properties.id) : null;
    const matchingKey = (featId && overrides[featId]) ? featId : (propId && overrides[propId]) ? propId : null;
    if (!matchingKey) {
      return feature;
    }
    const newGeometry = overrides[matchingKey];
    return {
      ...feature,
      geometry: newGeometry,
      properties: {
        ...feature.properties,
        area_hectares: geometryAreaHa(newGeometry),
      },
    };
  });
  return {
    ...collection,
    features: updatedFeatures,
  };
}

/**
 * Formats toast and banner feedback messages for parcel completion and removal events.
 */
export function formatParcelFeedback(
  type: 'complete' | 'delete' | 'register' | 'update',
  optionsOrMetrics?: ParcelMetrics | { localOnly?: boolean },
  options?: { localOnly?: boolean }
): { type: 'success' | 'info'; message: string } {
  const localOnly = Boolean(
    (optionsOrMetrics && 'localOnly' in optionsOrMetrics && optionsOrMetrics.localOnly) ||
    options?.localOnly
  );
  const metrics =
    optionsOrMetrics && 'areaHa' in optionsOrMetrics ? (optionsOrMetrics as ParcelMetrics) : undefined;

  if (type === 'register') {
    return {
      type: 'success',
      message: localOnly
        ? 'Parcel saved to sample data (not sent to the server).'
        : 'Parcel successfully registered.',
    };
  }
  if (type === 'update') {
    return {
      type: 'success',
      message: localOnly
        ? 'Parcel metadata updated in sample data (not sent to the server).'
        : 'Parcel metadata updated.',
    };
  }
  if (type === 'complete' && metrics) {
    return {
      type: 'success',
      message: `Parcel boundary recorded: ${metrics.areaHa.toFixed(2)} ha (${metrics.acres.toFixed(2)} acres). Ready for metadata registration.`,
    };
  }
  return {
    type: 'info',
    message: localOnly
      ? 'Parcel boundary removed from sample data (not sent to the server).'
      : 'Parcel boundary removed.',
  };
}
