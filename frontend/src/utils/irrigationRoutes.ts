import type { SampleHints } from '../services/irrigationSampleData.ts';

const HINT_KEYS = [
  ['parcelName', 'name'],
  ['cropName', 'crop'],
  ['soilProfileId', 'soil'],
] as const;

/** Link to the Parcel Water Dashboard. Hints are display-only and never override live data. */
export function waterDashboardPath(parcelId: string, hints?: SampleHints): string {
  const params = new URLSearchParams();
  for (const [hintKey, param] of HINT_KEYS) {
    const value = hints?.[hintKey];
    if (value) params.set(param, value);
  }
  const query = params.toString();
  return `/parcels/${encodeURIComponent(parcelId)}/irrigation${query ? `?${query}` : ''}`;
}

export function readDashboardHints(search: string): {
  parcelName: string | undefined;
  cropName: string | undefined;
  soilProfileId: string | undefined;
} {
  const params = new URLSearchParams(search);
  const read = (param: string) => params.get(param)?.trim() || undefined;
  return { parcelName: read('name'), cropName: read('crop'), soilProfileId: read('soil') };
}
