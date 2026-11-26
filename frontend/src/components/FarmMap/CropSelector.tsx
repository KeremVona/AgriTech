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
 * Crop selector: four large tap targets, each with a small palette-coloured dot and the crop name.
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
      <div className="mb-1.5">
        <span className="block text-[13px] font-medium text-ui-ink-3">Crop</span>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Crop" aria-required="true">
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
              className={`flex min-h-11 items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-[15px] font-medium text-ui-ink transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
                isSelected
                  ? 'border-ui-accent-line bg-ui-accent-soft'
                  : 'border-ui-line bg-ui-bg hover:bg-ui-warm'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: crop.palette.stroke }}
                aria-hidden="true"
              />
              {crop.commonName}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-1.5 text-[13px] text-red-700 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
