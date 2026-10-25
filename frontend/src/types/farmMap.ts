import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export interface ParcelMapProperties {
  id: string;
  name: string;
  field_id: string | null;
  field_name: string | null;
  crop_id: string | null;
  crop_name: string | null;
  soil_profile_id: string | null;
  soil_profile_name: string | null;
  area_hectares: number | null;
  planting_date: string | null;
}

export type ParcelFeatureCollection = FeatureCollection<Polygon | MultiPolygon, ParcelMapProperties>;
export type GisDataMode = 'auto' | 'api' | 'sample';
export type ParcelMapData = {
  collection: ParcelFeatureCollection;
  source: 'api' | 'sample';
  fallbackReason: string | null;
};
