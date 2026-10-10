import React, { useState, useEffect, useRef } from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import type { SymptomHotspot } from '../models/hotspotRegistry';
import { getActiveHotspotsForProgress } from '../models/hotspotRegistry';

export interface LeafHotspotOverlayProps {
  cropId: SupportedCropId;
  sliderPercentage: number;
  enabled: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  className?: string;
}

export const LeafHotspotOverlay: React.FC<LeafHotspotOverlayProps> = ({
  cropId,
  sliderPercentage,
  enabled,
  onToggleEnabled,
  className = '',
}) => {
  const [selectedHotspot, setSelectedHotspot] = useState<SymptomHotspot | null>(null);
  const detailCardRef = useRef<HTMLDivElement | null>(null);

  const activeHotspots = getActiveHotspotsForProgress(cropId, sliderPercentage);

  // Close hotspot detail on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedHotspot(null);
      }
    };
    if (selectedHotspot) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedHotspot]);

  // Click outside detail card to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (detailCardRef.current && !detailCardRef.current.contains(e.target as Node)) {
        // Only close if not clicking on a pin button
        const target = e.target as HTMLElement;
        if (!target.closest('[data-hotspot-pin]')) {
          setSelectedHotspot(null);
        }
      }
    };

    if (selectedHotspot) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedHotspot]);

  const getPinColorClasses = (color: SymptomHotspot['badgeColor']) => {
    switch (color) {
      case 'emerald':
        return {
          pin: 'bg-emerald-500 border-white text-white',
          glow: 'shadow-[0_0_10px_rgba(16,185,129,0.7)]',
          badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60',
        };
      case 'amber':
        return {
          pin: 'bg-amber-500 border-white text-slate-950 font-bold',
          glow: 'shadow-[0_0_10px_rgba(245,158,11,0.7)]',
          badge: 'bg-amber-950/90 text-amber-300 border-amber-700/60',
        };
      case 'red':
        return {
          pin: 'bg-rose-500 border-white text-white',
          glow: 'shadow-[0_0_10px_rgba(244,63,94,0.7)]',
          badge: 'bg-rose-950/90 text-rose-300 border-rose-700/60',
        };
      case 'purple':
        return {
          pin: 'bg-violet-500 border-white text-white',
          glow: 'shadow-[0_0_10px_rgba(139,92,246,0.7)]',
          badge: 'bg-violet-950/90 text-violet-300 border-violet-700/60',
        };
    }
  };

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 ${className}`}>
      {/* Top Floating Controls: Toggle & Count Badge */}
      <div className="absolute top-3 right-3 pointer-events-auto flex items-center gap-2">
        {onToggleEnabled && (
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all duration-150 ease-out shadow-md flex items-center gap-1.5 cursor-pointer border active:scale-[0.97] ${
              enabled
                ? 'bg-slate-900 border-emerald-500/60 text-emerald-300 shadow-emerald-950/30'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>🔬</span>
            <span>{enabled ? 'Hotspots Active' : 'Show Hotspots'}</span>
            {enabled && activeHotspots.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeHotspots.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Render Hotspot Pins if enabled */}
      {enabled &&
        activeHotspots.map((hotspot, idx) => {
          const styles = getPinColorClasses(hotspot.badgeColor);
          const isSelected = selectedHotspot?.id === hotspot.id;

          return (
            <div
              key={hotspot.id}
              className="absolute pointer-events-auto transition-transform duration-150 ease-out -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hotspot.xPct}%`,
                top: `${hotspot.yPct}%`,
              }}
            >
              {/* Calm, Non-jittering Pin Button */}
              <button
                data-hotspot-pin="true"
                type="button"
                onClick={() => setSelectedHotspot(isSelected ? null : hotspot)}
                className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shadow-lg transition-all duration-150 ease-out cursor-pointer hover:scale-115 active:scale-[0.97] ${
                  styles.pin
                } ${styles.glow} ${
                  isSelected ? 'scale-120 ring-2 ring-white ring-offset-1 ring-offset-slate-950' : ''
                }`}
                title={hotspot.title}
                aria-label={`Inspect ${hotspot.title}`}
              >
                {idx + 1}
              </button>
            </div>
          );
        })}

      {/* Selected Hotspot Detailed Diagnostic Modal / Card */}
      {enabled && selectedHotspot && (
        <div
          ref={detailCardRef}
          className="absolute inset-x-3 bottom-14 pointer-events-auto z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="bg-slate-950/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🔬</span>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    {selectedHotspot.title}
                  </h4>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {selectedHotspot.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                    getPinColorClasses(selectedHotspot.badgeColor).badge
                  }`}
                >
                  {selectedHotspot.badgeLabel}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedHotspot(null)}
                  className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer active:scale-[0.97]"
                  aria-label="Close hotspot detail"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Description Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  Anatomical Pathology
                </div>
                <p className="text-slate-300">{selectedHotspot.anatomicalDescription}</p>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  Host Plant Impact
                </div>
                <p className="text-slate-300">{selectedHotspot.physiologicalImpact}</p>
              </div>
            </div>

            {/* Treatment Recommendation Footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-emerald-300 bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-800/30">
              <span className="text-xs mt-0.5">🛡️</span>
              <div>
                <span className="font-semibold text-white">Targeted Advisory: </span>
                {selectedHotspot.treatmentAdvisory}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
