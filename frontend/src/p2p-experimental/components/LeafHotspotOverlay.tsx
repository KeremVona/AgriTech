import React, { useState } from 'react';
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

  const activeHotspots = getActiveHotspotsForProgress(cropId, sliderPercentage);

  const getPinColorClasses = (color: SymptomHotspot['badgeColor']) => {
    switch (color) {
      case 'emerald':
        return {
          ring: 'bg-emerald-400/40',
          pin: 'bg-emerald-500 border-white text-white',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.8)]',
          badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60',
        };
      case 'amber':
        return {
          ring: 'bg-amber-400/40',
          pin: 'bg-amber-500 border-white text-slate-950 font-bold',
          glow: 'shadow-[0_0_12px_rgba(245,158,11,0.8)]',
          badge: 'bg-amber-950/90 text-amber-300 border-amber-700/60',
        };
      case 'red':
        return {
          ring: 'bg-red-400/40',
          pin: 'bg-red-500 border-white text-white',
          glow: 'shadow-[0_0_12px_rgba(239,68,68,0.8)]',
          badge: 'bg-red-950/90 text-red-300 border-red-700/60',
        };
      case 'purple':
        return {
          ring: 'bg-purple-400/40',
          pin: 'bg-purple-500 border-white text-white',
          glow: 'shadow-[0_0_12px_rgba(168,85,247,0.8)]',
          badge: 'bg-purple-950/90 text-purple-300 border-purple-700/60',
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
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border ${
              enabled
                ? 'bg-purple-950/90 border-purple-500/50 text-purple-200 hover:bg-purple-900/90'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔬</span>
            <span>{enabled ? 'Hotspots Active' : 'Show Hotspots'}</span>
            {enabled && activeHotspots.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">
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
              className="absolute pointer-events-auto transition-all duration-300 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hotspot.xPct}%`,
                top: `${hotspot.yPct}%`,
              }}
            >
              {/* Outer Pulsing Ping Ring */}
              <span
                className={`absolute -inset-1.5 rounded-full ${styles.ring} animate-ping pointer-events-none`}
              />

              {/* Pin Button */}
              <button
                type="button"
                onClick={() => setSelectedHotspot(isSelected ? null : hotspot)}
                className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shadow-lg transition-transform hover:scale-125 cursor-pointer ${
                  styles.pin
                } ${styles.glow} ${isSelected ? 'scale-125 ring-2 ring-white' : ''}`}
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
        <div className="absolute inset-x-4 bottom-14 pointer-events-auto z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-slate-950/95 border border-purple-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🔬</span>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    {selectedHotspot.title}
                  </h4>
                  <div className="text-[10px] text-purple-300/90 font-mono">
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
                  className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
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
