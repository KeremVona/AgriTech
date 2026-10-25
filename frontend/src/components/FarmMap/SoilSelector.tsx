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

/**
 * Custom agronomic soil selector presenting the 4 canonical soil textures:
 * Sand, Sandy Loam, Silt, and Clay.
 *
 * Displays profile name, field capacity (theta_FC) badge, and agronomic drainage notes.
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
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
          Soil Texture Profile <span className="text-rose-500">*</span>
        </label>
        <span className="text-xs text-slate-500">USDA texture classification</span>
      </div>

      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Soil Texture Profile"
      >
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
              className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/60 ring-1 ring-teal-600/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}`}
            >
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">{soil.name}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
                      isSelected
                        ? 'bg-teal-100 text-teal-800 border border-teal-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    title={`Volumetric Field Capacity (theta_FC): ${soil.thetaFc}`}
                  >
                    &theta;<sub>FC</sub> = {soil.thetaFc.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  {soil.description}
                </p>
              </div>

              <div className="mt-0.5 flex items-center justify-center">
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
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
