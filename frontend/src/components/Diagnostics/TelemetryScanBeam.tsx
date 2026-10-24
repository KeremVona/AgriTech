import React, { useEffect, useState } from 'react';

interface TelemetryScanBeamProps {
  onAbort?: () => void;
  startTime?: number;
}

export const TelemetryScanBeam: React.FC<TelemetryScanBeamProps> = ({ onAbort, startTime }) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    const start = startTime || performance.now();
    const interval = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 16); // 60fps tick

    return () => clearInterval(interval);
  }, [startTime]);

  const formattedTime = (elapsedMs / 1000).toFixed(2);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 pointer-events-none bg-slate-950/20 backdrop-brightness-95">
      {/* Animated Telemetry Scanning Beam */}
      <div className="ag-telemetry-scan-beam" aria-hidden="true" />

      {/* Top Telemetry HUD Badge */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-300 shadow-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-semibold tracking-wide uppercase">ONNX Neural Scan</span>
        </div>

        {/* Tabular Milliseconds Counter */}
        <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-xs text-slate-200 ag-tabular-numeric shadow-md">
          <span className="text-slate-400 mr-1.5">Timer:</span>
          <span className="font-bold text-cyan-400">{formattedTime}s</span>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/95 border border-slate-700/80 pointer-events-auto shadow-lg">
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-cyan-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs text-slate-200 font-medium">
            Extracting foliar pathology features on CPU runtime...
          </span>
        </div>

        {onAbort && (
          <button
            type="button"
            onClick={onAbort}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 ag-interactive cursor-pointer shadow-xs"
          >
            Cancel Scan
          </button>
        )}
      </div>
    </div>
  );
};
