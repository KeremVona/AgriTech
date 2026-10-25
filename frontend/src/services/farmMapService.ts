import { sampleFarmMap } from '../data/sampleFarmMap.ts';
import type { GisDataMode, ParcelMapData } from '../types/farmMap.ts';
import type { ParcelFormData } from '../types/parcelMetadata.ts';
import { parseParcelCollection } from '../utils/farmMapGeometry.ts';
import { buildParcelCreatePayload } from '../utils/parcelMetadataPolicy.ts';

class AvailabilityError extends Error {}

function callerAbort(): DOMException {
  return new DOMException('Parcel request cancelled.', 'AbortError');
}

function sampleData(fallbackReason: string | null): ParcelMapData {
  // Normalize and clone through the same contract as live data on every load.
  return { collection: parseParcelCollection(sampleFarmMap), source: 'sample', fallbackReason };
}

function generateParcelId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `parcel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildOptimisticFeature(
  id: string,
  parcel: ParcelFormData,
  geometry: GeoJSON.Polygon,
  areaHa: number,
  fieldId?: string | null
): GeoJSON.Feature<GeoJSON.Polygon> {
  const payload = buildParcelCreatePayload(parcel, geometry, areaHa);
  return {
    type: 'Feature',
    id,
    geometry,
    properties: {
      id,
      name: payload.name || 'Unnamed parcel',
      field_id: payload.field_id ?? fieldId ?? null,
      field_name: null,
      crop_id: payload.crop_id || null,
      crop_name: payload.crop_name || null,
      soil_profile_id: payload.soil_profile_id || null,
      soil_profile_name: payload.soil_profile_name || null,
      area_hectares: areaHa,
      planting_date: payload.planting_date || null,
    },
  };
}

export async function loadParcelMapData(options: {
  apiBaseUrl: string;
  parcelsPath: string;
  mode: GisDataMode;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ParcelMapData> {
  const { apiBaseUrl, parcelsPath, mode, signal, fetchImpl = fetch } = options;
  if (signal?.aborted) throw callerAbort();
  if (mode === 'sample') return sampleData(null);

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerAbort());
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new AvailabilityError('Live parcel request timed out after 5,000 ms.'));
  }, 5000);

  try {
    const request = async (): Promise<ParcelMapData> => {
      let response: Response;
      try {
        response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/${parcelsPath.replace(/^\//, '')}`, {
          signal: controller.signal,
          headers: { Accept: 'application/geo+json, application/json' },
        });
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new AvailabilityError('Live parcel API is unreachable (network failure).', { cause: error });
      }
      if (!response.ok) {
        const message = `Live parcel request failed (HTTP ${response.status}).`;
        if (response.status === 404 || (response.status >= 500 && response.status < 600)) throw new AvailabilityError(message);
        throw new Error(message);
      }
      // JSON and contract failures are hard errors, even if they throw TypeError.
      const collection = parseParcelCollection(await response.json());
      return { collection, source: 'api', fallbackReason: null };
    };
    // A race also bounds fetch/body implementations that ignore AbortSignal.
    return await Promise.race([request(), cancelled]);
  } catch (error) {
    if (signal?.aborted) throw callerAbort();
    if (mode === 'auto' && error instanceof AvailabilityError) return sampleData(error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

export async function saveParcel(options: {
  apiBaseUrl: string;
  parcelsPath: string;
  mode: GisDataMode;
  parcel: ParcelFormData;
  geometry: GeoJSON.Polygon;
  areaHa: number;
  fieldId?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<GeoJSON.Feature<GeoJSON.Polygon>> {
  const {
    apiBaseUrl,
    parcelsPath,
    mode,
    parcel,
    geometry,
    areaHa,
    fieldId,
    signal,
    fetchImpl = fetch,
  } = options;

  if (signal?.aborted) throw callerAbort();
  if (mode === 'sample') {
    return buildOptimisticFeature(generateParcelId(), parcel, geometry, areaHa, fieldId);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerAbort());
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new AvailabilityError('Live parcel save request timed out after 5,000 ms.'));
  }, 5000);

  try {
    const request = async (): Promise<GeoJSON.Feature<GeoJSON.Polygon>> => {
      let response: Response;
      const url = `${apiBaseUrl.replace(/\/$/, '')}/${parcelsPath.replace(/^\//, '')}`;
      const payload = buildParcelCreatePayload(parcel, geometry, areaHa);

      try {
        response = await fetchImpl(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/geo+json, application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new AvailabilityError('Live parcel API is unreachable (network failure).', { cause: error });
      }

      if (!response.ok) {
        const message = `Live parcel request failed (HTTP ${response.status}).`;
        if (response.status === 404 || (response.status >= 500 && response.status < 600)) {
          throw new AvailabilityError(message);
        }
        throw new Error(message);
      }

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (json && json.type === 'Feature') {
        return json;
      }
      const respId = String(json?.id ?? generateParcelId());
      return buildOptimisticFeature(respId, { ...parcel, ...(json?.properties ?? json) }, geometry, areaHa, fieldId);
    };

    return await Promise.race([request(), cancelled]);
  } catch (error) {
    if (signal?.aborted) throw callerAbort();
    if (mode === 'auto' && error instanceof AvailabilityError) {
      return buildOptimisticFeature(generateParcelId(), parcel, geometry, areaHa, fieldId);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

export async function updateParcelMetadata(options: {
  apiBaseUrl: string;
  parcelsPath: string;
  mode: GisDataMode;
  parcelId: string;
  data: ParcelFormData;
  geometry?: GeoJSON.Polygon;
  areaHa?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<GeoJSON.Feature<GeoJSON.Polygon>> {
  const {
    apiBaseUrl,
    parcelsPath,
    mode,
    parcelId,
    data,
    geometry,
    areaHa,
    signal,
    fetchImpl = fetch,
  } = options;

  if (signal?.aborted) throw callerAbort();
  const effectiveGeom: GeoJSON.Polygon = geometry ?? { type: 'Polygon', coordinates: [] };
  const effectiveArea = areaHa ?? (data as any).area_hectares ?? 0;

  if (mode === 'sample') {
    return buildOptimisticFeature(parcelId, data, effectiveGeom, effectiveArea, data.fieldId);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerAbort());
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new AvailabilityError('Live parcel update request timed out after 5,000 ms.'));
  }, 5000);

  try {
    const request = async (): Promise<GeoJSON.Feature<GeoJSON.Polygon>> => {
      let response: Response;
      const url = `${apiBaseUrl.replace(/\/$/, '')}/${parcelsPath.replace(/^\//, '')}/${encodeURIComponent(parcelId)}`;
      const payload = buildParcelCreatePayload(data, effectiveGeom, effectiveArea);

      try {
        response = await fetchImpl(url, {
          method: 'PUT',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/geo+json, application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new AvailabilityError('Live parcel API is unreachable (network failure).', { cause: error });
      }

      if (!response.ok) {
        const message = `Live parcel update failed (HTTP ${response.status}).`;
        if (response.status === 404 || (response.status >= 500 && response.status < 600)) {
          throw new AvailabilityError(message);
        }
        throw new Error(message);
      }

      let json: any = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (json && json.type === 'Feature') {
        return json;
      }
      return buildOptimisticFeature(parcelId, { ...data, ...(json?.properties ?? json) }, effectiveGeom, effectiveArea, data.fieldId);
    };

    return await Promise.race([request(), cancelled]);
  } catch (error) {
    if (signal?.aborted) throw callerAbort();
    if (mode === 'auto' && error instanceof AvailabilityError) {
      return buildOptimisticFeature(parcelId, data, effectiveGeom, effectiveArea, data.fieldId);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

export async function deleteParcelBoundary(options: {
  apiBaseUrl: string;
  parcelsPath: string;
  mode: GisDataMode;
  parcelId: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ success: boolean; id: string }> {
  const {
    apiBaseUrl,
    parcelsPath,
    mode,
    parcelId,
    signal,
    fetchImpl = fetch,
  } = options;

  if (signal?.aborted) throw callerAbort();
  if (mode === 'sample') {
    return { success: true, id: parcelId };
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerAbort());
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new AvailabilityError('Live parcel delete request timed out after 5,000 ms.'));
  }, 5000);

  try {
    const request = async (): Promise<{ success: boolean; id: string }> => {
      let response: Response;
      const url = `${apiBaseUrl.replace(/\/$/, '')}/${parcelsPath.replace(/^\//, '')}/${encodeURIComponent(parcelId)}`;

      try {
        response = await fetchImpl(url, {
          method: 'DELETE',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new AvailabilityError('Live parcel API is unreachable (network failure).', { cause: error });
      }

      if (!response.ok) {
        const message = `Live parcel delete failed (HTTP ${response.status}).`;
        if (response.status === 404 || (response.status >= 500 && response.status < 600)) {
          throw new AvailabilityError(message);
        }
        throw new Error(message);
      }

      return { success: true, id: parcelId };
    };

    return await Promise.race([request(), cancelled]);
  } catch (error) {
    if (signal?.aborted) throw callerAbort();
    if (mode === 'auto' && error instanceof AvailabilityError) {
      return { success: true, id: parcelId };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}
