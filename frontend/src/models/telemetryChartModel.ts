import type {
  IrrigationTriggerType,
  SoilConstants,
  TelemetryResponse,
  TelemetryWindow,
} from '../types/irrigation.ts';

export interface ChartRow {
  timestamp: string;
  moisture: number | null;
  moistureForecast: number | null;
  etcMm: number | null;
  effectiveRainMm: number;
  irrigationMm: number;
  isForecast: boolean;
  events: { durationMinutes: number; triggerType: IrrigationTriggerType }[];
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_NAMES: Record<TelemetryWindow, string> = { '24h': '24-hour', '7d': '7-day', '30d': '30-day' };

const one = (value: number): string => value.toFixed(1);

export function buildChartRows(response: TelemetryResponse): ChartRow[] {
  const bucketMs = response.resolution === 'hour' ? HOUR_MS : DAY_MS;
  const rows: ChartRow[] = response.points.map((point) => {
    const startMs = Date.parse(point.timestamp);
    const events = response.irrigationEvents
      .filter((event) => {
        const eventMs = Date.parse(event.actualStart ?? event.scheduledStart);
        return eventMs >= startMs && eventMs < startMs + bucketMs;
      })
      .map(({ durationMinutes, triggerType }) => ({ durationMinutes, triggerType }));
    return {
      timestamp: point.timestamp,
      moisture: point.isForecast ? null : point.soilMoisturePct,
      moistureForecast: point.isForecast ? point.soilMoisturePct : null,
      etcMm: point.etcMm,
      effectiveRainMm: point.effectiveRainMm,
      irrigationMm: point.irrigationMm,
      isForecast: point.isForecast,
      events,
    };
  });

  // Join the dashed forecast line to the solid history line.
  const firstForecast = rows.findIndex((r) => r.isForecast);
  if (firstForecast > 0) {
    const lastHistory = rows[firstForecast - 1];
    lastHistory.moistureForecast = lastHistory.moisture;
  }
  return rows;
}

export function soilBands(soil: SoilConstants | null): {
  saturationPct: number;
  fieldCapacityPct: number;
  madThresholdPct: number;
} | null {
  if (soil === null) return null;
  const madThresholdPct = soil.fieldCapacityPct - soil.madFraction * (soil.fieldCapacityPct - soil.wiltingPointPct);
  return { saturationPct: soil.saturationPct, fieldCapacityPct: soil.fieldCapacityPct, madThresholdPct };
}

export function computeAxisDomains(rows: ChartRow[], saturationPct: number | null): {
  left: [0, number];
  right: [0, number];
} {
  const leftMax = saturationPct === null ? 50 : Math.max(50, Math.ceil(saturationPct + 5));
  const maxRight = rows.reduce(
    (max, r) => Math.max(max, r.effectiveRainMm + r.irrigationMm, r.etcMm ?? 0),
    0,
  );
  return { left: [0, leftMax], right: [0, Math.max(40, Math.ceil(maxRight * 1.2))] };
}

export function formatBucketLabel(timestamp: string, resolution: 'hour' | 'day', timeZone?: string): string {
  const date = new Date(timestamp);
  if (resolution === 'day') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date);
}

export function tooltipLines(row: ChartRow, madThresholdPct: number | null): string[] {
  const lines: string[] = [];
  const moisture = row.moisture ?? row.moistureForecast;
  if (moisture !== null) lines.push(`Soil moisture ${one(moisture)} %`);
  if (row.etcMm !== null) lines.push(`ETc ${one(row.etcMm)} mm`);
  lines.push(`Effective rain ${one(row.effectiveRainMm)} mm`);
  lines.push(`Irrigation ${one(row.irrigationMm)} mm`);
  for (const event of row.events) {
    const trigger = event.triggerType === 'MANUAL_OVERRIDE' ? 'Manual' : 'Automatic';
    lines.push(`Valve opened: ${event.durationMinutes} min (${trigger})`);
  }
  if (moisture !== null && madThresholdPct !== null && moisture < madThresholdPct) lines.push('Below MAD threshold');
  if (row.isForecast) lines.push('Forecast');
  return lines;
}

function latestHistory(rows: ChartRow[]): ChartRow | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i].isForecast && rows[i].moisture !== null) return rows[i];
  }
  return null;
}

export function chartAriaLabel(rows: ChartRow[], window: TelemetryWindow, madThresholdPct: number | null): string {
  const latest = latestHistory(rows);
  const parts = [`Soil moisture ${WINDOW_NAMES[window]} chart`];
  parts.push(latest?.moisture != null ? `latest ${one(latest.moisture)} %` : 'no readings');
  if (madThresholdPct !== null) parts.push(`MAD threshold ${one(madThresholdPct)} %`);
  return parts.join(', ');
}

export function latestValuesSummary(rows: ChartRow[]): string {
  const latest = latestHistory(rows);
  if (latest === null || latest.moisture === null) return 'No soil moisture readings in this window.';
  const etc = latest.etcMm === null ? '' : `, ETc ${one(latest.etcMm)} mm`;
  return `Latest reading: soil moisture ${one(latest.moisture)} %${etc}, effective rain ${one(latest.effectiveRainMm)} mm, irrigation ${one(latest.irrigationMm)} mm.`;
}
