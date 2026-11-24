import { normalizeSoilPercent } from '../models/waterBalanceModel.ts';
import type {
  IrrigationEvent,
  IrrigationEventStatus,
  IrrigationStatus,
  IrrigationTriggerType,
  SoilConstants,
  Sourced,
  TelemetryPoint,
  TelemetryResponse,
  TelemetryWindow,
  ValveState,
  WaterBudget,
} from '../types/irrigation.ts';
import type { IrrigationConfig } from '../utils/irrigationConfig.ts';
import {
  createSampleTelemetry,
  createSampleValveSimulator,
  createSampleWaterBudget,
} from './irrigationSampleData.ts';
import type { SampleHints } from './irrigationSampleData.ts';

/** User-facing request errors (400 / 409 / 422). Never trigger a sample fallback. */
export class IrrigationRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'IrrigationRequestError';
    this.status = status;
  }
}

/** Backend unreachable or not deployed (404 / 5xx / network / timeout). */
class AvailabilityError extends Error {}

export interface RequestOptions {
  config: IrrigationConfig;
  parcelId: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  nowMs?: number;
  timeoutMs?: number;
  hints?: SampleHints;
}

/** Shared by sample-mode reads and writes so a simulated run shows up in the next status poll. */
export const sampleValveSimulator = createSampleValveSimulator();

const DEFAULT_TIMEOUT_MS = 5_000;
const USER_ERROR_STATUSES = new Set([400, 409, 422]);

function callerAbort(): DOMException {
  return new DOMException('Irrigation request cancelled.', 'AbortError');
}

function parcelUrl(options: RequestOptions, suffix: string): string {
  return `${options.config.apiBaseUrl.replace(/\/$/, '')}/api/v1/parcels/${encodeURIComponent(options.parcelId)}${suffix}`;
}

async function userErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const { detail, title, message } = body as Record<string, unknown>;
      const text = [detail, title, message].find((value) => typeof value === 'string' && value.trim());
      if (typeof text === 'string') return text;
    }
  } catch {
    // Body is optional for error responses.
  }
  return `Request failed (HTTP ${response.status}).`;
}

