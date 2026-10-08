import React from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import type {
  YieldRetentionAnalyticsResult,
  InterventionEfficacyResult,
  FungicideCategory,
} from '../models/treatmentBranchingModel';
import { AGRONOMIC_INTERVENTION_REGISTRY } from '../models/treatmentBranchingModel';

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
  const profile = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  if (!profile) return null;

  const manifestation = profile.manifestation;
  const isPostTreatment = treatmentActive && currentScrubDay > interventionDay;

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all ${
        treatmentActive
          ? 'border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20'
          : 'border-slate-800 opacity-90'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Agronomic Impact & Pathology Outcome
          </h3>
        </div>
        <span
          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${
            treatmentActive
              ? isPostTreatment
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
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
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Green Leaf Area (GLA)
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {treatmentActive ? `${yieldAnalytics.greenLeafAreaPct.toFixed(1)}%` : '0.0%'}
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: `${treatmentActive ? yieldAnalytics.greenLeafAreaPct : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {treatmentActive ? 'Photosynthetic canopy preserved' : 'Total foliar necrosis'}
            </span>
          </div>
        </div>

        {/* Metric 2: Yield Retention / Salvaged */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Yield Salvaged vs. Untreated
            </span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
              {treatmentActive ? `+${yieldAnalytics.salvagedYieldPct.toFixed(1)}%` : '+0.0%'}
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] text-slate-400 font-medium block">
              Harvest Retention:{' '}
              <strong className="text-slate-200">
                {yieldAnalytics.retainedYieldPct.toFixed(1)}%
              </strong>
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {treatmentActive
                ? `Protected ${yieldAnalytics.salvagedYieldPct.toFixed(1)}% crop from loss`
                : 'Unmitigated pathogen destruction'}
            </span>
          </div>
        </div>

        {/* Metric 3: Economic Financial Benefit */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">
              Net Economic Benefit
            </span>
            <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">
              {treatmentActive
                ? `+$${yieldAnalytics.netEconomicBenefitUSDPerHectare.toLocaleString()}`
                : '$0/ha'}
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[10px] text-slate-400 font-medium block">
              Return on Spray (ROI):{' '}
              <strong className="text-emerald-400">
                {treatmentActive ? `${yieldAnalytics.returnOnInvestmentRatio.toFixed(1)}×` : '0×'}
              </strong>
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Valued at ${profile.marketValuePerHectareUSD.toLocaleString()}/ha harvest
            </span>
          </div>
        </div>
      </div>

      {/* Biological Cicatrization & Cellular Pathology Details */}
      {treatmentActive ? (
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <span>🔬</span>
            <span>Biological Manifestation & Cicatrization Response</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
              <span className="text-amber-400 font-bold block mb-0.5">
                • Halo & Chlorosis Arrest:
              </span>
              <p className="text-slate-300 leading-relaxed">
                {manifestation.haloChlorosisEffect}
              </p>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
              <span className="text-emerald-400 font-bold block mb-0.5">
                • Necrotic Desiccation & Scar:
              </span>
              <p className="text-slate-300 leading-relaxed">
                {manifestation.necroticDesiccationEffect}
              </p>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
              <span className="text-blue-400 font-bold block mb-0.5">
                • Sporulation Suppression:
              </span>
              <p className="text-slate-300 leading-relaxed">
                {manifestation.sporulationSuppressionEffect}
              </p>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
              <span className="text-purple-400 font-bold block mb-0.5">
                • Lesion Margin Suberization:
              </span>
              <p className="text-slate-300 leading-relaxed">
                {manifestation.marginMorphology}
              </p>
            </div>
          </div>

          {/* Comparative Summary Footer */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <div>
              Sprayed at <strong className="text-amber-300 font-mono">{interventionSeverity.toFixed(1)}%</strong> • Active state:{' '}
              <strong className="text-emerald-300 font-mono">{currentTreatedSeverity.toFixed(1)}%</strong> • Plateau capped at{' '}
              <strong className="text-emerald-300 font-mono">
                {plateauSeverity.toFixed(1)}%
              </strong>{' '}
              (vs <span className="text-rose-400 line-through">100% defoliation</span>)
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              <span className="capitalize text-slate-400 mr-2">{selectedCategory.replace('_', ' ')}</span>
              Curative efficacy: {efficacyResult.efficacyPct}% • Cost: ${profile.sprayCostPerHectareUSD}/ha
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 text-center">
          <p className="text-xs text-slate-400">
            Pathogen progression is unchecked. Enable <strong className="text-emerald-400">Treatment Branching</strong> to simulate fungicide intervention, lesion cicatrization, and crop yield salvage.
          </p>
        </div>
      )}
    </div>
  );
};
