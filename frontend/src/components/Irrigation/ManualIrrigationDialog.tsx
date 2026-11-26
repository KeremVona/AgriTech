import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MANUAL_DURATION, MANUAL_DURATIONS, estimateVolumeLiters } from '../../models/valveControlModel.ts';
import { BUTTON } from '../Diagnostics/styles.ts';

const PRESS = 'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent';

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
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-ui-line bg-ui-bg p-0 font-[family-name:var(--font-ui)] text-ui-ink shadow-[0_24px_64px_rgba(0,0,0,0.18)] backdrop:bg-black/30"
    >
      <form
        method="dialog"
        className="p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(duration);
          onClose();
        }}
      >
        <h2 id="manual-irrigation-title" className="text-xl font-medium text-ui-ink">Water now</h2>
        <p className="mt-1 text-sm text-ui-ink-2">Open the valve for a set time. You can stop it at any point.</p>

        <fieldset className="mt-4">
          <legend className="text-[13px] font-medium text-ui-ink-3">How long</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {MANUAL_DURATIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                onClick={() => setDuration(minutes)}
                className={`min-h-12 rounded-xl border text-sm tabular-nums ${PRESS} ${duration === minutes ? 'border-ui-ink bg-ui-ink font-medium text-white' : 'border-ui-line text-ui-ink hover:bg-ui-warm'}`}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 rounded-xl bg-ui-warm px-4 py-3">
          <p className="text-xs text-ui-ink-3">About</p>
          <p className="text-2xl font-medium tabular-nums text-ui-ink">{volume} L</p>
          <p className="text-xs tabular-nums text-ui-ink-3">at {flowRateLpm} L/min</p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={BUTTON.light}>
            Cancel
          </button>
          <button type="submit" className={BUTTON.dark}>
            Start watering
          </button>
        </div>
      </form>
    </dialog>
  );
}
