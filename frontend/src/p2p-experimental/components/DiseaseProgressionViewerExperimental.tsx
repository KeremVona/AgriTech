import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../models/agronomicTimelineModel';
import { calculateElapsedDays, AGRONOMIC_CALIBRATION_REGISTRY } from '../models/agronomicTimelineModel';
import type {
  FungicideCategory,
  InterventionEfficacyResult,
  TreatedSeverityTrajectoryResult,
  YieldRetentionAnalyticsResult,
} from '../models/treatmentBranchingModel';
import {
  calculateInterventionEfficacy,
  calculateTreatedSeverity,
  evaluateYieldRetention,
  getTreatmentProducts,
} from '../models/treatmentBranchingModel';
import type { AgronomicFieldReportData } from '../models/exportReportModel';
import { assembleFieldReportData, generateExportFilename } from '../models/exportReportModel';
import {
  recordProgressionTimelapse,
  captureAndDownloadCanvasSnapshot,
  triggerFileDownload,
} from '../utils/timelapseRecorder';
import { useExperimentalProgressionData } from '../hooks/useExperimentalProgressionData.ts';
import { ProgressionShaderRenderer } from '../../components/DiseaseProgressionViewer/ProgressionShaderRenderer';
import { CompareHealthyToggle } from '../../components/DiseaseProgressionViewer/CompareHealthyToggle';
import { AgronomicTimelineSlider } from './AgronomicTimelineSlider';
import { LeafHotspotOverlay } from './LeafHotspotOverlay';
import { StudioInspectorRail } from './StudioInspectorRail';
import { DiagnosticPdfReportModal } from './DiagnosticPdfReportModal';

export type TrajectoryViewMode = 'treated' | 'untreated' | 'split';

export interface DiseaseProgressionViewerExperimentalProps {
  cropId?: SupportedCropId;
  initialPercentage?: number;
  onPercentageChange?: (percentage: number) => void;
  className?: string;
  showControls?: boolean;
}

