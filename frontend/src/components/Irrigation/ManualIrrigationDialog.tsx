import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MANUAL_DURATION, MANUAL_DURATIONS, estimateVolumeLiters } from '../../models/valveControlModel.ts';

const PRESS = 'transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ag-brand';

/**
 * Manual watering dialog (TODO-308). Mount it only while open so the duration
 * resets each time; it opens itself with showModal() and reports Esc / backdrop
 * closes through the native `close` event.
 */
export function ManualIrrigationDialog({ flowRateLpm, onConfirm, onClose }: {
  flowRateLpm: number;
  onConfirm(durationMinutes: number): void;
  onClose(): void;
}): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState<number>(DEFAULT_MANUAL_DURATION);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // StrictMode mounts effects twice; showModal() throws on an already-open dialog.
    if (!dialog.open) dialog.showModal();
    // React does not emit the autofocus attribute, so showModal() would focus the first option.
    dialog.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
  }, []);

  const volume = estimateVolumeLiters(duration, flowRateLpm).toLocaleString('en-US');

  return (
    <dialog
      ref={ref}
      aria-labelledby="manual-irrigation-title"
      // Every close path we control calls onClose directly; the native `close` event
      // is only a fallback (it did not fire in the embedded Chrome 156 test browser).
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-ag-border bg-ag-surface p-0 text-ag-ink shadow-xl backdrop:bg-slate-900/40"
    >
      <form
        method="dialog"
        className="p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(duration);
          onClose();
        }}
      >
        <h2 id="manual-irrigation-title" className="text-lg font-semibold tracking-tight">Water now</h2>
        <p className="mt-1 text-sm text-ag-ink-secondary">Open the valve for a fixed time. You can stop it at any point.</p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Duration</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MANUAL_DURATIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                onClick={() => setDuration(minutes)}
                className={`min-h-12 rounded-lg border font-mono text-sm tabular-nums ${PRESS} ${duration === minutes ? 'border-ag-brand bg-ag-brand-subtle font-semibold text-ag-brand' : 'border-ag-border text-ag-ink hover:bg-ag-surface-muted'}`}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </fieldset>

        <p className="mt-4 text-sm text-ag-ink-secondary">
          Estimated volume <span className="font-mono font-semibold tabular-nums text-ag-ink">≈ {volume} L</span>
          <span className="font-mono tabular-nums"> ({flowRateLpm} L/min)</span>
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={`min-h-12 rounded-lg border border-ag-border px-4 text-sm font-semibold hover:bg-ag-surface-muted md:min-h-10 ${PRESS}`}>
            Cancel
          </button>
          <button type="submit" className={`min-h-12 rounded-lg bg-ag-brand px-4 text-sm font-semibold text-white hover:bg-ag-brand-hover md:min-h-10 ${PRESS}`}>
            Start irrigation
          </button>
        </div>
      </form>
    </dialog>
  );
}
