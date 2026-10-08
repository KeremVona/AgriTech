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
      className={`bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
          <span>📤</span>
          <span>Field Exports & Media:</span>
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 hidden sm:inline">
          60 FPS WebM • PDF Print • PNG
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* 1. Timelapse Recording Button */}
        <button
          type="button"
          onClick={onStartRecording}
          disabled={isRecording}
          className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer shadow-sm ${
            isRecording
              ? 'bg-rose-950/60 border-rose-600/60 text-rose-300 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:shadow-emerald-950/40'
          }`}
          title="Record automated 60 FPS timeline sweep video"
        >
          {isRecording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
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
              className="absolute bottom-0 left-0 h-1 bg-rose-500 rounded-b-xl transition-all duration-100"
              style={{ width: `${recordingProgress}%` }}
            />
          )}
        </button>

        {/* 2. PDF Advisory Report Modal Trigger */}
        <button
          type="button"
          onClick={onOpenReportModal}
          disabled={isRecording}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer flex items-center gap-1.5 shadow-sm"
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
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 hover:border-slate-600 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer flex items-center gap-1.5"
          title="Save instantaneous high-resolution PNG snapshot"
        >
          <span>📸</span>
          <span className="hidden md:inline">Snap PNG</span>
        </button>
      </div>
    </div>
  );
};
