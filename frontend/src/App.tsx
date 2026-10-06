import { useState, useRef } from 'react';
import type { CropId } from './types/progression';
import { DiseaseProgressionViewer } from './components/DiseaseProgressionViewer';
import { DiagnosticUploadCard } from './components/DiagnosticScan';

const CROPS: { id: CropId; label: string; icon: string; subtitle: string }[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight' },
  { id: 'corn', label: 'Corn (Maize)', icon: '🌽', subtitle: 'Common Rust' },
  { id: 'apple', label: 'Apple', icon: '🍏', subtitle: 'Apple Scab' },
];

function App() {
  const [selectedCrop, setSelectedCrop] = useState<CropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const handleViewProgression = (cropId: CropId, pct: number) => {
    setSelectedCrop(cropId);
    setCurrentProgress(pct);
    viewerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4 sm:px-6">
      {/* Header */}
      <header className="max-w-4xl w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-lg">
            🌱
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Precision AgriTech Platform
            </h1>
            <p className="text-xs text-emerald-400 font-medium">
              Phase 1 • Disease Progression Slider Engine & AI Diagnostics
            </p>
          </div>
        </div>

        {/* Crop Selector Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
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
      </header>

      {/* Main Feature Container */}
      <main className="max-w-4xl w-full space-y-8">
        {/* Diagnostic Scan & Quick Analysis Section */}
        <DiagnosticUploadCard onViewProgression={handleViewProgression} />

        {/* Core WebGL Disease Progression Viewer Section */}
        <div ref={viewerSectionRef} className="pt-2">
          <DiseaseProgressionViewer
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </div>

        {/* Architectural Context & Teammate Info Footer */}
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
      </main>
    </div>
  );
}

export default App;
