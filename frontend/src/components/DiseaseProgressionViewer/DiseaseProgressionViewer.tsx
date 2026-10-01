import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CropId } from '../../types/progression';
import { useProgressionData } from '../../hooks/useProgressionData';
import { ProgressionShaderRenderer } from './ProgressionShaderRenderer';
import { ProgressionSlider } from './ProgressionSlider';
import { CompareHealthyToggle } from './CompareHealthyToggle';
import { DiagnosticOverlayCard } from './DiagnosticOverlayCard';

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
  const [compareMode, setCompareMode] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ProgressionShaderRenderer | null>(null);

  const { cropData, activeStage, loading: dataLoading, error } = useProgressionData(cropId, sliderValue);

  // Initialize WebGL/2D renderer
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
  }, [rendererLoaded, compareMode]);

  // Handle slider scrub
  const handleSliderChange = useCallback(
    (val: number) => {
      setSliderValue(val);
      rendererRef.current?.render(val / 100.0);
      onPercentageChange?.(val);
    },
    [onPercentageChange]
  );

  const getStageColorBadge = (order: number) => {
    if (order === 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (order === 1) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const healthyBaselineUrl = cropData?.stages.find((s) => s.stage_order === 0)?.assets.base_image_url;

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ${className}`}
    >
      {/* Top Header Bar */}
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

        <div className="flex items-center gap-3">
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

          <CompareHealthyToggle enabled={compareMode} onToggle={setCompareMode} />
        </div>
      </div>

      {/* Main Presentation Viewport: Single or Side-by-Side Mode */}
      <div className="p-6 flex flex-col items-center">
        <div
          className={`w-full max-w-4xl grid gap-6 ${
            compareMode ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-[540px]'
          }`}
        >
          {/* Side-by-Side Comparison: Panel A (Healthy Baseline Reference) */}
          {compareMode && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-square rounded-2xl bg-slate-950/80 border border-emerald-500/30 shadow-inner overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                {healthyBaselineUrl ? (
                  <img
                    src={healthyBaselineUrl}
                    alt={`${cropData?.crop_name} Healthy Baseline`}
                    className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                  />
                ) : (
                  <div className="w-8 h-8 border-2 border-emerald-400 rounded-full animate-spin" />
                )}

                <div className="absolute top-3 left-3 bg-emerald-950/90 border border-emerald-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-md flex items-center gap-1.5">
                  <span>🌿</span> Baseline Reference (Stage 0)
                </div>

                <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg px-2 py-0.5 text-[11px] font-mono text-emerald-400 shadow-md">
                  0.0% Infection
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-2 font-medium">Asymptomatic Baseline Folium</span>
            </div>
          )}

          {/* Panel B: Active Interactive WebGL Progression Canvas */}
          <div className="flex flex-col items-center">
            <div
              ref={containerRef}
              className={`relative w-full aspect-square rounded-2xl bg-slate-950/80 shadow-inner overflow-hidden flex items-center justify-center ${
                compareMode ? 'border border-amber-500/30' : 'border border-slate-800/80'
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

              {/* Buffering State */}
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

              {/* WebGL Canvas */}
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-300"
                style={{ opacity: rendererLoaded ? 1 : 0 }}
              />

              {/* Top Banner on Compare Mode */}
              {compareMode && (
                <div className="absolute top-3 left-3 bg-amber-950/90 border border-amber-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-md flex items-center gap-1.5">
                  <span>🔬</span> Active Progression State
                </div>
              )}

              {/* HUD Floating Scrub Counter */}
              <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 shadow-md">
                Infection: <span className="font-bold text-emerald-400">{sliderValue.toFixed(1)}%</span>
              </div>
            </div>
            {compareMode && (
              <span className="text-xs text-slate-400 mt-2 font-medium">Active Pathological State</span>
            )}
          </div>
        </div>

        {/* Controls & Diagnostic Card Section */}
        {showControls && (
          <div className="w-full max-w-[540px] mt-6 space-y-6">
            {/* Accessible Progression Slider */}
            <ProgressionSlider
              value={sliderValue}
              onChange={handleSliderChange}
              activeStageLabel={activeStage?.stage_label}
            />

            {/* Dynamic Diagnostic & Agronomic Advisory Card */}
            <DiagnosticOverlayCard
              cropData={cropData}
              activeStage={activeStage}
              sliderPercentage={sliderValue}
            />
          </div>
        )}
      </div>
    </div>
  );
};
