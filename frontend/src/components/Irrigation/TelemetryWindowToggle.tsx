import type { TelemetryWindow } from '../../types/irrigation.ts';

const OPTIONS: { value: TelemetryWindow; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 d' },
  { value: '30d', label: '30 d' },
];

export function TelemetryWindowToggle({ value, onChange, disabled = false }: {
  value: TelemetryWindow;
  onChange(window: TelemetryWindow): void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <div role="group" aria-label="Chart time window" className="inline-flex rounded-lg bg-ui-warm p-1">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-11 min-w-14 cursor-pointer rounded-md px-3 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-accent disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 ${selected ? 'bg-ui-bg font-medium text-ui-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ui-ink-2 hover:text-ui-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
