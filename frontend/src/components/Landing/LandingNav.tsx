import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_CTA, NAV_LINKS } from './landingContent.ts';
import { LeafMark, PillLink } from './primitives.tsx';

const NAV_LINK_CLASS =
  'rounded-md px-3 py-1.5 text-sm text-ui-ink-2 transition-colors hover:bg-ui-warm hover:text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-ui-bg/85 backdrop-blur-md transition-colors duration-200 ${
        scrolled ? 'border-ui-line' : 'border-transparent'
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 rounded-md text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent">
          <LeafMark className="h-7 w-7" />
          <span className="text-[17px] font-semibold tracking-tight">AgriTech</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              {link.href.startsWith('#') ? (
                <a href={link.href} className={NAV_LINK_CLASS}>
                  {link.label}
                </a>
              ) : (
                <Link to={link.href} className={NAV_LINK_CLASS}>
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <PillLink to={APP_CTA.to} size="sm">
          {APP_CTA.label}
        </PillLink>
      </nav>
    </header>
  );
}
