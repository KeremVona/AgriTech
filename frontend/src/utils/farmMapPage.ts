import type { GisDataMode, ParcelFeatureCollection } from '../types/farmMap.ts';

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
