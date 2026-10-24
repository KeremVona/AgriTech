/**
 * ProgressionCanvasViewport (SPEC-UI-007, Section 4.2 & 4.3).
 * Interactive foliar canvas viewport featuring:
 * - WebGL two-phase shader blending engine with HTML5 2D fallback
 * - 3 interactive view modes: Standard RGB, Cross-Attention Heatmap, Difference Mask
 * - Split curtain comparison against Stage 0 healthy baseline
 * - Overlay of anatomical symptom hotspot pins
 * - Integrated agronomic timeline scrubber
 */

import React, { useEffect, useRef, useState } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../../models/agronomicTimelineModel.ts';
import type { ProgressionViewMode, TextureSources } from './types.ts';
import { ProgressionShaderRenderer } from './ProgressionShaderRenderer.ts';
import { LeafHotspotOverlay } from './LeafHotspotOverlay.tsx';
import { AgronomicTimelineSlider } from './AgronomicTimelineSlider.tsx';

export interface ProgressionCanvasViewportProps {
  cropId: SupportedCropId;
  textureSources: TextureSources;
  sliderPercentage: number;
  onSliderPercentageChange: (pct: number) => void;
  dynamicOutput: ProgressionDynamicOutput;
  treatmentActive?: boolean;
  interventionSeverity?: number;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const ProgressionCanvasViewport: React.FC<ProgressionCanvasViewportProps> = ({
  cropId,
  textureSources,
  sliderPercentage,
  onSliderPercentageChange,
  dynamicOutput,
  treatmentActive = false,
  interventionSeverity,
  className = '',
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ProgressionShaderRenderer | null>(null);

  const [viewMode, setViewMode] = useState<ProgressionViewMode>('rgb');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPosition, setSplitPosition] = useState(0.5);
  const [hotspotsEnabled, setHotspotsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebGLEnabled, setIsWebGLEnabled] = useState(true);

  // Initialize WebGL / 2D Pipeline
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const renderer = new ProgressionShaderRenderer(canvas);
    rendererRef.current = renderer;
    setIsWebGLEnabled(renderer.isAvailable());

    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onCanvasReady]);

  // Load Textures whenever cropId or sources change
  useEffect(() => {
    if (!rendererRef.current) return;
    const renderer = rendererRef.current;

    setIsLoading(true);
    renderer
      .loadTextures(textureSources)
      .then(() => {
        setIsLoading(false);
        setIsWebGLEnabled(renderer.isAvailable());
      })
      .catch((err) => {
        console.error('[ProgressionCanvasViewport] Texture load error:', err);
        setIsLoading(false);
      });
  }, [textureSources]);

  // Update Progress on slider changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(sliderPercentage / 100.0);
    }
  }, [sliderPercentage]);

  // Update View Mode
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewMode(viewMode);
    }
  }, [viewMode]);

  // Update Split Compare
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setSplitCompare(splitEnabled, splitPosition);
    }
  }, [splitEnabled, splitPosition]);

  // Responsive Canvas Resize Observer with DPR Calibration
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      rendererRef.current.resize(rect.width, rect.height, dpr);
    };

    // Initial resize trigger
    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return (
    <div
      className={`flex flex-col space-y-4 bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs ${className}`}
      role="region"
      aria-label="Interactive Foliar Canvas Stage"
    >
      {/* Top Viewport Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        {/* Left: View Mode Segmented Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-mono uppercase text-slate-500 font-bold px-2 hidden sm:inline">
            Mode:
          </span>

          <button
            type="button"
            onClick={() => setViewMode('rgb')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
              viewMode === 'rgb'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Photorealistic RGB progression blend"
          >
            🌿 Standard RGB
          </button>

          <button
            type="button"
            onClick={() => setViewMode('attention')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
              viewMode === 'attention'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Cross-Attention Heatmap (#0F766E Teal -> #F59E0B Amber -> #DC2626 Red)"
          >
            🔥 Attention Map
          </button>

          <button
            type="button"
            onClick={() => setViewMode('mask')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
              viewMode === 'mask'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="High-contrast isolated lesion mask"
          >
            🎭 Difference Mask
          </button>
        </div>

        {/* Right: Split Curtain & Mode Badges */}
        <div className="flex items-center gap-2">
          {/* Split Screen Curtain Toggle */}
          <button
            type="button"
            onClick={() => setSplitEnabled(!splitEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
              splitEnabled
                ? 'bg-teal-50 border-teal-700 text-teal-900 font-bold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Compare Stage 0 Healthy baseline against predicted progression"
            aria-pressed={splitEnabled}
          >
            <span>⚖️</span>
            <span>{splitEnabled ? 'Curtain Active' : 'Split Baseline'}</span>
          </button>

          {!isWebGLEnabled && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
              title="HTML5 2D Canvas Fallback Pipeline"
            >
              2D Fallback
            </span>
          )}
        </div>
      </div>

      {/* Split Curtain Position Range (when active) */}
      {splitEnabled && (
        <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl flex items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
          <span className="font-semibold text-teal-950 flex items-center gap-1.5 shrink-0">
            <span>↔️</span>
            <span>Curtain Divider:</span>
          </span>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={splitPosition}
            onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
            className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2 cursor-pointer"
            aria-label="Split Screen Curtain Position"
            aria-valuemin={5}
            aria-valuemax={95}
            aria-valuenow={Math.round(splitPosition * 100)}
            aria-valuetext={`Split curtain at ${Math.round(splitPosition * 100)} percent`}
          />
          <span className="font-mono tabular-nums text-teal-800 font-bold shrink-0">
            {Math.round(splitPosition * 100)}%
          </span>
        </div>
      )}

      {/* Main Canvas Container (Aspect Ratio 1:1, max 800x800) */}
      <div className="relative w-full aspect-square max-w-[640px] mx-auto bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs space-y-2">
            <div className="w-8 h-8 rounded-full border-3 border-teal-200 border-t-teal-700 animate-spin" />
            <span className="text-xs font-mono text-slate-500 font-medium">
              Calibrating Foliar Shaders...
            </span>
          </div>
        )}

        {/* WebGL Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="w-full h-full object-contain select-none"
        />

        {/* Anatomical Leaf Hotspots Overlay */}
        <LeafHotspotOverlay
          cropId={cropId}
          sliderPercentage={sliderPercentage}
          enabled={hotspotsEnabled}
          onToggleEnabled={setHotspotsEnabled}
        />
      </div>

      {/* Bottom Agronomic Timeline Scrubber */}
      <AgronomicTimelineSlider
        cropId={cropId}
        sliderPercentage={sliderPercentage}
        onSliderPercentageChange={onSliderPercentageChange}
        dynamicOutput={dynamicOutput}
        treatmentActive={treatmentActive}
        interventionSeverity={interventionSeverity}
      />
    </div>
  );
};
