import type { IrrigationEvent, IrrigationStatus } from '../types/irrigation.ts';

export const MANUAL_DURATIONS = [15, 30, 45, 60] as const;
export const DEFAULT_MANUAL_DURATION = 30;
export const ACTIVE_RUN_MESSAGE = 'A run is already active — stop it first.';
export const CONTROLS_UNAVAILABLE_MESSAGE = 'Controls unavailable — live data unavailable';

export interface ValveControlState {
  server: IrrigationStatus | null;
  clockOffsetMs: number;
  pending:
    | { kind: 'start'; durationMinutes: number; requestedAtMs: number }
    | { kind: 'stop'; eventId: string }
    | null;
  lastWriteSettledAtMs: number | null;
  lastPollReceivedAtMs: number | null;
  error: string | null;
}

export const initialValveControlState: ValveControlState = {
  server: null,
  clockOffsetMs: 0,
  pending: null,
  lastWriteSettledAtMs: null,
  lastPollReceivedAtMs: null,
  error: null,
};

export type ValveAction =
  | { type: 'poll-received'; status: IrrigationStatus; requestStartedAtMs: number; receivedAtMs: number }
  | { type: 'start-requested'; durationMinutes: number; nowMs: number }
  | { type: 'start-succeeded'; event: IrrigationEvent; nowMs: number }
  | { type: 'start-failed'; message: string; nowMs: number }
  | { type: 'stop-requested'; eventId: string }
  | { type: 'stop-succeeded'; event: IrrigationEvent; nowMs: number }
  | { type: 'stop-failed'; message: string; nowMs: number }
  | { type: 'dismiss-error' };

export interface ValveDisplay {
  label: 'Closed' | 'Opening' | 'Pumping' | 'Stopping';
  tone: 'idle' | 'transition' | 'active';
  flowRateLpm: number | null;
  secondsLeft: number | null;
  startsInSeconds: number | null;
  isStarting: boolean;
  closesAtMs: number | null;
  canStart: boolean;
  canStop: boolean;
  startBlockedReason: string | null;
}

const LABELS = {
  CLOSED: { label: 'Closed', tone: 'idle' },
  OPENING: { label: 'Opening', tone: 'transition' },
  PUMPING: { label: 'Pumping', tone: 'active' },
  STOPPING: { label: 'Stopping', tone: 'transition' },
} as const;

function isManualDuration(minutes: number): boolean {
  return (MANUAL_DURATIONS as readonly number[]).includes(minutes);
}

/**
 * A run in progress, or a manual run that is accepted but not yet started (both live in
 * `activeEvent`), blocks another manual start. A pending automated run in
 * `nextScheduledEvent` does not.
 */
function hasRunInProgress(server: IrrigationStatus | null): boolean {
  const status = server?.activeEvent?.status;
  return status === 'IN_PROGRESS' || status === 'PENDING';
}

export function stoppableEventId(state: ValveControlState): string | null {
  return state.server?.activeEvent?.id ?? state.server?.nextScheduledEvent?.id ?? null;
}

export function upcomingRunLabel(event: IrrigationEvent): string {
  if (event.triggerType === 'MANUAL_OVERRIDE') return 'Manual run';
  if (event.triggerType === 'SCHEDULED_RECIPE') return 'Next scheduled run';
  return 'Next automatic run';
}

/** Valve status counts as stale (controls lock) after two missed polls. */
export function statusIsStale(lastPollReceivedAtMs: number | null, nowMs: number, pollMs: number): boolean {
  return lastPollReceivedAtMs === null || nowMs - lastPollReceivedAtMs > 2 * pollMs;
}

/** The stop confirmation belongs to one run; it must not reappear for a later run. */
export function stopConfirmVisible(state: ValveControlState, confirmingForEventId: string | null, canStop: boolean): boolean {
  return canStop && confirmingForEventId !== null && confirmingForEventId === stoppableEventId(state);
}

