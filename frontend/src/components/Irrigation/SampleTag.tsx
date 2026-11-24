/** Marks a widget whose own data is sample data (spec §5.6). */
export function SampleTag({ label = 'Sample' }: { label?: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded border border-ag-risk-low-border bg-ag-risk-low-bg px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
      {label}
    </span>
  );
}
