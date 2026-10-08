import React, { useEffect, useCallback } from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel';
import type { CropId } from '../../types/progression';
import { DiagnosticUploadCard } from '../../components/DiagnosticScan';

export interface DiagnosticScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProgression: (cropId: SupportedCropId, sliderPercentage: number) => void;
}

export const DiagnosticScanModal: React.FC<DiagnosticScanModalProps> = ({
  isOpen,
  onClose,
  onViewProgression,
}) => {
  // Close on Escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling while modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleScanComplete = (cropId: CropId, sliderPercentage: number) => {
    onViewProgression(cropId as SupportedCropId, sliderPercentage);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 transition-transform duration-150 ease-out transform scale-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/95 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm shadow-inner">
              📷
            </div>
            <div>
              <h2
                id="scanner-modal-title"
                className="text-base font-bold text-white tracking-tight flex items-center gap-2"
              >
                AI Leaf Diagnostic Scanner
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                  MobileNetV3 Core
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Classify leaf pathology and project calibrated infection timeline
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-all cursor-pointer active:scale-[0.97]"
            aria-label="Close diagnostic scanner"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Diagnostic Upload Card */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <DiagnosticUploadCard onViewProgression={handleScanComplete} />
        </div>
      </div>
    </div>
  );
};
