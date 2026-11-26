import { Link } from 'react-router-dom';
import { FeaturePreview } from './FeaturePreviews.tsx';
import { FEATURES } from './landingContent.ts';
import { Reveal, SectionHeading } from './primitives.tsx';

export function FeatureGrid() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading id="features-title">One workspace for the whole field.</SectionHeading>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <Reveal key={feature.id}>
              <article className="flex h-full flex-col rounded-2xl bg-ui-warm p-6">
                <h3 className="text-lg font-medium text-ui-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ui-ink-2">{feature.body}</p>
                <FeaturePreview kind={feature.id} />
                <Link
                  to={feature.to}
                  className="group mt-5 inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-ui-accent hover:text-ui-accent-hover focus-visible:outline-2 focus-visible:outline-ui-accent"
                >
                  {feature.linkLabel}
                  <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
