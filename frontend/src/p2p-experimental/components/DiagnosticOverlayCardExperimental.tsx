import React from 'react';
import type { ProgressionStage } from '../../types/progression';
import type { ExperimentalCropProgressionData } from '../services/experimentalProgressionService.ts';

export interface DiagnosticOverlayCardExperimentalProps {
  cropData: ExperimentalCropProgressionData | null;
  activeStage: ProgressionStage | null;
  sliderPercentage: number;
  className?: string;
}

/**
 * Returns granular biological symptoms based on precise scrub position (0 to 100%).
 */
function getGranularPathologyText(cropName: string, diseaseName: string, pct: number): string {
  if (pct <= 10.0) {
    return `Pristine ${cropName} leaflet lamina. Intact waxy cuticle layer, uniform chlorophyll pigmentation, zero ${diseaseName} foliar degradation.`;
  }
  if (pct <= 30.0) {
    return `Incipient ${diseaseName} infection stage. Scattered microscopic chlorotic flecks emerging along interveinal zones of the ${cropName} blade.`;
  }
  if (pct <= 50.0) {
    return `Active ${diseaseName} lesion expansion. Discrete water-soaked necrotic foci surrounded by distinct chlorotic haloes. Pathogen colonizing parenchymal tissue.`;
  }
  if (pct <= 70.0) {
    return `Rapid confluent ${diseaseName} spread. Individual lesions coalesce across primary venation pathways. Significant reduction in photosynthetic active area (~45%).`;
  }
  if (pct <= 85.0) {
    return `Advanced ${diseaseName} necrotic collapse. Severe concentric target-board ring desiccation. Structural foliar breakdown with brittle curling margins.`;
  }
  return `Critical terminal ${diseaseName} blight. Near-total tissue necrosis (>85%), extensive cellular collapse, vascular cavitations, and imminent premature defoliation.`;
}

export const DiagnosticOverlayCardExperimental: React.FC<DiagnosticOverlayCardExperimentalProps> = ({
  cropData,
  activeStage,
  sliderPercentage,
  className = '',
}) => {
  if (!cropData || !activeStage) return null;

  const granularText = getGranularPathologyText(
    cropData.crop_name,
    cropData.disease_name,
    sliderPercentage
  );

  const getRiskBadge = (pct: number) => {
    if (pct <= 30) {
      return { label: 'LOW THREAT', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    }
    if (pct <= 70) {
      return { label: 'MODERATE RISK', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    }
    return { label: 'CRITICAL OUTBREAK', color: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' };
  };

  const risk = getRiskBadge(sliderPercentage);

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 backdrop-blur-md ${className}`}
      aria-live="polite"
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-wide">
            {cropData.crop_name} • {cropData.disease_name}
          </span>
          <span className="text-[11px] font-mono text-slate-400 italic">
            ({cropData.pathogen_scientific})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${risk.color}`}
          >
            {risk.label}
          </span>
          <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
            {sliderPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Live Granular Pathology Status */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>🔬</span> Live Pathology Description
        </div>
        <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          {granularText}
        </p>
      </div>

      {/* Stage Symptom Markers & Agronomic Advisory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <span>🌿</span> Stage {activeStage.stage_order} Markers
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeStage.symptom_markers}
          </p>
        </div>

        <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-900/30 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <span>🛡️</span> Actionable Agronomic Advisory
          </div>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            {activeStage.agronomic_advice}
          </p>
        </div>
      </div>

      {/* Color Spectrum & Pathogen Info Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-slate-500 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <span>Pathogen Class:</span>
          <span className="font-semibold text-slate-400">{cropData.pathogen_type}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>Symptom Palette:</span>
          <div className="flex gap-1.5">
            {activeStage.color_palette_hex.map((hex, idx) => (
              <span
                key={idx}
                className="w-3.5 h-3.5 rounded-full border border-slate-700 shadow-xs"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
