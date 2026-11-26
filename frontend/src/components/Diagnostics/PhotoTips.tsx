import { DistanceIcon, LeafIcon, SpotIcon, SunIcon } from './icons.tsx';

const TIPS = [
  { icon: LeafIcon, title: 'One leaf', body: 'Fill the frame with a single leaf.' },
  { icon: SunIcon, title: 'Soft daylight', body: 'No flash, no harsh shadows.' },
  { icon: SpotIcon, title: 'Show symptoms', body: 'A leaf with spots, not a dead one.' },
  { icon: DistanceIcon, title: '15–25 cm', body: 'Hold the phone flat and steady.' },
] as const;

/** Four photo tips as small icon tiles: short enough to read in a glance. */
export function PhotoTips({ className = '' }: { className?: string }) {
  return (
    <section aria-labelledby="photo-tips-title" className={className}>
      <h2 id="photo-tips-title" className="text-[13px] font-medium text-ui-ink-3">
        For the best result
      </h2>
      <ul role="list" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIPS.map(({ icon: TipIcon, title, body }) => (
          <li key={title} className="rounded-xl border border-ui-line bg-ui-bg p-3">
            <TipIcon className="h-5 w-5 text-ui-accent" />
            <p className="mt-2 text-sm font-medium text-ui-ink">{title}</p>
            <p className="mt-0.5 text-xs leading-snug text-ui-ink-3">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
