import { useEffect, useRef, useState } from 'react';
import { HERO, HERO_VIDEO_SRC, PRIMARY_CTA, SECONDARY_CTA } from './landingContent.ts';
import { PillLink } from './primitives.tsx';

/**
 * Hero background video (decorative field footage): muted, looping, inline. Starts paused for people who prefer reduced motion,
 * and always has a visible pause/play button (motion longer than 5 s must be stoppable).
 */
function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) video.play().catch(() => setPlaying(false));
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setPlaying(false));
    else video.pause();
  };

  return (
    <figure className="relative mx-auto mt-14 aspect-video w-full max-w-5xl overflow-hidden rounded-2xl border border-ui-line bg-ui-warm sm:mt-16">
      <video
        ref={videoRef}
        src={HERO_VIDEO_SRC}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause video' : 'Play video'}
        className="absolute bottom-3 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-ui-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
          </svg>
        )}
      </button>
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
        <HeroVideo />
      </div>
    </section>
  );
}
