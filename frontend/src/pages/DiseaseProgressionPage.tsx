import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SupportedCropId } from '../models/agronomicTimelineModel.ts';
import { DiseaseProgressionViewer } from '../components/DiseaseProgressionViewer/DiseaseProgressionViewer.tsx';
import { CompactCropSelectorRail } from '../components/DiseaseProgressionViewer/CompactCropSelectorRail.tsx';
import { DEFAULT_CROP_SPECIMENS } from '../components/DiseaseProgressionViewer/types.ts';

export function DiseaseProgressionPage() {
  const [selectedCrop, setSelectedCrop] = useState<SupportedCropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const activeSpecimen = DEFAULT_CROP_SPECIMENS.find((c) => c.id === selectedCrop) || DEFAULT_CROP_SPECIMENS[0];

  const handleSelectCrop = (cropId: SupportedCropId) => {
    setSelectedCrop(cropId);
    viewerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col antialiased selection:bg-teal-500 selection:text-white">
      {/* =========================================================================
          1. STICKY PAGE HEADER & BREADCRUMBS
          ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Navigation links and title */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-300 transition-all duration-150 ease-out cursor-pointer active:scale-95 shadow-2xs group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
              <span>Home</span>
            </Link>

            <Link
              to="/diagnostics"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50/70 border border-teal-200/70 text-xs font-semibold text-teal-800 hover:text-teal-900 hover:border-teal-300 transition-all duration-150 ease-out cursor-pointer active:scale-95 shadow-2xs"
            >
              <span>📷</span>
              <span>AI Leaf Diagnostics</span>
            </Link>

            <div className="h-4 w-[1px] bg-slate-200 hidden md:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-base shadow-2xs">
                🔬
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Disease Progression Studio
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100/70 text-teal-800 border border-teal-200 font-bold hidden md:inline">
                    SPEC-UI-007
                  </span>
                </div>
                <nav aria-label="Breadcrumb" className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span>Operations</span>
                  <span>/</span>
                  <span>Agronomy Intelligence</span>
                  <span>/</span>
                  <span className="text-teal-800 font-semibold">{activeSpecimen.label} ({activeSpecimen.subtitle})</span>
                </nav>
              </div>
            </div>
          </div>

          {/* Right: Runtime Telemetry Status Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] hidden sm:inline-block">
              60 FPS WebGL
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] flex items-center gap-1.5 font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              <span>8 Crops Calibrated</span>
            </span>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN WORKSPACE CONTAINER
          ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Compact Ergonomic Crop Selector Rail */}
        <section aria-label="Agricultural Crop Specimen Selector">
          <CompactCropSelectorRail
            crops={DEFAULT_CROP_SPECIMENS}
            selectedCrop={selectedCrop}
            onSelectCrop={handleSelectCrop}
          />
        </section>

        {/* Primary Progression Studio Viewport */}
        <section ref={viewerSectionRef} aria-label="Disease Progression Studio Stage">
          <DiseaseProgressionViewer
            key={selectedCrop}
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </section>

        {/* =========================================================================
            3. THEORETICAL & ALGORITHMIC ARCHITECTURE CARD
            ========================================================================= */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-3xl">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Epidemiological Model & Prompt-to-Prompt Diffusion Foundation</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                USDA Magarey Beta Response
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              Incubation latency and progressive cellular necrosis are simulated using non-linear cardinal temperature response{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-semibold">f(T)</code>{' '}
              coupled with quadratic humidity saturation{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-semibold">g(RH)</code>.
              Diffusion plates are synthesized via Prompt-to-Prompt cross-attention injection (Hertz et al., 2022) with localized spatial difference blending, locking foliar venation and petiole geometry down to the sub-millimeter while allowing disease lesions to evolve seamlessly.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px] font-medium shadow-2xs">
              Bi-directional Days ↔ %
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono text-[11px] font-semibold shadow-2xs">
              Zero GPU Context Leaks
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px] font-medium shadow-2xs">
              WebP Plates &lt; 150KB
            </span>
          </div>
        </section>
      </main>

      {/* =========================================================================
          4. PRODUCTION PAGE FOOTER
          ========================================================================= */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} AgriTech • Precision Crop Health & Disease Progression Studio</p>
          <div className="flex items-center gap-4">
            <Link to="/diagnostics" className="text-teal-700 hover:text-teal-800 font-medium transition-colors">
              AI Leaf Diagnostics
            </Link>
            <span>•</span>
            <Link to="/" className="hover:text-slate-700 transition-colors">
              Return Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
