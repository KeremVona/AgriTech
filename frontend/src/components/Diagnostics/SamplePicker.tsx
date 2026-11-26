import type { ClinicalSamplePreset } from '../../types/diagnostics';
import { severityWord } from './styles.ts';

/** Sample leaves with their real photos, so the page can be tried without a photo or the ML service. */
export function SamplePicker({
  presets,
  disabled,
  onSelect,
}: {
  presets: readonly ClinicalSamplePreset[];
  disabled?: boolean;
  onSelect: (preset: ClinicalSamplePreset) => void;
}) {
  return (
    <section aria-labelledby="samples-title" className="flex h-full flex-col rounded-2xl bg-ui-warm p-5 sm:p-6">
      <h2 id="samples-title" className="text-lg font-medium text-ui-ink">
        No photo at hand?
      </h2>
      <p className="mt-1 text-sm text-ui-ink-2">Try one of these sample leaves.</p>
      <ul role="list" className="mt-5 grid grid-cols-2 gap-3">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              onClick={() => onSelect(preset)}
              disabled={disabled}
              className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-ui-line bg-ui-bg text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-28 w-full items-center justify-center bg-ui-bg sm:h-32">
                {preset.sampleImageUrl && (
                  <img src={preset.sampleImageUrl} alt="" loading="lazy" className="h-[85%] w-[85%] object-contain transition-transform duration-200 group-hover:scale-105" />
                )}
              </span>
              <span className="border-t border-ui-line px-3 py-2.5">
                <span className="block text-sm font-medium text-ui-ink">{preset.crop}</span>
                <span className="block text-xs text-ui-ink-3">
                  {preset.condition} · {severityWord(preset.severityTier)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
