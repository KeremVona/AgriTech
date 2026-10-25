import React from 'react';
import type { CropDefinition } from '../../types/parcelMetadata.ts';
import { CROPS } from '../../utils/parcelMetadataPolicy.ts';

export interface CropSelectorProps {
  selectedCropId?: string;
  value?: string;
  onChange: (crop: CropDefinition) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * High-contrast agricultural crop selector presenting the 4 canonical varieties:
 * Tomato, Corn (Maize), Potato, and Apple.
 *
 * Displays emoji, common name, botanical family, scientific name, and color swatch preview.
 */
export function CropSelector({
  selectedCropId,
  value,
  onChange,
  disabled = false,
  error,
}: CropSelectorProps): React.JSX.Element {
  const activeIdentifier = (selectedCropId || value || '').trim().toLowerCase();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
          Crop Variety <span className="text-rose-500">*</span>
        </label>
        <span className="text-xs text-slate-500">4 canonical varieties</span>
      </div>

      <div
        className="grid grid-cols-2 gap-2.5"
        role="radiogroup"
        aria-label="Crop Variety"
      >
        {CROPS.map((crop) => {
          const isSelected =
            crop.id.toLowerCase() === activeIdentifier ||
            crop.name.toLowerCase() === activeIdentifier ||
            crop.commonName.toLowerCase() === activeIdentifier ||
            crop.category.toLowerCase() === activeIdentifier ||
            crop.scientificName.toLowerCase() === activeIdentifier;

          return (
            <button
              key={crop.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(crop)}
              style={{
                borderColor: isSelected ? crop.palette.stroke : undefined,
                backgroundColor: isSelected ? crop.palette.fill : undefined,
              }}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none text-slate-900 ${
                isSelected
                  ? 'border-2 shadow-sm ring-1 ring-slate-900/5'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-2xl leading-none" role="img" aria-label={crop.commonName}>
                  {crop.emoji}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border shadow-xs"
                    style={{
                      backgroundColor: crop.palette.stroke,
                      borderColor: isSelected ? crop.palette.selected : 'rgba(0,0,0,0.1)',
                    }}
                    title={`Crop palette swatch: ${crop.palette.stroke}`}
                  />
                  {isSelected && (
                    <svg
                      className="w-4 h-4"
                      style={{ color: crop.palette.selected }}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>

              <div className="font-semibold text-sm leading-tight text-slate-800">
                {crop.commonName}
              </div>

              <div className="text-[11px] text-slate-500 italic mt-0.5 leading-tight">
                {crop.family} &bull; <span className="opacity-80">{crop.scientificName}</span>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-rose-600 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
