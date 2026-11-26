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
  CATEGORY_PROTECTION_DAYS,
  calculateInterventionEfficacy,
  evaluateYieldRetention,
  getTreatmentProducts,
  simulateTreatment,
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
  const [humidity, setHumidity] = useState<number>(profile.humidity.opt);
  const [prevCropId, setPrevCropId] = useState<SupportedCropId>(cropId);

  // Treatment branching state
  const [treatmentActive, setTreatmentActive] = useState<boolean>(false);
  const [interventionSeverity, setInterventionSeverity] = useState<number>(25.0);
  const [selectedCategory, setSelectedCategory] = useState<FungicideCategory>('systemic_curative');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [trajectoryView, setTrajectoryView] = useState<TrajectoryViewMode>('treated');
  const [keepSpraying, setKeepSpraying] = useState<boolean>(true);

  // Foliar Viewport Modes
  const [viewMode, setViewMode] = useState<FoliarViewMode>('rgb');
  const [splitEnabled, setSplitEnabled] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);

  // Export and Media state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [assembledReport, setAssembledReport] = useState<AgronomicFieldReportData | null>(null);

  // Bacterial diseases have no curative spray: fall back to the first category this crop has products for.
  const activeCategory: FungicideCategory =
    getTreatmentProducts(cropId, selectedCategory).length > 0
      ? selectedCategory
      : getTreatmentProducts(cropId)[0]?.category ?? selectedCategory;

  // Derive active product id based on crop and category during render
  const availableProducts = useMemo(
    () => getTreatmentProducts(cropId, activeCategory),
    [cropId, activeCategory]
  );
  const effectiveProductId =
    selectedProductId && availableProducts.some((p) => p.id === selectedProductId)
      ? selectedProductId
      : availableProducts[0]?.id || '';
  const protectionDays =
    availableProducts.find((p) => p.id === effectiveProductId)?.protectionDays ?? CATEGORY_PROTECTION_DAYS[activeCategory];

  // Synchronize microclimate when crop changes
  if (prevCropId !== cropId) {
    setPrevCropId(cropId);
    setTemperature(profile.cardinals.opt);
    setHumidity(profile.humidity.opt);
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
    return calculateInterventionEfficacy(cropId, interventionSeverity, activeCategory);
  }, [cropId, interventionSeverity, activeCategory]);

  // Same weather, product protection and re-spray choice drive the treated branch and the season outcome.
  const scenario = useMemo(
    () => ({ temperatureC: temperature, humidityPct: humidity, protectionDays, keepSpraying }),
    [temperature, humidity, protectionDays, keepSpraying]
  );

  const treatedOutput: TreatedSeverityTrajectoryResult = useMemo(() => {
    return simulateTreatment(cropId, interventionSeverity, sliderValue, activeCategory, scenario);
  }, [cropId, interventionSeverity, sliderValue, activeCategory, scenario]);

  const yieldAnalytics: YieldRetentionAnalyticsResult = useMemo(() => {
    return evaluateYieldRetention(cropId, interventionSeverity, treatmentActive, activeCategory, scenario);
  }, [cropId, interventionSeverity, treatmentActive, activeCategory, scenario]);

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
      selectedCategory: activeCategory,
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
    activeCategory,
    temperature,
    treatmentActive,
    yieldAnalytics,
  ]);

  const isDualView = (compareMode && !treatmentActive) || (treatmentActive && trajectoryView === 'split');
  const stalled = dynamicOutput.microclimate.isStalled;
  const tooLate = treatmentActive && efficacyResult.windowTier === 'terminal';
  const treatedNow = treatmentActive && isPostTreatment && trajectoryView !== 'untreated';

  const VIEW_MODES: { id: FoliarViewMode; label: string; title: string }[] = [
    { id: 'rgb', label: 'Photo', title: 'The leaf as it looks' },
    { id: 'attention', label: 'Heatmap', title: 'Colours where the picture changes between stages' },
    { id: 'mask', label: 'Changes', title: 'Black-and-white map of what changes between stages' },
  ];
  const TRAJECTORIES: { id: TrajectoryViewMode; label: string }[] = [
    { id: 'treated', label: 'Treated' },
    { id: 'untreated', label: 'Not treated' },
    { id: 'split', label: 'Side by side' },
  ];
  const segment = (active: boolean) =>
    `min-h-9 cursor-pointer rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ui-accent ${
      active ? 'bg-ui-bg font-medium text-ui-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ui-ink-2 hover:text-ui-ink'
    }`;
  const chip = 'pointer-events-none rounded-full border border-ui-line bg-white/90 px-2.5 py-1 text-xs text-ui-ink-2 backdrop-blur-sm';
  const plate = 'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-ui-warm';
  const crossFade = (pct: number) => [
    pct <= 50 ? 1 - pct / 50 : 0,
    pct <= 50 ? pct / 50 : Math.max(0, 1 - (pct - 50) / 50),
    pct > 50 ? (pct - 50) / 50 : 0,
  ];

  return (
    <div className={className}>
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-2xl font-medium tracking-[-0.01em] text-ui-ink">
          {cropData?.crop_name || 'Crop'} · {cropData?.disease_name || 'Disease'}
        </h2>
        {cropData?.pathogen_scientific && <p className="text-sm italic text-ui-ink-3">{cropData.pathogen_scientific}</p>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* View controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-ui-warm p-1" role="group" aria-label="Leaf view">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  aria-pressed={viewMode === mode.id}
                  title={mode.title}
                  className={segment(viewMode === mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <CompareHealthyToggle enabled={compareMode} onToggle={setCompareMode} />
              <button
                type="button"
                onClick={() => setSplitEnabled((prev) => !prev)}
                aria-pressed={splitEnabled}
                title="Show the healthy leaf on one side of a draggable line"
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ui-accent ${
                  splitEnabled ? 'border-ui-accent-line bg-ui-accent-soft text-ui-accent-hover' : 'border-ui-line text-ui-ink-2 hover:bg-ui-warm'
                }`}
              >
                Before / after line
              </button>
            </div>
          </div>

          {splitEnabled && (
            <label className="flex items-center gap-3 text-sm text-ui-ink-2">
              <span className="shrink-0">Line position</span>
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={splitPosition}
                onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-[var(--color-ui-accent)]"
                aria-valuetext={`Line at ${Math.round(splitPosition * 100)} percent`}
              />
            </label>
          )}

          {treatmentActive && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-accent-line bg-ui-accent-soft px-4 py-2.5">
              <p className="text-sm text-ui-ink">
                {tooLate ? (
                  <>Sprayed at {interventionSeverity.toFixed(0)}% — too late to change the outcome</>
                ) : isPostTreatment ? (
                  <>
                    {treatedOutput.spraysSoFar} {treatedOutput.spraysSoFar === 1 ? 'spray' : 'sprays'} so far · season end about{' '}
                    <span className="font-medium tabular-nums">{treatedOutput.plateauSeverityPct.toFixed(0)}%</span>
                  </>
                ) : (
                  <>
                    Spray at <span className="font-medium tabular-nums">{interventionSeverity.toFixed(0)}%</span> progress
                    {stalled ? '' : <> (day <span className="font-medium tabular-nums">{interventionDays.toFixed(0)}</span>)</>}
                  </>
                )}
              </p>
              <div className="inline-flex rounded-lg bg-white/70 p-1" role="group" aria-label="Treatment view">
                {TRAJECTORIES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTrajectoryView(option.id)}
                    aria-pressed={trajectoryView === option.id}
                    className={segment(trajectoryView === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leaf stage */}
          <div className={`grid gap-4 ${isDualView ? 'grid-cols-1 sm:grid-cols-2' : 'mx-auto w-full max-w-[520px] grid-cols-1'}`}>
            {compareMode && !treatmentActive && (
              <figure>
                <div className={plate}>
                  {stage0Url ? (
                    <img src={stage0Url} alt={`Healthy ${cropData?.crop_name ?? ''} leaf`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ui-accent border-t-transparent" />
                  )}
                </div>
                <figcaption className="mt-2 text-center text-sm text-ui-ink-3">Healthy</figcaption>
              </figure>
            )}

            {treatmentActive && trajectoryView === 'split' && stage0Url && stage1Url && stage2Url && (
              <figure>
                <div className={plate}>
                  {[stage0Url, stage1Url, stage2Url].map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt={index === 0 ? 'Leaf without treatment' : ''}
                      className="absolute inset-0 h-full w-full object-contain transition-opacity duration-75"
                      style={{ opacity: crossFade(sliderValue)[index] }}
                    />
                  ))}
                  <span className={`absolute bottom-3 right-3 ${chip}`}>
                    <span className="tabular-nums">{sliderValue.toFixed(0)}%</span>
                  </span>
                </div>
                <figcaption className="mt-2 text-center text-sm text-red-700">Not treated</figcaption>
              </figure>
            )}

            <figure>
              <div
                ref={containerRef}
                className={`${plate} ${treatedNow ? 'ring-2 ring-ui-accent' : ''}`}
              >
                {(dataLoading || !isContentReady) && (
                  <div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ui-warm">
                    <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-ui-accent border-t-transparent" aria-hidden="true" />
                    <span className="text-sm text-ui-ink-2">Loading the leaf…</span>
                  </div>
                )}

                {error && (
                  <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-red-50 p-6 text-center">
                    <p className="text-sm text-red-700">{error.message}</p>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={`${cropData?.crop_name ?? 'Crop'} leaf at ${effectiveRenderSeverity.toFixed(0)}% severity`}
                  className={`h-full w-full object-contain transition-opacity duration-300 ${isFallbackMode ? 'hidden' : 'block'}`}
                  style={{ opacity: rendererLoaded ? 1 : 0 }}
                />

                {isFallbackMode && stage0Url && stage1Url && stage2Url && (
                  <div className="pointer-events-none absolute inset-0">
                    {[stage0Url, stage1Url, stage2Url].map((url, index) => (
                      <img
                        key={url}
                        src={url}
                        alt={index === 0 ? `${cropData?.crop_name ?? 'Crop'} leaf` : ''}
                        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-75"
                        style={{ opacity: crossFade(effectiveRenderSeverity)[index] }}
                      />
                    ))}
                  </div>
                )}

                <LeafHotspotOverlay
                  cropId={cropId}
                  sliderPercentage={effectiveRenderSeverity}
                  enabled={hotspotsEnabled}
                  onToggleEnabled={setHotspotsEnabled}
                />

                {treatedNow && <span className={`absolute left-3 top-3 ${chip} text-ui-accent-hover`}>Treated</span>}

                <span className={`absolute bottom-3 right-3 ${chip}`}>
                  <span className="font-medium tabular-nums text-ui-ink">{effectiveRenderSeverity.toFixed(0)}%</span> progress ·{' '}
                  {stalled ? 'no change in this weather' : <>Day <span className="tabular-nums">{dynamicOutput.elapsedDays.toFixed(0)}</span></>}
                </span>
              </div>
              {isDualView && (
                <figcaption className="mt-2 text-center text-sm text-ui-ink-3">
                  {treatmentActive && trajectoryView === 'split' ? 'Treated' : 'Now'}
                </figcaption>
              )}
            </figure>
          </div>

          <AgronomicTimelineSlider
            cropId={cropId}
            sliderPercentage={sliderValue}
            onSliderPercentageChange={handleSliderChange}
            dynamicOutput={dynamicOutput}
            treatmentActive={treatmentActive}
            interventionSeverity={interventionSeverity}
          />
        </div>

        {showControls && (
          <div className="lg:col-span-5">
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
              selectedCategory={activeCategory}
              keepSpraying={keepSpraying}
              onToggleKeepSpraying={setKeepSpraying}
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
