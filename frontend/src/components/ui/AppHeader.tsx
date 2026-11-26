import { Link, NavLink } from 'react-router-dom';
import { LeafMark } from '../Landing/primitives.tsx';

const APP_LINKS = [
  { to: '/map', label: 'Field map', short: 'Map' },
  { to: '/diagnostics', label: 'Leaf diagnostics', short: 'Diagnose' },
  { to: '/disease-progression', label: 'Disease progression', short: 'Progression' },
] as const;

/** Notion-style top bar shared by the app pages: logo home link + main sections. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ui-line bg-ui-bg/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded-md text-ui-ink focus-visible:outline-2 focus-visible:outline-ui-accent">
          <LeafMark className="h-6 w-6" />
          <span className="font-semibold tracking-tight">AgriTech</span>
        </Link>
        <ul role="list" className="-mr-2 ml-auto flex items-center gap-0.5">
          {APP_LINKS.map((link) => (
            <li key={link.to} className="shrink-0">
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `block rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ui-accent ${
                    isActive ? 'bg-ui-warm font-medium text-ui-ink' : 'text-ui-ink-2 hover:bg-ui-warm hover:text-ui-ink'
                  }`
                }
              >
                <span className="sm:hidden">{link.short}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
