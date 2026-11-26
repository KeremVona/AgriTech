/**
 * Right-hand rail: a "Right now" summary (stage, day, disease progress) and four tabs —
 * Weather, Treatment, Export, Model — with WAI-ARIA arrow-key navigation and roving tabindex.
 */

import React, { useState, useRef } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../../models/agronomicTimelineModel.ts';
import type {
  FungicideCategory,
  InterventionEfficacyResult,
  TreatedSeverityTrajectoryResult,
  YieldRetentionAnalyticsResult,
} from '../../models/treatmentBranchingModel.ts';
import type { ProgressionStage } from '../../types/progression.ts';
import { PromptAttentionInspector } from './PromptAttentionInspector.tsx';
import { MicroclimateControlPanel } from './MicroclimateControlPanel.tsx';
import { TreatmentBranchingControls } from './TreatmentBranchingControls.tsx';
import { TreatmentOutcomeCard } from './TreatmentOutcomeCard.tsx';
import { ExportToolbar } from './ExportToolbar.tsx';

const STAGE_NAMES = ['Healthy', 'Early', 'Severe'] as const;

export type InspectorTab = 'prompts' | 'climate' | 'treatment' | 'export';

export interface StudioInspectorRailProps {
  cropId: SupportedCropId;
  cropData?: unknown;
  activeStage: ProgressionStage | null;
  effectiveRenderSeverity?: number;
  sliderValue: number;
  currentScrubDay: number;
  // Microclimate props
  temperature: number;
  humidity: number;
  onTemperatureChange: (temp: number) => void;
  onHumidityChange: (humidity: number) => void;
  dynamicOutput: ProgressionDynamicOutput;
  // Treatment props
  treatmentActive: boolean;
  onToggleTreatment: (active: boolean) => void;
  interventionSeverity: number;
  interventionDays: number;
  onSetInterventionSeverity: (sevPct: number) => void;
  onPinCurrentScrub: () => void;
  selectedCategory: FungicideCategory;
  onSelectCategory: (cat: FungicideCategory) => void;
  selectedProductId: string;
  onSelectProductId: (id: string) => void;
  efficacyResult: InterventionEfficacyResult;
  yieldAnalytics: YieldRetentionAnalyticsResult;
  treatedOutput: TreatedSeverityTrajectoryResult;
  // Export props
  isRecording: boolean;
  recordingProgress: number;
  onStartRecording: () => void;
  onOpenReportModal: () => void;
  onSnapImage: () => void;
  className?: string;
}

