import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CropId } from '../../types/progression';
import { useProgressionData } from '../../hooks/useProgressionData';
import { ProgressionShaderRenderer } from './ProgressionShaderRenderer';

export interface DiseaseProgressionViewerProps {
  cropId?: CropId;
  initialPercentage?: number;
  onPercentageChange?: (percentage: number) => void;
  className?: string;
  showControls?: boolean;
}

export const DiseaseProgressionViewer: React.FC<DiseaseProgressionViewerProps> = ({
  cropId = 'tomato',
  initialPercentage = 0,
  onPercentageChange,
  className = '',
  showControls = true,
}) => {
  const [sliderValue, setSliderValue] = useState<number>(initialPercentage);
  const [rendererLoaded, setRendererLoaded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ProgressionShaderRenderer | null>(null);

  const { cropData, activeStage, loading: dataLoading, error } = useProgressionData(cropId, sliderValue);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new ProgressionShaderRenderer(canvasRef.current);
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Load textures when cropData changes
  useEffect(() => {
    if (!cropData || !rendererRef.current) return;

    const stages = cropData.stages;
    const stage0 = stages.find((s) => s.stage_order === 0)?.assets.base_image_url;
    const stage1 = stages.find((s) => s.stage_order === 1)?.assets.base_image_url;
    const stage2 = stages.find((s) => s.stage_order === 2)?.assets.base_image_url;
    const mask1 = stages.find((s) => s.stage_order === 1)?.assets.mask_image_url;
    const mask2 = stages.find((s) => s.stage_order === 2)?.assets.mask_image_url;

    if (!stage0 || !stage1 || !stage2) return;

    let isMounted = true;

    rendererRef.current
      .loadTextures({
        stage0,
        stage1,
        stage2,
        mask1,
        mask2,
      })
      .then(() => {
        if (isMounted) {
          setRendererLoaded(true);
          rendererRef.current?.render(sliderValue / 100.0);
        }
      })
      .catch((err) => {
        console.error('[DiseaseProgressionViewer] Failed to load progression textures:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [cropData, sliderValue]);

  // Handle Resize & DPR compensation with ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !rendererRef.current) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const size = Math.min(width, height > 0 ? height : width);
        if (size > 0 && rendererRef.current) {
          rendererRef.current.resize(size, size, window.devicePixelRatio || 1);
        }
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rendererLoaded]);

  // Render on slider scrub
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSliderValue(val);
      rendererRef.current?.render(val / 100.0);
      onPercentageChange?.(val);
    },
    [onPercentageChange]
  );

  // Stage milestone marker clicks
  const jumpToPercentage = (pct: number) => {
    setSliderValue(pct);
    rendererRef.current?.render(pct / 100.0);
    onPercentageChange?.(pct);
  };

  const getStageColorBadge = (order: number) => {
    if (order === 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (order === 1) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden ${className}`}
    >
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-800/60 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-wide">
              {cropData?.crop_name || 'Crop'} Disease Progression
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-mono">
              {cropData?.disease_name || 'Pathology'}
            </span>
          </div>
          <p className="text-xs text-slate-400 italic mt-0.5">
            {cropData?.scientific_name} • {cropData?.pathogen_scientific} ({cropData?.pathogen_type})
          </p>
        </div>

        {activeStage && (
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-2 ${getStageColorBadge(
              activeStage.stage_order
            )}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            Stage {activeStage.stage_order}: {activeStage.stage_label}
          </div>
        )}
      </div>

      {/* Main Canvas Presentation Viewport */}
      <div className="p-6 flex flex-col items-center">
        <div
          ref={containerRef}
          className="relative w-full max-w-[520px] aspect-square rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-inner overflow-hidden flex items-center justify-center"
        >
          {/* Subtle Grid Backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

          {/* Loading Indicator */}
          {(dataLoading || !rendererLoaded) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs z-10">
              <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
              <span className="text-xs text-slate-400 font-medium mt-3">Buffering high-res leaf textures...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 p-6 text-center z-10">
              <span className="text-2xl mb-2">⚠️</span>
              <p className="text-xs text-red-300">{error.message}</p>
            </div>
          )}

          {/* Active Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-300"
            style={{ opacity: rendererLoaded ? 1 : 0 }}
          />

          {/* HUD Floating Scrub Counter */}
          <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 shadow-md">
            Infection: <span className="font-bold text-emerald-400">{sliderValue.toFixed(1)}%</span>
          </div>
        </div>

        {/* Controls Section */}
        {showControls && (
          <div className="w-full max-w-[520px] mt-6 flex flex-col gap-4">
            {/* Range Slider Container */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-slate-400">
                <span>Healthy Baseline (0%)</span>
                <span>Active Spread (50%)</span>
                <span>Severe Necrosis (100%)</span>
              </div>

              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={sliderValue}
                  onChange={handleSliderChange}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                  aria-label="Disease progression infection slider"
                />
              </div>

              {/* Stage Milestone Step Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => jumpToPercentage(0)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    sliderValue <= 30
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Stage 0: 0%
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPercentage(50)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    sliderValue > 30 && sliderValue <= 70
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Stage 1: 50%
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPercentage(100)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    sliderValue > 70
                      ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow-sm'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Stage 2: 100%
                </button>
              </div>
            </div>

            {/* Diagnostic Agronomic Feedback Card */}
            {activeStage && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3 backdrop-blur-xs">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span>🔬</span> Biological Symptom Markers
                  </div>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    {activeStage.symptom_markers}
                  </p>
                </div>

                <div className="border-t border-slate-700/40 pt-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span>🛡️</span> Actionable Agronomic Advisory
                  </div>
                  <p className="text-xs text-emerald-300/90 mt-1 leading-relaxed">
                    {activeStage.agronomic_advice}
                  </p>
                </div>

                {/* Color Palette Indicators */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">Color Spectrum:</span>
                  <div className="flex gap-1.5">
                    {activeStage.color_palette_hex.map((hex, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-slate-700 shadow-xs"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
