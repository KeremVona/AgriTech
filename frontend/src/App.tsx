import { useState, useRef } from 'react';
import type { CropId } from './types/progression';
import { DiseaseProgressionViewer } from './components/DiseaseProgressionViewer';
import { DiagnosticUploadCard } from './components/DiagnosticScan';
import { Navbar } from './components/LandingHero/Navbar';
import { HeroSection } from './components/LandingHero/HeroSection';
import { FeaturePillars } from './components/LandingHero/FeaturePillars';

const CROPS: { id: CropId; label: string; icon: string; subtitle: string }[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight' },
  { id: 'corn', label: 'Corn (Maize)', icon: '🌽', subtitle: 'Common Rust' },
  { id: 'apple', label: 'Apple', icon: '🍏', subtitle: 'Apple Scab' },
];

function App() {
  const [selectedCrop, setSelectedCrop] = useState<CropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  
  const scannerSectionRef = useRef<HTMLDivElement | null>(null);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);
  const toolsSectionRef = useRef<HTMLDivElement | null>(null);

  const handleScrollToScanner = () => {
    scannerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToSlider = () => {
    viewerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToTools = () => {
    toolsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleViewProgression = (cropId: CropId, pct: number) => {
    setSelectedCrop(cropId);
    setCurrentProgress(pct);
    viewerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectFeaturePillar = (feature: 'scanner' | 'slider') => {
    if (feature === 'scanner') {
      handleScrollToScanner();
    } else {
      handleScrollToSlider();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* 1. Global Navigation Bar (Codex Style) */}
      <Navbar
        onOpenScanner={handleScrollToScanner}
        onOpenSlider={handleScrollToSlider}
      />

      {/* 2. Hero Section with 1.mp4 Background Video & Central App Badge */}
      <main className="flex-1 w-full">
        <HeroSection
          onExploreClick={handleScrollToTools}
          onScannerClick={handleScrollToScanner}
          onSliderClick={handleScrollToSlider}
        />

        {/* 3. Core Platform Pillars (PROJECT_DETAILS.md: Vision, FAO-56, Spatial GIS) */}
        <FeaturePillars onSelectFeature={handleSelectFeaturePillar} />

        {/* 4. Interactive Live Platform Workspace */}
        <section
          id="interactive-tools"
          ref={toolsSectionRef}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 scroll-mt-24 space-y-8"
        >
          {/* Section Divider & Crop Selector Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-xs font-mono text-emerald-300 mb-2">
                <span>ACTIVE FIELD WORKSPACE</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Live Disease Inspection & Progression Engine
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Select target crop to examine morphological symptoms or upload inspection photos for AI diagnosis.
              </p>
            </div>

            {/* Crop Selector Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 shrink-0">
              {CROPS.map((crop) => (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => setSelectedCrop(crop.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCrop === crop.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span>{crop.icon}</span>
                  <span>{crop.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostic Scan & Quick Analysis Section */}
          <div ref={scannerSectionRef} className="scroll-mt-24">
            <DiagnosticUploadCard onViewProgression={handleViewProgression} />
          </div>

          {/* Core WebGL Disease Progression Viewer Section */}
          <div ref={viewerSectionRef} className="scroll-mt-24 pt-2">
            <DiseaseProgressionViewer
              cropId={selectedCrop}
              initialPercentage={currentProgress}
              onPercentageChange={setCurrentProgress}
            />
          </div>

          {/* Architectural Context Banner */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-slate-300">Feature #1: WebGL Morphological Blend Engine</div>
              <p className="text-slate-500">
                Biologically registered Prompt-to-Prompt WebP leaf plates with localized chlorosis and necrotic edge reveal shaders.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-slate-300 font-mono">
                60 FPS WebGL / Canvas2D
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-mono">
                Offline-Ready
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* 5. Comprehensive Multi-Column Footer (Element 11) */}
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
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">Platform Pillars</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Foliage CNN Inference</a></li>
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Disease Progression Slider</a></li>
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">FAO-56 Irrigation Engine</a></li>
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">PostGIS Spatial Boundary</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">Target Crops</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><span className="hover:text-emerald-400 cursor-pointer" onClick={() => setSelectedCrop('tomato')}>Tomato (Early & Late Blight)</span></li>
                <li><span className="hover:text-emerald-400 cursor-pointer" onClick={() => setSelectedCrop('potato')}>Potato (Late Blight)</span></li>
                <li><span className="hover:text-emerald-400 cursor-pointer" onClick={() => setSelectedCrop('corn')}>Corn (Common Rust)</span></li>
                <li><span className="hover:text-emerald-400 cursor-pointer" onClick={() => setSelectedCrop('apple')}>Apple (Apple Scab)</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-3">System Runtime</h4>
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
            <p>© {new Date().getFullYear()} AgriTech Platform. Precision Field Operations & Crop Health.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-300 transition-colors">Documentation</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Agronomy Standards</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy & Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
