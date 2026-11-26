import { Link } from 'react-router-dom';
import { CLOSING, FOOTER_COLUMNS, FOOTER_NOTE, PRIMARY_CTA, SECONDARY_CTA } from './landingContent.ts';
import { LeafMark, PillLink, Reveal } from './primitives.tsx';

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="px-4 py-24 sm:px-6 sm:py-32">
      <Reveal className="mx-auto max-w-4xl text-center">
        <h2 id="closing-title" className="text-[40px] font-medium leading-[1.05] tracking-[-0.025em] text-ui-ink sm:text-[64px]">
          {CLOSING.title}
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <PillLink to={PRIMARY_CTA.to}>{PRIMARY_CTA.label}</PillLink>
          <PillLink to={SECONDARY_CTA.to} variant="light">
            {SECONDARY_CTA.label}
          </PillLink>
        </div>
      </Reveal>
    </section>
  );
}

const LINK_CLASS = 'rounded text-sm text-ui-ink-2 transition-colors hover:text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent';

export function LandingFooter() {
  return (
    <footer className="border-t border-ui-line px-4 pb-10 pt-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 rounded-md text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent">
            <LeafMark className="h-6 w-6" />
            <span className="font-semibold tracking-tight">AgriTech</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ui-ink-2">{FOOTER_NOTE}</p>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-[13px] font-medium text-ui-ink-3">{column.title}</h2>
            <ul role="list" className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                      {link.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : link.href.startsWith('#') ? (
                    <a href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-xs text-ui-ink-3">© {new Date().getFullYear()} AgriTech</p>
    </footer>
  );
}