async function requestJson(url: string, init: RequestInit, options: RequestOptions): Promise<unknown> {
  const { signal, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (signal?.aborted) throw callerAbort();

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerAbort());
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new AvailabilityError(`Irrigation API request timed out after ${timeoutMs.toLocaleString('en-US')} ms.`));
  }, timeoutMs);

  try {
    const request = async (): Promise<unknown> => {
      let response: Response;
      try {
        response = await fetchImpl(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new AvailabilityError('Irrigation API is unreachable (network failure).', { cause: error });
      }
      if (!response.ok) {
        if (USER_ERROR_STATUSES.has(response.status)) {
          throw new IrrigationRequestError(response.status, await userErrorMessage(response));
        }
        const message = `Irrigation API request failed (HTTP ${response.status}).`;
        if (response.status === 404 || (response.status >= 500 && response.status < 600)) throw new AvailabilityError(message);
        throw new Error(message);
      }
      return await response.json();
    };
    return await Promise.race([request(), cancelled]);
  } catch (error) {
    if (signal?.aborted) throw callerAbort();
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

async function readWithFallback<T>(
  options: RequestOptions,
  url: string,
  parse: (json: unknown) => T,
  sample: () => T,
): Promise<Sourced<T>> {
  if (options.config.mode === 'sample') {
    if (options.signal?.aborted) throw callerAbort();
    return { data: sample(), source: 'sample', fallbackReason: null };
  }
  try {
    const json = await requestJson(url, { headers: { Accept: 'application/json' } }, options);
    return { data: parse(json), source: 'api', fallbackReason: null };
  } catch (error) {
    if (options.config.mode === 'auto' && error instanceof AvailabilityError) {
      return { data: sample(), source: 'sample', fallbackReason: error.message };
    }
    throw error;
  }
}

async function postJson<T>(options: RequestOptions, url: string, body: unknown, parse: (json: unknown) => T): Promise<T> {
  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, options);
  return parse(json);
}

const now = (options: RequestOptions): number => options.nowMs ?? Date.now();

export function fetchWaterBudget(options: RequestOptions): Promise<Sourced<WaterBudget>> {
  return readWithFallback(options, parcelUrl(options, '/water-budget'), parseWaterBudget,
    () => createSampleWaterBudget(options.parcelId, now(options), options.hints));
}

export function fetchTelemetry(options: RequestOptions & { window: TelemetryWindow }): Promise<Sourced<TelemetryResponse>> {
  return readWithFallback(options, parcelUrl(options, `/telemetry?window=${encodeURIComponent(options.window)}`), parseTelemetry,
    () => createSampleTelemetry(options.parcelId, options.window, now(options), options.hints));
}

export function fetchIrrigationStatus(options: RequestOptions): Promise<Sourced<IrrigationStatus>> {
  return readWithFallback(options, parcelUrl(options, '/irrigation/status'), parseIrrigationStatus,
    () => sampleValveSimulator.getStatus(options.parcelId, now(options)));
}

/** Writes never fall back: a sample "success" would show a pump that is not running. */
export async function startManualIrrigation(options: RequestOptions & { durationMinutes: number }): Promise<IrrigationEvent> {
  if (options.config.mode === 'sample') return sampleValveSimulator.startManual(options.parcelId, options.durationMinutes, now(options));
  return postJson(options, parcelUrl(options, '/irrigate-manual'), { durationMinutes: options.durationMinutes }, parseIrrigationEvent);
}

export async function abortIrrigation(options: RequestOptions & { eventId: string }): Promise<IrrigationEvent> {
  if (options.config.mode === 'sample') return sampleValveSimulator.abort(options.parcelId, options.eventId, now(options));
  return postJson(options, parcelUrl(options, `/irrigation/${encodeURIComponent(options.eventId)}/abort`), undefined, parseIrrigationEvent);
}

// ---------------------------------------------------------------------------
// Response parsers
// ---------------------------------------------------------------------------

const TRIGGER_TYPES: readonly IrrigationTriggerType[] = ['AUTOMATED_DEFICIT', 'MANUAL_OVERRIDE', 'SCHEDULED_RECIPE'];
const EVENT_STATUSES: readonly IrrigationEventStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'];
const VALVE_STATES: readonly ValveState[] = ['CLOSED', 'OPENING', 'PUMPING', 'STOPPING'];
const WINDOWS: readonly TelemetryWindow[] = ['24h', '7d', '30d'];

class Reader {
  record: Record<string, unknown>;
  thing: string;

  constructor(json: unknown, thing: string) {
    this.thing = thing;
    if (!json || typeof json !== 'object' || Array.isArray(json)) this.fail();
    this.record = json as Record<string, unknown>;
  }

  fail(): never {
    throw new Error(`Malformed ${this.thing} response.`);
  }

  num(key: string): number {
    const value = this.record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) this.fail();
    return value;
  }

  numOrNull(key: string): number | null {
    const value = this.record[key];
    return value === null || value === undefined ? null : this.num(key);
  }

  str(key: string): string {
    const value = this.record[key];
    if (typeof value !== 'string') this.fail();
    return value;
  }

  strOrNull(key: string): string | null {
    const value = this.record[key];
    return value === null || value === undefined ? null : this.str(key);
  }

  bool(key: string): boolean {
    const value = this.record[key];
    if (typeof value !== 'boolean') this.fail();
    return value;
  }

  oneOf<T extends string>(key: string, allowed: readonly T[]): T {
    const value = this.str(key);
    if (!(allowed as readonly string[]).includes(value)) this.fail();
    return value as T;
  }

  array(key: string): unknown[] {
    const value = this.record[key];
    if (!Array.isArray(value)) this.fail();
    return value;
  }
}

