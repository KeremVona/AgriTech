import type { ParcelFeatureCollection } from '../types/farmMap.ts';

/** Fictional, adjacent demonstration parcels near rural Konya, Türkiye.
 * These coordinates and metadata do not represent real farm records.
 */
export const sampleFarmMap: ParcelFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: '20700000-0000-4000-8000-000000000001', name: 'Demo west parcel',
        field_id: '20700000-0000-4000-8000-000000000010', field_name: 'Fictional Konya Demo Farm',
        crop_id: null, crop_name: null, soil_profile_id: null, soil_profile_name: null,
        area_hectares: null, planting_date: null,
      },
      geometry: { type: 'Polygon', coordinates: [[[32.6, 38], [32.602, 38], [32.602, 38.002], [32.6, 38.002], [32.6, 38]]] },
    },
    {
      type: 'Feature',
      properties: {
        id: '20700000-0000-4000-8000-000000000002', name: 'Demo east parcel',
        field_id: '20700000-0000-4000-8000-000000000010', field_name: 'Fictional Konya Demo Farm',
        crop_id: null, crop_name: null, soil_profile_id: null, soil_profile_name: null,
        area_hectares: null, planting_date: null,
      },
      geometry: { type: 'Polygon', coordinates: [[[32.602, 38], [32.604, 38], [32.604, 38.002], [32.602, 38.002], [32.602, 38]]] },
    },
  ],
};
