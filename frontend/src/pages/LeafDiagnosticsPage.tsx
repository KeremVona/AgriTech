import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type {
  DiagnosticPrediction,
  DiagnosticUIState,
  ClinicalSamplePreset,
} from '../types/diagnostics';
import {
  LeafImageDropzone,
  SamplingBestPracticesCard,
  DiagnosticVerdictCard,
  VerdictSkeletonLoader,
} from '../components/Diagnostics';
import { validateLeafImage } from '../utils/imageValidation';
import {
  classifyLeafImage,
  CLINICAL_SAMPLE_PRESETS,
  presetToPrediction,
} from '../services/diagnosticsService';

export const LeafDiagnosticsPage: React.FC = () => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uiState, setUiState] = useState<DiagnosticUIState>('IDLE');
  const [verdict, setVerdict] = useState<DiagnosticPrediction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<{
    name: string;
    sizeMb: number;
    width?: number;
    height?: number;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeFileRef = useRef<File | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedImageUrl && selectedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImageUrl);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedImageUrl]);

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (selectedImageUrl && selectedImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    setSelectedImageUrl(null);
    setVerdict(null);
    setErrorMessage(null);
    setFileMetadata(null);
    setUiState('IDLE');
    activeFileRef.current = null;
  };

  const handleImageSelected = async (file: File) => {
    setErrorMessage(null);
    setVerdict(null);
    setUiState('VALIDATING');

    // 1. Client-Side Pre-Flight Validation
    const validation = await validateLeafImage(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid leaf image. Please check format and dimensions.');
      setUiState('REJECTED');
      return;
    }

    // 2. Set Preview & Metadata
    if (selectedImageUrl && selectedImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedImageUrl(previewUrl);
    activeFileRef.current = file;

    setFileMetadata({
      name: file.name,
      sizeMb: validation.fileSizeMb || Number((file.size / (1024 * 1024)).toFixed(2)),
      width: validation.width,
      height: validation.height,
    });

    // 3. Dispatch Machine Learning Inference
    runInference(file);
  };

  const runInference = async (file: File) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setUiState('INFERENCING');
    setErrorMessage(null);

    try {
      const prediction = await classifyLeafImage(file, controller.signal);
      setVerdict(prediction);
      if (prediction.requiresRescan || prediction.confidenceScore < 0.70) {
        setUiState('LOW_CONFIDENCE');
      } else {
        setUiState('SUCCESS');
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        setUiState('IDLE');
        return;
      }
      setErrorMessage(error.message || 'Vision service error occurred during classification.');
      setUiState('ERROR');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleAbortScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUiState('IDLE');
  };

  const handleSelectPreset = (preset: ClinicalSamplePreset) => {
    handleReset();
    const prediction = presetToPrediction(preset);
    setVerdict(prediction);
    setUiState(preset.severityTier === 'Tier 1' ? 'LOW_CONFIDENCE' : 'SUCCESS');
    setFileMetadata({
      name: `${preset.id}.jpg`,
      sizeMb: 1.85,
      width: 1024,
      height: 1024,
    });
  };

  return (
    <div className="min-h-screen bg-ag-canvas text-ag-ink font-sans antialiased p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumbs & Top Utilities */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-ag-border">
          <nav className="text-xs text-ag-ink-secondary flex items-center gap-1.5 flex-wrap">
            <Link to="/" className="hover:text-ag-brand transition-colors">
              Platform Home
            </Link>
            <span>/</span>
            <span>Operations & Agronomy</span>
            <span>/</span>
            <span className="text-ag-ink font-semibold">AI Leaf Diagnostics</span>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/disease-progression"
              className="px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-ag-ink ag-interactive shadow-xs flex items-center gap-1.5"
            >
              <span>🔬</span>
              <span>Progression Engine</span>
            </Link>

            {(selectedImageUrl || verdict) && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-ag-ink ag-interactive shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>✕</span>
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Page Title & Clinical Quick-Select Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-ag-brand-subtle border border-emerald-300 text-teal-800 text-[11px] font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
              <span>MobileNetV3-Large Dual-Head ONNX Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ag-ink tracking-tight font-display">
              AI Foliar Pathology & Vision Diagnostics
            </h1>
            <p className="text-xs sm:text-sm text-ag-ink-secondary max-w-2xl">
              High-sunlight foliar diagnostic workbench. Ingest plant leaf photos via camera or file upload to generate instant cellular pathology classifications, dual-coded risk severity, and actionable agronomic advisories.
            </p>
          </div>

          {/* Quick-Test Clinical Specimen Pills (4 Target Staples) */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-ag-ink-secondary block">
              Quick Test Clinical Specimens:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {CLINICAL_SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 hover:border-ag-brand text-ag-ink flex items-center gap-1.5 ag-interactive shadow-xs cursor-pointer"
                  title={`Test ${preset.label} (${preset.severityTier})`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.crop}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Focused 2-Column Responsive Workbench (SPEC-UI-006 §2.1: 5 Cols Left / 7 Cols Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Image Ingestion, Dropzone & Sampling Guide (Cols 1-5, ~42% width) */}
          <div className="lg:col-span-5 space-y-5">
            <LeafImageDropzone
              selectedImageUrl={selectedImageUrl}
              uiState={uiState}
              errorMessage={errorMessage}
              fileMetadata={fileMetadata}
              onImageSelected={handleImageSelected}
              onRetake={handleReset}
              onAbortScan={handleAbortScan}
            />

            <SamplingBestPracticesCard />
          </div>

          {/* Right Column: Diagnostic Verdict & Agronomic Advisory Card (Cols 6-12, ~58% width) */}
          <div className="lg:col-span-7">
            {uiState === 'INFERENCING' ? (
              <VerdictSkeletonLoader />
            ) : verdict ? (
              <DiagnosticVerdictCard
                verdict={verdict}
                onNewScan={handleReset}
                onRetake={handleReset}
              />
            ) : (
              /* IDLE / EMPTY STATE CONTAINER (SPEC-UI-006 §5 State 1) */
              <div className="bg-ag-surface border border-ag-border rounded-xl p-8 sm:p-12 shadow-xs text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-ag-surface-muted border border-slate-200 text-slate-400 mx-auto flex items-center justify-center text-2xl shadow-inner">
                  🔬
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-ag-ink">Diagnostic Engine Ready</h3>
                  <p className="text-xs sm:text-sm text-ag-ink-secondary leading-relaxed">
                    Select or photograph a single plant leaf from Tomato, Potato, Corn, or Apple to run deep learning foliar diagnostics and view treatment recommendations.
                  </p>
                </div>

                <div className="pt-3 max-w-sm mx-auto grid grid-cols-2 gap-3 text-left">
                  <div className="p-3 rounded-lg bg-ag-surface-muted border border-ag-border space-y-1">
                    <span className="text-xs font-semibold text-ag-ink flex items-center gap-1.5">
                      <span>⚡</span> Sub-85ms
                    </span>
                    <p className="text-[11px] text-ag-ink-secondary">Real-time CPU ONNX inference</p>
                  </div>
                  <div className="p-3 rounded-lg bg-ag-surface-muted border border-ag-border space-y-1">
                    <span className="text-xs font-semibold text-ag-ink flex items-center gap-1.5">
                      <span>🛡️</span> Dual Coded
                    </span>
                    <p className="text-[11px] text-ag-ink-secondary">4-Tier Agronomic Severity Ramp</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer System Status Bar */}
      <footer className="max-w-7xl mx-auto w-full pt-10 pb-4 text-xs text-ag-ink-tertiary flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-ag-border mt-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Precision Ag-Intelligence v1.0.0-PROD</span>
          <span className="text-slate-300">|</span>
          <span>WCAG AAA Outdoor Hardened</span>
        </div>
        <p>FAO-56 Biological Mathematics & Foliar Computer Vision Platform</p>
      </footer>
    </div>
  );
};
