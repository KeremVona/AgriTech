import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  deriveValveDisplay,
  initialValveControlState,
  statusIsStale,
  stoppableEventId,
  valveControlReducer,
} from '../models/valveControlModel.ts';
import type { ValveControlState, ValveDisplay } from '../models/valveControlModel.ts';
import {
  IrrigationRequestError,
  abortIrrigation,
  fetchIrrigationStatus,
  startManualIrrigation,
} from '../services/irrigationService.ts';
import type { DataSource, IrrigationStatus, Sourced } from '../types/irrigation.ts';
import { controlsEnabled as areControlsEnabled } from '../utils/irrigationConfig.ts';
import type { IrrigationConfig } from '../utils/irrigationConfig.ts';
import { useNow } from './useNow.ts';
import { usePolledResource } from './usePolledResource.ts';

export interface ValveControl {
  display: ValveDisplay;
  state: ValveControlState;
  source: DataSource | null;
  sourced: Sourced<IrrigationStatus> | null;
  statusError: string | null;
  controlsEnabled: boolean;
  start(durationMinutes: number): Promise<void>;
  stop(): Promise<void>;
  dismissError(): void;
  refresh(): void;
}

function writeErrorMessage(error: unknown, mode: IrrigationConfig['mode']): string {
  if (error instanceof IrrigationRequestError) return error.message;
  if (mode === 'sample' && error instanceof Error) return error.message;
  return 'Could not reach the irrigation service.';
}

export function useValveControl(parcelId: string, config: IrrigationConfig, refreshToken = 0): ValveControl {
  const [state, dispatch] = useReducer(valveControlReducer, initialValveControlState);
  const status = usePolledResource(
    (signal) => fetchIrrigationStatus({ config, parcelId, signal }),
    config.pollMs,
    `${parcelId}|${config.mode}|${config.apiBaseUrl}|status|${refreshToken}`,
  );
  const refreshStatus = status.refresh;

  useEffect(() => {
    if (status.data === null || status.dataRequestedAt === null) return;
    dispatch({
      type: 'poll-received',
      status: status.data.data,
      requestStartedAtMs: status.dataRequestedAt,
      receivedAtMs: status.updatedAt ?? Date.now(),
    });
  }, [status.data, status.dataRequestedAt, status.updatedAt]);

  const source = status.data?.source ?? null;
  const needsClock = state.pending !== null || Boolean(state.server?.activeEvent || state.server?.nextScheduledEvent);
  // Ticks slowly even when idle so a status that stops refreshing locks the controls.
  const now = useNow(needsClock ? 1000 : 5000, true);
  const enabled = areControlsEnabled(source, config.mode) && !statusIsStale(state.lastPollReceivedAtMs, now, config.pollMs);
  const display = deriveValveDisplay(state, now, enabled);

  // Synchronous guard: dispatch is async, so a double click must be stopped here, not in the reducer.
  const inFlight = useRef(false);
  const latest = useRef({ state, enabled });
  useEffect(() => {
    latest.current = { state, enabled };
  });

  const start = useCallback(async (durationMinutes: number) => {
    const nowMs = Date.now();
    if (inFlight.current || !deriveValveDisplay(latest.current.state, nowMs, latest.current.enabled).canStart) return;
    inFlight.current = true;
    dispatch({ type: 'start-requested', durationMinutes, nowMs });
    try {
      const event = await startManualIrrigation({ config, parcelId, durationMinutes });
      dispatch({ type: 'start-succeeded', event, nowMs: Date.now() });
    } catch (error) {
      dispatch({ type: 'start-failed', message: writeErrorMessage(error, config.mode), nowMs: Date.now() });
    } finally {
      inFlight.current = false;
      refreshStatus();
    }
  }, [config, parcelId, refreshStatus]);

  const stop = useCallback(async () => {
    const eventId = stoppableEventId(latest.current.state);
    if (inFlight.current || eventId === null || !deriveValveDisplay(latest.current.state, Date.now(), latest.current.enabled).canStop) return;
    inFlight.current = true;
    dispatch({ type: 'stop-requested', eventId });
    try {
      const event = await abortIrrigation({ config, parcelId, eventId });
      dispatch({ type: 'stop-succeeded', event, nowMs: Date.now() });
    } catch (error) {
      dispatch({ type: 'stop-failed', message: writeErrorMessage(error, config.mode), nowMs: Date.now() });
    } finally {
      inFlight.current = false;
      refreshStatus();
    }
  }, [config, parcelId, refreshStatus]);

  const dismissError = useCallback(() => dispatch({ type: 'dismiss-error' }), []);

  return {
    display,
    state,
    source,
    sourced: status.data,
    statusError: status.error,
    controlsEnabled: enabled,
    start,
    stop,
    dismissError,
    refresh: refreshStatus,
  };
}
