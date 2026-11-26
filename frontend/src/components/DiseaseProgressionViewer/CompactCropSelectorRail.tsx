/**
 * Crop picker: one tile per crop with its healthy-leaf photo, name and disease.
 * WAI-ARIA tablist with arrow/Home/End keys; scrolls the active tile into view on small screens.
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
    <div className={`relative ${className}`} role="region" aria-label="Crop selector">
      <div
        ref={railRef}
        role="tablist"
        aria-label="Crops"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-8 lg:px-0 [&::-webkit-scrollbar]:hidden"
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
              className={`flex w-28 shrink-0 cursor-pointer flex-col items-center rounded-2xl border px-2 pb-2.5 pt-2 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent lg:w-auto ${
                isSelected ? 'border-ui-accent-line bg-ui-accent-soft' : 'border-ui-line bg-ui-bg hover:bg-ui-warm'
              }`}
            >
              <img
                src={`/progression-experimental/${crop.id}/${crop.id}_stage0_healthy.webp`}
                alt=""
                loading="lazy"
                className="h-12 w-12 object-contain"
              />
              <span className={`mt-1.5 block text-sm ${isSelected ? 'font-medium text-ui-ink' : 'text-ui-ink'}`}>{crop.label}</span>
              <span className="block w-full truncate text-[11px] text-ui-ink-3">{crop.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
