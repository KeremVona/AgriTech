import { useCallback, useEffect, useRef, useState } from 'react';

export interface PolledResource<T> {
  data: T | null;
  /** The `key` that produced `data` (differs from the current key while a new key loads). */
  dataKey: string | null;
  /** `Date.now()` when the request that produced `data` was sent. */
  dataRequestedAt: number | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  refresh: () => void;
}

interface ResourceState<T> {
  data: T | null;
  dataKey: string | null;
  dataRequestedAt: number | null;
  updatedAt: number | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads `load` on mount, whenever `key` changes, on `refresh()`, and every `intervalMs`
 * while the tab is visible. Keeps the last data through errors and key changes; aborts
 * superseded requests so a slow old response can never overwrite a newer one.
 */
export function usePolledResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  key: string,
): PolledResource<T> {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<ResourceState<T>>({
    data: null, dataKey: null, dataRequestedAt: null, updatedAt: null, error: null, loading: true,
  });
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    const run = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const requestedAt = Date.now();
      setState((previous) => (previous.loading ? previous : { ...previous, loading: true }));
      try {
        const data = await loadRef.current(current.signal);
        if (disposed || current.signal.aborted) return;
        setState({ data, dataKey: key, dataRequestedAt: requestedAt, updatedAt: Date.now(), error: null, loading: false });
      } catch (cause) {
        if (disposed || current.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : 'Request failed.';
        setState((previous) => ({ ...previous, error: message, loading: false }));
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void run();
    }, intervalMs);

    void run();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [key, intervalMs, refreshCount]);

  return { ...state, refresh };
}
