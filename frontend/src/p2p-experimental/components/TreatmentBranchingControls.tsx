import React from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import type {
  FungicideCategory,
  ChemicalProductSpec,
  InterventionEfficacyResult,
} from '../models/treatmentBranchingModel';
import { getTreatmentProducts } from '../models/treatmentBranchingModel';

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
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  efficacyResult: InterventionEfficacyResult;
  className?: string;
}

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
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'mid':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'late':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      className={`bg-slate-900/90 border rounded-2xl p-5 shadow-xl transition-all duration-200 ${
        treatmentActive
          ? 'border-emerald-500/40 shadow-emerald-950/20'
          : 'border-slate-800 hover:border-slate-700'
      } ${className}`}
    >
      {/* Header and Master Toggle */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${
              treatmentActive
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            🧪
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Pathology Treatment Branching
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                TIER 1 • WHAT-IF
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate systemic fungicide kickback, lesion cicatrization & canopy salvage
            </p>
          </div>
        </div>

        {/* Master Toggle Button */}
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={treatmentActive}
            onChange={(e) => onToggleTreatment(e.target.checked)}
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-150 after:ease-out peer-checked:bg-emerald-500"></div>
          <span className="ml-2.5 text-xs font-semibold text-slate-300 hidden sm:inline">
            {treatmentActive ? 'Treatment Active' : 'Untreated Only'}
          </span>
        </label>
      </div>

      {treatmentActive && (
        <div className="mt-4 space-y-4">
          {/* Timeline Status Callout */}
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              isPostTreatment
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                : 'bg-sky-950/40 border-sky-700/50 text-sky-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{isPostTreatment ? '🛡️' : '⏱️'}</span>
              <span>
                {isPostTreatment ? (
                  <>
                    <strong className="font-semibold text-emerald-200">
                      Curative Branch Engaged:
                    </strong>{' '}
                    Lesions arrested at Day <span className="font-mono tabular-nums">{interventionDay.toFixed(1)}</span> (<span className="font-mono tabular-nums">{interventionSeverity.toFixed(1)}%</span>).
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-sky-200">
                      Pre-Treatment Phase:
                    </strong>{' '}
                    Current scrubber (Day <span className="font-mono tabular-nums">{currentScrubDay.toFixed(1)}</span>) is before spray checkpoint (Day{' '}
                    <span className="font-mono tabular-nums">{interventionDay.toFixed(1)}</span>).
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={onPinCurrentScrub}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer flex items-center gap-1 shrink-0"
              title="Set intervention timing to current scrubber position"
            >
              <span>🎯</span> Pin to Day <span className="font-mono tabular-nums">{currentScrubDay.toFixed(1)}</span>
            </button>
          </div>

          {/* Quick Intervention Timing Presets */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium text-slate-300">Intervention Timing Presets:</span>
              <span className="font-mono tabular-nums text-emerald-400">
                Trigger: {interventionSeverity.toFixed(1)}% (Day {interventionDay.toFixed(1)})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onSetInterventionSeverity(15.0)}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                  Math.abs(interventionSeverity - 15.0) < 1.0
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>🌱</span> Prophylactic
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">15% • First Sign</div>
              </button>

              <button
                type="button"
                onClick={() => onSetInterventionSeverity(35.0)}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                  Math.abs(interventionSeverity - 35.0) < 1.0
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>⚠️</span> Action Threshold
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">35% • Economic Limit</div>
              </button>

              <button
                type="button"
                onClick={() => onSetInterventionSeverity(60.0)}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                  Math.abs(interventionSeverity - 60.0) < 1.0
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>🚨</span> Late Rescue
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">60% • Canopy Collapse</div>
              </button>
            </div>
          </div>

          {/* Fungicide Modality Selector Tabs */}
          <div>
            <span className="text-xs font-medium text-slate-300 mb-1.5 block">
              Intervention Modality & Chemistry:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onSelectCategory('systemic_curative')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] text-center ${
                  selectedCategory === 'systemic_curative'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md font-semibold'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs">Systemic Curative</div>
                <div className="text-[10px] opacity-80 mt-0.5">48–72h Kickback</div>
              </button>

              <button
                type="button"
                onClick={() => onSelectCategory('protectant_contact')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] text-center ${
                  selectedCategory === 'protectant_contact'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md font-semibold'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs">Protectant Contact</div>
                <div className="text-[10px] opacity-80 mt-0.5">Multi-Site Shield</div>
              </button>

              <button
                type="button"
                onClick={() => onSelectCategory('bio_fungicide')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] text-center ${
                  selectedCategory === 'bio_fungicide'
                    ? 'bg-violet-600 text-white border-violet-500 shadow-md font-semibold'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs">Bio-Fungicide</div>
                <div className="text-[10px] opacity-80 mt-0.5">Organic Certified</div>
              </button>
            </div>
          </div>

          {/* Active Product Spec Detail & Selector */}
          {products.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {products.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => onSelectProduct(prod.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                    (selectedProductId === prod.id || (!selectedProductId && prod.id === activeProduct?.id))
                      ? 'bg-slate-700 text-white border-slate-500 font-semibold shadow-xs'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {prod.tradeName.split('(')[0].trim()}
                </button>
              ))}
            </div>
          )}

          {activeProduct && (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {activeProduct.tradeName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-slate-800 text-amber-300 border border-slate-700">
                      {activeProduct.fracCode}
                    </span>
                    {activeProduct.isOrganicCertified && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        OMRI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 italic">
                    Active: {activeProduct.activeIngredient}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block">Rainfast:</span>
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    {activeProduct.rainfastnessHours}h
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeProduct.modeOfAction}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span>
                  PHI: <strong className="text-slate-200">{activeProduct.preHarvestIntervalDays} days</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Resistance Risk:
                  <span
                    className={`font-semibold font-mono ${
                      activeProduct.resistanceRisk === 'HIGH'
                        ? 'text-rose-400'
                        : activeProduct.resistanceRisk === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeProduct.resistanceRisk}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Efficacy Window Badge and Clinical Assessment */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-medium">Curative Efficacy Rating:</span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getWindowBadgeStyle(
                  efficacyResult.windowTier
                )}`}
              >
                <span className="font-mono tabular-nums">{efficacyResult.efficacyPct}%</span> Curative Knockdown
              </span>
            </div>
            <p className="text-[11px] text-slate-400 italic bg-slate-950/40 rounded-lg p-2.5 border border-slate-800/60 leading-relaxed">
              {efficacyResult.agronomicAssessment}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
