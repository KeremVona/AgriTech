import React from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type {
  FungicideCategory,
  ChemicalProductSpec,
  InterventionEfficacyResult,
} from '../../models/treatmentBranchingModel.ts';
import { getTreatmentProducts } from '../../models/treatmentBranchingModel.ts';
import { BUTTON } from '../Diagnostics/styles.ts';

export interface TreatmentBranchingControlsProps {
  cropId: SupportedCropId;
  treatmentActive: boolean;
  onToggleTreatment: (active: boolean) => void;
  interventionSeverity: number;
  interventionDay: number;
  currentScrubDay: number;
  currentScrubSeverity: number;
  onSetInterventionSeverity: (sevPct: number) => void;
  onPinCurrentScrub: () => void;
  selectedCategory: FungicideCategory;
  onSelectCategory: (cat: FungicideCategory) => void;
  keepSpraying: boolean;
  onToggleKeepSpraying: (keep: boolean) => void;
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  efficacyResult: InterventionEfficacyResult;
  className?: string;
}

const CATEGORY_LABELS: Record<FungicideCategory, { label: string }> = {
  systemic_curative: { label: 'Cures' },
  protectant_contact: { label: 'Protects' },
  bio_fungicide: { label: 'Biological' },
};

export const TreatmentBranchingControls: React.FC<TreatmentBranchingControlsProps> = ({
  cropId,
  treatmentActive,
  onToggleTreatment,
  interventionSeverity,
  interventionDay,
  currentScrubDay,
  onSetInterventionSeverity,
  onPinCurrentScrub,
  selectedCategory,
  onSelectCategory,
  keepSpraying,
  onToggleKeepSpraying,
  selectedProductId,
  onSelectProduct,
  efficacyResult,
  className = '',
}) => {
  const products = getTreatmentProducts(cropId, selectedCategory);
  const activeProduct: ChemicalProductSpec | undefined =
    products.find((p) => p.id === selectedProductId) || products[0];

  const isPostTreatment = treatmentActive && currentScrubDay > interventionDay;

  const getWindowBadgeStyle = (tier: string) => {
    switch (tier) {
      case 'early':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'mid':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'late':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-ui-warm text-ui-ink-2 border-ui-line';
    }
  };

  const WINDOW_WORDS: Record<string, string> = { early: 'Good timing', mid: 'Okay timing', late: 'Late' };
  const windowWord = WINDOW_WORDS[efficacyResult.windowTier] ?? efficacyResult.windowTier;
  const efficacyPct = efficacyResult.efficacyPct ?? Math.round((efficacyResult.efficacy || 0) * 100);

  const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent';

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Treatment Controls">
      {/* Master toggle */}
      <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-4 rounded-xl border border-ui-line bg-ui-warm px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-ui-ink">Try a treatment</span>
          <span className="block text-sm text-ui-ink-2">See the leaf if you spray.</span>
        </span>
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            checked={treatmentActive}
            onChange={(e) => onToggleTreatment(e.target.checked)}
            className="peer sr-only"
            aria-label="Try a treatment"
          />
          <span className="h-7 w-12 rounded-full bg-ui-warm-strong transition-colors peer-checked:bg-ui-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ui-accent after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:after:translate-x-5" />
        </span>
      </label>

      {treatmentActive && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Category */}
          <div>
            <div className="mb-2 text-[13px] font-medium text-ui-ink-3">Type</div>
            <div className="grid grid-cols-3 gap-2">
              {(['systemic_curative', 'protectant_contact', 'bio_fungicide'] as FungicideCategory[]).map((cat) => {
                const isSelected = selectedCategory === cat;
                const unavailable = getTreatmentProducts(cropId, cat).length === 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={unavailable}
                    title={unavailable ? 'No spray of this type works on this disease' : undefined}
                    onClick={() => {
                      onSelectCategory(cat);
                      const catProducts = getTreatmentProducts(cropId, cat);
                      if (catProducts[0]) onSelectProduct(catProducts[0].id);
                    }}
                    className={`${isSelected ? BUTTON.dark : BUTTON.outline} px-3 ${focus}`}
                  >
                    {CATEGORY_LABELS[cat].label}
                  </button>
                );
              })}
            </div>
            {getTreatmentProducts(cropId, 'systemic_curative').length === 0 && (
              <p className="mt-2 text-xs text-ui-ink-3">No spray cures bacterial spot; copper and biologicals only protect healthy leaves.</p>
            )}
          </div>

          {/* Products */}
          <div>
            <div className="mb-2 text-[13px] font-medium text-ui-ink-3">Product</div>
            <div className="grid grid-cols-1 gap-2">
              {products.map((p) => {
                const isSelected = activeProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectProduct(p.id)}
                    className={`min-h-11 cursor-pointer rounded-xl border p-3 text-left transition-colors duration-150 ${focus} ${
                      isSelected
                        ? 'border-ui-accent-line bg-ui-accent-soft'
                        : 'border-ui-line bg-ui-bg hover:bg-ui-warm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ui-ink">{p.tradeName}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.resistanceRisk === 'HIGH' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {p.resistanceRisk === 'HIGH' ? 'Resistance risk' : 'Low resistance risk'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-ui-ink-2">{p.activeIngredient}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-ui-ink-2">
                      <span>Protects about <strong className="text-ui-ink">{p.protectionDays} days</strong></span>
                      <span>Rain-safe after <strong className="text-ui-ink">{p.rainfastnessHours}h</strong></span>
                      <span>Harvest wait <strong className="text-ui-ink">{p.preHarvestIntervalDays}d</strong></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-ui-ink-3">Example products. Names, intervals and approvals differ by country — always follow the local label.</p>

          {/* Re-spray */}
          <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-4 rounded-xl border border-ui-line px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-ui-ink">Keep spraying</span>
              <span className="block text-xs text-ui-ink-3">
                {keepSpraying
                  ? `Re-spray every ${activeProduct?.protectionDays ?? '—'} days, when protection runs out`
                  : 'One spray only — protection wears off'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={keepSpraying}
              onChange={(e) => onToggleKeepSpraying(e.target.checked)}
              className="h-5 w-5 cursor-pointer accent-[var(--color-ui-accent)]"
            />
          </label>

          {/* Timing */}
          <div className="space-y-3 rounded-xl border border-ui-line bg-ui-warm p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-ui-ink-3">Spray on</div>
                <div className="text-2xl font-semibold tabular-nums text-ui-ink">Day {interventionDay.toFixed(0)}</div>
              </div>
              <button
                type="button"
                onClick={onPinCurrentScrub}
                className={`${BUTTON.outline} px-4 ${focus}`}
                title="Pin intervention day to current scrubber position"
              >
                Use day {currentScrubDay.toFixed(0)}
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={95}
              step={1}
              value={interventionSeverity}
              onChange={(e) => onSetInterventionSeverity(parseFloat(e.target.value))}
              className="h-6 w-full cursor-pointer accent-[var(--color-ui-accent)] focus-visible:outline-2 focus-visible:outline-ui-accent"
              aria-label="Spray when this much of the leaf is affected"
              aria-valuemin={1}
              aria-valuemax={95}
              aria-valuenow={interventionSeverity}
              aria-valuetext={`Intervention set at ${interventionSeverity.toFixed(0)} percent on Day ${interventionDay.toFixed(0)}`}
            />
            <div className="text-sm text-ui-ink-2">
              When <strong className="tabular-nums text-ui-ink">{interventionSeverity.toFixed(0)}%</strong> of the leaf is affected
            </div>
          </div>

          {/* Efficacy */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-line p-3.5">
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${getWindowBadgeStyle(efficacyResult.windowTier)}`}>
                {windowWord}
              </span>
              <span className="text-sm text-ui-ink-2">
                Works on <strong className="text-lg font-semibold tabular-nums text-ui-ink">{efficacyPct}%</strong>
              </span>
            </div>
            {isPostTreatment && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                Showing treated leaf
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
