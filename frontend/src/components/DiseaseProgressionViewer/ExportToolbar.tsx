/**
 * ExportToolbar (SPEC-UI-007, Section 4.9).
 * Precision Ag-Intelligence light-mode toolbar for:
 * - 60 FPS WebM automated timeline sweep video recording
 * - Printable Agronomic Field Advisory PDF generation
 * - Foliar canvas PNG viewport snapshot
 */

import React from 'react';

export interface ExportToolbarProps {
  isRecording: boolean;
  recordingProgress: number; // 0 to 100
  onStartRecording: () => void;
  onOpenReportModal: () => void;
  onSnapImage: () => void;
  className?: string;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  isRecording,
  recordingProgress,
  onStartRecording,
  onOpenReportModal,
  onSnapImage,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs ${className}`}
      role="toolbar"
      aria-label="Field Exports and Reporting"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>📤</span>
          <span>Field Exports & Media:</span>
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline">
          60 FPS WebM • PDF Print • PNG
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* 1. Timelapse Recording Button */}
        <button
          type="button"
          onClick={onStartRecording}
          disabled={isRecording}
          className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
            isRecording
              ? 'bg-rose-50 border-rose-300 text-rose-800 cursor-wait'
              : 'bg-teal-700 hover:bg-teal-800 text-white border-teal-800 shadow-xs'
          }`}
          title="Record automated 60 FPS timeline sweep video"
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>Recording <span className="font-mono tabular-nums">{recordingProgress}%</span></span>
            </>
          ) : (
            <>
              <span>🎬</span>
              <span>Timelapse Video</span>
            </>
          )}

          {/* Inline progress bar background when recording */}
          {isRecording && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-rose-600 rounded-b-xl transition-all duration-100"
              style={{ width: `${recordingProgress}%` }}
            />
          )}
        </button>

        {/* 2. PDF Advisory Report Modal Trigger */}
        <button
          type="button"
          onClick={onOpenReportModal}
          disabled={isRecording}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          title="Generate printable agronomic field advisory PDF report"
        >
          <span>📄</span>
          <span>PDF Advisory</span>
        </button>

        {/* 3. Snapshot Image Button */}
        <button
          type="button"
          onClick={onSnapImage}
          disabled={isRecording}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          title="Capture high-resolution PNG snapshot of current leaf viewport"
        >
          <span>📷</span>
          <span>Snap PNG</span>
        </button>
      </div>
    </div>
  );
};
