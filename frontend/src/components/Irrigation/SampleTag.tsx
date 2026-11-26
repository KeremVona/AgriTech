/** Marks a widget whose own data is sample data (spec §5.6). */
export function SampleTag({ label = 'Sample' }: { label?: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      {label}
    </span>
  );
}