export function valveControlReducer(state: ValveControlState, action: ValveAction): ValveControlState {
  switch (action.type) {
    case 'poll-received': {
      const clockOffsetMs = Date.parse(action.status.serverTime) - action.receivedAtMs;
      if (state.pending !== null) return { ...state, clockOffsetMs, lastPollReceivedAtMs: action.receivedAtMs };
      if (state.lastWriteSettledAtMs !== null && action.requestStartedAtMs < state.lastWriteSettledAtMs) return state;
      return { ...state, server: action.status, clockOffsetMs, lastPollReceivedAtMs: action.receivedAtMs };
    }
    case 'start-requested': {
      if (state.server === null || state.pending !== null || hasRunInProgress(state.server) || !isManualDuration(action.durationMinutes)) {
        return state;
      }
      return {
        ...state,
        pending: { kind: 'start', durationMinutes: action.durationMinutes, requestedAtMs: action.nowMs },
        error: null,
      };
    }
    case 'start-succeeded': {
      const server = state.server;
      if (server === null) return { ...state, pending: null, lastWriteSettledAtMs: action.nowMs };
      const next: IrrigationStatus =
        action.event.status === 'IN_PROGRESS'
          ? { ...server, activeEvent: action.event, valveState: 'OPENING' }
          : action.event.status === 'PENDING'
            ? { ...server, activeEvent: action.event }
            : server;
      return { ...state, server: next, pending: null, lastWriteSettledAtMs: action.nowMs };
    }
    case 'stop-requested': {
      if (state.pending !== null || action.eventId !== stoppableEventId(state)) return state;
      return { ...state, pending: { kind: 'stop', eventId: action.eventId }, error: null };
    }
    case 'stop-succeeded': {
      const server = state.server;
      if (server === null) return { ...state, pending: null, lastWriteSettledAtMs: action.nowMs };
      const wasActive = server.activeEvent?.id === action.event.id;
      const next: IrrigationStatus = {
        ...server,
        lastEvent: action.event,
        activeEvent: wasActive ? null : server.activeEvent,
        nextScheduledEvent: server.nextScheduledEvent?.id === action.event.id ? null : server.nextScheduledEvent,
        valveState: wasActive ? 'CLOSED' : server.valveState,
      };
      return { ...state, server: next, pending: null, lastWriteSettledAtMs: action.nowMs };
    }
    case 'start-failed':
    case 'stop-failed':
      return { ...state, pending: null, lastWriteSettledAtMs: action.nowMs, error: action.message };
    case 'dismiss-error':
      return state.error === null ? state : { ...state, error: null };
  }
}

const ceilSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000));

export function deriveValveDisplay(state: ValveControlState, nowMs: number, controlsEnabled: boolean): ValveDisplay {
  const { server, pending, clockOffsetMs } = state;
  const serverNow = nowMs + clockOffsetMs;
  const inProgress = hasRunInProgress(server);

  let label: ValveDisplay['label'] = LABELS[server?.valveState ?? 'CLOSED'].label;
  let tone: ValveDisplay['tone'] = LABELS[server?.valveState ?? 'CLOSED'].tone;
  let secondsLeft: number | null = null;
  let closesAtMs: number | null = null;
  let startsInSeconds: number | null = null;

  if (pending?.kind === 'start') {
    label = 'Opening';
    tone = 'transition';
    closesAtMs = pending.requestedAtMs + pending.durationMinutes * 60_000;
    secondsLeft = ceilSeconds(closesAtMs - nowMs);
  } else {
    if (pending?.kind === 'stop') {
      label = 'Stopping';
      tone = 'transition';
    }
    const active = server?.activeEvent ?? null;
    if (active?.actualStart) {
      const endServerMs = Date.parse(active.actualStart) + active.durationMinutes * 60_000;
      secondsLeft = ceilSeconds(endServerMs - serverNow);
      closesAtMs = endServerMs - clockOffsetMs;
    }
    const upcoming = active && !active.actualStart ? active : server?.nextScheduledEvent ?? null;
    if (upcoming && !upcoming.actualStart) {
      startsInSeconds = ceilSeconds(Date.parse(upcoming.scheduledStart) - serverNow);
    }
  }

  const canStart = controlsEnabled && pending === null && server !== null && !inProgress;
  const canStop = controlsEnabled && pending === null && stoppableEventId(state) !== null;
  const startBlockedReason = !controlsEnabled ? CONTROLS_UNAVAILABLE_MESSAGE : inProgress ? ACTIVE_RUN_MESSAGE : null;

  return {
    label,
    tone,
    flowRateLpm: server?.flowRateLpm ?? null,
    secondsLeft,
    startsInSeconds,
    isStarting: startsInSeconds === 0,
    closesAtMs,
    canStart,
    canStop,
    startBlockedReason,
  };
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatStartsIn(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}

export function estimateVolumeLiters(durationMinutes: number, flowRateLpm: number): number {
  return durationMinutes * flowRateLpm;
}
