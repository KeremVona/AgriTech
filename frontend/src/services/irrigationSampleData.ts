import { sampleFarmMap } from '../data/sampleFarmMap.ts';
import { computeDeficit } from '../models/waterBalanceModel.ts';
import { ACTIVE_RUN_MESSAGE, MANUAL_DURATIONS } from '../models/valveControlModel.ts';
import type {
  IrrigationEvent,
  IrrigationStatus,
  SoilConstants,
  TelemetryPoint,
  TelemetryResponse,
  TelemetryWindow,
  WaterBudget,
} from '../types/irrigation.ts';

/**
 * Deterministic, offline sample data for the Parcel Water Dashboard (spec §8).
 * One hourly series per parcel feeds every sample output so the gauge, chart
 * and budget always agree. Randomness is seeded per (parcel, UTC day) and the
 * simulation is anchored at a UTC-day boundary, so history is stable within a day.
 */

export interface SampleHints {
  parcelName?: string | null;
  cropName?: string | null;
  soilProfileId?: string | null;
}

type SampleSoilId = 'sand' | 'sandy_loam' | 'silt' | 'clay';

/** Mirrors backend/Data/Migrations/20261112212907_SeedReferenceData.cs, in percent. */
export const SAMPLE_SOILS: Record<SampleSoilId, { name: string } & SoilConstants> = {
  sand: { name: 'Sand', fieldCapacityPct: 12, wiltingPointPct: 5, saturationPct: 38, madFraction: 0.5 },
  sandy_loam: { name: 'Sandy Loam', fieldCapacityPct: 22, wiltingPointPct: 10, saturationPct: 43, madFraction: 0.5 },
  silt: { name: 'Silt', fieldCapacityPct: 31, wiltingPointPct: 14, saturationPct: 48, madFraction: 0.5 },
  clay: { name: 'Clay', fieldCapacityPct: 38, wiltingPointPct: 22, saturationPct: 50, madFraction: 0.5 },
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_DAYS = 31;
const FORECAST_DAYS = 7;
/** mm of water per 1 % VWC for an assumed 0.4 m root zone. */
const MM_PER_PCT = 4;
/** Assumed irrigated area for sample volumes (1 ha) and drip efficiency. */
const SAMPLE_AREA_M2 = 10_000;
const DRIP_EFFICIENCY = 0.88;
const SAMPLE_FLOW_LPM = 100;
const AUTOMATED_RUN_MINUTES = 45;
const OPENING_MS = 3_000;

/** Daylight drying curve over 06:00–17:59 UTC, normalised to sum to 1. */
const DAYLIGHT_WEIGHTS = (() => {
  const raw = Array.from({ length: 12 }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / 12));
  const total = raw.reduce((sum, w) => sum + w, 0);
  return raw.map((w) => w / total);
})();

const round2 = (value: number): number => Math.round(value * 100) / 100;
const iso = (ms: number): string => new Date(ms).toISOString();

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function findSampleFeature(parcelId: string) {
  return sampleFarmMap.features.find((f) => f.properties.id === parcelId)?.properties ?? null;
}

function resolveSoil(parcelId: string, hints?: SampleHints): { id: SampleSoilId; isDefault: boolean } {
  const candidate = hints?.soilProfileId ?? findSampleFeature(parcelId)?.soil_profile_id ?? null;
  if (candidate && candidate in SAMPLE_SOILS) return { id: candidate as SampleSoilId, isDefault: false };
  return { id: 'sandy_loam', isDefault: true };
}

function soilConstants(id: SampleSoilId): SoilConstants {
  const { fieldCapacityPct, wiltingPointPct, saturationPct, madFraction } = SAMPLE_SOILS[id];
  return { fieldCapacityPct, wiltingPointPct, saturationPct, madFraction };
}

interface SimHour {
  t: number;
  moisture: number;
  etcMm: number;
  effectiveRainMm: number;
  irrigationMm: number;
  isForecast: boolean;
  event: IrrigationEvent | null;
}

