import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagnosticUIState } from '../../types/diagnostics';
import { CameraIcon, LeafIcon, RetryIcon, UploadIcon } from './icons.tsx';
import { BUTTON } from './styles.ts';

export interface LeafImageDropzoneProps {
  selectedImageUrl: string | null;
  uiState: DiagnosticUIState;
  errorMessage?: string | null;
  fileMetadata?: { name: string; sizeMb: number; width?: number; height?: number } | null;
  onImageSelected: (file: File) => void;
  onRetake: () => void;
  onAbortScan?: () => void;
  onRetry?: () => void;
  className?: string;
}

/** Calm overlay shown on the photo while the model runs. */
function ScanOverlay({ label, onAbort }: { label: string; onAbort?: () => void }) {
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/75 backdrop-blur-[2px]">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-ui-accent border-t-transparent" aria-hidden="true" />
      <span className="text-[15px] font-medium text-ui-ink">{label}</span>
      {onAbort && (
        <button type="button" onClick={onAbort} className={BUTTON.outline}>
          Cancel
        </button>
      )}
    </div>
  );
}

export const LeafImageDropzone: React.FC<LeafImageDropzoneProps> = ({
  selectedImageUrl,
  uiState,
  errorMessage,
  fileMetadata,
  onImageSelected,
  onRetake,
  onAbortScan,
  onRetry,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const isInferencing = uiState === 'INFERENCING';
  const isValidating = uiState === 'VALIDATING';
  const isRejected = uiState === 'REJECTED' || uiState === 'ERROR';
  const isLocked = isInferencing || isValidating;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const hasPhoto = Boolean(selectedImageUrl);

  // The upload buttons unmount when a photo appears: move focus to the photo so keyboard users are not dropped on <body>.
  useEffect(() => {
    if (hasPhoto && document.activeElement === document.body) previewRef.current?.focus();
  }, [hasPhoto]);

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
      if (isLocked) return;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) onImageSelected(files[0]);
    },
    [onImageSelected, isLocked],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageSelected(files[0]);
      // Reset so picking the same file again still fires change.
      e.target.value = '';
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileInputChange}
        className="sr-only"
        id="desktop-leaf-upload"
        tabIndex={-1}
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
        tabIndex={-1}
        aria-label="Take leaf photo with camera"
      />

      {!selectedImageUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="region"
          aria-label="Leaf photo drop area"
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-200 sm:py-16 ${
            isDragOver
              ? 'border-ui-accent bg-ui-accent-soft'
              : isRejected
                ? 'border-red-300 bg-red-50/50'
                : 'border-ui-line bg-ui-warm'
          }`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-ui-line bg-ui-bg text-ui-accent transition-transform duration-150 ${
              isDragOver ? 'scale-110' : ''
            }`}
          >
            <LeafIcon className="h-8 w-8" />
          </span>
          <p className="mt-5 text-lg font-medium text-ui-ink">{isDragOver ? 'Drop to scan' : 'Drop a leaf photo here'}</p>
          <p className="mt-1 text-sm text-ui-ink-3">JPEG or PNG, up to 10 MB</p>

          <div className="mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isLocked} className={BUTTON.dark}>
              <CameraIcon className="h-[18px] w-[18px]" />
              Take photo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLocked} className={BUTTON.outline}>
              <UploadIcon className="h-[18px] w-[18px]" />
              Choose file
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            ref={previewRef}
            tabIndex={-1}
            className="relative flex aspect-square w-full items-center outline-none justify-center overflow-hidden rounded-2xl border border-ui-line bg-ui-warm">
            <img src={selectedImageUrl} alt="Leaf photo being diagnosed" className="h-full w-full object-contain" />
            {isInferencing && <ScanOverlay label="Reading the leaf…" onAbort={onAbortScan} />}
            {isValidating && <ScanOverlay label="Checking the photo…" />}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {fileMetadata ? (
              <p className="min-w-0 truncate text-sm text-ui-ink-3" title={fileMetadata.name}>
                <span className="text-ui-ink-2">{fileMetadata.name}</span> · {fileMetadata.sizeMb} MB
              </p>
            ) : (
              <span />
            )}
            <button type="button" onClick={onRetake} disabled={isLocked} className={BUTTON.light}>
              <RetryIcon className="h-4 w-4" />
              Use another photo
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-800">{uiState === 'ERROR' ? 'The diagnosis service did not answer' : 'This photo can’t be used'}</p>
          <p className="mt-1 leading-relaxed text-red-700">{errorMessage}</p>
          {uiState === 'ERROR' && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700"
            >
              <RetryIcon className="h-4 w-4" />
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
};
