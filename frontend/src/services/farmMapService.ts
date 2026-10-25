import { sampleFarmMap } from '../data/sampleFarmMap.ts';
import type { GisDataMode, ParcelMapData } from '../types/farmMap.ts';
import { parseParcelCollection } from '../utils/farmMapGeometry.ts';

class AvailabilityError extends Error {}

function callerAbort(): DOMException {
  return new DOMException('Parcel request cancelled.', 'AbortError');
}

function sampleData(fallbackReason: string | null): ParcelMapData {
  // Normalize and clone through the same contract as live data on every load.
  return { collection: parseParcelCollection(sampleFarmMap), source: 'sample', fallbackReason };
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
