import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { DEFAULT_IRRIGATION_CONFIG } from '../components/Irrigation/defaultIrrigationConfig.ts';
import { usePolledResource } from '../hooks/usePolledResource.ts';
import type { SampleHints } from '../services/irrigationSampleData.ts';
import { fetchTelemetry, fetchWaterBudget } from '../services/irrigationService.ts';
import type { Sourced } from '../types/irrigation.ts';
import { combineSources } from '../utils/irrigationConfig.ts';
import type { IrrigationConfig } from '../utils/irrigationConfig.ts';
import { readDashboardHints } from '../utils/irrigationRoutes.ts';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function PageFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-ag-canvas text-ag-ink font-sans">{children}</div>;
}

function CenteredNotice({ title, body }: { title: string; body: string }) {
  return (
    <PageFrame>
      <main className="mx-auto max-w-xl px-4 py-16">
        <section className="rounded-lg border border-ag-border bg-ag-surface p-6" role="alert">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-ag-ink-secondary">{body}</p>
          <Link to="/map" className="mt-4 inline-flex min-h-12 items-center rounded-lg border border-ag-border-active px-4 text-sm font-semibold text-ag-brand hover:bg-ag-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ag-brand">
            ← Back to field map
          </Link>
        </section>
      </main>
    </PageFrame>
  );
}

export function ParcelIrrigationPage(): React.JSX.Element {
  const { parcelId = '' } = useParams<{ parcelId: string }>();
  const { search } = useLocation();
  const hints = useMemo(() => readDashboardHints(search), [search]);
  const resolved = DEFAULT_IRRIGATION_CONFIG;

  if (resolved.config === null) {
    return <CenteredNotice title="Water dashboard configuration error" body={resolved.error} />;
  }
  return <WaterDashboard key={parcelId} parcelId={parcelId} config={resolved.config} hints={hints} hintsKey={search} />;
}

function WaterDashboard({ parcelId, config, hints, hintsKey }: {
  parcelId: string;
  config: IrrigationConfig;
  hints: SampleHints;
  hintsKey: string;
}) {
  const budget = usePolledResource(
    (signal) => fetchWaterBudget({ config, parcelId, signal, hints }),
    config.pollMs,
    `${parcelId}|budget|${hintsKey}`,
  );
  const hourly = usePolledResource(
    (signal) => fetchTelemetry({ config, parcelId, signal, hints, window: '24h' }),
    config.pollMs,
    `${parcelId}|24h|${hintsKey}`,
  );
  const [childSources, setChildSources] = useState<Record<string, Sourced<unknown> | null>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  // Children (chart, valve card) report their own data source for the combined header label.
  const reportSource = useCallback((name: string, source: Sourced<unknown> | null) => {
    setChildSources((previous) => (previous[name] === source ? previous : { ...previous, [name]: source }));
  }, []);
  void reportSource;

  const refreshAll = () => {
    budget.refresh();
    hourly.refresh();
    setRefreshToken((token) => token + 1);
  };
  void refreshToken;

  const source = combineSources([budget.data, hourly.data, ...Object.values(childSources)], config.mode);
  const data = budget.data?.data ?? null;
  const parcelName = data?.parcelName ?? hints.parcelName ?? 'Parcel';
  const subtitle = [data?.cropName ?? hints.cropName, data?.soilProfileName ?? hints.soilProfileId].filter(Boolean).join(' · ');

  if (config.mode === 'api' && budget.data === null && budget.error?.includes('HTTP 404')) {
    return <CenteredNotice title="Parcel not found" body="The irrigation service has no parcel with this id." />;
  }

  return (
    <PageFrame>
      <header className="sticky top-0 z-10 border-b border-ag-border bg-ag-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link
            to="/map"
            className="inline-flex min-h-12 items-center rounded-lg border border-ag-border px-3 text-sm font-semibold text-ag-ink hover:bg-ag-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ag-brand md:min-h-10"
          >
            ← Field map
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{parcelName}</h1>
            <p className="truncate text-[13px] text-ag-ink-secondary">{subtitle || 'Parcel Water Dashboard'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${source.anySample ? 'border-ag-risk-low-border bg-ag-risk-low-bg text-amber-900' : 'border-ag-risk-healthy-border bg-ag-risk-healthy-bg text-emerald-900'}`}
            >
              <span aria-hidden="true">{source.anySample ? '◐' : '●'}</span>
              {source.label}
            </span>
            {budget.updatedAt !== null && (
              <span className="hidden font-mono text-xs tabular-nums text-ag-ink-tertiary sm:inline">
                Updated {timeFormat.format(budget.updatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex min-h-12 items-center rounded-lg border border-ag-border px-3 text-sm font-semibold text-ag-ink transition-transform hover:bg-ag-surface-muted active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ag-brand md:min-h-10"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,35%)] lg:py-6">
        <section aria-labelledby="water-budget-heading" className="rounded-lg border border-ag-border bg-ag-surface p-4 lg:col-start-2 lg:row-start-1">
          <h2 id="water-budget-heading" className="text-lg font-semibold tracking-tight">Water budget</h2>
          <p className="mt-2 text-sm text-ag-ink-secondary">
            {budget.error && !data ? budget.error : data ? `Moisture ${data.currentMoisturePct ?? '—'} %` : 'Loading water budget…'}
          </p>
        </section>
        <section aria-labelledby="valve-control-heading" className="rounded-lg border border-ag-border bg-ag-surface p-4 lg:col-start-2 lg:row-start-2">
          <h2 id="valve-control-heading" className="text-lg font-semibold tracking-tight">Valve control</h2>
        </section>
        <section aria-labelledby="telemetry-heading" className="rounded-lg border border-ag-border bg-ag-surface p-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <h2 id="telemetry-heading" className="text-lg font-semibold tracking-tight">Soil moisture &amp; water inputs</h2>
        </section>
      </main>
    </PageFrame>
  );
}
