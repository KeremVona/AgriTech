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
          pin: 'bg-emerald-700 text-white border-white',
          glow: 'ring-4 ring-emerald-500/25',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          word: 'Mild',
        };
      case 'amber':
        return {
          pin: 'bg-amber-700 text-white border-white',
          glow: 'ring-4 ring-amber-500/25',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          word: 'Watch',
        };
      case 'red':
        return {
          pin: 'bg-red-700 text-white border-white',
          glow: 'ring-4 ring-red-500/25',
          badge: 'bg-red-50 text-red-700 border-red-200',
          word: 'Serious',
        };
      case 'purple':
      default:
        return {
          pin: 'bg-ui-ink text-white border-white',
          glow: 'ring-4 ring-black/15',
          badge: 'bg-ui-warm text-ui-ink-2 border-ui-line',
          word: 'Note',
        };
    }
  };

  return (
    <div className={`pointer-events-none absolute inset-0 z-20 ${className}`}>
      <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
        {onToggleEnabled && (
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium shadow-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
              enabled
                ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent-hover'
                : 'border-ui-line bg-white text-ui-ink-2 hover:bg-ui-warm'
            }`}
            title="Toggle anatomical symptom hotspot pins"
            aria-pressed={enabled}
          >
            Spots
            <span className="tabular-nums">{activeHotspots.length}</span>
          </button>
        )}
      </div>

      {enabled &&
        activeHotspots.map((hotspot) => {
          const isSelected = selectedHotspot?.id === hotspot.id;
          const styling = getPinColorClasses(hotspot.badgeColor);

          return (
            <div
              key={hotspot.id}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-out"
              style={{
                left: `${hotspot.xPct}%`,
                top: `${hotspot.yPct}%`,
              }}
            >
              <button
                type="button"
                data-hotspot-pin={hotspot.id}
                onClick={() => setSelectedHotspotId(isSelected ? null : hotspot.id)}
                className={`group relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-semibold shadow-sm transition-transform duration-150 after:absolute after:-inset-2 after:rounded-full after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
                  styling.pin
                } ${isSelected ? 'z-30 scale-110 ring-4 ring-ui-accent' : styling.glow}`}
                aria-label={`Hotspot: ${hotspot.title}`}
                aria-expanded={isSelected}
                aria-haspopup="dialog"
              >
                <span className="relative z-10">{hotspot.badgeColor === 'red' ? '!' : '•'}</span>

                <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-ui-line bg-white px-2 py-1 text-xs font-medium text-ui-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  {hotspot.title}
                </span>
              </button>
            </div>
          );
        })}

      {enabled && selectedHotspot && (
        <div
          ref={detailCardRef}
          className="pointer-events-auto absolute bottom-4 left-4 right-4 z-40 rounded-2xl border border-ui-line bg-white p-4 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-150 sm:left-auto sm:w-[calc(100%-2rem)] sm:max-w-80"
          role="dialog"
          aria-label={`Hotspot Details: ${selectedHotspot.title}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span
                className={`mb-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  getPinColorClasses(selectedHotspot.badgeColor).badge
                }`}
              >
                {getPinColorClasses(selectedHotspot.badgeColor).word}
              </span>
              <h4 className="text-base font-semibold leading-tight text-ui-ink">{selectedHotspot.title}</h4>
            </div>

            <button
              type="button"
              onClick={() => setSelectedHotspotId(null)}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ui-ink-2 hover:bg-ui-warm focus-visible:outline-2 focus-visible:outline-ui-accent"
              aria-label="Close hotspot popover"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <p className="mt-2 text-sm leading-snug text-ui-ink-2">{selectedHotspot.anatomicalDescription}</p>
          <p className="mt-2 text-sm text-ui-ink">
            <span className="font-medium">Effect:</span> {selectedHotspot.physiologicalImpact}
          </p>
        </div>
      )}
    </div>
  );
};
