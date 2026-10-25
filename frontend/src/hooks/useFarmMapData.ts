import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadParcelMapData } from '../services/farmMapService.ts';
import type { GisDataMode, ParcelMapData } from '../types/farmMap.ts';

export function useFarmMapData(config: {
  apiBaseUrl: string;
  parcelsPath: string;
  mode: GisDataMode;
}): {
  data: ParcelMapData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { apiBaseUrl, parcelsPath, mode } = config;
  const [attempt, setAttempt] = useState(0);
  // Identity also changes for A → B → A config transitions, which must start
  // loading again even when the last completed data happened to come from A.
  const request = useMemo(() => ({ apiBaseUrl, parcelsPath, mode, attempt }), [apiBaseUrl, parcelsPath, mode, attempt]);
  const [state, setState] = useState<{
    data: ParcelMapData | null;
    error: string | null;
    completedRequest: typeof request | null;
  }>({ data: null, error: null, completedRequest: null });
  const generation = useRef(0);
  const reload = useCallback(() => {
    // Invalidate immediately, including the interval before effect cleanup.
    generation.current++;
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const { apiBaseUrl, parcelsPath, mode } = request;
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && generation.current === requestGeneration;
    void loadParcelMapData({ apiBaseUrl, parcelsPath, mode, signal: controller.signal })
      .then((result) => {
        if (isCurrent()) setState({ data: result, error: null, completedRequest: request });
      })
      .catch((cause: unknown) => {
        if (isCurrent()) {
          setState((previous) => ({
            data: previous.data,
            error: cause instanceof Error ? cause.message : 'Unable to load parcel data.',
            completedRequest: request,
          }));
        }
      });

    // Retain the last collection through retries and failures. The error is
    // independent of data, so an unsuccessful retry stays visible to callers.
    return () => controller.abort();
  }, [request]);

  const loading = state.completedRequest !== request;
  return { data: state.data, loading, error: loading ? null : state.error, reload };
}
