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

      {/* Main Container Card */}
      <div className="bg-ag-surface border border-ag-border rounded-lg p-5 shadow-xs relative overflow-hidden transition-all duration-200">
        {!selectedImageUrl ? (
          /* IDLE / DRAG-OVER DROPZONE */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Drop or upload a leaf photo"
            className={`flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 text-center select-none ${
              isDragOver
                ? 'border-ag-brand bg-ag-brand-subtle/80 scale-[1.01]'
                : isRejected
                ? 'border-red-300 bg-red-50/40 hover:border-red-400'
                : 'border-slate-300 hover:border-ag-brand hover:bg-ag-brand-subtle/40 bg-white'
            }`}
          >
            {/* Foliar Icon with Scale Transition */}
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-transform duration-200 ${
                isDragOver ? 'scale-110 bg-teal-100 text-ag-brand' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 3c-4.97 0-9 4.03-9 9 0 3.92 2.51 7.24 6.04 8.47.51.09.7-.22.7-.49v-1.74c-2.48.54-3-1.2-3-1.2-.41-1.04-1-1.32-1-1.32-.81-.55.06-.54.06-.54.9.06 1.37.92 1.37.92.8 1.36 2.09.97 2.6.74.08-.58.31-.97.57-1.19-1.98-.22-4.06-.99-4.06-4.4 0-.97.35-1.77.92-2.39-.09-.23-.4-1.13.09-2.36 0 0 .75-.24 2.45.91A8.54 8.54 0 0112 6.8c.77.004 1.54.1 2.27.3 1.7-1.15 2.45-.91 2.45-.91.49 1.23.18 2.13.09 2.36.57.62.92 1.42.92 2.39 0 3.42-2.09 4.18-4.08 4.4.32.28.61.82.61 1.66v2.46c0 .27.19.59.71.49A9.006 9.006 0 0021 12c0-4.97-4.03-9-9-9z"
                />
              </svg>
            </div>

            <p className="text-sm font-semibold text-ag-ink">
              {isDragOver ? 'Release to Scan Leaf' : 'Upload or Drag Leaf Photo'}
            </p>
            <p className="text-xs text-ag-ink-secondary mt-1">Supports JPEG or PNG format up to 10MB</p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-ag-brand hover:bg-ag-brand-hover text-white text-xs font-semibold shadow-xs ag-interactive">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Choose Photo
              </span>

              {/* Native Mobile Camera Trigger Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-ag-ink text-xs font-semibold shadow-xs ag-interactive"
              >
                <svg className="w-4 h-4 text-ag-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Open Camera
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE PREVIEW & SCANNING VIEWPORT */
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-ag-border bg-slate-950 flex items-center justify-center">
              <img
                src={selectedImageUrl}
                alt="Foliar Specimen Preview"
                className="w-full h-full object-contain"
              />

              {/* In-Flight Scanning Telemetry Laser Beam */}
              {isInferencing && <TelemetryScanBeam onAbort={onAbortScan} />}

              {/* In-Memory Validating Spinner */}
              {isValidating && (
                <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center gap-2.5 z-30">
                  <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-white">Validating image resolution...</span>
                </div>
              )}
            </div>

            {/* File Metadata Chip */}
            {fileMetadata && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-ag-surface-muted border border-ag-border text-xs text-ag-ink-secondary ag-tabular-numeric">
                <span className="font-medium text-ag-ink truncate max-w-[200px]" title={fileMetadata.name}>
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

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isInferencing}
                className="flex-1 py-2 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-ag-ink text-xs font-medium ag-interactive disabled:opacity-50 cursor-pointer shadow-xs text-center"
              >
                Upload New Photo
              </button>

              <button
                type="button"
                onClick={onRetake}
                disabled={isInferencing}
                className="flex-1 py-2 px-3 rounded-md bg-ag-brand hover:bg-ag-brand-hover text-white text-xs font-semibold ag-interactive disabled:opacity-50 cursor-pointer shadow-xs text-center"
              >
                Retake Scan
              </button>
            </div>
          </div>
        )}

        {/* Client Validation Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
          >
            <span className="text-base shrink-0 leading-none">⚠️</span>
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
