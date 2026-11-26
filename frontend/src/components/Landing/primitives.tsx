import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const PILL_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent';

const PILL_VARIANT = {
  dark: 'bg-ui-ink text-white hover:bg-black',
  light: 'bg-ui-warm text-ui-ink hover:bg-ui-warm-strong',
} as const;

const PILL_SIZE = {
  md: 'px-5 py-2.5 text-[15px]',
  sm: 'px-3.5 py-1.5 text-sm',
} as const;

export function PillLink({
  to,
  children,
  variant = 'dark',
  size = 'md',
}: {
  to: string;
  children: ReactNode;
  variant?: keyof typeof PILL_VARIANT;
  size?: keyof typeof PILL_SIZE;
}) {
  return (
    <Link to={to} className={`${PILL_BASE} ${PILL_VARIANT[variant]} ${PILL_SIZE[size]}`}>
      {children}
    </Link>
  );
}

/** AgriTech mark: a leaf in a rounded square. Same drawing as `public/favicon.svg`. */
export function LeafMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="2.25" />
      <path d="M9 23c0-8 5.5-13.5 14-14 .2 8.6-5.4 14-14 14Z" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" />
      <path d="M9 23l7.5-7.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function shouldAnimateReveal(): boolean {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fades its children in the first time they scroll into view.
 * Content stays visible when the observer is unavailable or the visitor prefers reduced motion.
 */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(shouldAnimateReveal);

  useEffect(() => {
    const node = ref.current;
    if (!hidden || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hidden]);

  return (
    <div ref={ref} className={`ui-reveal ${className}`} data-hidden={hidden}>
      {children}
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mx-auto max-w-3xl text-center text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-ui-ink sm:text-[44px]"
    >
      {children}
    </h2>
  );
}

/** Notion's three short columns under a visual. */
export function PointColumns({ points }: { points: readonly { title: string; body: string }[] }) {
  return (
    <div className="mt-10 grid gap-8 sm:grid-cols-3">
      {points.map((point) => (
        <div key={point.title}>
          <h3 className="text-base font-medium text-ui-ink">{point.title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ui-ink-2">{point.body}</p>
        </div>
      ))}
    </div>
  );
}
