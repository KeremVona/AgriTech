/**
 * LeafHotspotOverlay (SPEC-UI-007, Section 4.3).
 * Precision Ag-Intelligence light-mode foliar symptom hotspot overlay with:
 * - 24 registered anatomical pins (3 per crop specimen)
 * - Dynamic active window detection with pulsating halo rings
 * - Accessible popover card with microscopic manifestation descriptions
 * - Click-outside and Escape key dismissal
 */

import React, { useState, useEffect, useRef } from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type { SymptomHotspot } from '../../models/hotspotRegistry.ts';
import { getActiveHotspotsForProgress } from '../../models/hotspotRegistry.ts';

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
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const detailCardRef = useRef<HTMLDivElement | null>(null);

  const activeHotspots = getActiveHotspotsForProgress(cropId, sliderPercentage);
  // Pure derived state: automatically null if hotspot is not active in current crop / slider tier
  const selectedHotspot = activeHotspots.find((h) => h.id === selectedHotspotId) || null;

  // Close hotspot detail on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedHotspotId(null);
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
        const target = e.target as HTMLElement;
        if (!target.closest('[data-hotspot-pin]')) {
          setSelectedHotspotId(null);
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
          pin: 'bg-emerald-600 text-white border-white',
          glow: 'ring-4 ring-emerald-500/30',
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'amber':
        return {
          pin: 'bg-amber-600 text-white border-white',
          glow: 'ring-4 ring-amber-500/30',
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'red':
        return {
          pin: 'bg-rose-600 text-white border-white',
          glow: 'ring-4 ring-rose-500/30',
          badge: 'bg-rose-50 text-rose-800 border-rose-200',
        };
      case 'purple':
      default:
        return {
          pin: 'bg-purple-600 text-white border-white',
          glow: 'ring-4 ring-purple-500/30',
          badge: 'bg-purple-50 text-purple-800 border-purple-200',
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
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all duration-150 active:scale-95 shadow-xs flex items-center gap-1.5 cursor-pointer border ${
              enabled
                ? 'bg-white border-teal-700 text-teal-800 shadow-teal-900/10'
                : 'bg-white/90 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
            title="Toggle anatomical symptom hotspot pins"
            aria-pressed={enabled}
          >
            <span>🔬</span>
            <span>Hotspots ({activeHotspots.length})</span>
          </button>
        )}
      </div>

      {/* Render Hotspot Pins when enabled */}
      {enabled &&
        activeHotspots.map((hotspot) => {
          const isSelected = selectedHotspot?.id === hotspot.id;
          const styling = getPinColorClasses(hotspot.badgeColor);

          return (
            <div
              key={hotspot.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-all duration-200 ease-out"
              style={{
                left: `${hotspot.xPct}%`,
                top: `${hotspot.yPct}%`,
              }}
            >
              <button
                type="button"
                data-hotspot-pin={hotspot.id}
                onClick={() => setSelectedHotspotId(isSelected ? null : hotspot.id)}
                className={`relative group w-7 h-7 rounded-full border-2 flex items-center justify-center font-mono text-[11px] font-bold transition-transform duration-150 active:scale-90 cursor-pointer shadow-md after:content-[''] after:absolute after:-inset-2 after:rounded-full ${
                  styling.pin
                } ${isSelected ? 'scale-125 ring-4 ring-teal-600 shadow-lg z-30' : styling.glow}`}
                aria-label={`Hotspot: ${hotspot.title}`}
                aria-expanded={isSelected}
                aria-haspopup="dialog"
              >
                {/* Pulsing ring animation */}
                <span
                  className={`absolute inset-0 rounded-full animate-ping opacity-40 ${styling.pin}`}
                  aria-hidden="true"
                />
                <span className="relative z-10">{hotspot.badgeColor === 'red' ? '!' : '•'}</span>

                {/* Floating tooltip on hover */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900 text-white whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40">
                  {hotspot.title}
                </span>
              </button>
            </div>
          );
        })}

      {/* Selected Hotspot Popover Detail Card */}
      {enabled && selectedHotspot && (
        <div
          ref={detailCardRef}
          className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl pointer-events-auto z-40 animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="dialog"
          aria-label={`Hotspot Details: ${selectedHotspot.title}`}
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border font-semibold inline-block mb-1 ${
                  getPinColorClasses(selectedHotspot.badgeColor).badge
                }`}
              >
                Stage {selectedHotspot.stageOrder} • {selectedHotspot.badgeColor.toUpperCase()}
              </span>
              <h4 className="text-xs font-bold text-slate-900 leading-tight">
                {selectedHotspot.title}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setSelectedHotspotId(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 text-xs cursor-pointer"
              aria-label="Close hotspot popover"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 mt-2.5">
            <p className="text-xs text-slate-700 leading-relaxed">
              {selectedHotspot.anatomicalDescription}
            </p>
            <p className="text-[11px] text-slate-500 italic">
              <strong>Impact:</strong> {selectedHotspot.physiologicalImpact}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
            <span>
              Threshold:{' '}
              <strong className="text-teal-700">
                {selectedHotspot.minSliderPct}%+
              </strong>
            </span>
            <span>
              Coords: ({selectedHotspot.xPct}%, {selectedHotspot.yPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
