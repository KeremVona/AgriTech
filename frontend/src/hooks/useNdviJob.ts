import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Polygon, MultiPolygon } from 'geojson';
import type { NdviFrame, NdviJobState, SatelliteErrorKind } from '../types/satellite.ts';
import { ndviJobReducer } from '../utils/satelliteTimeline.ts';
import {
  createNdviJob,
  getNdviJob,
  frameUrl,
  SatelliteRequestError,
} from '../services/satelliteService.ts';

export interface ParcelTarget {
  id: string;
  geometry: Polygon | MultiPolygon;
}

export interface UseNdviJobOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function useNdviJob(
  parcel: ParcelTarget | null,
  options?: UseNdviJobOptions
): { state: NdviJobState; retry: () => void } {
  const [state, dispatch] = useReducer(ndviJobReducer, { phase: 'idle' });
  const [retryCount, setRetryCount] = useState(0);

  const preloadedRef = useRef<Set<string>>(new Set());

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const preloadFrames = useCallback(
    (frames: NdviFrame[]) => {
      if (typeof Image === 'undefined') return;
      for (const frame of frames) {
        if (!preloadedRef.current.has(frame.png_url)) {
          preloadedRef.current.add(frame.png_url);
          const img = new Image();
          img.src = frameUrl(frame.png_url, options?.baseUrl);
        }
      }
    },
    [options?.baseUrl]
  );

  useEffect(() => {
    if (!parcel) {
      dispatch({ type: 'reset' });
      return;
    }

    const controller = new AbortController();
    const parcelId = parcel.id;
    const geometry = parcel.geometry;

    let timerId: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      dispatch({ type: 'select', parcelId });
      try {
        const initialStatus = await createNdviJob({
          geometry,
          parcelId,
          signal: controller.signal,
          baseUrl: options?.baseUrl,
          fetchImpl: options?.fetchImpl,
        });

        if (controller.signal.aborted) return;
        preloadFrames(initialStatus.frames);
        dispatch({ type: 'started', parcelId, status: initialStatus });

        let currentStatus = initialStatus;

        while (
          !controller.signal.aborted &&
          (currentStatus.status === 'queued' || currentStatus.status === 'running')
        ) {
          await new Promise<void>((resolve) => {
            timerId = setTimeout(resolve, 2000);
            controller.signal.addEventListener('abort', () => resolve(), { once: true });
          });
          if (controller.signal.aborted) return;

          try {
            const polledStatus = await getNdviJob({
              jobId: currentStatus.job_id,
              signal: controller.signal,
              baseUrl: options?.baseUrl,
              fetchImpl: options?.fetchImpl,
            });
            if (controller.signal.aborted) return;

            preloadFrames(polledStatus.frames);
            currentStatus = polledStatus;
            dispatch({ type: 'polled', parcelId, status: polledStatus });
          } catch (pollErr: unknown) {
            if (controller.signal.aborted) return;
            const kind: SatelliteErrorKind =
              pollErr instanceof SatelliteRequestError ? pollErr.kind : 'other';
            const message =
              pollErr instanceof Error ? pollErr.message : 'Satellite request failed';
            dispatch({ type: 'requestFailed', parcelId, kind, message });
            return;
          }
        }
      } catch (createErr: unknown) {
        if (controller.signal.aborted) return;
        const kind: SatelliteErrorKind =
          createErr instanceof SatelliteRequestError ? createErr.kind : 'other';
        const message =
          createErr instanceof Error ? createErr.message : 'Satellite request failed';
        dispatch({ type: 'requestFailed', parcelId, kind, message });
      }
    }

    void run();

    return () => {
      controller.abort();
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [parcel, retryCount, preloadFrames, options?.baseUrl, options?.fetchImpl]);

  return { state, retry };
}
