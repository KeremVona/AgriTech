/**
 * CompactCropSelectorRail (SPEC-UI-007, Section 4.4).
 * Precision Ag-Intelligence light-mode 8-crop specimen selector rail with:
 * - 44px+ hit targets for touch ergonomics
 * - Auto-scroll active pill into view smoothly
 * - Light-mode design system tokens (#FFFFFF surface, #0F766E active teal accent)
 * - Full WAI-ARIA tablist/tab compliance and keyboard navigation
 */

import React, { useRef, useEffect } from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type { CropSpecimenItem } from './types.ts';
import { DEFAULT_CROP_SPECIMENS } from './types.ts';

export { DEFAULT_CROP_SPECIMENS };

export interface CompactCropSelectorRailProps {
  crops?: CropSpecimenItem[];
  selectedCrop: SupportedCropId;
  onSelectCrop: (cropId: SupportedCropId) => void;
  className?: string;
}

export const CompactCropSelectorRail: React.FC<CompactCropSelectorRailProps> = ({
  crops = DEFAULT_CROP_SPECIMENS,
  selectedCrop,
  onSelectCrop,
  className = '',
}) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % crops.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + crops.length) % crops.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = crops.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextCrop = crops[nextIndex];
    onSelectCrop(nextCrop.id);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={`relative w-full bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs ${className}`}
      role="region"
      aria-label="Crop Specimen Selector"
    >
      <div className="flex items-center justify-between px-2 pt-0.5 pb-2 border-b border-slate-100 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-teal-800 font-bold flex items-center gap-1.5">
            <span>🌱</span> Agricultural Specimen Rail
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline">
            8 Pathosystems
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
          Select crop specimen to update diffusion weights
        </span>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={railRef}
        role="tablist"
        aria-label="Agricultural Crops"
        className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {crops.map((crop, idx) => {
          const isSelected = selectedCrop === crop.id;

          return (
            <button
              key={crop.id}
              ref={(el) => {
                buttonRefs.current[idx] = el;
                if (isSelected) activeBtnRef.current = el;
              }}
              role="tab"
              aria-selected={isSelected}
              id={`crop-tab-${crop.id}`}
              tabIndex={isSelected ? 0 : -1}
              type="button"
              onClick={() => onSelectCrop(crop.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all duration-150 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-1 select-none ${
                isSelected
                  ? 'bg-teal-50 border-teal-700 text-teal-900 shadow-2xs ring-1 ring-teal-700/30 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className="text-lg shrink-0 leading-none">{crop.icon}</span>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className={`font-bold truncate ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                    {crop.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 hidden lg:inline">
                    ({crop.family})
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal truncate mt-0.5 max-w-[120px]">
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
