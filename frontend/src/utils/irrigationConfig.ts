import type { DataSource, IrrigationDataMode, Sourced, TelemetryResponse } from '../types/irrigation.ts';

export interface IrrigationConfig {
  apiBaseUrl: string;
  mode: IrrigationDataMode;
  pollMs: number;
}

type Environment = Partial<Record<'VITE_API_BASE_URL' | 'VITE_IRRIGATION_DATA_MODE' | 'VITE_IRRIGATION_POLL_MS', string>>;

const DEFAULT_POLL_MS = 15_000;
const MIN_POLL_MS = 5_000;

export function resolveIrrigationConfig(env: Environment): { config: IrrigationConfig; error: null } | { config: null; error: string } {
  const mode = env.VITE_IRRIGATION_DATA_MODE?.trim() || 'auto';
  if (mode !== 'auto' && mode !== 'api' && mode !== 'sample') {
    return { config: null, error: 'Invalid VITE_IRRIGATION_DATA_MODE. Choose auto, api, or sample in frontend/.env.local.' };
  }
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || 'http://localhost:5051';
  try {
    const url = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error();
  } catch {
    return { config: null, error: 'Invalid API base URL. Set VITE_API_BASE_URL to an absolute HTTP or HTTPS URL in frontend/.env.local.' };
  }
  const rawPoll = env.VITE_IRRIGATION_POLL_MS?.trim();
  const parsedPoll = rawPoll ? Number(rawPoll) : Number.NaN;
  const pollMs = Number.isFinite(parsedPoll) ? Math.max(MIN_POLL_MS, parsedPoll) : DEFAULT_POLL_MS;
  return { config: { apiBaseUrl, mode, pollMs }, error: null };
}

export type SourceLabel =
  | 'Live data'
  | 'Sample data'
  | 'Sample data — live data unavailable'
  | 'Partly sample data — some live data unavailable'
  | 'Loading…';

export function combineSources(sources: (Sourced<unknown> | null)[], mode: IrrigationDataMode): { label: SourceLabel; anySample: boolean } {
  const loaded = sources.filter((s): s is Sourced<unknown> => s !== null);
  if (loaded.length === 0) return { label: 'Loading…', anySample: false };
  const sampleCount = loaded.filter((s) => s.source === 'sample').length;
  if (sampleCount === 0) return { label: 'Live data', anySample: false };
  if (mode === 'sample') return { label: 'Sample data', anySample: true };
  if (sampleCount === loaded.length) return { label: 'Sample data — live data unavailable', anySample: true };
  return { label: 'Partly sample data — some live data unavailable', anySample: true };
}

/**
 * Hourly readings for the gauge's trigger estimate, only when they come from the same
 * source as the water budget — never a sample drying slope applied to a live reading.
 */
export function gaugeSamples(
  budget: Sourced<unknown> | null,
  hourly: Sourced<TelemetryResponse> | null,
): TelemetryResponse['points'] {
  if (budget === null || hourly === null || budget.source !== hourly.source) return [];
  return hourly.data.points;
}

/** Valve controls never drive a simulator unless the whole app is in sample mode (spec §5.4). */
export function controlsEnabled(statusSource: DataSource | null, mode: IrrigationDataMode): boolean {
  return mode === 'sample' || statusSource === 'api';
}
