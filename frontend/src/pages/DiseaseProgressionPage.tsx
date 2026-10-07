import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { CropId } from '../types/progression';
import { DiseaseProgressionViewer } from '../components/DiseaseProgressionViewer';
import { DiagnosticUploadCard } from '../components/DiagnosticScan';

const CROPS: { id: CropId; label: string; icon: string; subtitle: string }[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight' },
  { id: 'corn', label: 'Corn (Maize)', icon: '🌽', subtitle: 'Common Rust' },
  { id: 'apple', label: 'Apple', icon: '🍏', subtitle: 'Apple Scab' },
];

export function DiseaseProgressionPage() {
  const [selectedCrop, setSelectedCrop] = useState<CropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const handleViewProgression = (cropId: CropId, pct: number) => {
    setSelectedCrop(cropId);
    setCurrentProgress(pct);
    viewerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* =========================================================================
          1. PAGE HEADER & BREADCRUMB
          ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-slate-950/85 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Left: Back Link & Page Title */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:border-emerald-500/40 transition-all cursor-pointer group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span>Home</span>
            </Link>

            <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-base">
                🌱
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Disease Progression
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-300 hidden md:inline-block">
                    FEATURE #1
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  WebGL Morphological Blend Engine & AI Leaf Scanner
                </p>
              </div>
            </div>
          </div>

          {/* Right: Runtime Status Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] hidden sm:inline-block">
              60 FPS WebGL
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine Online
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN WORKSPACE CONTAINER
          ========================================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Crop Selector Toolbar */}
        <section className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-1">
              SELECT TARGET SPECIMEN
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Target Crop Pathology
            </h2>
            <p className="text-xs text-slate-400">
              Switch between standardized agricultural staples to inspect continuous symptom progression.
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
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30 ring-1 ring-emerald-400/50'
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

        {/* =====================================================================
            3. AI DIAGNOSTIC UPLOAD CARD
            ===================================================================== */}
        <section aria-label="AI Leaf Diagnostic Scanner">
          <DiagnosticUploadCard onViewProgression={handleViewProgression} />
        </section>

        {/* =====================================================================
            4. WEBGL DISEASE PROGRESSION SLIDER ENGINE
            ===================================================================== */}
        <section ref={viewerSectionRef} aria-label="WebGL Morphological Progression Viewer" className="pt-2">
          <DiseaseProgressionViewer
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </section>

        {/* =====================================================================
            5. TECHNICAL ARCHITECTURE & SHADER SPECS FOOTER CARD
            ===================================================================== */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 text-xs text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Biologically Registered Foliage Shaders</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                TODO-108 / TODO-109
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Two-phase fragment interpolation with localized contrast masking. Transitions seamlessly from Stage 0 (Healthy) through Stage 1 (Initial Lesions) to Stage 2 (Severe Necrosis) with zero memory leaks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-slate-300 font-mono">
              WebP Masks (&lt;150KB)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-mono">
              Offline-Ready
            </span>
          </div>
        </section>
      </main>

      {/* Page Footer */}
      <footer className="w-full border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} AgriTech • Precision Crop Health & Disease Progression</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-300 transition-colors">
              Return to Landing Page
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