const soilPctOrNull = (value: number | null): number | null => (value === null ? null : normalizeSoilPercent(value));

export function parseWaterBudget(json: unknown): WaterBudget {
  const r = new Reader(json, 'water budget');
  return {
    parcelId: r.str('parcelId'),
    parcelName: r.str('parcelName'),
    cropName: r.strOrNull('cropName'),
    soilProfileId: r.strOrNull('soilProfileId'),
    soilProfileName: r.strOrNull('soilProfileName'),
    fieldCapacityPct: soilPctOrNull(r.numOrNull('fieldCapacityPct')),
    wiltingPointPct: soilPctOrNull(r.numOrNull('wiltingPointPct')),
    saturationPct: soilPctOrNull(r.numOrNull('saturationPct')),
    madFraction: r.numOrNull('madFraction'),
    currentMoisturePct: r.numOrNull('currentMoisturePct'),
    latestReadingAt: r.strOrNull('latestReadingAt'),
    hoursUntilTrigger: r.numOrNull('hoursUntilTrigger'),
    systemFlowRateLpm: r.num('systemFlowRateLpm'),
  };
}

function parseSoil(json: unknown, thing: string): SoilConstants {
  const r = new Reader(json, thing);
  return {
    fieldCapacityPct: normalizeSoilPercent(r.num('fieldCapacityPct')),
    wiltingPointPct: normalizeSoilPercent(r.num('wiltingPointPct')),
    saturationPct: normalizeSoilPercent(r.num('saturationPct')),
    madFraction: r.num('madFraction'),
  };
}

function parsePoint(json: unknown): TelemetryPoint {
  const r = new Reader(json, 'telemetry');
  return {
    timestamp: r.str('timestamp'),
    soilMoisturePct: r.numOrNull('soilMoisturePct'),
    etcMm: r.numOrNull('etcMm'),
    effectiveRainMm: r.num('effectiveRainMm'),
    irrigationMm: r.num('irrigationMm'),
    isForecast: r.bool('isForecast'),
  };
}

function parseEvent(json: unknown, thing: string): IrrigationEvent {
  const r = new Reader(json, thing);
  return {
    id: r.str('id'),
    triggerType: r.oneOf('triggerType', TRIGGER_TYPES),
    status: r.oneOf('status', EVENT_STATUSES),
    scheduledStart: r.str('scheduledStart'),
    actualStart: r.strOrNull('actualStart'),
    completedAt: r.strOrNull('completedAt'),
    durationMinutes: r.num('durationMinutes'),
    waterVolumeLiters: r.num('waterVolumeLiters'),
  };
}

export function parseIrrigationEvent(json: unknown): IrrigationEvent {
  return parseEvent(json, 'irrigation event');
}

export function parseTelemetry(json: unknown): TelemetryResponse {
  const r = new Reader(json, 'telemetry');
  const soil = r.record.soil;
  return {
    parcelId: r.str('parcelId'),
    window: r.oneOf('window', WINDOWS),
    resolution: r.oneOf('resolution', ['hour', 'day'] as const),
    soil: soil === null || soil === undefined ? null : parseSoil(soil, 'telemetry'),
    points: r.array('points').map(parsePoint),
    irrigationEvents: r.array('irrigationEvents').map((event) => parseEvent(event, 'telemetry')),
  };
}

export function parseIrrigationStatus(json: unknown): IrrigationStatus {
  const r = new Reader(json, 'irrigation status');
  const optionalEvent = (key: string): IrrigationEvent | null => {
    const value = r.record[key];
    return value === null || value === undefined ? null : parseEvent(value, 'irrigation status');
  };
  return {
    valveState: r.oneOf('valveState', VALVE_STATES),
    flowRateLpm: r.num('flowRateLpm'),
    activeEvent: optionalEvent('activeEvent'),
    nextScheduledEvent: optionalEvent('nextScheduledEvent'),
    lastEvent: optionalEvent('lastEvent'),
    serverTime: r.str('serverTime'),
  };
}
