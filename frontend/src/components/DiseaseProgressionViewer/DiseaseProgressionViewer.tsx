import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../../models/agronomicTimelineModel.ts';
import {
  calculateElapsedDays,
  AGRONOMIC_CALIBRATION_REGISTRY,
} from '../../models/agronomicTimelineModel.ts';
import type {
  FungicideCategory,
  InterventionEfficacyResult,
  TreatedSeverityTrajectoryResult,
  YieldRetentionAnalyticsResult,
} from '../../models/treatmentBranchingModel.ts';
import {
  calculateInterventionEfficacy,
  calculateTreatedSeverity,
  evaluateYieldRetention,
  getTreatmentProducts,
} from '../../models/treatmentBranchingModel.ts';
import type { AgronomicFieldReportData } from '../../models/exportReportModel.ts';
import {
  assembleFieldReportData,
  generateExportFilename,
} from '../../models/exportReportModel.ts';
import {
  recordProgressionTimelapse,
  captureAndDownloadCanvasSnapshot,
  triggerFileDownload,
} from '../../utils/timelapseRecorder.ts';
import { useProgressionData } from '../../hooks/useProgressionData.ts';
import type { ProgressionStage } from '../../types/progression.ts';
import { ProgressionShaderRenderer } from './ProgressionShaderRenderer.ts';
import { CompareHealthyToggle } from './CompareHealthyToggle.tsx';
import { AgronomicTimelineSlider } from './AgronomicTimelineSlider.tsx';
import { LeafHotspotOverlay } from './LeafHotspotOverlay.tsx';
import { StudioInspectorRail } from './StudioInspectorRail.tsx';
import { DiagnosticPdfReportModal } from './DiagnosticPdfReportModal.tsx';

export type TrajectoryViewMode = 'treated' | 'untreated' | 'split';
export type FoliarViewMode = 'rgb' | 'attention' | 'mask';

export interface DiseaseProgressionViewerProps {
  cropId?: SupportedCropId;
  initialPercentage?: number;
  onPercentageChange?: (percentage: number) => void;
  className?: string;
  showControls?: boolean;
}

