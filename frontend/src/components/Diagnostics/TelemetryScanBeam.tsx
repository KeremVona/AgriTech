import React, { useEffect, useState } from 'react';

interface TelemetryScanBeamProps {
  onAbort?: () => void;
  startTime?: number;
}

export const TelemetryScanBeam: React.FC<TelemetryScanBeamProps> = ({ onAbort, startTime }) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    const start = startTime || performance.now();
    // Throttle to 60ms (~16fps) to prevent aggressive React re-render thrashing
    const interval = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 60);

    return () => clearInterval(interval);
  }, [startTime]);

  // Format as SPEC-UI-006 §3.2: "Timer: 00:00:48 ms"
  const totalSecs = Math.floor(elapsedMs / 1000);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  const remainderMs = String(elapsedMs % 1000).padStart(3, '0').slice(0, 2);
  const formattedTimer = `${mins}:${secs}:${remainderMs} ms`;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 pointer-events-none bg-slate-950/20 backdrop-brightness-95">
      {/* Animated Telemetry Scanning Laser Beam */}
      <div className="ag-telemetry-scan-beam" aria-hidden="true" />

      {/* Top Telemetry HUD Badge */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-300 shadow-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide uppercase">ONNX Neural Scan</span>
        </div>

        {/* Tabular Milliseconds Counter adhering to SPEC-UI-006 §3.2 */}
        <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs text-slate-200 ag-tabular-numeric shadow-md">
          <span className="text-slate-400 mr-1.5">Timer:</span>
          <span className="font-bold text-cyan-400">{formattedTimer}</span>
        </div>
      </div>

      {/* Bottom Control Bar with Assistive Technology Live Region */}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-900/95 border border-slate-700/80 pointer-events-auto shadow-lg"
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-cyan-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs text-slate-200 font-medium">
            Extracting foliar pathology cellular features on CPU runtime...
          </span>
        </div>

        {onAbort && (
          <button
            type="button"
            onClick={onAbort}
            className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 ag-interactive cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>✕</span>
            <span>Cancel Scan</span>
          </button>
        )}
      </div>
    </div>
  );
};
