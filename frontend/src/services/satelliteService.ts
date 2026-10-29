import type { Polygon, MultiPolygon } from 'geojson';
import type { NdviJobStatus, SatelliteErrorKind } from '../types/satellite.ts';

export const SATELLITE_URL: string =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SATELLITE_URL !== undefined
    ? import.meta.env.VITE_SATELLITE_URL
    : 'http://localhost:8100';

export class SatelliteRequestError extends Error {
  kind: SatelliteErrorKind;

  constructor(kind: SatelliteErrorKind, message: string) {
    super(message);
    this.name = 'SatelliteRequestError';
    this.kind = kind;
  }
}

function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') {
    return true;
  }
  return false;
}

async function handleResponseError(response: Response): Promise<never> {
  let message = `Request failed with status ${response.status}`;
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((d: { msg?: string } | string) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
        .join('; ');
    } else if (typeof data.message === 'string') {
      message = data.message;
    }
  } catch {
    // Fall back to default status message
  }

  if (response.status === 422) {
    throw new SatelliteRequestError('invalid', message);
  }
  throw new SatelliteRequestError('other', message);
}

export function frameUrl(pngUrl: string, baseUrl?: string): string {
  if (pngUrl.startsWith('http://') || pngUrl.startsWith('https://')) {
    return pngUrl;
  }
  const base = (baseUrl ?? SATELLITE_URL).replace(/\/+$/, '');
  const path = pngUrl.replace(/^\/+/, '');
  return `${base}/${path}`;
}

export interface CreateNdviJobOptions {
  geometry: Polygon | MultiPolygon;
  parcelId: string;
  signal?: AbortSignal;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function createNdviJob(opts: CreateNdviJobOptions): Promise<NdviJobStatus> {
  const f = opts.fetchImpl ?? fetch;
  const base = (opts.baseUrl ?? SATELLITE_URL).replace(/\/+$/, '');
  const url = `${base}/api/v1/ndvi/jobs`;

  let response: Response;
  try {
    response = await f(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        geometry: opts.geometry,
        parcel_id: opts.parcelId,
      }),
      signal: opts.signal,
    });
  } catch (err: unknown) {
    if (isAbortError(err, opts.signal)) {
      throw err;
    }
    throw new SatelliteRequestError('offline', 'Satellite service is offline.');
  }

  if (!response.ok) {
    await handleResponseError(response);
  }

  return (await response.json()) as NdviJobStatus;
}

export interface GetNdviJobOptions {
  jobId: string;
  signal?: AbortSignal;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function getNdviJob(opts: GetNdviJobOptions): Promise<NdviJobStatus> {
  const f = opts.fetchImpl ?? fetch;
  const base = (opts.baseUrl ?? SATELLITE_URL).replace(/\/+$/, '');
  const url = `${base}/api/v1/ndvi/jobs/${encodeURIComponent(opts.jobId)}`;

  let response: Response;
  try {
    response = await f(url, {
      method: 'GET',
      signal: opts.signal,
    });
  } catch (err: unknown) {
    if (isAbortError(err, opts.signal)) {
      throw err;
    }
    throw new SatelliteRequestError('offline', 'Satellite service is offline.');
  }

  if (!response.ok) {
    await handleResponseError(response);
  }

  return (await response.json()) as NdviJobStatus;
}
