import { Navbar } from '../components/LandingHero/Navbar';
import { HeroSection } from '../components/LandingHero/HeroSection';
import { FeaturePillars } from '../components/LandingHero/FeaturePillars';
import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* 1. Global Navigation Bar (Codex Style) */}
      <Navbar />

      {/* 2. Hero Section with Background Video & Central App Badge */}
      <main className="flex-1 w-full">
        <HeroSection />

        {/* 3. Core Platform Pillars (PROJECT_DETAILS.md: Vision, FAO-56, Spatial GIS) */}
        <FeaturePillars />

        {/* 4. Feature Spotlight Banner Linking to Disease Progression */}
        <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-emerald-950/80 p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 group">
            <div className="space-y-3 max-w-xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-mono text-emerald-300">
                <span>FEATURE #1 READY</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Inspect Real-Time Foliar Pathology
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Experience 60 FPS continuous WebGL morphological disease progression across tomato, potato, corn, and apple crops with instant AI leaf scanning.
              </p>
            </div>

            <Link
              to="/disease-progression"
              className="shrink-0 px-8 py-4 rounded-full text-sm sm:text-base font-semibold text-slate-950 bg-white hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 cursor-pointer group/btn"
            >
              <span>Launch Disease Progression</span>
              <span className="group-hover/btn:translate-x-1 transition-transform duration-200">→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* 5. Comprehensive Multi-Column Footer */}
      <footer className="w-full bg-slate-950/90 border-t border-white/10 mt-20 pt-16 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-sm">
                  🌱
                </div>
                <span className="font-display font-extrabold text-base text-white">AgriTech</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Precision agronomy platform marrying foliar computer vision, FAO-56 evapotranspiration models, and GIS spatial management.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">
                Platform Pillars
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Disease Progression Slider
                  </Link>
                </li>
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Foliage CNN Inference
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-emerald-400 transition-colors">
                    FAO-56 Irrigation Engine
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-emerald-400 transition-colors">
                    PostGIS Spatial Boundary
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">
                Target Crops
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Tomato (Early & Late Blight)
                  </Link>
                </li>
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Potato (Late Blight)
                  </Link>
                </li>
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Corn (Common Rust)
                  </Link>
                </li>
                <li>
                  <Link to="/disease-progression" className="hover:text-emerald-400 transition-colors">
                    Apple (Apple Scab)
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">
                System Runtime
              </h4>
              <div className="space-y-2 text-xs text-slate-400 font-mono">
                <div className="flex items-center justify-between">
                  <span>Inference:</span>
                  <span className="text-emerald-400">&lt; 85ms CPU</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Model:</span>
                  <span className="text-emerald-400">ONNX FP32/INT8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Backend:</span>
                  <span className="text-slate-300">FastAPI & ASP.NET 10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Spatial DB:</span>
                  <span className="text-slate-300">PostgreSQL + PostGIS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} AgriTech Platform. Precision Field Operations & Crop Health.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/disease-progression" className="hover:text-slate-300 transition-colors">
                Disease Progression Engine
              </Link>
              <a href="#" className="hover:text-slate-300 transition-colors">
                Agronomy Standards
              </a>
              <a href="#" className="hover:text-slate-300 transition-colors">
                Privacy & Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
