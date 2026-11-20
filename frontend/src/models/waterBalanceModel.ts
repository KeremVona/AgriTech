import type { SoilConstants, WaterBudget } from '../types/irrigation.ts';

/**
 * FAO-56 root-zone water balance expressed in volumetric water content (VWC %).
 * Working in % keeps the gauge independent of rooting depth:
 *   TAW% = FC − WP, RAW% = MAD × TAW%, depletion% = FC − current (clamped to [0, TAW%]).
 */

export type DeficitZone = 'comfortable' | 'watch' | 'irrigation-soon' | 'stress';

export type TriggerEstimate =
  | { kind: 'hours'; hours: number }
  | { kind: 'reached' }
  | { kind: 'not-drying' }
  | { kind: 'unknown' };

const HOUR_MS = 3_600_000;
const TREND_WINDOW_HOURS = 24;
const MIN_TREND_SPAN_HOURS = 12;
const NOT_DRYING_SLOPE = -0.01;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Soil constants are stored as fractions in the DB; no real soil has FC ≤ 1 % VWC. */
export function normalizeSoilPercent(value: number): number {
  return value <= 1 ? value * 100 : value;
}

export function budgetSoil(budget: WaterBudget): SoilConstants | null {
  const { fieldCapacityPct, wiltingPointPct, saturationPct, madFraction } = budget;
  if (fieldCapacityPct === null || wiltingPointPct === null || saturationPct === null || madFraction === null) return null;
  return { fieldCapacityPct, wiltingPointPct, saturationPct, madFraction };
}

export function computeDeficit(input: SoilConstants & { currentMoisturePct: number }): {
  tawPct: number;
  rawPct: number;
  madThresholdPct: number;
  depletionPct: number;
  ratio: number;
  zone: DeficitZone;
} {
  const { fieldCapacityPct, wiltingPointPct, madFraction, currentMoisturePct } = input;
  const tawPct = fieldCapacityPct - wiltingPointPct;
  const rawPct = madFraction * tawPct;
  const madThresholdPct = fieldCapacityPct - rawPct;
  const depletionPct = clamp(fieldCapacityPct - currentMoisturePct, 0, tawPct);
  const ratio = rawPct > 0 ? depletionPct / rawPct : 0;
  const zone: DeficitZone = ratio >= 1 ? 'stress' : ratio >= 0.75 ? 'irrigation-soon' : ratio >= 0.5 ? 'watch' : 'comfortable';
  return { tawPct, rawPct, madThresholdPct, depletionPct, ratio, zone };
}

export function zoneTone(zone: DeficitZone): 'green' | 'yellow' | 'red' {
  if (zone === 'comfortable') return 'green';
  if (zone === 'stress') return 'red';
  return 'yellow';
}

/** Least-squares slope in % per hour. */
function slopePerHour(points: { hours: number; value: number }[]): number {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.hours, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    numerator += (p.hours - meanX) * (p.value - meanY);
    denominator += (p.hours - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export function estimateTrigger(input: {
  samples: { timestamp: string; soilMoisturePct: number | null }[];
  currentMoisturePct: number;
  madThresholdPct: number;
  apiHours: number | null;
}): TriggerEstimate {
  const { samples, currentMoisturePct, madThresholdPct, apiHours } = input;
  if (currentMoisturePct <= madThresholdPct) return { kind: 'reached' };
  if (apiHours !== null) return { kind: 'hours', hours: apiHours };

  const readings = samples
    .filter((s): s is { timestamp: string; soilMoisturePct: number } => s.soilMoisturePct !== null)
    .map((s) => ({ ms: Date.parse(s.timestamp), value: s.soilMoisturePct }))
    .filter((r) => Number.isFinite(r.ms));
  if (readings.length < 2) return { kind: 'unknown' };

  const latestMs = Math.max(...readings.map((r) => r.ms));
  const recent = readings
    .filter((r) => latestMs - r.ms <= TREND_WINDOW_HOURS * HOUR_MS)
    .map((r) => ({ hours: (r.ms - latestMs) / HOUR_MS, value: r.value }));
  const spanHours = -Math.min(...recent.map((r) => r.hours));
  if (recent.length < 2 || spanHours < MIN_TREND_SPAN_HOURS) return { kind: 'unknown' };

  const slope = slopePerHour(recent);
  if (slope >= NOT_DRYING_SLOPE) return { kind: 'not-drying' };
  return { kind: 'hours', hours: (currentMoisturePct - madThresholdPct) / -slope };
}

export function isStale(latestReadingAt: string | null, nowMs: number, maxAgeHours = 2): boolean {
  if (latestReadingAt === null) return true;
  const readingMs = Date.parse(latestReadingAt);
  if (!Number.isFinite(readingMs)) return true;
  return nowMs - readingMs > maxAgeHours * HOUR_MS;
}

/** Gauge sweeps 240° (−120° … +120° from 12 o'clock) over 0 → 150 % of RAW. */
export function gaugeAngleDeg(ratio: number): number {
  return -120 + clamp(ratio / 1.5, 0, 1) * 240;
}

export function gaugeAriaValueNow(ratio: number): number {
  return Math.round(clamp(ratio, 0, 1.5) * 100);
}
