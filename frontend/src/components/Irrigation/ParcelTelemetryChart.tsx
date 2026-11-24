import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePolledResource } from '../../hooks/usePolledResource.ts';
import {
  buildChartRows,
  chartAriaLabel,
  computeAxisDomains,
  formatBucketLabel,
  latestValuesSummary,
  soilBands,
  tooltipLines,
} from '../../models/telemetryChartModel.ts';
import type { ChartRow } from '../../models/telemetryChartModel.ts';
import type { SampleHints } from '../../services/irrigationSampleData.ts';
import { fetchTelemetry } from '../../services/irrigationService.ts';
import type { Sourced, TelemetryResponse, TelemetryWindow } from '../../types/irrigation.ts';
import type { IrrigationConfig } from '../../utils/irrigationConfig.ts';
import { DEFAULT_IRRIGATION_CONFIG } from './defaultIrrigationConfig.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { SampleTag } from './SampleTag.tsx';
import { TelemetryWindowToggle } from './TelemetryWindowToggle.tsx';

export interface ParcelTelemetryChartProps {
  parcelId: string;
  config?: IrrigationConfig;
  hints?: SampleHints;
  onSourceChange?: (source: Sourced<unknown> | null) => void;
  /** Changing this number forces an immediate reload (page-level Refresh). */
  refreshToken?: number;
  headingId?: string;
}

const CHART_POLL_MS = 60_000;
const COLORS = {
  moisture: '#0891B2',
  rain: '#38BDF8',
  irrigation: '#10B981',
  etc: '#475569',
  fieldCapacity: '#0E7490',
  saturation: '#64748B',
  mad: '#DC2626',
  axisRight: '#64748B',
};

const hourTooltipFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function rowLabel(row: ChartRow, resolution: TelemetryResponse['resolution']): string {
  return resolution === 'day' ? `${formatBucketLabel(row.timestamp, 'day')} (UTC day)` : hourTooltipFormat.format(new Date(row.timestamp));
}