function simulateHourlySeries(parcelId: string, soil: SoilConstants, nowMs: number): { hours: SimHour[]; nowHourMs: number; todayStartMs: number } {
  const nowHourMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const todayStartMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const startMs = todayStartMs - HISTORY_DAYS * DAY_MS;
  const endMs = todayStartMs + (FORECAST_DAYS + 1) * DAY_MS;
  const { madThresholdPct } = computeDeficit({ ...soil, currentMoisturePct: soil.fieldCapacityPct });

  const hours: SimHour[] = [];
  let moisture = soil.fieldCapacityPct;
  let dailyEtc = 0;
  let rainMm = 0;
  let rainHour = -1;

  for (let t = startMs; t < endMs; t += HOUR_MS) {
    const hour = new Date(t).getUTCHours();
    if (hour === 0 || hours.length === 0) {
      const rng = mulberry32(fnv1a(`${parcelId}:${Math.floor(t / DAY_MS)}`));
      dailyEtc = 3 + 3 * rng();
      const rains = rng() < 0.15;
      rainMm = rains ? 6 + 14 * rng() : 0;
      rainHour = rains ? Math.floor(rng() * 24) : -1;
    }
    const isForecast = t > nowHourMs;
    const etcMm = hour >= 6 && hour < 18 ? dailyEtc * DAYLIGHT_WEIGHTS[hour - 6] : 0;
    const effectiveRainMm = hour === rainHour ? Math.max(0, (rainMm - 5) * 0.75) : 0;

    let irrigationMm = 0;
    let event: IrrigationEvent | null = null;
    if (!isForecast && moisture <= madThresholdPct) {
      irrigationMm = (soil.fieldCapacityPct - moisture) * MM_PER_PCT;
      event = {
        id: `sample-${parcelId}-${iso(t)}`,
        triggerType: 'AUTOMATED_DEFICIT',
        status: 'COMPLETED',
        scheduledStart: iso(t),
        actualStart: iso(t),
        completedAt: iso(t + AUTOMATED_RUN_MINUTES * 60_000),
        durationMinutes: AUTOMATED_RUN_MINUTES,
        waterVolumeLiters: Math.round((irrigationMm * SAMPLE_AREA_M2) / DRIP_EFFICIENCY),
      };
    }

    hours.push({ t, moisture: round2(moisture), etcMm: round2(etcMm), effectiveRainMm: round2(effectiveRainMm), irrigationMm: round2(irrigationMm), isForecast, event });

    // FAO-56: water above field capacity is lost to deep percolation within the hour.
    const next = moisture + (effectiveRainMm + irrigationMm - etcMm) / MM_PER_PCT;
    moisture = Math.min(soil.fieldCapacityPct, Math.max(soil.wiltingPointPct, next));
  }
  return { hours, nowHourMs, todayStartMs };
}

function toDailyPoints(hours: SimHour[], firstDayMs: number, dayCount: number, nowHourMs: number): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  for (let d = 0; d < dayCount; d++) {
    const dayStart = firstDayMs + d * DAY_MS;
    const inDay = hours.filter((h) => h.t >= dayStart && h.t < dayStart + DAY_MS);
    const isForecast = dayStart > nowHourMs;
    const counted = isForecast ? inDay : inDay.filter((h) => h.t <= nowHourMs);
    if (counted.length === 0) continue;
    const sum = (key: 'etcMm' | 'effectiveRainMm' | 'irrigationMm') => round2(counted.reduce((total, h) => total + h[key], 0));
    points.push({
      timestamp: iso(dayStart),
      soilMoisturePct: counted[counted.length - 1].moisture,
      etcMm: sum('etcMm'),
      effectiveRainMm: sum('effectiveRainMm'),
      irrigationMm: sum('irrigationMm'),
      isForecast,
    });
  }
  return points;
}

export function createSampleTelemetry(parcelId: string, window: TelemetryWindow, nowMs: number, hints?: SampleHints): TelemetryResponse {
  const soilId = resolveSoil(parcelId, hints).id;
  const soil = soilConstants(soilId);
  const { hours, nowHourMs, todayStartMs } = simulateHourlySeries(parcelId, soil, nowMs);

  if (window === '24h') {
    const windowStart = nowHourMs - 23 * HOUR_MS;
    const inWindow = hours.filter((h) => h.t >= windowStart && h.t <= nowHourMs);
    return {
      parcelId,
      window,
      resolution: 'hour',
      soil,
      points: inWindow.map((h) => ({
        timestamp: iso(h.t),
        soilMoisturePct: h.moisture,
        etcMm: h.etcMm,
        effectiveRainMm: h.effectiveRainMm,
        irrigationMm: h.irrigationMm,
        isForecast: false,
      })),
      irrigationEvents: inWindow.flatMap((h) => (h.event ? [h.event] : [])),
    };
  }

  const historyDays = window === '7d' ? 7 : 30;
  const firstDayMs = todayStartMs - (historyDays - 1) * DAY_MS;
  return {
    parcelId,
    window,
    resolution: 'day',
    soil,
    points: toDailyPoints(hours, firstDayMs, historyDays + FORECAST_DAYS, nowHourMs),
    irrigationEvents: hours.filter((h) => h.event && h.t >= firstDayMs && h.t <= nowHourMs).map((h) => h.event as IrrigationEvent),
  };
}

