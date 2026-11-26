import type { FlowSection, FlowStep } from './landingContent.ts';
import { PointColumns, Reveal, SectionHeading } from './primitives.tsx';

function Node({ step, hub = false }: { step: FlowStep; hub?: boolean }) {
  return (
    <li
      className={`rounded-xl border px-4 py-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
        hub ? 'border-ui-accent-line bg-ui-accent-soft lg:min-w-52' : 'border-ui-line bg-ui-bg lg:min-w-40'
      }`}
    >
      <span className="block text-sm font-medium text-ui-ink">{step.title}</span>
      <span className="mt-0.5 block text-xs text-ui-ink-2">{step.detail}</span>
    </li>
  );
}

/** Arrow between columns: points down below `lg`, right from `lg` up. */
function Arrow() {
  return (
    <li aria-hidden="true" className="flex items-center justify-center text-ui-ink-3">
      <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90 lg:rotate-0">
        <path d="M4 12h15m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </li>
  );
}

function Column({ steps }: { steps: readonly FlowStep[] }) {
  if (steps.length === 1) return <Node step={steps[0]} />;
  return (
    <li>
      <ul role="list" className="flex flex-col gap-2">
        {steps.map((step) => (
          <Node key={step.title} step={step} />
        ))}
      </ul>
    </li>
  );
}

/**
 * Notion-style diagram: inputs → hub → outputs on a warm board, then three text columns.
 * Read by screen readers as an ordered list of steps.
 */
export function FlowDiagram({ flow }: { flow: FlowSection }) {
  const titleId = `${flow.id}-title`;
  return (
    <section id={flow.id} aria-labelledby={titleId} className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading id={titleId}>{flow.title}</SectionHeading>
        </Reveal>
        <Reveal>
          <div className="mt-12 rounded-3xl bg-ui-warm px-4 py-10 sm:px-8 sm:py-14">
            <ol role="list" className="flex flex-col items-stretch justify-center gap-3 lg:flex-row lg:items-center">
              <Column steps={flow.inputs} />
              <Arrow />
              <Node step={flow.hub} hub />
              {flow.outputs.map((step) => (
                <FragmentStep key={step.title} step={step} />
              ))}
            </ol>
          </div>
          <PointColumns points={flow.points} />
        </Reveal>
      </div>
    </section>
  );
}

function FragmentStep({ step }: { step: FlowStep }) {
  return (
    <>
      <Arrow />
      <Node step={step} />
    </>
  );
}