function ChartTooltip({ active, payload, madThresholdPct, resolution }: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  madThresholdPct: number | null;
  resolution: TelemetryResponse['resolution'];
}) {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-ag-ink">{rowLabel(row, resolution)}</p>
      <ul className="space-y-0.5 font-mono tabular-nums text-ag-ink-secondary">
        {tooltipLines(row, madThresholdPct).map((line) => (
          <li key={line} className={line.startsWith('Valve') || line === 'Below MAD threshold' ? 'font-semibold text-ag-ink' : undefined}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function LegendItem({ color, label, kind }: { color: string; label: string; kind: 'line' | 'dashed' | 'bar' }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      {kind === 'bar'
        ? <span aria-hidden="true" className="inline-block h-3 w-2.5 rounded-t-sm" style={{ backgroundColor: color }} />
        : <span aria-hidden="true" className="inline-block w-4 border-t-2" style={{ borderColor: color, borderTopStyle: kind === 'dashed' ? 'dashed' : 'solid' }} />}
      {label}
    </li>
  );
}

/** Dual-axis soil moisture / water input chart (TODO-307). */
export function ParcelTelemetryChart(props: ParcelTelemetryChartProps): React.JSX.Element {
  const config = props.config ?? DEFAULT_IRRIGATION_CONFIG.config;
  if (config === null) return <ErrorNotice message={DEFAULT_IRRIGATION_CONFIG.error ?? 'Irrigation configuration error.'} />;
  return <TelemetryChartBody {...props} config={config} />;
}

function TelemetryChartBody({ parcelId, config, hints, onSourceChange, refreshToken = 0, headingId }: ParcelTelemetryChartProps & { config: IrrigationConfig }) {
  const [timeWindow, setTimeWindow] = useState<TelemetryWindow>('7d');
  const hintsKey = JSON.stringify(hints ?? {});
  const key = `${parcelId}|${timeWindow}|${hintsKey}|${config.mode}|${refreshToken}`;
  const resource = usePolledResource(
    (signal) => fetchTelemetry({ config, parcelId, signal, hints, window: timeWindow }),
    CHART_POLL_MS,
    key,
  );

  useEffect(() => {
    onSourceChange?.(resource.data);
  }, [onSourceChange, resource.data]);

  const response = resource.data?.data ?? null;
  const showingOldWindow = response !== null && resource.dataKey !== key;
  const rows = useMemo(() => (response ? buildChartRows(response) : []), [response]);
  const bands = soilBands(response?.soil ?? null);
  const domains = computeAxisDomains(rows, bands?.saturationPct ?? null);
  const madThreshold = bands?.madThresholdPct ?? null;
  const hasReadings = rows.some((r) => !r.isForecast && r.moisture !== null);
  const hasEtc = rows.some((r) => r.etcMm !== null);
  const forecastRows = rows.filter((r) => r.isForecast);
  const resolution = response?.resolution ?? 'day';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">Soil moisture &amp; water inputs</h2>
          {resource.data?.source === 'sample' && <SampleTag />}
        </div>
        <TelemetryWindowToggle value={timeWindow} onChange={setTimeWindow} disabled={showingOldWindow && resource.loading} />
      </div>

      {response === null ? (
        resource.error
          ? <ErrorNotice message={resource.error} onRetry={resource.refresh} />
          : <div className="h-[260px] animate-pulse rounded-lg bg-ag-surface-muted motion-reduce:animate-none sm:h-[320px]" role="status" aria-label="Loading chart" />
      ) : !hasReadings ? (
        <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-ag-border-field bg-ag-surface-muted text-sm text-ag-ink-secondary sm:h-[320px]">
          No sensor readings yet for this window
        </div>
      ) : (
        <>
          <div className="mb-1 flex justify-between text-[11px] font-semibold" aria-hidden="true">
            <span style={{ color: COLORS.moisture }}>Soil VWC (%)</span>
            <span style={{ color: COLORS.axisRight }}>Precipitation &amp; Irrigation (mm)</span>
          </div>
          <div
            role="img"
            aria-label={chartAriaLabel(rows, response.window, madThreshold)}
            className={`h-[260px] transition-opacity sm:h-[320px] ${showingOldWindow ? 'opacity-50' : ''}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value: string) => formatBucketLabel(value, resolution)}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  minTickGap={16}
                />
                <YAxis
                  yAxisId="left"
                  domain={domains.left}
                  tick={{ fontSize: 11, fill: COLORS.moisture }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickCount={Math.floor(domains.left[1] / 10) + 1}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={domains.right}
                  tick={{ fontSize: 11, fill: COLORS.axisRight }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                />

                {bands && (
                  <>
                    <ReferenceArea yAxisId="left" y1={bands.fieldCapacityPct} y2={bands.saturationPct} fill="rgb(100,116,139)" fillOpacity={0.06} ifOverflow="hidden"
                      label={{ value: 'Drainage', position: 'insideTopLeft', fontSize: 10, fill: '#475569' }} />
                    <ReferenceArea yAxisId="left" y1={bands.madThresholdPct} y2={bands.fieldCapacityPct} fill="rgb(8,145,178)" fillOpacity={0.06}
                      label={{ value: 'Readily available', position: 'insideTopLeft', fontSize: 10, fill: '#0E7490' }} />
                    <ReferenceArea yAxisId="left" y1={0} y2={bands.madThresholdPct} fill="rgb(220,38,38)" fillOpacity={0.08}
                      label={{ value: 'Stress', position: 'insideBottomLeft', fontSize: 10, fill: '#B91C1C' }} />
                    <ReferenceLine yAxisId="left" y={bands.saturationPct} stroke={COLORS.saturation} strokeDasharray="2 3" ifOverflow="hidden" />
                    <ReferenceLine yAxisId="left" y={bands.fieldCapacityPct} stroke={COLORS.fieldCapacity} strokeWidth={1.5}
                      label={{ value: 'Field capacity θFC', position: 'insideTopRight', fontSize: 10, fill: COLORS.fieldCapacity }} />
                    <ReferenceLine yAxisId="left" y={bands.madThresholdPct} stroke={COLORS.mad} strokeWidth={1.5} strokeDasharray="4 4"
                      label={{ value: 'MAD threshold', position: 'insideBottomRight', fontSize: 10, fill: '#B91C1C' }} />
                  </>
                )}
                {forecastRows.length > 0 && (
                  <ReferenceArea yAxisId="left" x1={forecastRows[0].timestamp} x2={forecastRows[forecastRows.length - 1].timestamp}
                    fill="rgb(15,23,42)" fillOpacity={0.05} label={{ value: 'Forecast', position: 'insideTop', fontSize: 10, fill: '#475569' }} />
                )}

                <Bar yAxisId="right" dataKey="effectiveRainMm" stackId="water" fill={COLORS.rain} maxBarSize={14} isAnimationActive={false} />
                <Bar yAxisId="right" dataKey="irrigationMm" stackId="water" fill={COLORS.irrigation} fillOpacity={0.85} maxBarSize={14} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                {hasEtc && (
                  <Line yAxisId="right" dataKey="etcMm" type="monotoneX" stroke={COLORS.etc} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                )}
                <Line yAxisId="left" dataKey="moisture" type="monotoneX" stroke={COLORS.moisture} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="left" dataKey="moistureForecast" type="monotoneX" stroke={COLORS.moisture} strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />

                <Tooltip
                  cursor={{ stroke: '#94A3B8', strokeWidth: 1 }}
                  content={({ active, payload }) => (
                    <ChartTooltip active={active} payload={payload} madThresholdPct={madThreshold} resolution={resolution} />
                  )}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">{latestValuesSummary(rows)}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ag-ink-secondary" aria-label="Chart legend">
            <LegendItem color={COLORS.moisture} label="Soil moisture" kind="line" />
            {forecastRows.length > 0 && <LegendItem color={COLORS.moisture} label="Forecast" kind="dashed" />}
            {hasEtc && <LegendItem color={COLORS.etc} label="ETc" kind="dashed" />}
            <LegendItem color={COLORS.rain} label="Effective rain" kind="bar" />
            <LegendItem color={COLORS.irrigation} label="Irrigation" kind="bar" />
            {bands && <LegendItem color={COLORS.mad} label="MAD threshold" kind="dashed" />}
          </ul>
          {resource.error && <p className="mt-2 text-xs text-ag-ink-secondary" role="status">Could not refresh: {resource.error}</p>}
        </>
      )}
    </div>
  );
}
