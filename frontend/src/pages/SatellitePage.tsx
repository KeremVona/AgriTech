import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Polygon, MultiPolygon } from 'geojson';
import { ParcelList } from '../components/SatelliteTimeline/ParcelList.tsx';
import { SatelliteMap } from '../components/SatelliteTimeline/SatelliteMap.tsx';
import { TimelinePlayer } from '../components/SatelliteTimeline/TimelinePlayer.tsx';
import { NdviChart } from '../components/SatelliteTimeline/NdviChart.tsx';
import { NdviLegend } from '../components/SatelliteTimeline/NdviLegend.tsx';
import { useNdviJob } from '../hooks/useNdviJob.ts';
import { frameUrl } from '../services/satelliteService.ts';
import { loadParcelMapData } from '../services/farmMapService.ts';
import type { ParcelMapData } from '../types/farmMap.ts';
import { frameBlendAt, toDayNumber } from '../utils/satelliteTimeline.ts';
import { resolveFarmMapConfig } from '../utils/farmMapPage.ts';

const configuration = resolveFarmMapConfig({
  VITE_GIS_API_BASE_URL: import.meta.env.VITE_GIS_API_BASE_URL,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_GIS_PARCELS_PATH: import.meta.env.VITE_GIS_PARCELS_PATH,
  VITE_GIS_DATA_MODE: import.meta.env.VITE_GIS_DATA_MODE,
});

