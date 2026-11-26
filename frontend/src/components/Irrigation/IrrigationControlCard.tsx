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
import { BUTTON } from '../Diagnostics/styles.ts';

export interface IrrigationControlCardProps {
  parcelId: string;
  config?: IrrigationConfig;
  onSourceChange?: (source: Sourced<unknown> | null) => void;
  /** Changing this number forces an immediate status reload (page-level Refresh). */
  refreshToken?: number;
  headingId?: string;
}

const PRESS = 'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';
const closesAtFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

function triggerReason(event: IrrigationEvent): string {
  const reason = event.triggerType === 'MANUAL_OVERRIDE' ? 'Manual override'
    : event.triggerType === 'SCHEDULED_RECIPE' ? 'Scheduled recipe'
      : 'Automatic — soil reached the refill point';
  const status = event.status === 'ABORTED' ? ' · stopped early' : event.status === 'COMPLETED' ? ' · completed' : '';
  return `${reason}${status}`;
}

function Readout({ label, value, hiddenValue }: { label: string; value: string; hiddenValue?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ui-line py-2.5 text-sm last:border-b-0">
      <dt className="text-ui-ink-3">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-ui-ink">
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-[17px] font-medium text-ui-ink">Valve</h2>
        {config.mode === 'sample' ? <SampleTag label="Simulated" /> : valve.source === 'sample' ? <SampleTag /> : null}
      </div>

      {server === null && valve.statusError ? (
        <ErrorNotice message={`Valve status unavailable: ${valve.statusError}`} onRetry={valve.refresh} />
      ) : server === null ? (
        <div className="h-[180px] animate-pulse rounded-xl bg-ui-warm motion-reduce:animate-none" role="status" aria-label="Loading valve status" />
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
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Could not refresh valve status: {valve.statusError} The state above may be out of date.
            </p>
          )}
        </>
      )}

      {!valve.controlsEnabled && server !== null && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="note">
          {display.startBlockedReason}
        </p>
      )}

      {state.error && (
        <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{errorPrefix}{state.error}</p>
          <button type="button" onClick={valve.dismissError} aria-label="Dismiss error" className={`grid min-h-11 min-w-11 place-items-center rounded-md hover:bg-red-100 focus-visible:outline-red-700 ${PRESS}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          disabled={!display.canStart}
          onClick={() => setDialogOpen(true)}
          aria-describedby={display.canStart || !display.startBlockedReason ? undefined : 'water-now-blocked'}
          className={`${BUTTON.dark} w-full disabled:bg-ui-warm-strong disabled:text-ui-ink-3 disabled:opacity-100`}
        >
          Water now
        </button>
        {!display.canStart && display.startBlockedReason && valve.controlsEnabled && (
          <p id="water-now-blocked" className="text-xs text-ui-ink-3">{display.startBlockedReason}</p>
        )}

        {display.canStop && !showConfirm && (
          <button
            type="button"
            onClick={() => setConfirmingStopFor(stoppableEventId(state))}
            className={`min-h-11 w-full rounded-full border border-red-300 px-5 text-[15px] font-medium text-red-700 hover:bg-red-50 focus-visible:outline-red-700 ${PRESS}`}
          >
            Emergency stop
          </button>
        )}
        {showConfirm && (
          <div role="group" aria-label="Confirm emergency stop" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="flex-1 text-sm font-medium text-red-800">Stop the valve now?</p>
            <button
              type="button"
              autoFocus
              onClick={() => {
                setConfirmingStopFor(null);
                setLastAction('stop');
                void valve.stop();
              }}
              className={`min-h-11 rounded-full bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-red-700 ${PRESS}`}
            >
              Stop valve
            </button>
            <button type="button" onClick={() => setConfirmingStopFor(null)} className={`min-h-11 rounded-full border border-ui-line bg-white px-4 text-sm font-medium text-ui-ink hover:bg-ui-warm focus-visible:outline-ui-accent ${PRESS}`}>
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
