import React, { useState } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../models/agronomicTimelineModel';
import type {
  FungicideCategory,
  InterventionEfficacyResult,
  TreatedSeverityTrajectoryResult,
  YieldRetentionAnalyticsResult,
} from '../models/treatmentBranchingModel';
import type { ExperimentalCropProgressionData } from '../services/experimentalProgressionService.ts';
import type { ProgressionStage } from '../../types/progression';
import { MicroclimateControlPanel } from './MicroclimateControlPanel';
import { TreatmentBranchingControls } from './TreatmentBranchingControls';
import { TreatmentOutcomeCard } from './TreatmentOutcomeCard';
import { DiagnosticOverlayCardExperimental } from './DiagnosticOverlayCardExperimental';
import { ExportToolbar } from './ExportToolbar';

export type InspectorTab = 'climate' | 'treatment' | 'diagnostics' | 'export';

export interface StudioInspectorRailProps {
  cropId: SupportedCropId;
  cropData: ExperimentalCropProgressionData | null;
  activeStage: ProgressionStage | null;
  effectiveRenderSeverity: number;
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
  cropData,
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

  const microclimate = dynamicOutput.microclimate;

  return (
    <div
      className={`bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col space-y-4 ${className}`}
      role="region"
      aria-label="Studio Parameter Inspector"
    >
      {/* =========================================================================
          1. SEGMENTED TAB SWITCHER (Emil Kowalski Tactile Micro-Interactions)
          ========================================================================= */}
      <div
        role="tablist"
        aria-label="Inspector Panels"
        className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl"
      >
        {/* Tab 1: Climate */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'climate'}
          onClick={() => setActiveTab('climate')}
          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] select-none ${
            activeTab === 'climate'
              ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700/80 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
          }`}
        >
          <span className="text-sm shrink-0">🌦️</span>
          <span className="truncate">Climate</span>
          {microclimate.isStalled ? (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Stalled" />
          ) : (
            <span
              className="text-[9px] font-mono opacity-80 hidden sm:inline"
              title="Speed multiplier"
            >
              {microclimate.compositeFactor.toFixed(1)}×
            </span>
          )}
        </button>

        {/* Tab 2: Treatment */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'treatment'}
          onClick={() => setActiveTab('treatment')}
          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] select-none ${
            activeTab === 'treatment'
              ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700/80 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
          }`}
        >
          <span className="text-sm shrink-0">🛡️</span>
          <span className="truncate">Treatment</span>
          {treatmentActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          )}
        </button>

        {/* Tab 3: Diagnostics */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'diagnostics'}
          onClick={() => setActiveTab('diagnostics')}
          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] select-none ${
            activeTab === 'diagnostics'
              ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700/80 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
          }`}
        >
          <span className="text-sm shrink-0">🔬</span>
          <span className="truncate">Diagnosis</span>
          <span className="text-[9px] font-mono opacity-75 hidden sm:inline">
            Stg {activeStage?.stage_order ?? 0}
          </span>
        </button>

        {/* Tab 4: Export */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'export'}
          onClick={() => setActiveTab('export')}
          className={`px-2 py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] select-none ${
            activeTab === 'export'
              ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700/80 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
          }`}
        >
          <span className="text-sm shrink-0">📤</span>
          <span className="truncate">Export</span>
          {isRecording && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          )}
        </button>
      </div>

      {/* =========================================================================
          2. ACTIVE TAB CONTENT PANELS
          ========================================================================= */}
      <div className="flex-1 transition-all duration-150">
        {/* Tab 1: Weather & Microclimate */}
        {activeTab === 'climate' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <MicroclimateControlPanel
              cropId={cropId}
              temperature={temperature}
              humidity={humidity}
              onTemperatureChange={onTemperatureChange}
              onHumidityChange={onHumidityChange}
              diagnostics={microclimate}
            />
          </div>
        )}

        {/* Tab 2: Treatment & What-If Branching */}
        {activeTab === 'treatment' && (
          <div className="space-y-4 animate-in fade-in duration-150">
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
              currentTreatedSeverity={effectiveRenderSeverity}
              plateauSeverity={treatedOutput.plateauSeverityPct}
              yieldAnalytics={yieldAnalytics}
              efficacyResult={efficacyResult}
              selectedCategory={selectedCategory}
            />
          </div>
        )}

        {/* Tab 3: Clinical Diagnosis & Pathology */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <DiagnosticOverlayCardExperimental
              cropData={cropData}
              activeStage={activeStage}
              sliderPercentage={effectiveRenderSeverity}
            />
          </div>
        )}

        {/* Tab 4: Field Exports & Media */}
        {activeTab === 'export' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <ExportToolbar
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              onStartRecording={onStartRecording}
              onOpenReportModal={onOpenReportModal}
              onSnapImage={onSnapImage}
            />

            {/* Field Export Specs Card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <span>📁 Telemetry & Media Engine</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700/60">
                  Client-side 60 FPS
                </span>
              </div>
              <ul className="text-slate-400 space-y-2 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>
                    <strong className="text-slate-300">WebM Timelapse:</strong> Automatically sweeps from 0% to 100% over 4.0s with continuous canvas frame rendering.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>
                    <strong className="text-slate-300">Printable Advisory PDF:</strong> Generates a full field agronomic diagnostic report with pathogen telemetry, weather profile, and chemical recommendations.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span>
                    <strong className="text-slate-300">Instant PNG Snapshot:</strong> Direct WebGL canvas buffer capture at 800×800 native resolution.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