export function SatellitePage(): React.JSX.Element {
  const [parcelData, setParcelData] = useState<ParcelMapData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [parcelsError, setParcelsError] = useState<string | null>(configuration.error);

  const initializedJobIdRef = useRef<string | null>(null);

  // Load parcel map data once using the same configuration as FieldMapPage
  useEffect(() => {
    if (!configuration.config) {
      return;
    }

    const controller = new AbortController();
    loadParcelMapData({
      apiBaseUrl: configuration.config.apiBaseUrl,
      parcelsPath: configuration.config.parcelsPath,
      mode: configuration.config.mode,
      signal: controller.signal,
    })
      .then((data) => {
        setParcelData(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setParcelsError(err instanceof Error ? err.message : 'Failed to load parcels');
      });

    return () => controller.abort();
  }, []);

  // Filter out features with null geometry
  const validParcels = useMemo(() => {
    if (!parcelData?.collection?.features) return [];
    return parcelData.collection.features.filter((f) => Boolean(f && f.geometry));
  }, [parcelData]);

  // Selected parcel target for the job hook
  const selectedTarget = useMemo(() => {
    if (!selectedId) return null;
    const found = validParcels.find(
      (p) => String(p.properties?.id ?? p.id) === selectedId
    );
    if (!found || !found.geometry) return null;
    return {
      id: selectedId,
      geometry: found.geometry as Polygon | MultiPolygon,
    };
  }, [selectedId, validParcels]);

  // Satellite NDVI job polling hook
  const { state: jobState, retry } = useNdviJob(selectedTarget);

  // When frames first arrive, day starts at the last frame's day
  useEffect(() => {
    if (jobState.phase === 'polling' || jobState.phase === 'done') {
      const job = jobState.job;
      if (job.frames.length > 0 && initializedJobIdRef.current !== job.job_id) {
        initializedJobIdRef.current = job.job_id;
        setDay(toDayNumber(job.frames[job.frames.length - 1].date));
      }
    }
  }, [jobState]);

  // Reset day when parcel selection changes
  const handleSelectParcel = (id: string) => {
    setSelectedId(id);
    initializedJobIdRef.current = null;
    setDay(null);
  };

  // Cross-fading image overlay calculation
  const overlay = useMemo(() => {
    if (
      (jobState.phase === 'polling' || jobState.phase === 'done') &&
      jobState.job.bounds &&
      jobState.job.frames.length > 0 &&
      day !== null
    ) {
      const blend = frameBlendAt(jobState.job.frames, day);
      return {
        bounds: jobState.job.bounds,
        before: blend.before
          ? { url: frameUrl(blend.before.png_url), opacity: 1 - blend.alpha }
          : null,
        after: blend.after
          ? { url: frameUrl(blend.after.png_url), opacity: blend.alpha }
          : null,
      };
    }
    return null;
  }, [jobState, day]);

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-ag-canvas text-ag-ink overflow-hidden font-sans">
      {/* Header bar */}
      <header className="flex-none h-14 border-b border-ag-border bg-ag-surface px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-ag-border bg-ag-surface-muted text-ag-ink hover:bg-ag-brand-subtle transition-colors"
            title="AgriTech Platform"
            aria-label="Back to Platform"
          >
            ←
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-ag-ink flex items-center gap-2">
              Satellite NDVI Timeline
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800">
                Sentinel-2
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/map"
            className="text-xs font-semibold text-ag-brand hover:text-ag-brand-hover px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-muted hover:bg-ag-brand-subtle transition-colors"
          >
            Field GIS Map
          </Link>
        </div>
      </header>

      {/* Main workspace layout: 3-column / 3-panel on desktop (≥768px), stacked vertically on mobile */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Column: Parcel List */}
        <aside className="w-full md:w-80 lg:w-96 flex-none border-b md:border-b-0 md:border-r border-ag-border bg-ag-surface flex flex-col max-h-56 md:max-h-none overflow-hidden">
          {parcelsError && (
            <div className="p-3 text-xs text-red-600 bg-red-50 border-b border-red-200">
              {parcelsError}
            </div>
          )}
          <ParcelList
            parcels={validParcels}
            selectedId={selectedId}
            onSelect={handleSelectParcel}
            fallbackReason={parcelData?.fallbackReason}
          />
        </aside>

        {/* Center & Bottom: Map and Timeline Panel */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Map View */}
          <div className="flex-1 min-h-[300px] md:min-h-0 relative">
            <SatelliteMap
              parcels={validParcels}
              selectedId={selectedId}
              onSelect={handleSelectParcel}
              overlay={overlay}
            />
          </div>

          {/* Timeline Panel (player, legend, chart, and status messages) */}
          <section className="flex-none border-t border-ag-border bg-ag-surface p-4 overflow-y-auto max-h-[50vh] md:max-h-80">
            {/* Spec §4.4 States & Messages */}
            {jobState.phase === 'idle' && (
              <div className="py-6 text-center text-sm text-ag-ink-secondary">
                Pick a parcel to see its satellite timeline.
              </div>
            )}

            {jobState.phase === 'starting' && (
              <div className="py-4 flex items-center justify-center gap-2 text-sm text-ag-ink-secondary">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                Searching satellite archive…
              </div>
            )}

            {jobState.phase === 'polling' && (
              <div className="mb-3 flex items-center justify-between text-xs font-medium text-ag-ink-secondary">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  {jobState.job.progress.total !== null
                    ? `Processing satellite passes… ${jobState.job.progress.processed} / ${jobState.job.progress.total}`
                    : 'Searching satellite archive…'}
                </span>
                <span className="text-ag-ink-tertiary">
                  {jobState.job.frames.length} cloud-free passes loaded
                </span>
              </div>
            )}

            {jobState.phase === 'done' && jobState.job.frames.length === 0 && (
              <div className="py-6 text-center text-sm text-ag-ink-secondary">
                No cloud-free passes in the last 12 months.
              </div>
            )}

            {jobState.phase === 'failed' && (
              <div className="py-4 flex items-center justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <span>{jobState.job.error || 'Satellite job failed.'}</span>
                <button
                  type="button"
                  onClick={retry}
                  className="px-3 py-1 text-xs font-semibold rounded bg-white hover:bg-red-50 text-red-700 border border-red-300 cursor-pointer shadow-xs"
                >
                  Retry
                </button>
              </div>
            )}

            {jobState.phase === 'error' && (
              <div className="py-4">
                {jobState.kind === 'offline' ? (
                  <div className="p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                    Satellite service is offline.
                  </div>
                ) : jobState.kind === 'invalid' ? (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {jobState.message}
                  </div>
                ) : (
                  <div className="p-3 flex items-center justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    <span>{jobState.message}</span>
                    <button
                      type="button"
                      onClick={retry}
                      className="px-3 py-1 text-xs font-semibold rounded bg-white hover:bg-red-50 text-red-700 border border-red-300 cursor-pointer shadow-xs"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* When frames exist (during polling or done), render player, legend, and chart */}
            {(jobState.phase === 'polling' || jobState.phase === 'done') &&
              jobState.job.frames.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                      <TimelinePlayer
                        frames={jobState.job.frames}
                        day={day}
                        onDayChange={setDay}
                      />
                    </div>
                    <div className="flex-none w-full sm:w-auto">
                      <NdviLegend />
                    </div>
                  </div>

                  <div>
                    <NdviChart
                      job={jobState.job}
                      day={day}
                      onDayChange={setDay}
                    />
                  </div>
                </div>
              )}
          </section>
        </main>
      </div>
    </div>
  );
}
