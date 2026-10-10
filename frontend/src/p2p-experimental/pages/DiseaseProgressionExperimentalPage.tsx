import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import { DiseaseProgressionViewerExperimental } from '../components/DiseaseProgressionViewerExperimental';
import { CompactCropSelectorRail, type CropSpecimenItem } from '../components/CompactCropSelectorRail';
import { DiagnosticScanModal } from '../components/DiagnosticScanModal';

const CROPS: CropSpecimenItem[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight', family: 'Solanaceae' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight', family: 'Solanaceae' },
  { id: 'pepper', label: 'Pepper Bell', icon: '🫑', subtitle: 'Bacterial Spot', family: 'Solanaceae' },
  { id: 'corn', label: 'Corn (Maize)', icon: '🌽', subtitle: 'Common Rust', family: 'Poaceae' },
  { id: 'apple', label: 'Apple', icon: '🍏', subtitle: 'Apple Scab', family: 'Rosaceae' },
  { id: 'peach', label: 'Peach', icon: '🍑', subtitle: 'Bacterial Spot', family: 'Rosaceae' },
  { id: 'grape', label: 'Grape', icon: '🍇', subtitle: 'Black Rot', family: 'Vitaceae' },
  { id: 'squash', label: 'Squash', icon: '🎃', subtitle: 'Powdery Mildew', family: 'Cucurbitaceae' },
];

export function DiseaseProgressionExperimentalPage() {
  const [selectedCrop, setSelectedCrop] = useState<SupportedCropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const handleViewProgression = (cropId: SupportedCropId, pct: number) => {
    setSelectedCrop(cropId);
    setCurrentProgress(pct);
    setIsScannerOpen(false);
    viewerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* =========================================================================
          1. PAGE HEADER & NAVIGATION
          ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Navigation links and title */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:border-emerald-500/40 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span>Home</span>
            </Link>

            <Link
              to="/disease-progression"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:text-white hover:border-emerald-400 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97]"
            >
              <span>🌿 Presentation View</span>
            </Link>

            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm shadow-inner">
                🔬
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  P2P Progression Studio
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-300 hidden md:inline">
                    EXPERIMENTAL
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden lg:block">
                  Precision Bio-Calibrated Dynamics Across 8 Crops
                </p>
              </div>
            </div>
          </div>

          {/* Right: AI Leaf Scan trigger & Status Badge */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 border border-emerald-400/40 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97]"
              title="Open AI Diagnostic Leaf Scanner"
            >
              <span className="text-sm leading-none">📷</span>
              <span>Scan Leaf with AI</span>
            </button>

            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>8 Crops Ready</span>
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. RESEARCH SANDBOX NOTICE
          ========================================================================= */}
      <div className="bg-slate-900/60 border-b border-white/5 px-4 py-2 text-center text-xs text-slate-400">
        <span>🔬 Experimental Studio: Real-world timeline, symptom hotspots & what-if treatment branching. Standard view at </span>
        <Link to="/disease-progression" className="underline font-mono text-emerald-400 hover:text-emerald-300">
          /disease-progression
        </Link>{' '}
        <span>is completely untouched.</span>
      </div>

      {/* =========================================================================
          3. MAIN WORKSPACE CONTAINER
          ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Compact Ergonomic Crop Selector Rail */}
        <section aria-label="Agricultural Crop Specimen Selector">
          <CompactCropSelectorRail
            crops={CROPS}
            selectedCrop={selectedCrop}
            onSelectCrop={setSelectedCrop}
          />
        </section>

        {/* Core Progression Viewer Studio */}
        <section ref={viewerSectionRef} aria-label="Disease Progression Studio">
          <DiseaseProgressionViewerExperimental
            key={selectedCrop}
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </section>

        {/* Theoretical Framework & Formulation Reference */}
        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-xs text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Epidemiological Model Specification</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700/60">
                USDA Magarey Beta Response
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Incubation latency and lesion expansion are computed using non-linear cardinal temperature response f(T) coupled with exponential moisture saturation g(RH). Thermal ceilings (T &gt; T_max) trigger epidemiological arrest.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-[10px]">
              Bi-directional Days ↔ %
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-mono text-[10px]">
              Zero GPU Context Leaks
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} AgriTech • Precision Crop Health & Disease Progression (Experimental Studio)</p>
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

      {/* AI Diagnostic Scanner Modal Dialog */}
      <DiagnosticScanModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onViewProgression={handleViewProgression}
      />
    </div>
  );
}
