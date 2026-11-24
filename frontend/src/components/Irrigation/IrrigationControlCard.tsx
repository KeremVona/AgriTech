import { useEffect, useState } from 'react';
import { useValveControl } from '../../hooks/useValveControl.ts';
import {
  formatCountdown,
  formatStartsIn,
  stopConfirmVisible,
  stoppableEventId,
  upcomingRunLabel,
} from '../../models/valveControlModel.ts';
import type { IrrigationEvent, Sourced } from '../../types/irrigation.ts';
import type { IrrigationConfig } from '../../utils/irrigationConfig.ts';
import { DEFAULT_IRRIGATION_CONFIG } from './defaultIrrigationConfig.ts';
import { ErrorNotice } from './ErrorNotice.tsx';
import { ManualIrrigationDialog } from './ManualIrrigationDialog.tsx';
import { SampleTag } from './SampleTag.tsx';
import { ValveStatusBadge } from './ValveStatusBadge.tsx';

export interface IrrigationControlCardProps {
  parcelId: string;
  config?: IrrigationConfig;
  onSourceChange?: (source: Sourced<unknown> | null) => void;
  /** Changing this number forces an immediate status reload (page-level Refresh). */
  refreshToken?: number;
  headingId?: string;
}

const PRESS = 'transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2';
const closesAtFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function triggerReason(event: IrrigationEvent): string {
  const reason = event.triggerType === 'MANUAL_OVERRIDE' ? 'Manual override'
    : event.triggerType === 'SCHEDULED_RECIPE' ? 'Scheduled recipe'
      : 'Automatic — MAD exceeded';
  const status = event.status === 'ABORTED' ? ' · stopped early' : event.status === 'COMPLETED' ? ' · completed' : '';
  return `${reason}${status}`;
}

function Readout({ label, value, hiddenValue }: { label: string; value: string; hiddenValue?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ag-border py-2 text-sm last:border-b-0">
      <dt className="text-ag-ink-secondary">{label}</dt>
      <dd className="text-right font-mono font-medium tabular-nums text-ag-ink">
        <span aria-hidden={hiddenValue ? true : undefined}>{value}</span>
        {hiddenValue && <span className="sr-only">{hiddenValue}</span>}
      </dd>
    </div>
  );
}

/** Live valve state, manual watering and emergency stop (TODO-308). */
export function IrrigationControlCard(props: IrrigationControlCardProps): React.JSX.Element {
  const config = props.config ?? DEFAULT_IRRIGATION_CONFIG.config;
  if (config === null) return <ErrorNotice message={DEFAULT_IRRIGATION_CONFIG.error ?? 'Irrigation configuration error.'} />;
  return <ControlCardBody {...props} config={config} />;
}

