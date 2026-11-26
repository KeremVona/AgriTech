import React, { useState, useRef, useEffect } from "react";
import type {
  DiagnosticPrediction,
  DiagnosticUIState,
  ClinicalSamplePreset,
} from "../types/diagnostics";
import {
  LeafImageDropzone,
  PhotoTips,
  DiagnosticVerdictCard,
  VerdictSkeletonLoader,
  SamplePicker,
  StepStrip,
} from "../components/Diagnostics";
import { AppHeader } from "../components/ui/AppHeader";
import { validateLeafImage } from "../utils/imageValidation";
import {
  classifyLeafImage,
  CLINICAL_SAMPLE_PRESETS,
  presetToPrediction,
} from "../services/diagnosticsService";

export const LeafDiagnosticsPage: React.FC = () => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uiState, setUiState] = useState<DiagnosticUIState>("IDLE");
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

  // Clean up object URLs when selectedImageUrl changes or on unmount
  useEffect(() => {
    return () => {
      if (selectedImageUrl && selectedImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(selectedImageUrl);
      }
    };
  }, [selectedImageUrl]);

  // Abort any active in-flight inference fetch strictly on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (selectedImageUrl && selectedImageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    setSelectedImageUrl(null);
    setVerdict(null);
    setErrorMessage(null);
    setFileMetadata(null);
    setUiState("IDLE");
    activeFileRef.current = null;
  };

  const handleImageSelected = async (file: File) => {
    setErrorMessage(null);
    setVerdict(null);

    // 1. Instant preview URL & validating state
    if (selectedImageUrl && selectedImageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(selectedImageUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedImageUrl(previewUrl);
    activeFileRef.current = file;
    setUiState("VALIDATING");

    // 2. Client-Side Pre-Flight Validation
    const validation = await validateLeafImage(file);
    if (!validation.valid) {
      setErrorMessage(
        validation.error ||
          "Invalid leaf image. Please check format and dimensions.",
      );
      setUiState("REJECTED");
      return;
    }

    setFileMetadata({
      name: file.name,
      sizeMb:
        validation.fileSizeMb || Number((file.size / (1024 * 1024)).toFixed(2)),
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

    setUiState("INFERENCING");
    setErrorMessage(null);

    // A run that was cancelled or replaced (Retake, Abort, sample preset) must not touch the page.
    const isCurrentRun = () => abortControllerRef.current === controller;

    try {
      const prediction = await classifyLeafImage(file, controller.signal);
      if (!isCurrentRun()) return;
      setVerdict(prediction);
      if (prediction.requiresRescan) {
        setUiState("LOW_CONFIDENCE");
      } else {
        setUiState("SUCCESS");
      }
    } catch (err: unknown) {
      if (!isCurrentRun()) return;
      const error = err as Error;
      if (error?.name === "AbortError" || controller.signal.aborted) {
        setUiState("IDLE");
        return;
      }
      setErrorMessage(
        error.message || "Vision service error occurred during classification.",
      );
      setUiState("ERROR");
    } finally {
      if (isCurrentRun()) abortControllerRef.current = null;
    }
  };

  const handleAbortScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUiState("IDLE");
  };

  const handleRetryScan = () => {
    if (activeFileRef.current) {
      runInference(activeFileRef.current);
    }
  };

  const handleSelectPreset = (preset: ClinicalSamplePreset) => {
    handleReset();
    const prediction = presetToPrediction(preset);
    setVerdict(prediction);
    setUiState(preset.severityTier === "Tier 1" ? "LOW_CONFIDENCE" : "SUCCESS");
    if (preset.sampleImageUrl) {
      setSelectedImageUrl(preset.sampleImageUrl);
    }
    setFileMetadata({
      name: `${preset.id}.webp`,
      sizeMb: 0.12,
      width: 1024,
      height: 1024,
    });
  };

  const isBusy = uiState === "VALIDATING" || uiState === "INFERENCING";
  const activeStep = verdict ? 2 : selectedImageUrl ? 1 : 0;

  return (
    <div className="ui-page min-h-screen antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ui-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppHeader />

      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="text-center">
          <h1 className="text-[36px] font-medium leading-[1.08] tracking-[-0.025em] text-ui-ink sm:text-5xl">
            Scan a leaf
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-balance text-[17px] leading-relaxed text-ui-ink-2">
            Upload a photo of one leaf. Get a likely diagnosis and what to do today.
          </p>
        </div>

        <div className="mt-8">
          <StepStrip active={activeStep} />
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <LeafImageDropzone
              selectedImageUrl={selectedImageUrl}
              uiState={uiState}
              errorMessage={errorMessage}
              fileMetadata={fileMetadata}
              onImageSelected={handleImageSelected}
              onRetake={handleReset}
              onAbortScan={handleAbortScan}
              onRetry={handleRetryScan}
            />
            {!verdict && <PhotoTips />}
          </div>

          <div>
            {uiState === "INFERENCING" ? (
              <VerdictSkeletonLoader />
            ) : verdict ? (
              <DiagnosticVerdictCard
                verdict={verdict}
                onNewScan={handleReset}
                onRetake={handleReset}
              />
            ) : (
              <SamplePicker
                presets={CLINICAL_SAMPLE_PRESETS}
                disabled={isBusy}
                onSelect={handleSelectPreset}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
