import { useCallback } from 'react';
import L from 'leaflet';
import type { DrawingMode, DrawingState, ParcelMetrics } from '../../types/farmMapDrawing.ts';
import { formatDrawingHudMetrics, getDrawingHudMicrocopy } from '../../utils/drawingHudPolicy.ts';

export interface DrawingLiveAreaBadgeProps {
  state: DrawingState;
  activeMode?: DrawingMode;
  mode?: DrawingMode;
  metrics: ParcelMetrics | null;
  hasKinks?: boolean;
  onCancel?: () => void;
}

export function DrawingLiveAreaBadge({
  state,
  activeMode,
  mode,
  metrics,
  hasKinks = false,
  onCancel,
}: DrawingLiveAreaBadgeProps): React.JSX.Element | null {
  const currentMode = activeMode ?? mode ?? 'idle';
  const isKink = hasKinks || state === 'DRAWING_INVALID_KINK';

  // Leaflet DOM isolation: stop click and scroll propagation whenever DOM node mounts
  const handleContainerRef = useCallback((el: HTMLElement | null) => {
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  }, []);

  // Hidden when map is idle and not active in any drawing/editing mode
  if (!isKink && state === 'IDLE_MAP' && currentMode === 'idle') {
    return null;
  }

  const { prompt } = getDrawingHudMicrocopy(state, currentMode);

  return (
    <aside
      ref={handleContainerRef}
      className={`ag-drawing-hud absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto transition-all duration-200 select-none ${
        isKink
          ? 'ag-map-control-card border-red-300 bg-red-50/95 ring-1 ring-red-400/40 text-red-900 shadow-lg px-4 py-2.5 rounded-lg flex items-center gap-3'
          : 'ag-map-control-card border-slate-200/80 bg-white/95 backdrop-blur-md shadow-lg px-4 py-2 rounded-lg flex items-center gap-3 text-slate-800'
      }`}
      role={isKink ? 'alert' : 'status'}
      aria-live={isKink ? 'assertive' : 'polite'}
    >
      {isKink ? (
        <>
          {/* Warning / Exclamation Icon */}
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="#DC2626"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 text-red-600"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <div className="flex flex-col">
            <span className="font-semibold text-xs tracking-tight text-red-900">
              Self-intersecting polygon. Uncross boundary lines to complete parcel.
            </span>
            {metrics && metrics.vertexCount > 0 && (
              <span className="text-[11px] text-red-700/80 font-mono tabular-nums">
                {metrics.vertexCount} Vertices recorded
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col min-w-0">
          {/* Metrics display in tabular numerals */}
          <div className="font-mono font-semibold text-xs text-slate-800 tabular-nums tracking-tight">
            {metrics ? formatDrawingHudMetrics(metrics) : '0.00 ha (0.00 acres) • 0 Vertices • Perimeter: 0m'}
          </div>
          {/* Microcopy action instruction */}
          {prompt && (
            <div className="text-[11px] text-slate-500 font-sans tracking-tight">
              {prompt}
            </div>
          )}
        </div>
      )}

      {/* Subtle Cancel / Escape Affordance */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={`ml-2 text-xs px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 ${
            isKink
              ? 'border border-red-300 bg-red-100/70 text-red-800 hover:bg-red-200/80'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
          title="Cancel drawing (Esc)"
          aria-label="Cancel drawing"
        >
          <kbd className="font-mono text-[10px] opacity-75 uppercase tracking-wider">[ESC]</kbd>
          <span>Cancel</span>
        </button>
      )}
    </aside>
  );
}
