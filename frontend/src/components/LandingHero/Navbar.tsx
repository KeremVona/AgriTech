import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollPosition > 15);
    };

    // Check position on initial mount in case loaded while already scrolled
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isSolid = isScrolled || mobileMenuOpen;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 w-full transition-all duration-300 ease-out ${
        isSolid
          ? 'bg-slate-950/95 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40'
          : 'bg-transparent backdrop-blur-none border-b border-transparent shadow-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg p-1"
            aria-label="AgriTech Homepage"
          >
            {/* Botanic Brand Glyph */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12c0-5.52 4.48-10 10-10z" />
                <path d="M12 6v12" />
                <path d="M8 10c2 0 4 2 4 4" />
                <path d="M16 10c-2 0-4 2-4 4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                AgriTech
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span className="text-[10px] tracking-wider uppercase text-emerald-400 font-mono font-medium -mt-1 hidden sm:block">
                Precision Field Ops
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main Navigation">
          <Link
            to="/"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Platform
          </Link>
          <Link
            to="/disease-progression"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Disease Progression
          </Link>
          <a
            href="/#features"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            FAO-56 Irrigation
          </a>
          <a
            href="/#features"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Field GIS
          </a>
          <a
            href="/#features"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Research & Model
          </a>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/disease-progression"
            className="hidden sm:inline-block text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 transition-colors"
          >
            Field Portal
          </Link>

          {/* Primary Pill Button (Codex Style) */}
          <Link
            to="/disease-progression"
            className="relative inline-flex items-center justify-center gap-2 px-4.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-950 bg-white hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all duration-200 cursor-pointer group"
          >
            <span>Launch Engine</span>
            <span className="text-xs group-hover:translate-x-0.5 transition-transform duration-200">
              ↗
            </span>
          </Link>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 px-4 pt-3 pb-5 space-y-2.5">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-slate-800/70"
          >
            Platform
          </Link>
          <Link
            to="/disease-progression"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-emerald-400 hover:bg-slate-800/70"
          >
            🌱 Disease Progression
          </Link>
          <a
            href="/#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-slate-800/70"
          >
            FAO-56 Irrigation
          </a>
          <a
            href="/#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-200 hover:bg-slate-800/70"
          >
            Field GIS
          </a>
        </div>
      )}
    </header>
  );
}
