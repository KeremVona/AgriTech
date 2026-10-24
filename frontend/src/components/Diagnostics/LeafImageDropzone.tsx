import React, { useState, useRef, useCallback } from 'react';
import type { DiagnosticUIState } from '../../types/diagnostics';
import { TelemetryScanBeam } from './TelemetryScanBeam';

export interface LeafImageDropzoneProps {
  selectedImageUrl: string | null;
  uiState: DiagnosticUIState;
  errorMessage?: string | null;
  fileMetadata?: { name: string; sizeMb: number; width?: number; height?: number } | null;
  onImageSelected: (file: File) => void;
  onRetake: () => void;
  onAbortScan?: () => void;
  className?: string;
}

export const LeafImageDropzone: React.FC<LeafImageDropzoneProps> = ({
  selectedImageUrl,
  uiState,
  errorMessage,
  fileMetadata,
  onImageSelected,
  onRetake,
  onAbortScan,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const isInferencing = uiState === 'INFERENCING';
  const isValidating = uiState === 'VALIDATING';
  const isRejected = uiState === 'REJECTED' || uiState === 'ERROR';
  const isActionsLocked = isInferencing || isValidating;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onImageSelected(files[0]);
      }
    },
    [onImageSelected]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageSelected(files[0]);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden Native File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileInputChange}
        className="sr-only"
        id="desktop-leaf-upload"
        aria-label="Upload leaf photo"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={handleFileInputChange}
        className="sr-only"
        id="mobile-camera-capture"
        aria-label="Capture leaf photo with device camera"
      />

      {/* Main Container Card (SPEC-UI-006: 12px rounded-xl) */}
      <div className="bg-ag-surface border border-ag-border rounded-xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all duration-200">
        {!selectedImageUrl ? (
          /* IDLE / DRAG-OVER DROPZONE CONTAINER (role="region" avoids W3C nested interactive violation) */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label="Leaf photo ingestion dropzone"
            className={`flex flex-col items-center justify-center p-6 sm:p-10 border-2 border-dashed rounded-xl transition-all duration-200 text-center select-none ${
              isDragOver
                ? 'border-ag-brand bg-ag-brand-subtle/80'
                : isRejected
                ? 'border-red-300 bg-red-50/40'
                : 'border-slate-300 bg-white'
            }`}
          >
            {/* Authentic Foliar Botanical Leaf SVG Icon with 1.08x scale transition (SPEC-UI-006 §3.1) */}
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform duration-150 ease-out ${
                isDragOver ? 'scale-[1.08] bg-teal-100 text-ag-brand' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
                />
              </svg>
            </div>

            <p className="text-base font-semibold text-ag-ink">
              {isDragOver ? 'Release Leaf Photo to Scan' : 'Upload or Drag Leaf Photo'}
            </p>
            <p className="text-xs text-ag-ink-secondary mt-1 max-w-xs">
              Supports JPEG or PNG format up to 10MB (min 224×224 px)
            </p>

            {/* Interactive Action Triggers with Mandatory 48px+ / 52px Touch Targets (SPEC-DES-005 §2.1) */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
              {/* Primary Mobile Camera CTA (Full-width on mobile viewports per SPEC-UI-006 §3.1) */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isActionsLocked}
                className="w-full sm:w-auto min-h-[52px] sm:min-h-[48px] px-6 py-3 rounded-lg bg-ag-brand hover:bg-ag-brand-hover text-white text-sm font-semibold shadow-xs ag-interactive flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Take Leaf Photo</span>
              </button>

              {/* Desktop File Picker Trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isActionsLocked}
                className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-ag-ink text-sm font-medium shadow-xs ag-interactive flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Choose File</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE PREVIEW & SCANNING VIEWPORT */
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-ag-border bg-slate-950 flex items-center justify-center shadow-inner">
              <img
                src={selectedImageUrl}
                alt="Foliar Specimen Preview"
                className="w-full h-full object-contain"
              />

              {/* In-Flight Scanning Telemetry Laser Beam Overlay */}
              {isInferencing && <TelemetryScanBeam onAbort={onAbortScan} />}

              {/* In-Memory Validating Spinner State */}
              {isValidating && (
                <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-3 z-30" role="status">
                  <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-white tracking-wide">Validating image resolution & format...</span>
                </div>
              )}
            </div>

            {/* File Metadata Chip (Tabular Numerals) */}
            {fileMetadata && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-ag-surface-muted border border-ag-border text-xs text-ag-ink-secondary ag-tabular-numeric">
                <span className="font-semibold text-ag-ink truncate max-w-[200px]" title={fileMetadata.name}>
                  {fileMetadata.name}
                </span>
                <div className="flex items-center gap-3">
                  <span>{fileMetadata.sizeMb} MB</span>
                  {fileMetadata.width && fileMetadata.height && (
                    <span>
                      {fileMetadata.width}×{fileMetadata.height} px
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons (Minimum 48px Touch Targets) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isActionsLocked}
                className="w-full sm:flex-1 min-h-[48px] py-3 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-ag-ink text-xs font-semibold ag-interactive disabled:opacity-50 cursor-pointer shadow-xs text-center flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Upload New Photo</span>
              </button>

              <button
                type="button"
                onClick={onRetake}
                disabled={isActionsLocked}
                className="w-full sm:flex-1 min-h-[48px] py-3 px-4 rounded-lg bg-ag-brand hover:bg-ag-brand-hover text-white text-xs font-semibold ag-interactive disabled:opacity-50 cursor-pointer shadow-xs text-center flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Retake Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* Client Validation Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
          >
            <span className="text-base shrink-0 leading-none" aria-hidden="true">⚠️</span>
            <div className="space-y-0.5">
              <p className="font-semibold text-red-950">Pre-flight Validation Notice</p>
              <p className="text-red-800 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
