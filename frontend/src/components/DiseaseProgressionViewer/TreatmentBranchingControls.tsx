/**
 * TreatmentBranchingControls (SPEC-UI-007, Section 4.8).
 * Precision Ag-Intelligence light-mode fungicide & bio-control intervention simulator.
 */

import React from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type {
  FungicideCategory,
  ChemicalProductSpec,
  InterventionEfficacyResult,
} from '../../models/treatmentBranchingModel.ts';
import { getTreatmentProducts } from '../../models/treatmentBranchingModel.ts';

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

const CATEGORY_LABELS: Record<FungicideCategory, { label: string; icon: string }> = {
  systemic_curative: { label: 'Systemic Curative', icon: '💉' },
  protectant_contact: { label: 'Contact Protectant', icon: '🛡️' },
  bio_fungicide: { label: 'Bio-Fungicide', icon: '🌱' },
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
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'mid':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'late':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-xs transition-all duration-150 ${
        treatmentActive
          ? 'border-teal-600/40 shadow-teal-900/5'
          : 'border-slate-200 hover:border-slate-300'
      } ${className}`}
      role="region"
      aria-label="Pathology Treatment Branching Controls"
    >
      {/* Header and Master Toggle */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${
              treatmentActive
                ? 'bg-teal-50 border border-teal-200 text-teal-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            🧪
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Pathology Treatment Branching
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                WHAT-IF SIMULATION
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate systemic fungicide kickback, lesion arrest & canopy salvage
            </p>
          </div>
        </div>

        {/* Master Toggle Button */}
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={treatmentActive}
            onChange={(e) => onToggleTreatment(e.target.checked)}
            className="sr-only peer"
            aria-label="Enable Treatment Branching"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-700"></div>
          <span className="ml-2.5 text-xs font-semibold text-slate-700 hidden sm:inline">
            {treatmentActive ? 'Active' : 'Bypassed'}
          </span>
        </label>
      </div>

      {treatmentActive && (
        <div className="space-y-4 pt-4 animate-in fade-in duration-200">
          {/* Category Tabs: Curative vs Protectant vs Bio-control */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-2">
              Fungicide Modality
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['systemic_curative', 'protectant_contact', 'bio_fungicide'] as FungicideCategory[]).map((cat) => {
                const isSelected = selectedCategory === cat;
                const meta = CATEGORY_LABELS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat);
                      const catProducts = getTreatmentProducts(cropId, cat);
                      if (catProducts[0]) onSelectProduct(catProducts[0].id);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Portfolio Selection Cards */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-2">
              Registered Formulations ({products.length})
            </label>
            <div className="grid grid-cols-1 gap-2">
              {products.map((p) => {
                const isSelected = activeProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProduct(p.id)}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600 text-teal-950 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{p.tradeName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                        {p.fracCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.activeIngredient}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {p.modeOfAction}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-mono mt-2 pt-1.5 border-t border-slate-100">
                      <span>Kickback: <strong className="text-slate-800">{p.curativeKickbackHours}h</strong></span>
                      <span>Rainfast: <strong className="text-slate-800">{p.rainfastnessHours}h</strong></span>
                      <span>PHI: <strong className="text-slate-800">{p.preHarvestIntervalDays}d</strong></span>
                      <span className={`px-1.5 py-0.2 rounded font-semibold ${
                        p.resistanceRisk === 'HIGH' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        Risk: {p.resistanceRisk}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intervention Timing & Severity Slider */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span>Intervention Point (Day of Application)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Simulate early rescue vs. delayed spray timing
                </p>
              </div>

              <button
                type="button"
                onClick={onPinCurrentScrub}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-colors cursor-pointer shadow-2xs active:scale-95"
                title="Pin intervention day to current scrubber position"
              >
                Pin Current (Day {currentScrubDay.toFixed(1)})
              </button>
            </div>

            <input
              type="range"
              min={1}
              max={95}
              step={1}
              value={interventionSeverity}
              onChange={(e) => onSetInterventionSeverity(parseFloat(e.target.value))}
              className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2 cursor-pointer"
              aria-label="Intervention Severity Percentage"
            />

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">
                Applied at <strong className="text-slate-800">{interventionSeverity.toFixed(0)}%</strong> severity
              </span>
              <span className="text-teal-700 font-bold">
                Day {interventionDay.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Dynamic Efficacy & Window Tier Feedback */}
          <div className="p-3.5 rounded-xl border bg-slate-50/70 border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${getWindowBadgeStyle(efficacyResult.windowTier)}`}>
                {efficacyResult.windowTier.toUpperCase()} WINDOW
              </span>
              <span className="text-slate-600 font-medium">
                Effective Systemic Efficacy: <strong className="text-teal-700 font-mono">{efficacyResult.efficacyPct ?? Math.round((efficacyResult.efficacy || 0) * 100)}%</strong>
              </span>
            </div>

            {isPostTreatment && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                ✓ Viewing Treated Branch
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
