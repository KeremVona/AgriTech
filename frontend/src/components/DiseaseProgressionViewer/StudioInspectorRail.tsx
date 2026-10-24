/**
 * StudioInspectorRail (SPEC-UI-007, Section 4.5).
 * Precision Ag-Intelligence light-mode parameter inspector rail featuring:
 * - 4 tactile segmented tabs: Pathology & Prompts, Microclimate, Treatment Branch, Export & Reports
 * - Full WAI-ARIA arrow key navigation, roving tabindex, and zero overflow leakage
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
  const [activeTab, setActiveTab] = useState<InspectorTab>('prompts');
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: { id: InspectorTab; label: string; icon: string }[] = [
    { id: 'prompts', label: 'Pathology & Prompts', icon: '🧬' },
    { id: 'climate', label: 'Microclimate', icon: '🌡️' },
    { id: 'treatment', label: 'Treatment Branch', icon: '🧪' },
    { id: 'export', label: 'Export & Reports', icon: '📤' },
  ];

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
    <div
      className={`bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col space-y-4 ${className}`}
      role="region"
      aria-label="Studio Parameter Inspector"
    >
      {/* =========================================================================
          1. SEGMENTED TAB SWITCHER (WAI-ARIA Compliant Roving Tabindex)
          ========================================================================= */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80"
        role="tablist"
        aria-label="Inspector Panels"
      >
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabButtonRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-1 ${
                isActive
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          2. ACTIVE TAB PANEL CONTENT
          ========================================================================= */}
      <div className="flex-1 overflow-y-auto">
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
            className="space-y-4 animate-in fade-in duration-150"
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
            className="space-y-4 animate-in fade-in duration-150"
          >
            <ExportToolbar
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              onStartRecording={onStartRecording}
              onOpenReportModal={onOpenReportModal}
              onSnapImage={onSnapImage}
            />

            {/* Quick Export Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>📋</span>
                <span>Export Capabilities Specification</span>
              </span>
              <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                <li>
                  <strong className="text-slate-800">60 FPS WebM/MP4 Sweep:</strong> Sweeps timeline 0% to 100% and captures Canvas 2D/WebGL buffer at 60 frames per second.
                </li>
                <li>
                  <strong className="text-slate-800">Field PDF Advisory:</strong> Complete official extension print report with current foliar state, microclimate diagnostics, and FRAC chemical guidelines.
                </li>
                <li>
                  <strong className="text-slate-800">PNG Viewport Snapshot:</strong> Lossless 800x800 snapshot of active leaf specimen with applied view mode and cross-attention overlays.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