export const DiseaseProgressionViewerExperimental: React.FC<DiseaseProgressionViewerExperimentalProps> = ({
  cropId = 'tomato',
  initialPercentage = 0,
  onPercentageChange,
  className = '',
  showControls = true,
}) => {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];

  // Microclimate state (initialized to crop-specific favorable norms)
  const [temperature, setTemperature] = useState<number>(profile.cardinals.opt);
  const [humidity, setHumidity] = useState<number>(profile.humidity.crit);
  const [prevCropId, setPrevCropId] = useState<SupportedCropId>(cropId);

  // Treatment branching state (Tier 1, Feature 3)
  const [treatmentActive, setTreatmentActive] = useState<boolean>(false);
  const [interventionSeverity, setInterventionSeverity] = useState<number>(25.0);
  const [selectedCategory, setSelectedCategory] = useState<FungicideCategory>('systemic_curative');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [trajectoryView, setTrajectoryView] = useState<TrajectoryViewMode>('treated');

  // Export and Media state (Tier 1, Feature 4)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [assembledReport, setAssembledReport] = useState<AgronomicFieldReportData | null>(null);

  // Derive active product id based on crop and category during render
  const availableProducts = useMemo(
    () => getTreatmentProducts(cropId, selectedCategory),
    [cropId, selectedCategory]
  );
  const effectiveProductId =
    selectedProductId && availableProducts.some((p) => p.id === selectedProductId)
      ? selectedProductId
      : availableProducts[0]?.id || '';

  // Synchronize default temperature when crop changes (React recommended pattern)
  if (prevCropId !== cropId) {
    setPrevCropId(cropId);
    setTemperature(profile.cardinals.opt);
    setHumidity(profile.humidity.crit);
  }

  const [sliderValue, setSliderValue] = useState<number>(initialPercentage);
  const [prevInitial, setPrevInitial] = useState<number>(initialPercentage);
  const [loadedCropId, setLoadedCropId] = useState<SupportedCropId | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [hotspotsEnabled, setHotspotsEnabled] = useState<boolean>(true);

  // Synchronize state when initial percentage prop changes externally
  if (prevInitial !== initialPercentage) {
    setPrevInitial(initialPercentage);
    setSliderValue(initialPercentage);
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ProgressionShaderRenderer | null>(null);

  const { cropData, activeStage, loading: dataLoading, error } = useExperimentalProgressionData(cropId, sliderValue);

  const stage0Url = cropData?.stages.find((s) => s.stage_order === 0)?.assets.base_image_url;
  const stage1Url = cropData?.stages.find((s) => s.stage_order === 1)?.assets.base_image_url;
  const stage2Url = cropData?.stages.find((s) => s.stage_order === 2)?.assets.base_image_url;
  const mask1Url = cropData?.stages.find((s) => s.stage_order === 1)?.assets.mask_image_url;
  const mask2Url = cropData?.stages.find((s) => s.stage_order === 2)?.assets.mask_image_url;

  // Real-time dynamic agronomic computation for elapsed days
  const dynamicOutput: ProgressionDynamicOutput = useMemo(() => {
    return calculateElapsedDays(cropId, sliderValue, temperature, humidity);
  }, [cropId, sliderValue, temperature, humidity]);

  // Compute intervention elapsed day checkpoint under current microclimate
  const interventionDays = useMemo(() => {
    return calculateElapsedDays(cropId, interventionSeverity, temperature, humidity).elapsedDays;
  }, [cropId, interventionSeverity, temperature, humidity]);

  const currentScrubDay = dynamicOutput.elapsedDays;
  const isPostTreatment = treatmentActive && currentScrubDay > interventionDays;
  const daysPostIntervention = Math.max(0, currentScrubDay - interventionDays);

  // Treatment trajectory and efficacy evaluation
  const treatedOutput: TreatedSeverityTrajectoryResult = useMemo(() => {
    return calculateTreatedSeverity(cropId, interventionSeverity, daysPostIntervention, selectedCategory);
  }, [cropId, interventionSeverity, daysPostIntervention, selectedCategory]);

  const efficacyResult: InterventionEfficacyResult = useMemo(() => {
    return calculateInterventionEfficacy(cropId, interventionSeverity, selectedCategory);
  }, [cropId, interventionSeverity, selectedCategory]);

  const yieldAnalytics: YieldRetentionAnalyticsResult = useMemo(() => {
    return evaluateYieldRetention(cropId, interventionSeverity, treatmentActive, selectedCategory);
  }, [cropId, interventionSeverity, treatmentActive, selectedCategory]);

  // Compute effective rendered severity on canvas based on active trajectory view mode
  const effectiveRenderSeverity = useMemo(() => {
    if (!treatmentActive) return sliderValue;
    if (trajectoryView === 'untreated') return sliderValue;

    // In treated mode or split mode right-panel:
    if (currentScrubDay <= interventionDays) {
      return sliderValue;
    }
    return treatedOutput.currentSeverityPct;
  }, [treatmentActive, trajectoryView, sliderValue, currentScrubDay, interventionDays, treatedOutput.currentSeverityPct]);

  // Ref tracking current effective severity for initial texture load render
  const effectiveSeverityRef = useRef<number>(effectiveRenderSeverity);
  useEffect(() => {
    effectiveSeverityRef.current = effectiveRenderSeverity;
  }, [effectiveRenderSeverity]);

  // Initialize WebGL renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new ProgressionShaderRenderer(canvasRef.current);
    rendererRef.current = renderer;
    setIsFallbackMode(!renderer.isAvailable());

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Load textures when cropData changes
  useEffect(() => {
    if (!cropData || !rendererRef.current) return;
    if (!stage0Url || !stage1Url || !stage2Url) return;

    let isMounted = true;

    rendererRef.current
      .loadTextures({
        stage0: stage0Url,
        stage1: stage1Url,
        stage2: stage2Url,
        mask1: mask1Url,
        mask2: mask2Url,
      })
      .then(() => {
        if (isMounted) {
          setLoadedCropId(cropId);
          setIsFallbackMode(!rendererRef.current?.isAvailable());
          rendererRef.current?.render(effectiveSeverityRef.current / 100.0);
        }
      })
      .catch((err) => {
        console.error('[ExperimentalViewer] Failed to load progression textures:', err);
        if (isMounted) {
          setIsFallbackMode(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cropData, cropId, stage0Url, stage1Url, stage2Url, mask1Url, mask2Url]);

  const rendererLoaded = loadedCropId === cropId;
  const isContentReady = rendererLoaded || (isFallbackMode && !!stage0Url);

  // Keep canvas synchronized with effectiveRenderSeverity
  useEffect(() => {
    if (rendererLoaded && rendererRef.current && !isFallbackMode) {
      rendererRef.current.render(effectiveRenderSeverity / 100.0);
    }
  }, [effectiveRenderSeverity, rendererLoaded, isFallbackMode]);

  // Handle Resize & DPR compensation with ResizeObserver
  const isDualView = compareMode || (treatmentActive && trajectoryView === 'split');

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !rendererRef.current) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const size = Math.min(width, height > 0 ? height : width);
        if (size > 0 && rendererRef.current) {
          rendererRef.current.resize(size, size, window.devicePixelRatio || 1);
        }
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rendererLoaded, isDualView]);

  // Handle slider scrub
  const handleSliderChange = useCallback(
    (val: number) => {
      setSliderValue(val);
      onPercentageChange?.(val);
    },
    [onPercentageChange]
  );

  // Pin intervention checkpoint to current scrubber position
  const handlePinCurrentScrub = useCallback(() => {
    setInterventionSeverity(sliderValue);
  }, [sliderValue]);

  // Handle timelapse 60 FPS recording sweep
  const handleStartRecording = useCallback(async () => {
    if (!canvasRef.current || isRecording) return;

    const savedSliderValue = sliderValue;
    setIsRecording(true);
    setRecordingProgress(0);

    const targetMax =
      treatmentActive && trajectoryView === 'treated' && isPostTreatment
        ? treatedOutput.plateauSeverityPct
        : 100.0;

    try {
      const blob = await recordProgressionTimelapse({
        canvas: canvasRef.current,
        targetMaxPercentage: targetMax,
        totalDurationMs: 4500,
        fps: 30,
        onSetSliderPercentage: (pct) => setSliderValue(pct),
        onProgress: (prog) => setRecordingProgress(prog),
      });

      const filename = generateExportFilename(
        cropData?.crop_name || cropId,
        cropData?.disease_name || 'pathology',
        'webm'
      );
      triggerFileDownload(blob, filename);
    } catch (err) {
      console.error('[ExperimentalViewer] Timelapse recording failed:', err);
    } finally {
      setSliderValue(savedSliderValue);
      setIsRecording(false);
      setRecordingProgress(0);
    }
  }, [
    cropData?.crop_name,
    cropData?.disease_name,
    cropId,
    isPostTreatment,
    isRecording,
    sliderValue,
    trajectoryView,
    treatedOutput.plateauSeverityPct,
    treatmentActive,
  ]);

  // Handle foliar canvas snapshot
  const handleSnapImage = useCallback(() => {
    if (!canvasRef.current) return;
    const filename = generateExportFilename(
      cropData?.crop_name || cropId,
      cropData?.disease_name || 'pathology',
      'png'
    );
    captureAndDownloadCanvasSnapshot(canvasRef.current, filename);
  }, [cropData?.crop_name, cropData?.disease_name, cropId]);

  // Handle opening PDF report modal
  const handleOpenReportModal = useCallback(() => {
    const snapshotUrl = canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
    const report = assembleFieldReportData({
      cropId,
      cropName: cropData?.crop_name || cropId.toUpperCase(),
      diseaseName: cropData?.disease_name || 'Unknown Pathology',
      pathogenScientific: cropData?.pathogen_scientific || 'Pathogen species',
      pathogenType: cropData?.pathogen_type || 'Foliar Infection',
      currentSeverityPct: effectiveRenderSeverity,
      dynamicOutput,
      temperatureC: temperature,
      humidityPct: humidity,
      stageOrder: activeStage?.stage_order ?? 0,
      stageLabel: activeStage?.stage_label ?? 'Initial Observation',
      treatmentActive,
      interventionSeverity,
      interventionDays,
      selectedCategory,
      selectedProductId: effectiveProductId,
      efficacyResult,
      yieldAnalytics,
      canvasSnapshotDataUrl: snapshotUrl,
    });

    setAssembledReport(report);
    setIsReportModalOpen(true);
  }, [
    activeStage,
    cropData,
    cropId,
    dynamicOutput,
    effectiveProductId,
    effectiveRenderSeverity,
    efficacyResult,
    humidity,
    interventionDays,
    interventionSeverity,
    selectedCategory,
    temperature,
    treatmentActive,
    yieldAnalytics,
  ]);

  const getStageColorBadge = (order: number) => {
    if (order === 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (order === 1) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const healthyBaselineUrl = stage0Url;

  return (
    <div
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-800/60 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-wide">
              {cropData?.crop_name || 'Crop'} Disease Progression
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-mono">
              {cropData?.disease_name || 'Pathology'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
              TIER 1 LAB
            </span>
          </div>
          <p className="text-xs text-slate-400 italic mt-0.5">
            {cropData?.scientific_name} • {cropData?.pathogen_scientific} ({cropData?.pathogen_type})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeStage && (
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-2 ${getStageColorBadge(
                activeStage.stage_order
              )}`}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              Stage {activeStage.stage_order}: {activeStage.stage_label}
            </div>
          )}

          <CompareHealthyToggle enabled={compareMode} onToggle={setCompareMode} />
        </div>
      </div>

      {/* Trajectory Branch Mode Selector (When Treatment Simulation is Active) */}
      {treatmentActive && (
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-bold">🌿 What-If Simulation:</span>
            <span className="text-slate-400">
              {isPostTreatment ? (
                <>
                  Spray active at Day <span className="font-mono tabular-nums">{interventionDays.toFixed(1)}</span> (<span className="font-mono tabular-nums">{interventionSeverity.toFixed(1)}%</span>) • Plateau capped at{' '}
                  <strong className="text-emerald-300 font-mono tabular-nums">
                    {treatedOutput.plateauSeverityPct.toFixed(1)}%
                  </strong>
                </>
              ) : (
                <>Pre-treatment phase (Day <span className="font-mono tabular-nums">{currentScrubDay.toFixed(1)}</span> &lt; Day <span className="font-mono tabular-nums">{interventionDays.toFixed(1)}</span>)</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTrajectoryView('treated')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                trajectoryView === 'treated'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🛡️ Treated Branch
            </button>
            <button
              type="button"
              onClick={() => setTrajectoryView('untreated')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                trajectoryView === 'untreated'
                  ? 'bg-rose-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ☠️ Untreated Baseline
            </button>
            <button
              type="button"
              onClick={() => setTrajectoryView('split')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                trajectoryView === 'split'
                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚖️ Split A/B View
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN STUDIO VIEWPORT: 2-COLUMN RESPONSIVE LAYOUT
          Left: Sticky Canvas Hero Stage + Docked Scrubber + Quick Action Bar
          Right: Tabbed Studio Inspector Rail
          ========================================================================= */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Hero Stage (~58% width, lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 lg:sticky lg:top-20">
          <div
            className={`w-full grid gap-4 ${
              isDualView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
          {/* Panel A: Left Side in Dual View */}
          {/* Case 1: Healthy Baseline Comparison */}
          {compareMode && !treatmentActive && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-square rounded-2xl bg-slate-950/80 border border-emerald-500/30 shadow-inner overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                {healthyBaselineUrl ? (
                  <img
                    src={healthyBaselineUrl}
                    alt={`${cropData?.crop_name} Healthy Baseline`}
                    className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                  />
                ) : (
                  <div className="w-8 h-8 border-2 border-emerald-400 rounded-full animate-spin" />
                )}

                <div className="absolute top-3 left-3 bg-emerald-950/90 border border-emerald-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-md flex items-center gap-1.5">
                  <span>🌿</span> Baseline Reference (Stage 0)
                </div>

                <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg px-2 py-0.5 text-[11px] font-mono text-emerald-400 shadow-md">
                  0.0% Infection • Day 0.0
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-2 font-medium">Asymptomatic Baseline Folium</span>
            </div>
          )}

          {/* Case 2: Split A/B Treatment View (Left Panel: Untreated Baseline) */}
          {treatmentActive && trajectoryView === 'split' && stage0Url && stage1Url && stage2Url && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-square rounded-2xl bg-slate-950/80 border border-rose-500/40 shadow-inner overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                {/* Multi-layer CSS cross-dissolve for Untreated State */}
                <img
                  src={stage0Url}
                  alt="Untreated Stage 0"
                  className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                  style={{
                    opacity: sliderValue <= 50 ? 1 - sliderValue / 50 : 0,
                  }}
                />
                <img
                  src={stage1Url}
                  alt="Untreated Stage 1"
                  className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                  style={{
                    opacity: sliderValue <= 50 ? sliderValue / 50 : Math.max(0, 1 - (sliderValue - 50) / 50),
                  }}
                />
                <img
                  src={stage2Url}
                  alt="Untreated Stage 2"
                  className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                  style={{
                    opacity: sliderValue > 50 ? (sliderValue - 50) / 50 : 0,
                  }}
                />

                <div className="absolute top-3 left-3 bg-rose-950/90 border border-rose-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-rose-300 shadow-md flex items-center gap-1.5">
                  <span>☠️</span> Untreated (No Chemical Intervention)
                </div>

                <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg px-2 py-0.5 text-[11px] font-mono text-rose-400 shadow-md">
                  {sliderValue.toFixed(1)}% Infection • Day {dynamicOutput.elapsedDays.toFixed(1)}
                </div>
              </div>
              <span className="text-xs text-rose-400 mt-2 font-medium">Unchecked Terminal Collapse</span>
            </div>
          )}

          {/* Panel B: Active Interactive WebGL Progression Canvas / CSS Blend Fallback */}
          <div className="flex flex-col items-center">
            <div
              ref={containerRef}
              className={`relative w-full aspect-square rounded-2xl bg-slate-950/80 shadow-inner overflow-hidden flex items-center justify-center ${
                treatmentActive && isPostTreatment && trajectoryView !== 'untreated'
                  ? 'border border-emerald-500/50 shadow-emerald-950/30'
                  : isDualView
                  ? 'border border-amber-500/30'
                  : 'border border-slate-800/80'
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

              {/* Buffering State */}
              {(dataLoading || !isContentReady) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs z-10">
                  <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                  <span className="text-xs text-slate-400 font-medium mt-3">Buffering leaf textures...</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 p-6 text-center z-10">
                  <span className="text-2xl mb-2">⚠️</span>
                  <p className="text-xs text-red-300">{error.message}</p>
                </div>
              )}

              {/* WebGL Canvas */}
              <canvas
                ref={canvasRef}
                className={`w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-300 ${
                  isFallbackMode ? 'hidden' : 'block'
                }`}
                style={{ opacity: rendererLoaded ? 1 : 0 }}
              />

              {/* Hardware-Accelerated CSS Multi-Layer Cross-Dissolve Fallback */}
              {isFallbackMode && stage0Url && stage1Url && stage2Url && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Stage 0 */}
                  <img
                    src={stage0Url}
                    alt={`${cropData?.crop_name} Stage 0`}
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                    style={{
                      opacity: effectiveRenderSeverity <= 50 ? 1 - effectiveRenderSeverity / 50 : 0,
                    }}
                  />
                  {/* Stage 1 */}
                  <img
                    src={stage1Url}
                    alt={`${cropData?.crop_name} Stage 1`}
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                    style={{
                      opacity:
                        effectiveRenderSeverity <= 50
                          ? effectiveRenderSeverity / 50
                          : Math.max(0, 1 - (effectiveRenderSeverity - 50) / 50),
                    }}
                  />
                  {/* Stage 2 */}
                  <img
                    src={stage2Url}
                    alt={`${cropData?.crop_name} Stage 2`}
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-opacity duration-75"
                    style={{
                      opacity: effectiveRenderSeverity > 50 ? (effectiveRenderSeverity - 50) / 50 : 0,
                    }}
                  />
                </div>
              )}

              {/* Interactive Anatomical Symptom Hotspots Overlay */}
              <LeafHotspotOverlay
                cropId={cropId}
                sliderPercentage={effectiveRenderSeverity}
                enabled={hotspotsEnabled}
                onToggleEnabled={setHotspotsEnabled}
              />

              {/* Top Banner Callout Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                {treatmentActive && isPostTreatment && trajectoryView !== 'untreated' ? (
                  <div className="bg-emerald-950/90 border border-emerald-600/70 rounded-lg px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-md flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>🛡️</span> Intervention Active (Lesions Arrested)
                  </div>
                ) : compareMode ? (
                  <div className="bg-amber-950/90 border border-amber-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-md flex items-center gap-1.5">
                    <span>🔬</span> Active Progression State
                  </div>
                ) : treatmentActive && trajectoryView === 'untreated' ? (
                  <div className="bg-rose-950/90 border border-rose-700/60 rounded-lg px-2.5 py-1 text-[11px] font-bold text-rose-300 shadow-md flex items-center gap-1.5">
                    <span>☠️</span> Untreated Trajectory
                  </div>
                ) : null}
              </div>

              {/* HUD Floating Scrub & Calendar Counter */}
              <div className="absolute bottom-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300 shadow-lg flex items-center gap-3">
                <div>
                  Foliar Severity:{' '}
                  <span
                    className={`font-bold ${
                      treatmentActive && isPostTreatment && trajectoryView !== 'untreated'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {effectiveRenderSeverity.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 w-[1px] bg-slate-700" />
                <div>
                  📅 <span className="font-bold text-amber-300">Day {dynamicOutput.elapsedDays.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {isDualView && (
              <span className="text-xs text-slate-400 mt-2 font-medium">
                {treatmentActive && trajectoryView === 'split'
                  ? 'Treated Outcome (Lesions Contained)'
                  : 'Active Pathological State'}
              </span>
            )}
          </div>
          </div>

          {/* DOCKED PRIMARY TIMELINE SCRUBBER: Glued Directly Beneath Canvas */}
          <AgronomicTimelineSlider
            cropId={cropId}
            sliderPercentage={sliderValue}
            onSliderPercentageChange={handleSliderChange}
            dynamicOutput={dynamicOutput}
          />

          {/* QUICK STUDIO ACTION DOCK */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs backdrop-blur-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <span>⚡</span> Quick Studio Actions:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isRecording}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] disabled:active:scale-100 disabled:pointer-events-none ${
                  isRecording
                    ? 'bg-rose-950/80 border border-rose-600/70 text-rose-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/40'
                }`}
                title="Record automated 60 FPS progression video sweep"
              >
                <span>🎬</span>
                <span>{isRecording ? <>Recording <span className="font-mono tabular-nums">{recordingProgress}%</span></> : 'Timelapse'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenReportModal}
                disabled={isRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all duration-150 ease-out disabled:active:scale-100 disabled:pointer-events-none disabled:opacity-50"
                title="Generate printable agronomic field advisory PDF"
              >
                <span>📄</span>
                <span>Advisory PDF</span>
              </button>
              <button
                type="button"
                onClick={handleSnapImage}
                disabled={isRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all duration-150 ease-out disabled:active:scale-100 disabled:pointer-events-none disabled:opacity-50"
                title="Save instantaneous high-resolution PNG snapshot"
              >
                <span>📸</span>
                <span>Snap PNG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Studio Inspector Rail (~42% width, lg:col-span-5) */}
        {showControls && (
          <div className="lg:col-span-5 flex flex-col">
            <StudioInspectorRail
              cropId={cropId}
              cropData={cropData}
              activeStage={activeStage}
              effectiveRenderSeverity={effectiveRenderSeverity}
              sliderValue={sliderValue}
              currentScrubDay={currentScrubDay}
              temperature={temperature}
              humidity={humidity}
              onTemperatureChange={setTemperature}
              onHumidityChange={setHumidity}
              dynamicOutput={dynamicOutput}
              treatmentActive={treatmentActive}
              onToggleTreatment={setTreatmentActive}
              interventionSeverity={interventionSeverity}
              interventionDays={interventionDays}
              onSetInterventionSeverity={setInterventionSeverity}
              onPinCurrentScrub={handlePinCurrentScrub}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedProductId={effectiveProductId}
              onSelectProductId={setSelectedProductId}
              efficacyResult={efficacyResult}
              yieldAnalytics={yieldAnalytics}
              treatedOutput={treatedOutput}
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              onStartRecording={handleStartRecording}
              onOpenReportModal={handleOpenReportModal}
              onSnapImage={handleSnapImage}
            />
          </div>
        )}
      </div>

      {/* Field Diagnostic PDF Report Modal (Tier 1, Feature 4) */}
      <DiagnosticPdfReportModal
        reportData={assembledReport}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};
