/**
 * TreatmentOutcomeCard (SPEC-UI-007, Section 4.8).
 * Precision Ag-Intelligence light-mode analytics card displaying:
 * - Green Leaf Area (GLA) preservation %
 * - Yield Retention & Loss Mitigation vs untreated baseline
 * - Economic Net Margin Saved ($/ha) & FRAC rotation guidance
 */

import React from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type {
  YieldRetentionAnalyticsResult,
  InterventionEfficacyResult,
  FungicideCategory,
} from '../../models/treatmentBranchingModel.ts';
import { AGRONOMIC_INTERVENTION_REGISTRY } from '../../models/treatmentBranchingModel.ts';

export interface TreatmentOutcomeCardProps {
  cropId: SupportedCropId;
  treatmentActive: boolean;
  interventionSeverity: number;
  interventionDay: number;
  currentScrubDay: number;
  currentTreatedSeverity: number;
  plateauSeverity: number;
  yieldAnalytics: YieldRetentionAnalyticsResult;
  efficacyResult: InterventionEfficacyResult;
  selectedCategory: FungicideCategory;
  className?: string;
}

export const TreatmentOutcomeCard: React.FC<TreatmentOutcomeCardProps> = ({
  cropId,
  treatmentActive,
  interventionSeverity,
  interventionDay,
  currentScrubDay,
  currentTreatedSeverity,
  plateauSeverity,
  yieldAnalytics,
  efficacyResult,
  selectedCategory,
  className = '',
}) => {
  const profile = AGRONOMIC_INTERVENTION_REGISTRY[cropId] || AGRONOMIC_INTERVENTION_REGISTRY.tomato;
  const isPostTreatment = treatmentActive && currentScrubDay > interventionDay;

  const manifestationNarrative =
    selectedCategory === 'systemic_curative'
      ? profile.manifestation.haloChlorosisEffect
      : selectedCategory === 'protectant_contact'
        ? profile.manifestation.sporulationSuppressionEffect
        : profile.manifestation.necroticDesiccationEffect;

  const displayGLA = treatmentActive
    ? yieldAnalytics.greenLeafAreaPct
    : Math.max(0, 100 - currentTreatedSeverity);

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
        treatmentActive
          ? 'border-teal-600/40 shadow-teal-900/5'
          : 'border-slate-200 opacity-90'
      } ${className}`}
      role="region"
      aria-label="Agronomic Impact and Pathology Outcome"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Agronomic Impact & Pathology Outcome
          </h3>
        </div>
        <span
          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${
            treatmentActive
              ? isPostTreatment
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-sky-50 text-sky-800 border-sky-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {treatmentActive
            ? isPostTreatment
              ? 'BRANCH: TREATED'
              : 'BRANCH: PRE-TREATMENT'
            : 'BRANCH: UNTREATED COLLAPSE'}
        </span>
      </div>

      {/* Main Metrics 3-Column Display */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {/* Metric 1: Green Leaf Area (GLA) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">
              Green Leaf Area (GLA)
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-teal-700 mt-0.5">
              {displayGLA.toFixed(1)}%
            </div>
          </div>
          <div className="mt-2">
            <div
              className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={displayGLA}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Green Leaf Area Percentage"
            >
              <div
                className="h-full bg-teal-700 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, displayGLA))}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {treatmentActive ? 'Canopy photosynthesis preserved' : 'Progressive foliar chlorosis'}
            </span>
          </div>
        </div>

        {/* Metric 2: Yield Retention */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">
              Yield Retention
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
              {yieldAnalytics.retainedYieldPct.toFixed(1)}%
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[11px] text-slate-600 font-medium block">
              {treatmentActive
                ? `+${yieldAnalytics.salvagedYieldPct.toFixed(0)}% Salvaged`
                : 'Unchecked Disease Damage'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Estimated Loss: {yieldAnalytics.yieldLossPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Metric 3: Economic Net Margin */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-medium block">
              Net Margin Protected
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-teal-700 mt-0.5">
              {treatmentActive ? `$${yieldAnalytics.netEconomicBenefitUSDPerHectare.toFixed(0)}` : '$0'}
              <span className="text-xs font-normal text-slate-500">/ha</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Spray Cost:</span>
              <span className="font-mono">${treatmentActive ? profile.sprayCostPerHectareUSD : 0}/ha</span>
            </div>
            <div className="flex justify-between font-semibold text-teal-700">
              <span>ROI Ratio:</span>
              <span className="font-mono">{treatmentActive ? `${yieldAnalytics.returnOnInvestmentRatio.toFixed(1)}x` : '0x'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Severity Arrest Trajectory Callout */}
      {treatmentActive && (
        <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-teal-900">
            <span>Pathology Arrest Dynamics:</span>
            <span className="font-mono">
              Day {interventionDay.toFixed(1)} @ {interventionSeverity.toFixed(0)}%
            </span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            {manifestationNarrative}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-teal-100">
            <span>Current Treated Severity: <strong className="text-teal-700">{currentTreatedSeverity.toFixed(1)}%</strong></span>
            <span>Terminal Plateau: <strong className="text-slate-700">{plateauSeverity.toFixed(1)}%</strong></span>
            <span>Efficacy Tier: <strong className="text-teal-700">{efficacyResult.windowTier.toUpperCase()}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};
