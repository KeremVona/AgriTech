import React from 'react';
import { BUTTON } from '../Diagnostics/styles.ts';

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
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="toolbar"
      aria-label="Field Exports and Reporting"
    >
      <button
        type="button"
        onClick={onStartRecording}
        disabled={isRecording}
        className={`${BUTTON.dark} relative overflow-hidden disabled:cursor-wait`}
        title="Record the timeline as a short video"
      >
        {isRecording ? (
          <span>
            Recording <span className="tabular-nums">{recordingProgress}%</span>
          </span>
        ) : (
          <span>Save video</span>
        )}
        {isRecording && (
          <span
            className="absolute bottom-0 left-0 h-1 bg-white/80 transition-all duration-100"
            style={{ width: `${recordingProgress}%` }}
          />
        )}
      </button>

      <button
        type="button"
        onClick={onOpenReportModal}
        disabled={isRecording}
        className={BUTTON.outline}
        title="Generate printable agronomic field advisory PDF report"
      >
        Report
      </button>

      <button
        type="button"
        onClick={onSnapImage}
        disabled={isRecording}
        className={BUTTON.outline}
        title="Capture high-resolution PNG snapshot of current leaf viewport"
      >
        Save image
      </button>
    </div>
  );
};
