import { useRef } from 'react';
import { CROPS } from './landingContent.ts';
import type { Crop } from './landingContent.ts';
import { Reveal, SectionHeading } from './primitives.tsx';

/** Drawn leaves for crops without a photo yet (rice: grass blades, cassava: palmate leaf). */
function DrawnLeaf({ crop }: { crop: string }) {
  if (crop === 'Rice') {
    return (
      <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden="true">
        <path d="M50 92 C46 60 30 34 14 12 C36 30 50 54 54 92Z" fill="#8DB580" />
        <path d="M52 92 C54 56 62 30 80 8 C70 34 62 60 58 92Z" fill="#7AA86C" />
        <path d="M54 92 C60 70 74 52 92 40 C78 56 66 74 60 92Z" fill="#9CC28F" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden="true">
      {[-60, -30, 0, 30, 60].map((angle) => (
        <ellipse key={angle} cx="50" cy="30" rx="8" ry="26" fill="#7AA86C" transform={`rotate(${angle} 50 60)`} />
      ))}
      <path d="M50 60 L50 96" stroke="#6E8F5E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CropCard({ crop }: { crop: Crop }) {
  return (
    <li className="group w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-ui-line bg-ui-bg">
      <div className="relative flex h-40 items-center justify-center bg-ui-warm">
        {crop.images ? (
          <>
            <img src={crop.images.healthy} alt="" loading="lazy" className="h-32 w-32 object-contain transition-opacity duration-300 group-hover:opacity-0" />
            <img
              src={crop.images.severe}
              alt=""
              loading="lazy"
              className="absolute h-32 w-32 object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </>
        ) : (
          <DrawnLeaf crop={crop.name} />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-medium text-ui-ink">{crop.name}</h3>
        <p className="mt-0.5 text-xs text-ui-ink-3">
          {crop.conditions.length} conditions
        </p>
        <p className="mt-2 text-[13px] leading-snug text-ui-ink-2">{crop.conditions.join(', ')}</p>
      </div>
    </li>
  );
}

function ScrollButton({ direction, onClick }: { direction: 'previous' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'next' ? 'Show more crops' : 'Show previous crops'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-ui-line bg-ui-bg text-ui-ink transition-colors hover:bg-ui-warm focus-visible:outline-2 focus-visible:outline-ui-accent"
    >
      <svg viewBox="0 0 24 24" className={`h-4 w-4 ${direction === 'previous' ? 'rotate-180' : ''}`} aria-hidden="true">
        <path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function CropStrip() {
  const listRef = useRef<HTMLUListElement>(null);
  const scroll = (direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    list.scrollBy({ left: direction * Math.max(240, list.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section id="crops" aria-labelledby="crops-title" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading id="crops-title">Seven crops, one photo away.</SectionHeading>
          <p className="mx-auto mt-4 max-w-xl text-center text-[17px] leading-relaxed text-ui-ink-2">
            The diagnosis model tells a healthy leaf from these diseases and pests.
          </p>
        </Reveal>
      </div>
      <Reveal>
        <ul
          ref={listRef}
          role="list"
          tabIndex={0}
          aria-label="Supported crops"
          className="mx-auto mt-12 flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-px-4 px-4 pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ui-accent sm:scroll-px-6 sm:px-6"
        >
          {CROPS.map((crop) => (
            <CropCard key={crop.name} crop={crop} />
          ))}
        </ul>
        <div className="mx-auto mt-4 flex max-w-6xl justify-end gap-2 px-4 sm:px-6">
          <ScrollButton direction="previous" onClick={() => scroll(-1)} />
          <ScrollButton direction="next" onClick={() => scroll(1)} />
        </div>
      </Reveal>
    </section>
  );
}
