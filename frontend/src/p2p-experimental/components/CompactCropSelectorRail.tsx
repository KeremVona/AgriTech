import React, { useRef, useEffect } from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel';

export interface CropSpecimenItem {
  id: SupportedCropId;
  label: string;
  icon: string;
  subtitle: string;
  family: string;
}

export interface CompactCropSelectorRailProps {
  crops: CropSpecimenItem[];
  selectedCrop: SupportedCropId;
  onSelectCrop: (cropId: SupportedCropId) => void;
  className?: string;
}

export const CompactCropSelectorRail: React.FC<CompactCropSelectorRailProps> = ({
  crops,
  selectedCrop,
  onSelectCrop,
  className = '',
}) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active pill into view smoothly
  useEffect(() => {
    if (activeBtnRef.current && railRef.current) {
      const rail = railRef.current;
      const btn = activeBtnRef.current;
      const railRect = rail.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      if (btnRect.left < railRect.left || btnRect.right > railRect.right) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    }
  }, [selectedCrop]);

  return (
    <div
      className={`relative w-full bg-slate-900/60 border border-white/10 rounded-2xl p-2 backdrop-blur-md shadow-lg ${className}`}
      role="region"
      aria-label="Crop Specimen Selector"
    >
      <div className="flex items-center justify-between px-2 pt-1 pb-1.5 border-b border-white/5 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
            <span>🌱</span> Agricultural Specimen Rail
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 hidden sm:inline">
            8 Pathosystems
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
          Scroll or click to switch pathogen models
        </span>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={railRef}
        role="tablist"
        aria-label="Agricultural Crops"
        className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {crops.map((crop) => {
          const isSelected = selectedCrop === crop.id;

          return (
            <button
              key={crop.id}
              ref={isSelected ? activeBtnRef : null}
              role="tab"
              aria-selected={isSelected}
              type="button"
              onClick={() => onSelectCrop(crop.id)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 select-none ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              <span className="text-base shrink-0 leading-none">{crop.icon}</span>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span
                    className={`font-bold truncate ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {crop.label}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {crop.family}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {crop.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
