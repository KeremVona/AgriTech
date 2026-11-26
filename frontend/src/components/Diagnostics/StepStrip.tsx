import { ArrowRightIcon, CameraIcon, ClipboardCheckIcon, ScanIcon } from './icons.tsx';

const STEPS = [
  { icon: CameraIcon, title: 'Photo', body: 'One leaf' },
  { icon: ScanIcon, title: 'Diagnosis', body: 'Likely disease' },
  { icon: ClipboardCheckIcon, title: 'Action', body: 'What to do today' },
] as const;

/** How the page works, as three icons. Highlights the step the user is on. */
export function StepStrip({ active }: { active: 0 | 1 | 2 }) {
  return (
    <ol role="list" aria-label="How it works" className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map(({ icon: StepIcon, title, body }, index) => (
        <li key={title} className="flex items-center gap-2 sm:gap-4" aria-current={index === active ? 'step' : undefined}>
          {index > 0 && <ArrowRightIcon className="h-4 w-4 shrink-0 text-ui-ink-3" />}
          <span className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                index <= active ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent' : 'border-ui-line bg-ui-bg text-ui-ink-3'
              }`}
            >
              <StepIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-left">
              <span className={`block text-sm font-medium ${index <= active ? 'text-ui-ink' : 'text-ui-ink-2'}`}>{title}</span>
              <span className="hidden text-xs text-ui-ink-3 sm:block">{body}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
