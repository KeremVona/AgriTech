import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { getFitOptions, shouldFitParcels } from './farmMapPolicy';
import type { LastFit, MapBounds } from './farmMapPolicy';

export function FarmMapViewport({ bounds, fitRequest }: { bounds: MapBounds | null; fitRequest: number }): null {
  const map = useMap();
  const current = useRef({ bounds, fitRequest });
  const lastFit = useRef<LastFit | null>(null);
  const schedule = useRef<() => void>(() => {});

  useEffect(() => {
    current.current = { bounds, fitRequest };
    schedule.current();
  }, [bounds, fitRequest]);

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;
    const update = () => {
      frame = 0;
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      map.invalidateSize({ pan: false, debounceMoveend: true });
      const { bounds: nextBounds, fitRequest: request } = current.current;
      if (!nextBounds) lastFit.current = null;
      if (nextBounds && shouldFitParcels(nextBounds, lastFit.current, request)) {
        const safeBottom = container.parentElement
          ? (Number.parseFloat(getComputedStyle(container.parentElement).paddingBottom) || 0)
          : 0;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        map.stop();
        map.fitBounds(L.latLngBounds(nextBounds), getFitOptions(width, height, safeBottom, reduced));
        lastFit.current = { bounds: nextBounds.map((corner) => [...corner]) as MapBounds, request };
      }
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule.current = queue;
    const observer = new ResizeObserver(queue);
    observer.observe(container);
    window.addEventListener('resize', queue);
    document.addEventListener('visibilitychange', queue);
    queue();
    return () => {
      schedule.current = () => {};
      observer.disconnect();
      window.removeEventListener('resize', queue);
      document.removeEventListener('visibilitychange', queue);
      if (frame) cancelAnimationFrame(frame);
      map.stop();
    };
  }, [map]);

  return null;
}