export function createSampleWaterBudget(parcelId: string, nowMs: number, hints?: SampleHints): WaterBudget {
  const soilChoice = resolveSoil(parcelId, hints);
  const soil = soilConstants(soilChoice.id);
  const { hours, nowHourMs } = simulateHourlySeries(parcelId, soil, nowMs);
  const current = hours.find((h) => h.t === nowHourMs) ?? null;
  const feature = findSampleFeature(parcelId);
  return {
    parcelId,
    parcelName: hints?.parcelName || feature?.name || 'Sample parcel',
    cropName: hints?.cropName || feature?.crop_name || null,
    soilProfileId: soilChoice.id,
    soilProfileName: soilChoice.isDefault ? `${SAMPLE_SOILS[soilChoice.id].name} (sample default)` : SAMPLE_SOILS[soilChoice.id].name,
    ...soil,
    currentMoisturePct: current?.moisture ?? null,
    latestReadingAt: current ? iso(current.t) : null,
    hoursUntilTrigger: null,
    systemFlowRateLpm: SAMPLE_FLOW_LPM,
  };
}

export function createSampleValveSimulator(): {
  getStatus(parcelId: string, nowMs: number): IrrigationStatus;
  startManual(parcelId: string, durationMinutes: number, nowMs: number): IrrigationEvent;
  abort(parcelId: string, eventId: string, nowMs: number): IrrigationEvent;
} {
  const parcels = new Map<string, { active: IrrigationEvent | null; last: IrrigationEvent | null }>();

  function settle(parcelId: string, nowMs: number) {
    const entry = parcels.get(parcelId) ?? { active: null, last: null };
    parcels.set(parcelId, entry);
    const active = entry.active;
    if (active?.actualStart && nowMs >= Date.parse(active.actualStart) + active.durationMinutes * 60_000) {
      entry.last = { ...active, status: 'COMPLETED', completedAt: iso(Date.parse(active.actualStart) + active.durationMinutes * 60_000) };
      entry.active = null;
    }
    return entry;
  }

  return {
    getStatus(parcelId, nowMs) {
      const entry = settle(parcelId, nowMs);
      const active = entry.active;
      const valveState = active === null
        ? 'CLOSED'
        : nowMs - Date.parse(active.actualStart ?? active.scheduledStart) < OPENING_MS ? 'OPENING' : 'PUMPING';
      return {
        valveState,
        flowRateLpm: SAMPLE_FLOW_LPM,
        activeEvent: active,
        nextScheduledEvent: null,
        lastEvent: entry.last,
        serverTime: iso(nowMs),
      };
    },
    startManual(parcelId, durationMinutes, nowMs) {
      const entry = settle(parcelId, nowMs);
      if (entry.active !== null) throw new Error(ACTIVE_RUN_MESSAGE);
      if (!(MANUAL_DURATIONS as readonly number[]).includes(durationMinutes)) {
        throw new Error('Duration must be 15, 30, 45 or 60 minutes.');
      }
      const event: IrrigationEvent = {
        id: `sim-${parcelId}-${nowMs}`,
        triggerType: 'MANUAL_OVERRIDE',
        status: 'IN_PROGRESS',
        scheduledStart: iso(nowMs),
        actualStart: iso(nowMs),
        completedAt: null,
        durationMinutes,
        waterVolumeLiters: durationMinutes * SAMPLE_FLOW_LPM,
      };
      entry.active = event;
      return event;
    },
    abort(parcelId, eventId, nowMs) {
      const entry = settle(parcelId, nowMs);
      if (entry.active?.id !== eventId) throw new Error('This run has already finished.');
      const aborted: IrrigationEvent = { ...entry.active, status: 'ABORTED', completedAt: iso(nowMs) };
      entry.last = aborted;
      entry.active = null;
      return aborted;
    },
  };
}
