import React from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type {
  YieldRetentionAnalyticsResult,
  InterventionEfficacyResult,
  FungicideCategory,
} from '../../models/treatmentBranchingModel.ts';
import { evaluateYieldRetention } from '../../models/treatmentBranchingModel.ts';

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
  spraysSoFar?: number;
  protectionDays?: number;
  keepSpraying?: boolean;
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
  spraysSoFar = 0,
  protectionDays,
  keepSpraying = true,
  className = '',
}) => {
  const isPostTreatment = treatmentActive && currentScrubDay > interventionDay;

  const displayGLA = treatmentActive
    ? yieldAnalytics.greenLeafAreaPct
    : Math.max(0, 100 - currentTreatedSeverity);

  const tooLate = treatmentActive && efficacyResult.windowTier === 'terminal';
  const branchLabel = tooLate
    ? 'Too late to help'
    : treatmentActive
    ? isPostTreatment
      ? 'Treated'
      : 'Before treatment'
    : 'No treatment';
  const branchTone = tooLate
    ? 'bg-red-50 text-red-700 border-red-200'
    : treatmentActive
    ? isPostTreatment
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-ui-accent-soft text-ui-accent-hover border-ui-accent-line'
    : 'bg-ui-warm text-ui-ink-2 border-ui-line';

  return (
    <div className={`space-y-3 ${className}`} role="region" aria-label="Treatment Outcome">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-ui-ink-3">Result</span>
        <span className={`rounded-full border px-3 py-1 text-sm font-medium ${branchTone}`}>{branchLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ui-line bg-ui-warm p-3.5">
          <div className="text-[13px] font-medium text-ui-ink-3">Healthy leaf</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums text-ui-ink">{displayGLA.toFixed(0)}%</div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ui-warm-strong"
            role="progressbar"
            aria-valuenow={displayGLA}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Healthy leaf"
          >
            <div
              className="h-full rounded-full bg-ui-accent transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, displayGLA))}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-ui-line bg-ui-warm p-3.5">
          <div className="text-[13px] font-medium text-ui-ink-3">Harvest kept</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums text-ui-ink">
            {(tooLate ? evaluateYieldRetention(cropId, interventionSeverity, false, selectedCategory).retainedYieldPct : yieldAnalytics.retainedYieldPct).toFixed(0)}%
          </div>
          <div className="mt-2 text-sm tabular-nums text-ui-ink-2">
            {tooLate
              ? 'Nothing saved'
              : treatmentActive
              ? `+${yieldAnalytics.salvagedYieldPct.toFixed(0)}% saved`
              : `${yieldAnalytics.yieldLossPct.toFixed(0)}% lost`}
          </div>
        </div>

        <div className="rounded-xl border border-ui-line bg-ui-warm p-3.5">
          <div className="text-[13px] font-medium text-ui-ink-3">Estimated gain</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums text-ui-ink">
            {treatmentActive && !tooLate
              ? `${yieldAnalytics.netEconomicBenefitUSDPerHectare < 0 ? '−' : ''}$${Math.abs(yieldAnalytics.netEconomicBenefitUSDPerHectare).toFixed(0)}`
              : '—'}
            <span className="text-sm font-normal text-ui-ink-2"> /ha</span>
          </div>
          <div className="mt-2 text-sm tabular-nums text-ui-ink-2">
            {tooLate
              ? 'Too late to pay off'
              : treatmentActive
              ? `Rough example: ${yieldAnalytics.sprayCount} ${yieldAnalytics.sprayCount === 1 ? 'spray' : 'sprays'}, $${yieldAnalytics.sprayCostUSDPerHectare}/ha`
              : 'Turn on a treatment'}
          </div>
        </div>
      </div>

      {tooLate && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          At {interventionSeverity.toFixed(0)}% the leaf damage is already done. Spray earlier to see a difference.
        </p>
      )}

      {treatmentActive && !tooLate && (
        <div className="rounded-xl border border-ui-accent-line bg-ui-accent-soft p-3.5">
          <div className="text-sm text-ui-ink">
            Spray on day <strong className="tabular-nums">{interventionDay.toFixed(0)}</strong> at{' '}
            <strong className="tabular-nums">{interventionSeverity.toFixed(0)}%</strong> progress. Now{' '}
            <strong className="tabular-nums">{currentTreatedSeverity.toFixed(0)}%</strong> after {spraysSoFar}{' '}
            {spraysSoFar === 1 ? 'spray' : 'sprays'}; about <strong className="tabular-nums">{plateauSeverity.toFixed(0)}%</strong> by
            season end{keepSpraying ? ` if you re-spray every ${protectionDays ?? '—'} days` : ' after one spray wears off'}.
          </div>
        </div>
      )}
    </div>
  );
};
