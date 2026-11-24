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
    <div role="group" aria-label="Chart time window" className="inline-flex rounded-lg border border-ag-border bg-ag-surface-muted p-0.5">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-12 min-w-14 rounded-md px-3 font-mono text-sm tabular-nums transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ag-brand disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 ${selected ? 'bg-ag-surface font-semibold text-ag-ink shadow-sm ring-1 ring-ag-border' : 'text-ag-ink-secondary hover:text-ag-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
