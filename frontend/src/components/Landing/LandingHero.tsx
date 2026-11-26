import { HERO, PRIMARY_CTA, SECONDARY_CTA } from './landingContent.ts';
import { PillLink } from './primitives.tsx';

/**
 * Frame reserved for the product introduction video.
 * When the video exists, replace the inner placeholder with a <video> (poster + controls, no autoplay with sound).
 */
function VideoPlaceholder() {
  return (
    <figure
      className="mx-auto mt-14 flex aspect-video w-full max-w-5xl items-center justify-center rounded-2xl border border-ui-line bg-ui-warm sm:mt-16"
    >
      <div className="px-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-ui-line bg-ui-bg sm:h-16 sm:w-16">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-ui-ink" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
          </svg>
        </div>
        <figcaption>
          <span className="block text-base font-medium text-ui-ink">Product introduction video</span>
          <span className="mt-1 block text-sm text-ui-ink-3">Coming soon</span>
        </figcaption>
      </div>
    </figure>
  );
}

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <h1
          id="hero-title"
          className="mx-auto max-w-5xl text-center text-[40px] font-medium leading-[1.04] tracking-[-0.025em] text-ui-ink sm:text-6xl lg:text-[76px]"
        >
          {HERO.title[0]}
          <br className="hidden sm:block" /> {HERO.title[1]}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-ui-ink-2">{HERO.subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <PillLink to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</PillLink>
          <PillLink to={SECONDARY_CTA.to} variant="light">
            {SECONDARY_CTA.label}
          </PillLink>
        </div>
        <VideoPlaceholder />
      </div>
    </section>
  );
}