export const DiseaseProgressionViewer: React.FC<DiseaseProgressionViewerProps> = ({
  cropId = 'tomato',
  initialPercentage = 0,
  onPercentageChange,
  className = '',
  showControls = true,
}) => {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId] || AGRONOMIC_CALIBRATION_REGISTRY.tomato;

  // Microclimate state (initialized to crop-specific favorable norms)
  const [temperature, setTemperature] = useState<number>(profile.cardinals.opt);
  const [humidity, setHumidity] = useState<number>(profile.humidity.crit);
  const [prevCropId, setPrevCropId] = useState<SupportedCropId>(cropId);

  // Treatment branching state
  const [treatmentActive, setTreatmentActive] = useState<boolean>(false);
  const [interventionSeverity, setInterventionSeverity] = useState<number>(25.0);
  const [selectedCategory, setSelectedCategory] = useState<FungicideCategory>('systemic_curative');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [trajectoryView, setTrajectoryView] = useState<TrajectoryViewMode>('treated');

  // Foliar Viewport Modes
  const [viewMode, setViewMode] = useState<FoliarViewMode>('rgb');
  const [splitEnabled, setSplitEnabled] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);

  // Export and Media state
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

  // Synchronize microclimate when crop changes
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
  const sliderValueRef = useRef<number>(sliderValue);

  useEffect(() => {
    sliderValueRef.current = sliderValue;
  }, [sliderValue]);

  // Hook into canonical progression data service
  const { cropData, activeStage, loading: dataLoading, error } = useProgressionData(
    cropId,
    sliderValue
  );

  const stage0Url = cropData?.stages.find((s: ProgressionStage) => s.stage_order === 0)?.assets.base_image_url;
  const stage1Url = cropData?.stages.find((s: ProgressionStage) => s.stage_order === 1)?.assets.base_image_url;
  const stage2Url = cropData?.stages.find((s: ProgressionStage) => s.stage_order === 2)?.assets.base_image_url;
  const mask1Url = cropData?.stages.find((s: ProgressionStage) => s.stage_order === 1)?.assets.mask_image_url;
  const mask2Url = cropData?.stages.find((s: ProgressionStage) => s.stage_order === 2)?.assets.mask_image_url;

  // Initialize WebGL/2D shader renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new ProgressionShaderRenderer(canvasRef.current);
    renderer.setViewMode(viewMode);
    renderer.setSplitCompare(splitEnabled, splitPosition);
    rendererRef.current = renderer;
    setIsFallbackMode(!renderer.isAvailable());

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronize shader options when view mode or split changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setViewMode(viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setSplitCompare(splitEnabled, splitPosition);
    }
  }, [splitEnabled, splitPosition]);

  // Load textures into GPU memory when cropData changes
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
          rendererRef.current?.render(sliderValueRef.current / 100.0);
        }
      })
      .catch((err) => {
        console.error('[DiseaseProgressionViewer] Failed to load progression textures:', err);
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

  // Compute dynamic epidemiological time elapsed using Magarey Beta response
  const dynamicOutput: ProgressionDynamicOutput = useMemo(() => {
    return calculateElapsedDays(cropId, sliderValue, temperature, humidity);
  }, [cropId, sliderValue, temperature, humidity]);

  const currentScrubDay = dynamicOutput.elapsedDays;

  // Compute intervention elapsed day
  const interventionDays = useMemo(() => {
    return calculateElapsedDays(cropId, interventionSeverity, temperature, humidity).elapsedDays;
  }, [cropId, interventionSeverity, temperature, humidity]);

  // Compute treatment efficacy and outcome trajectory
  const efficacyResult: InterventionEfficacyResult = useMemo(() => {
    return calculateInterventionEfficacy(cropId, interventionSeverity, selectedCategory);
  }, [cropId, interventionSeverity, selectedCategory]);

  const daysPostIntervention = Math.max(0, currentScrubDay - interventionDays);

  const treatedOutput: TreatedSeverityTrajectoryResult = useMemo(() => {
    return calculateTreatedSeverity(
      cropId,
      interventionSeverity,
      daysPostIntervention,
      selectedCategory
    );
  }, [cropId, interventionSeverity, daysPostIntervention, selectedCategory]);

  const yieldAnalytics: YieldRetentionAnalyticsResult = useMemo(() => {
    return evaluateYieldRetention(
      cropId,
      interventionSeverity,
      treatmentActive,
      selectedCategory
    );
  }, [cropId, interventionSeverity, treatmentActive, selectedCategory]);

  // Determine effective rendering severity
  const isPostTreatment = treatmentActive && sliderValue >= interventionSeverity;
  const effectiveRenderSeverity = useMemo(() => {
    if (!treatmentActive) return sliderValue;
    if (trajectoryView === 'untreated') return sliderValue;
    if (trajectoryView === 'treated' || trajectoryView === 'split') {
      return isPostTreatment ? treatedOutput.currentSeverityPct : sliderValue;
    }
    return sliderValue;
  }, [treatmentActive, trajectoryView, sliderValue, isPostTreatment, treatedOutput.currentSeverityPct]);

  // Render canvas frame on severity change
  useEffect(() => {
    if (rendererLoaded && rendererRef.current && !isFallbackMode) {
      rendererRef.current.render(effectiveRenderSeverity / 100.0);
    }
  }, [effectiveRenderSeverity, rendererLoaded, isFallbackMode]);

  // DPR-aware ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !rendererRef.current) return;

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
  }, [rendererLoaded, compareMode]);

  // Slider scrub handler
  const handleSliderChange = useCallback(
    (val: number) => {
      setSliderValue(val);
      onPercentageChange?.(val);
    },
    [onPercentageChange]
  );

  const handlePinCurrentScrub = useCallback(() => {
    setInterventionSeverity(sliderValue);
    setTreatmentActive(true);
  }, [sliderValue]);

  // Automated 60 FPS Timelapse sweep recorder
  const handleStartRecording = useCallback(async () => {
    if (!canvasRef.current || isRecording) return;

    setIsRecording(true);
    setRecordingProgress(0);

    const filename = generateExportFilename(
      cropData?.crop_name || cropId,
      cropData?.disease_name || 'progression',
      'webm'
    );

    try {
      const blob = await recordProgressionTimelapse({
        canvas: canvasRef.current,
        onSetSliderPercentage: (pct: number) => {
          setSliderValue(pct);
          if (rendererRef.current && !isFallbackMode) {
            rendererRef.current.render(pct / 100.0);
          }
        },
        onProgress: (pct: number) => setRecordingProgress(pct),
        fps: 60,
        totalDurationMs: 4500,
      });

      triggerFileDownload(blob, filename);
    } catch (err) {
      console.error('[DiseaseProgressionViewer] Timelapse recording failed:', err);
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  }, [cropData?.crop_name, cropData?.disease_name, cropId, isFallbackMode, isRecording]);

  // Instant high-res PNG canvas snapshot
  const handleSnapImage = useCallback(() => {
    if (!canvasRef.current) return;
    const filename = generateExportFilename(
      cropData?.crop_name || cropId,
      cropData?.disease_name || 'pathology',
      'png'
    );
    captureAndDownloadCanvasSnapshot(canvasRef.current, filename);
  }, [cropData?.crop_name, cropData?.disease_name, cropId]);

  // Printable Agronomic PDF Report Modal
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
    if (order === 0) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (order === 1) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-red-50 text-red-800 border-red-200';
  };

  const isDualView = (compareMode && !treatmentActive) || (treatmentActive && trajectoryView === 'split');

  return (
    <div
      className={`flex flex-col bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-slate-50/80 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {cropData?.crop_name || 'Crop'} Disease Progression
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-mono font-medium">
              {cropData?.disease_name || 'Pathology'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold">
              SPEC-UI-007
            </span>
          </div>
          <p className="text-xs text-slate-500 italic mt-0.5">
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
        <div className="px-6 py-2.5 bg-teal-50/40 border-b border-teal-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-teal-800 font-bold">🌿 What-If Simulation:</span>
            <span className="text-slate-600">
              {isPostTreatment ? (
                <>
                  Intervention at Day{' '}
                  <span className="font-mono tabular-nums font-semibold">{interventionDays.toFixed(1)}</span> (
                  <span className="font-mono tabular-nums font-semibold">{interventionSeverity.toFixed(1)}%</span>) •
                  Ceiling capped at{' '}
                  <strong className="text-teal-800 font-mono tabular-nums">
                    {treatedOutput.plateauSeverityPct.toFixed(1)}%
                  </strong>
                </>
              ) : (
                <>
                  Pre-treatment phase (Day{' '}
                  <span className="font-mono tabular-nums">{currentScrubDay.toFixed(1)}</span> &lt; Day{' '}
                  <span className="font-mono tabular-nums">{interventionDays.toFixed(1)}</span>)
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs font-medium">
            <button
              type="button"
              onClick={() => setTrajectoryView('treated')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${
                trajectoryView === 'treated'
                  ? 'bg-teal-700 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛡️ Treated Branch
            </button>
            <button
              type="button"
              onClick={() => setTrajectoryView('untreated')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${
                trajectoryView === 'untreated'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ☠️ Untreated Baseline
            </button>
            <button
              type="button"
              onClick={() => setTrajectoryView('split')}
              className={`px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${
                trajectoryView === 'split'
                  ? 'bg-sky-700 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚖️ Split A/B View
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Viewport: 12-Column Responsive Layout */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Foliar Canvas Stage (~58% width, lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 lg:sticky lg:top-20">
          {/* Top View Mode Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold px-2 hidden sm:inline">
                View:
              </span>
              <button
                type="button"
                onClick={() => setViewMode('rgb')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                  viewMode === 'rgb'
                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Photorealistic RGB progression blend"
              >
                🌿 RGB Blend
              </button>
              <button
                type="button"
                onClick={() => setViewMode('attention')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                  viewMode === 'attention'
                    ? 'bg-teal-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Cross-attention density colormap"
              >
                🔥 Attention Heatmap
              </button>
              <button
                type="button"
                onClick={() => setViewMode('mask')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                  viewMode === 'mask'
                    ? 'bg-slate-800 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Difference mask contour segmentation"
              >
                📐 Difference Mask
              </button>
            </div>

            {/* Split Screen Curtain Toggle */}
            <button
              type="button"
              onClick={() => setSplitEnabled((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 border ${
                splitEnabled
                  ? 'bg-teal-50 border-teal-300 text-teal-800 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Toggle split screen comparison curtain"
            >
              ↔️ Split Curtain {splitEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Split Curtain Position Range (when active) */}
          {splitEnabled && (
            <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-teal-950 flex items-center gap-1.5 shrink-0">
                <span>↔️</span>
                <span>Divider:</span>
              </span>
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={splitPosition}
                onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
                className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2 cursor-pointer"
                aria-label="Split Screen Curtain Position"
                aria-valuemin={5}
                aria-valuemax={95}
                aria-valuenow={Math.round(splitPosition * 100)}
                aria-valuetext={`Split curtain at ${Math.round(splitPosition * 100)} percent`}
              />
              <span className="font-mono tabular-nums text-teal-800 font-bold shrink-0">
                {Math.round(splitPosition * 100)}%
              </span>
            </div>
          )}

          {/* Canvas Viewport Stage */}
          <div
            className={`w-full grid gap-4 ${
              isDualView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* Healthy Baseline Panel (when compareMode active) */}
            {compareMode && !treatmentActive && (
              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-square rounded-2xl bg-slate-50 border border-teal-200 shadow-inner overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                  {stage0Url ? (
                    <img
                      src={stage0Url}
                      alt={`${cropData?.crop_name} Healthy Baseline`}
                      className="w-full h-full object-contain filter drop-shadow-sm"
                    />
                  ) : (
                    <div className="w-8 h-8 border-2 border-teal-500 rounded-full animate-spin" />
                  )}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs border border-teal-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-teal-800 shadow-xs flex items-center gap-1.5">
                    <span>🌿</span> Baseline Reference (Stage 0)
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-mono tabular-nums text-teal-800 shadow-xs">
                    0.0% Infection • Day 0.0
                  </div>
                </div>
                <span className="text-xs text-slate-500 mt-2 font-medium">Asymptomatic Baseline Folium</span>
              </div>
            )}

            {/* Split A/B Untreated Baseline Panel */}
            {treatmentActive && trajectoryView === 'split' && stage0Url && stage1Url && stage2Url && (
              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-square rounded-2xl bg-slate-50 border border-red-200 shadow-inner overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                  <img
                    src={stage0Url}
                    alt="Untreated Stage 0"
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                    style={{
                      opacity: sliderValue <= 50 ? 1 - sliderValue / 50 : 0,
                    }}
                  />
                  <img
                    src={stage1Url}
                    alt="Untreated Stage 1"
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                    style={{
                      opacity: sliderValue <= 50 ? sliderValue / 50 : Math.max(0, 1 - (sliderValue - 50) / 50),
                    }}
                  />
                  <img
                    src={stage2Url}
                    alt="Untreated Stage 2"
                    className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                    style={{
                      opacity: sliderValue > 50 ? (sliderValue - 50) / 50 : 0,
                    }}
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs border border-red-300 rounded-lg px-2.5 py-1 text-[11px] font-bold text-red-700 shadow-xs flex items-center gap-1.5">
                    <span>☠️</span> Untreated Baseline
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-mono tabular-nums text-red-700 shadow-xs">
                    {sliderValue.toFixed(1)}% Infection • Day {dynamicOutput.elapsedDays.toFixed(1)}
                  </div>
                </div>
                <span className="text-xs text-red-600 mt-2 font-medium">Unchecked Terminal Collapse</span>
              </div>
            )}

            {/* Active Interactive Canvas Stage */}
            <div className="flex flex-col items-center">
              <div
                ref={containerRef}
                className={`relative w-full aspect-square rounded-2xl bg-slate-50 shadow-inner overflow-hidden flex items-center justify-center ${
                  treatmentActive && isPostTreatment && trajectoryView !== 'untreated'
                    ? 'border-2 border-teal-500 shadow-teal-900/10'
                    : isDualView
                      ? 'border border-amber-300'
                      : 'border border-slate-200'
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                {/* Loading state */}
                {(dataLoading || !isContentReady) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs z-10">
                    <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin" />
                    <span className="text-xs text-slate-500 font-medium mt-3">Streaming foliar textures...</span>
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-6 text-center z-10">
                    <span className="text-2xl mb-2">⚠️</span>
                    <p className="text-xs text-red-700 font-medium">{error.message}</p>
                  </div>
                )}

                {/* WebGL Canvas */}
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-300 ${
                    isFallbackMode ? 'hidden' : 'block'
                  }`}
                  style={{ opacity: rendererLoaded ? 1 : 0 }}
                />

                {/* 2D CSS Cross-Dissolve Fallback */}
                {isFallbackMode && stage0Url && stage1Url && stage2Url && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src={stage0Url}
                      alt={`${cropData?.crop_name} Stage 0`}
                      className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                      style={{
                        opacity: effectiveRenderSeverity <= 50 ? 1 - effectiveRenderSeverity / 50 : 0,
                      }}
                    />
                    <img
                      src={stage1Url}
                      alt={`${cropData?.crop_name} Stage 1`}
                      className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                      style={{
                        opacity:
                          effectiveRenderSeverity <= 50
                            ? effectiveRenderSeverity / 50
                            : Math.max(0, 1 - (effectiveRenderSeverity - 50) / 50),
                      }}
                    />
                    <img
                      src={stage2Url}
                      alt={`${cropData?.crop_name} Stage 2`}
                      className="absolute inset-0 w-full h-full object-contain filter drop-shadow-sm transition-opacity duration-75"
                      style={{
                        opacity: effectiveRenderSeverity > 50 ? (effectiveRenderSeverity - 50) / 50 : 0,
                      }}
                    />
                  </div>
                )}

                {/* Anatomical Symptom Hotspots Overlay */}
                <LeafHotspotOverlay
                  cropId={cropId}
                  sliderPercentage={effectiveRenderSeverity}
                  enabled={hotspotsEnabled}
                  onToggleEnabled={setHotspotsEnabled}
                />

                {/* Active Status Badge in Viewport */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                  {treatmentActive && isPostTreatment && trajectoryView !== 'untreated' ? (
                    <div className="bg-teal-900/90 text-white rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-md flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      <span>🛡️ Intervention Active</span>
                    </div>
                  ) : compareMode ? (
                    <div className="bg-amber-800/90 text-white rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-md flex items-center gap-1.5">
                      <span>🔬 Active Progression State</span>
                    </div>
                  ) : treatmentActive && trajectoryView === 'untreated' ? (
                    <div className="bg-red-800/90 text-white rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-md flex items-center gap-1.5">
                      <span>☠️ Untreated Trajectory</span>
                    </div>
                  ) : null}
                </div>

                {/* Floating HUD Scrub Counter */}
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono tabular-nums text-slate-700 shadow-md flex items-center gap-3">
                  <div>
                    Severity:{' '}
                    <span
                      className={`font-bold ${
                        treatmentActive && isPostTreatment && trajectoryView !== 'untreated'
                          ? 'text-teal-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {effectiveRenderSeverity.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-[1px] bg-slate-200" />
                  <div>
                    📅 <span className="font-bold text-slate-900">Day {dynamicOutput.elapsedDays.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {isDualView && (
                <span className="text-xs text-slate-500 mt-2 font-medium">
                  {treatmentActive && trajectoryView === 'split'
                    ? 'Treated Outcome (Lesions Arrested)'
                    : 'Active Pathological State'}
                </span>
              )}
            </div>
          </div>

          {/* Primary Bi-directional Timeline Scrubber */}
          <AgronomicTimelineSlider
            cropId={cropId}
            sliderPercentage={sliderValue}
            onSliderPercentageChange={handleSliderChange}
            dynamicOutput={dynamicOutput}
            treatmentActive={treatmentActive}
            interventionSeverity={interventionSeverity}
          />

          {/* Quick Action Dock */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
            <span className="text-slate-600 font-semibold flex items-center gap-1.5">
              <span>⚡</span> Quick Studio Actions:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isRecording}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 disabled:pointer-events-none ${
                  isRecording
                    ? 'bg-red-50 border border-red-300 text-red-700'
                    : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs'
                }`}
                title="Record automated 60 FPS progression video sweep"
              >
                <span>🎬</span>
                <span>
                  {isRecording ? (
                    <>
                      Recording <span className="font-mono tabular-nums">{recordingProgress}%</span>
                    </>
                  ) : (
                    'Timelapse'
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenReportModal}
                disabled={isRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                title="Generate printable agronomic field advisory PDF"
              >
                <span>📄</span>
                <span>Advisory PDF</span>
              </button>
              <button
                type="button"
                onClick={handleSnapImage}
                disabled={isRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
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

      {/* Field Diagnostic PDF Report Modal */}
      <DiagnosticPdfReportModal
        reportData={assembledReport}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};
