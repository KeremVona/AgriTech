import type { ValveDisplay } from '../../models/valveControlModel.ts';
import './irrigation.css';

const TONE_CLASSES: Record<ValveDisplay['tone'], string> = {
  active: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  idle: 'bg-slate-100 text-slate-700 border-slate-300',
  transition: 'bg-amber-50 text-amber-900 border-amber-300',
};

function ValveIcon({ tone }: { tone: ValveDisplay['tone'] }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (tone === 'active') {
    return <svg {...common}><path className="ag-valve-droplet-pulse" d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>;
  }
  if (tone === 'transition') {
    return <svg {...common} className="animate-spin motion-reduce:animate-none"><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>;
}

/** Valve state badge (COMPONENTS §1.2). Color + icon + text; announced politely on change. */
export function ValveStatusBadge({ label, tone, detail }: {
  label: ValveDisplay['label'];
  tone: ValveDisplay['tone'];
  detail?: string | null;
}): React.JSX.Element {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${TONE_CLASSES[tone]}`}>
      <ValveIcon tone={tone} />
      <span>
        {label}
        {detail && <span className="font-mono tabular-nums">: {detail}</span>}
      </span>
    </span>
  );
}
