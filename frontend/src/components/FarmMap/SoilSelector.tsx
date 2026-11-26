import React from 'react';
import type { SoilDefinition } from '../../types/parcelMetadata.ts';
import { SOILS } from '../../utils/parcelMetadataPolicy.ts';

export interface SoilSelectorProps {
  selectedSoilId?: string;
  value?: string;
  onChange: (soil: SoilDefinition) => void;
  disabled?: boolean;
  error?: string;
}

const SOIL_HINTS: Record<string, string> = {
  sand: 'Drains fast',
  sandy_loam: 'Balanced',
  silt: 'Holds moisture',
  clay: 'Holds water longest',
};

/**
 * Soil selector: four simple options with name, one short hint and a small water-holding number.
 */
export function SoilSelector({
  selectedSoilId,
  value,
  onChange,
  disabled = false,
  error,
}: SoilSelectorProps): React.JSX.Element {
  const activeIdentifier = (selectedSoilId || value || '').trim().toLowerCase();

  return (
    <div className="w-full">
      <div className="mb-1.5">
        <span className="block text-[13px] font-medium text-ui-ink-3">Soil</span>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Soil" aria-required="true">
        {SOILS.map((soil) => {
          const isSelected =
            soil.id.toLowerCase() === activeIdentifier ||
            soil.name.toLowerCase() === activeIdentifier ||
            soil.type.toLowerCase() === activeIdentifier;

          return (
            <button
              key={soil.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(soil)}
              title={`Holds water: ${soil.thetaFc.toFixed(2)}`}
              className={`flex min-h-11 flex-col justify-center px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
                isSelected
                  ? 'border-ui-accent-line bg-ui-accent-soft'
                  : 'border-ui-line bg-ui-bg hover:bg-ui-warm'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-[15px] font-medium text-ui-ink">{soil.name}</span>
              <span className="text-xs text-ui-ink-2 tabular-nums">
                {SOIL_HINTS[soil.id] ?? 'Soil'} &middot; {soil.thetaFc.toFixed(2)}
              </span>
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
