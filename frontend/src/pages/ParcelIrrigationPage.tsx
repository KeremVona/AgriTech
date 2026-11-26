import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { DeficitGauge } from '../components/Irrigation/DeficitGauge.tsx';
import { DEFAULT_IRRIGATION_CONFIG } from '../components/Irrigation/defaultIrrigationConfig.ts';
import { ErrorNotice } from '../components/Irrigation/ErrorNotice.tsx';
import { IrrigationControlCard } from '../components/Irrigation/IrrigationControlCard.tsx';
import { ParcelTelemetryChart } from '../components/Irrigation/ParcelTelemetryChart.tsx';
import { AppHeader } from '../components/ui/AppHeader.tsx';
import { SampleTag } from '../components/Irrigation/SampleTag.tsx';
import { useNow } from '../hooks/useNow.ts';
import { usePolledResource } from '../hooks/usePolledResource.ts';
import type { SampleHints } from '../services/irrigationSampleData.ts';
import { fetchTelemetry, fetchWaterBudget } from '../services/irrigationService.ts';
import type { Sourced } from '../types/irrigation.ts';
import { combineSources, gaugeSamples } from '../utils/irrigationConfig.ts';
import type { IrrigationConfig } from '../utils/irrigationConfig.ts';
import { readDashboardHints } from '../utils/irrigationRoutes.ts';
import { BUTTON } from '../components/Diagnostics/styles.ts';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="ui-page min-h-screen antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ui-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppHeader />
      {children}
    </div>
  );
}

function CenteredNotice({ title, body }: { title: string; body: string }) {
  return (
    <PageFrame>
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <section className="rounded-2xl border border-ui-line bg-ui-bg p-6" role="alert">
          <h1 className="text-xl font-medium text-ui-ink">{title}</h1>
          <p className="mt-2 text-sm text-ui-ink-2">{body}</p>
          <Link to="/map" className={`mt-5 ${BUTTON.outline}`}>
            Back to field map
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
  const reportChartSource = useCallback((source: Sourced<unknown> | null) => reportSource('chart', source), [reportSource]);
  const reportValveSource = useCallback((source: Sourced<unknown> | null) => reportSource('valve', source), [reportSource]);

  const refreshAll = () => {
    budget.refresh();
    hourly.refresh();
    setRefreshToken((token) => token + 1);
  };

  const now = useNow(60_000, true);
  const source = combineSources([budget.data, hourly.data, ...Object.values(childSources)], config.mode);
  const pill = source.label === 'Loading…' && budget.error
    ? { label: 'Live data unavailable', dot: 'bg-red-600', className: 'bg-red-50 text-red-800' }
    : source.label === 'Loading…'
      ? { label: source.label, dot: 'bg-ui-ink-3', className: 'bg-ui-warm text-ui-ink-2' }
      : source.anySample
        ? { label: source.label, dot: 'bg-amber-500', className: 'bg-amber-50 text-amber-800' }
        : { label: source.label, dot: 'bg-emerald-600', className: 'bg-emerald-50 text-emerald-800' };
  const data = budget.data?.data ?? null;
  const parcelName = data?.parcelName ?? hints.parcelName ?? 'Parcel';
  const subtitle = [data?.cropName ?? hints.cropName, data?.soilProfileName ?? hints.soilProfileId].filter(Boolean).join(' · ');

  if (config.mode === 'api' && budget.data === null && budget.error?.includes('HTTP 404')) {
    return <CenteredNotice title="Parcel not found" body="The irrigation service has no parcel with this id." />;
  }

  return (
    <PageFrame>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-ui-ink-3">
          <Link to="/map" className="inline-flex min-h-11 items-center rounded hover:text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent">
            Field map
          </Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span className="text-ui-ink-2">Water</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[32px] font-medium leading-tight tracking-[-0.02em] text-ui-ink sm:text-[40px]">{parcelName}</h1>
            <p className="mt-1 truncate text-[15px] text-ui-ink-2">{subtitle || 'Water dashboard'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${pill.className}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${pill.dot}`} />
              {pill.label}
            </span>
            {budget.updatedAt !== null && (
              <span className="hidden text-[13px] tabular-nums text-ui-ink-3 sm:inline">Updated {timeFormat.format(budget.updatedAt)}</span>
            )}
            <button type="button" onClick={refreshAll} className={BUTTON.outline}>
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,35%)]">
          <section aria-labelledby="water-budget-heading" className="rounded-2xl border border-ui-line bg-ui-bg p-5 lg:col-start-2 lg:row-start-1">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="water-budget-heading" className="text-[17px] font-medium text-ui-ink">Water budget</h2>
              {budget.data?.source === 'sample' && <SampleTag />}
            </div>
            {data ? (
              <DeficitGauge
                currentMoisture={data.currentMoisturePct}
                fieldCapacity={data.fieldCapacityPct}
                wiltingPoint={data.wiltingPointPct}
                mad={data.madFraction}
                hoursUntilTrigger={data.hoursUntilTrigger}
                recentSamples={gaugeSamples(budget.data, hourly.data)}
                latestReadingAt={data.latestReadingAt}
                nowMs={now}
              />
            ) : budget.error ? (
              <ErrorNotice message={budget.error} onRetry={budget.refresh} />
            ) : (
              <div className="h-[300px] animate-pulse rounded-xl bg-ui-warm motion-reduce:animate-none" role="status" aria-label="Loading water budget" />
            )}
            {data && budget.error && <p className="mt-3 text-xs text-ui-ink-3" role="status">Could not refresh: {budget.error}</p>}
          </section>
          <section aria-labelledby="valve-control-heading" className="rounded-2xl border border-ui-line bg-ui-bg p-5 lg:col-start-2 lg:row-start-2">
            <IrrigationControlCard
              parcelId={parcelId}
              config={config}
              onSourceChange={reportValveSource}
              refreshToken={refreshToken}
              headingId="valve-control-heading"
            />
          </section>
          <section aria-labelledby="telemetry-heading" className="min-w-0 rounded-2xl border border-ui-line bg-ui-bg p-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
            <ParcelTelemetryChart
              parcelId={parcelId}
              config={config}
              hints={hints}
              onSourceChange={reportChartSource}
              refreshToken={refreshToken}
              headingId="telemetry-heading"
            />
          </section>
        </div>
      </main>
    </PageFrame>
  );
}