export const StudioInspectorRail: React.FC<StudioInspectorRailProps> = ({
  cropId,
  activeStage,
  effectiveRenderSeverity,
  sliderValue,
  currentScrubDay,
  temperature,
  humidity,
  onTemperatureChange,
  onHumidityChange,
  dynamicOutput,
  treatmentActive,
  onToggleTreatment,
  interventionSeverity,
  interventionDays,
  onSetInterventionSeverity,
  onPinCurrentScrub,
  selectedCategory,
  onSelectCategory,
  selectedProductId,
  onSelectProductId,
  efficacyResult,
  yieldAnalytics,
  treatedOutput,
  isRecording,
  recordingProgress,
  onStartRecording,
  onOpenReportModal,
  onSnapImage,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('climate');
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'climate', label: 'Weather' },
    { id: 'treatment', label: 'Treatment' },
    { id: 'export', label: 'Export' },
    { id: 'prompts', label: 'Model' },
  ];

  const severity = effectiveRenderSeverity ?? sliderValue;
  const stageOrder = activeStage?.stage_order ?? 0;
  const stageTone = ['bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700', 'bg-red-50 text-red-700'][stageOrder] ?? 'bg-red-50 text-red-700';

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    tabButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={`flex flex-col rounded-2xl border border-ui-line bg-ui-bg ${className}`} role="region" aria-label="Details">
      <section aria-labelledby="now-title" className="p-5">
        <h2 id="now-title" className="text-[13px] font-medium text-ui-ink-3">
          Right now
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium ${stageTone}`}>{STAGE_NAMES[stageOrder] ?? 'Severe'}</span>
            <p className="mt-1 text-xs text-ui-ink-3">stage</p>
          </div>
          <div>
            <p className="text-2xl font-medium tabular-nums leading-none text-ui-ink">{dynamicOutput.microclimate.isStalled ? '—' : currentScrubDay.toFixed(0)}</p>
            <p className="mt-1.5 text-xs text-ui-ink-3">{dynamicOutput.microclimate.isStalled ? 'no change in this weather' : 'days in'}</p>
          </div>
          <div>
            <p className="text-2xl font-medium tabular-nums leading-none text-ui-ink">{severity.toFixed(0)}%</p>
            <p className="mt-1.5 text-xs text-ui-ink-3">disease progress</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ui-warm-strong" aria-hidden="true">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600" style={{ width: `${Math.max(2, severity)}%` }} />
        </div>
      </section>

      <div className="flex gap-1 border-y border-ui-line px-3" role="tablist" aria-label="Detail panels">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={isActive ? `panel-${tab.id}` : undefined}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`-mb-px min-h-11 cursor-pointer border-b-2 px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-accent ${
                isActive ? 'border-ui-ink font-medium text-ui-ink' : 'border-transparent text-ui-ink-2 hover:text-ui-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          2. ACTIVE TAB PANEL CONTENT
          ========================================================================= */}
      <div className="flex-1 p-5">
        {/* TAB 1: Pathology & Prompts */}
        {activeTab === 'prompts' && (
          <div
            id="panel-prompts"
            role="tabpanel"
            aria-labelledby="tab-prompts"
            className="animate-in fade-in duration-150"
          >
            <PromptAttentionInspector
              cropId={cropId}
              activeStage={activeStage}
              sliderValue={sliderValue}
            />
          </div>
        )}

        {/* TAB 2: Microclimate */}
        {activeTab === 'climate' && (
          <div
            id="panel-climate"
            role="tabpanel"
            aria-labelledby="tab-climate"
            className="animate-in fade-in duration-150"
          >
            <MicroclimateControlPanel
              cropId={cropId}
              temperature={temperature}
              humidity={humidity}
              onTemperatureChange={onTemperatureChange}
              onHumidityChange={onHumidityChange}
              diagnostics={dynamicOutput.microclimate}
            />
          </div>
        )}

        {/* TAB 3: Treatment Branch */}
        {activeTab === 'treatment' && (
          <div
            id="panel-treatment"
            role="tabpanel"
            aria-labelledby="tab-treatment"
            className="space-y-4"
          >
            <TreatmentBranchingControls
              cropId={cropId}
              treatmentActive={treatmentActive}
              onToggleTreatment={onToggleTreatment}
              interventionSeverity={interventionSeverity}
              interventionDay={interventionDays}
              currentScrubDay={currentScrubDay}
              currentScrubSeverity={sliderValue}
              onSetInterventionSeverity={onSetInterventionSeverity}
              onPinCurrentScrub={onPinCurrentScrub}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              selectedProductId={selectedProductId}
              onSelectProduct={onSelectProductId}
              efficacyResult={efficacyResult}
            />

            <TreatmentOutcomeCard
              cropId={cropId}
              treatmentActive={treatmentActive}
              interventionSeverity={interventionSeverity}
              interventionDay={interventionDays}
              currentScrubDay={currentScrubDay}
              currentTreatedSeverity={treatedOutput.currentSeverityPct}
              plateauSeverity={treatedOutput.plateauSeverityPct}
              yieldAnalytics={yieldAnalytics}
              efficacyResult={efficacyResult}
              selectedCategory={selectedCategory}
            />
          </div>
        )}

        {/* TAB 4: Export & Reports */}
        {activeTab === 'export' && (
          <div
            id="panel-export"
            role="tabpanel"
            aria-labelledby="tab-export"
            className="space-y-4"
          >
            <ExportToolbar
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              onStartRecording={onStartRecording}
              onOpenReportModal={onOpenReportModal}
              onSnapImage={onSnapImage}
            />

          </div>
        )}
      </div>
    </div>
  );
};
