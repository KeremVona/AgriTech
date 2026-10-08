import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import { DiseaseProgressionViewerExperimental } from '../components/DiseaseProgressionViewerExperimental';
import { DiagnosticUploadCard } from '../../components/DiagnosticScan';

const CROPS: { id: SupportedCropId; label: string; icon: string; subtitle: string }[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight' },
  { id: 'corn', label: 'Corn (Maize)', icon: '🌽', subtitle: 'Common Rust' },
  { id: 'apple', label: 'Apple', icon: '🍏', subtitle: 'Apple Scab' },
];

export function DiseaseProgressionExperimentalPage() {
  const [selectedCrop, setSelectedCrop] = useState<SupportedCropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const handleViewProgression = (cropId: SupportedCropId, pct: number) => {
    setSelectedCrop(cropId);
    setCurrentProgress(pct);
    viewerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-purple-500 selection:text-white">
      {/* =========================================================================
          1. PAGE HEADER & NAVIGATION
          ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-slate-950/85 backdrop-blur-xl border-b border-purple-500/20 shadow-lg shadow-black/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Left: Back Links & Lab Badge */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:border-purple-500/40 transition-all cursor-pointer group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span>Home</span>
            </Link>

            <Link
              to="/disease-progression"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:text-white hover:border-emerald-400 transition-all cursor-pointer"
            >
              <span>🌿 Presentation View</span>
            </Link>

            <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-base">
                🧪
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  P2P Experimental Lab
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300">
                    TIER 1 • FEATURE 1
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Microclimate Modifiers & Calibrated Field Calendar Timeline
                </p>
              </div>
            </div>
          </div>

          {/* Right: Runtime Status Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/60 text-purple-300 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Dynamic Biocalibration Active
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. EXPERIMENTAL BANNER NOTICE
          ========================================================================= */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-emerald-950/40 border-b border-purple-500/20 px-4 py-2.5 text-center text-xs text-purple-200">
        <span className="font-semibold">🔬 Research Sandbox:</span> This page isolates Tier 1 environmental simulations. The standard presentation viewer at{' '}
        <Link to="/disease-progression" className="underline font-mono text-emerald-300 hover:text-white">
          /disease-progression
        </Link>{' '}
        remains unchanged and presentation-ready.
      </div>

      {/* =========================================================================
          3. MAIN WORKSPACE CONTAINER
          ========================================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Crop Selector Toolbar */}
        <section className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-purple-400 mb-1">
              TARGET PATHOLOGY CALIBRATION
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Select Agricultural Specimen</h2>
            <p className="text-xs text-slate-400">
              Epidemiological parameters (cardinal temperatures, moisture limits, degree-days) automatically re-calibrate for each crop.
            </p>
          </div>

          {/* Crop Selector Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap bg-slate-950/80 border border-slate-800 p-1.5 rounded-xl gap-1.5">
            {CROPS.map((crop) => (
              <button
                key={crop.id}
                type="button"
                onClick={() => setSelectedCrop(crop.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedCrop === crop.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30 ring-1 ring-purple-400/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-sm">{crop.icon}</span>
                <div className="text-left">
                  <div className="leading-tight">{crop.label}</div>
                  <div className="text-[10px] opacity-75 font-mono">{crop.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* AI Diagnostic Scanner Section */}
        <section aria-label="AI Leaf Diagnostic Scanner">
          <DiagnosticUploadCard onViewProgression={handleViewProgression} />
        </section>

        {/* Core Experimental Progression Viewer */}
        <section ref={viewerSectionRef} aria-label="Experimental Progression Viewer" className="pt-2">
          <DiseaseProgressionViewerExperimental
            key={selectedCrop}
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </section>

        {/* Theoretical Framework & Formulation Reference */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 text-xs text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Epidemiological Model Specification</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/50">
                USDA Magarey Beta Response
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Pathogen incubation days and lesion expansion are evaluated using non-linear cardinal temperature response f(T) coupled with exponential moisture saturation g(RH). Thermal ceilings (T &gt; T_max) accurately trigger epidemiological arrest.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-slate-300 font-mono">
              Bi-directional Days ↔ %
            </span>
            <span className="px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/60 text-purple-300 font-mono">
              Zero Context Leaks
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} AgriTech • Precision Crop Health & Disease Progression (Experimental)</p>
          <div className="flex items-center gap-4">
            <Link to="/disease-progression" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Standard Presentation View
            </Link>
            <span>•</span>
            <Link to="/" className="hover:text-slate-300 transition-colors">
              Return Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