function ControlCardBody({ parcelId, config, onSourceChange, refreshToken = 0, headingId }: IrrigationControlCardProps & { config: IrrigationConfig }) {
  const valve = useValveControl(parcelId, config, refreshToken);
  const { display, state } = valve;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingStopFor, setConfirmingStopFor] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'start' | 'stop'>('start');

  useEffect(() => {
    onSourceChange?.(valve.sourced);
  }, [onSourceChange, valve.sourced]);

  const server = state.server;
  const flowRate = display.flowRateLpm ?? 0;
  const active = server?.activeEvent ?? null;
  const reasonEvent = active ?? server?.lastEvent ?? null;
  const targetVolume = state.pending?.kind === 'start'
    ? state.pending.durationMinutes * flowRate
    : active?.waterVolumeLiters ?? null;
  const upcoming = active && !active.actualStart ? active : server?.nextScheduledEvent ?? null;
  const showConfirm = stopConfirmVisible(state, confirmingStopFor, display.canStop);
  const errorPrefix = lastAction === 'stop' ? 'Could not stop irrigation: ' : 'Could not start irrigation: ';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">Valve control</h2>
        {config.mode === 'sample' ? <SampleTag label="Simulated" /> : valve.source === 'sample' ? <SampleTag /> : null}
      </div>

      {server === null && valve.statusError ? (
        <ErrorNotice message={`Valve status unavailable: ${valve.statusError}`} onRetry={valve.refresh} />
      ) : server === null ? (
        <div className="h-[180px] animate-pulse rounded-lg bg-ag-surface-muted motion-reduce:animate-none" role="status" aria-label="Loading valve status" />
      ) : (
        <>
          <ValveStatusBadge
            label={display.label}
            tone={display.tone}
            detail={display.label === 'Pumping' && display.flowRateLpm !== null ? `${display.flowRateLpm} L/min` : null}
          />

          <dl className="mt-3">
            <Readout label="Flow rate" value={display.flowRateLpm === null ? '—' : `${display.flowRateLpm} L/min`} />
            {display.secondsLeft !== null && (
              <Readout
                label="Time left"
                value={formatCountdown(display.secondsLeft)}
                hiddenValue={display.closesAtMs === null ? undefined : `Valve closes at ${closesAtFormat.format(display.closesAtMs)}`}
              />
            )}
            {display.startsInSeconds !== null && (
              <Readout label={upcoming ? upcomingRunLabel(upcoming) : 'Next run'} value={display.isStarting ? 'Starting…' : `Starts in ${formatStartsIn(display.startsInSeconds)}`} />
            )}
            {targetVolume !== null && <Readout label="Target volume" value={`${Math.round(targetVolume).toLocaleString('en-US')} L`} />}
            {reasonEvent && <Readout label={active ? 'Trigger' : 'Last run'} value={triggerReason(reasonEvent)} />}
          </dl>
          {valve.statusError && (
            <p role="alert" className="mt-3 rounded-lg border border-ag-risk-critical-border bg-ag-risk-critical-bg px-3 py-2 text-sm text-red-900">
              Could not refresh valve status: {valve.statusError} The state above may be out of date.
            </p>
          )}
        </>
      )}

      {!valve.controlsEnabled && server !== null && (
        <p className="mt-3 rounded-lg border border-ag-risk-low-border bg-ag-risk-low-bg px-3 py-2 text-sm text-amber-900" role="note">
          {display.startBlockedReason}
        </p>
      )}

      {state.error && (
        <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-ag-risk-critical-border bg-ag-risk-critical-bg px-3 py-2 text-sm text-red-900">
          <p>{errorPrefix}{state.error}</p>
          <button type="button" onClick={valve.dismissError} aria-label="Dismiss error" className={`min-h-8 min-w-8 rounded font-semibold focus-visible:outline-red-700 ${PRESS}`}>✕</button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={!display.canStart}
          onClick={() => setDialogOpen(true)}
          aria-describedby={display.canStart || !display.startBlockedReason ? undefined : 'water-now-blocked'}
          className={`min-h-12 rounded-lg bg-ag-brand px-4 text-sm font-semibold text-white hover:bg-ag-brand-hover focus-visible:outline-ag-brand disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 md:min-h-10 ${PRESS}`}
        >
          Water now
        </button>
        {!display.canStart && display.startBlockedReason && valve.controlsEnabled && (
          <p id="water-now-blocked" className="text-xs text-ag-ink-secondary">{display.startBlockedReason}</p>
        )}

        {display.canStop && !showConfirm && (
          <button
            type="button"
            onClick={() => setConfirmingStopFor(stoppableEventId(state))}
            className={`min-h-12 rounded-lg border-2 border-red-600 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-red-700 md:min-h-10 ${PRESS}`}
          >
            Emergency stop
          </button>
        )}
        {showConfirm && (
          <div role="group" aria-label="Confirm emergency stop" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-2">
            <p className="flex-1 text-sm font-semibold text-red-900">Stop the valve now?</p>
            <button
              type="button"
              autoFocus
              onClick={() => {
                setConfirmingStopFor(null);
                setLastAction('stop');
                void valve.stop();
              }}
              className={`min-h-12 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-red-700 md:min-h-10 ${PRESS}`}
            >
              Stop valve
            </button>
            <button type="button" onClick={() => setConfirmingStopFor(null)} className={`min-h-12 rounded-lg border border-ag-border bg-white px-3 text-sm font-semibold focus-visible:outline-ag-brand md:min-h-10 ${PRESS}`}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {dialogOpen && (
        <ManualIrrigationDialog
          flowRateLpm={flowRate}
          onClose={() => setDialogOpen(false)}
          onConfirm={(minutes) => {
            setLastAction('start');
            void valve.start(minutes);
          }}
        />
      )}
    </div>
  );
}
