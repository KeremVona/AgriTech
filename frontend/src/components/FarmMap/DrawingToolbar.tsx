import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { DrawingMode } from '../../types/farmMapDrawing.ts';
import { toggleDrawingMode, cancelDrawingMode } from '../../utils/drawingState.ts';

export interface DrawingToolbarProps {
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  onCancel?: () => void;
}

export function DrawingToolbar({
  activeMode,
  onModeChange,
  onCancel,
}: DrawingToolbarProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  // Stop Leaflet event and scroll propagation so clicking/scrolling over toolbar controls never triggers map zooming, panning, or layer clicks
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // Keyboard accessibility: Escape key cancels active drawing/editing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeMode !== 'idle') {
        event.preventDefault();
        onCancel?.();
        onModeChange(cancelDrawingMode());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, onCancel, onModeChange]);

  const handleToolClick = (targetMode: DrawingMode) => {
    const nextMode = toggleDrawingMode(activeMode, targetMode);
    if (nextMode === 'idle') {
      onCancel?.();
    }
    onModeChange(nextMode);
  };

  const handleCancelClick = () => {
    onCancel?.();
    onModeChange(cancelDrawingMode());
  };

  return (
    <div
      ref={rootRef}
      className="ag-drawing-toolbar ag-map-control-card absolute top-4 left-4 z-[1000] p-1 flex items-center gap-1"
      role="toolbar"
      aria-label="Parcel drawing and editing tools"
    >
      {/* 1. Draw Polygon */}
      <button
        type="button"
        className={`ag-drawing-tool-btn min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-all ${
          activeMode === 'draw'
            ? 'bg-teal-50 border border-teal-600 text-teal-800'
            : 'text-slate-700 hover:bg-slate-100 active:scale-[0.95]'
        }`}
        data-active={activeMode === 'draw'}
        aria-pressed={activeMode === 'draw'}
        aria-label="Draw Polygon"
        title="Draw Polygon (Click map to place boundary vertices)"
        onClick={() => handleToolClick('draw')}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Vector Polygon Boundary Outline */}
          <polygon points="12 3 20 8 18 19 6 19 4 8" strokeDasharray="2.5 2" />
          <circle cx="12" cy="3" r="1.8" fill="currentColor" />
          <circle cx="20" cy="8" r="1.8" fill="currentColor" />
          <circle cx="18" cy="19" r="1.8" fill="currentColor" />
          <circle cx="6" cy="19" r="1.8" fill="currentColor" />
          <circle cx="4" cy="8" r="1.8" fill="currentColor" />
          {/* Pen Nib Tip */}
          <path d="M12 12l2.5-2.5m-1 3.5l1.5-1.5" />
        </svg>
      </button>

      {/* 2. Edit Vertices */}
      <button
        type="button"
        className={`ag-drawing-tool-btn min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-all ${
          activeMode === 'edit'
            ? 'bg-teal-50 border border-teal-600 text-teal-800'
            : 'text-slate-700 hover:bg-slate-100 active:scale-[0.95]'
        }`}
        data-active={activeMode === 'edit'}
        aria-pressed={activeMode === 'edit'}
        aria-label="Edit Vertices"
        title="Edit Vertices (Drag vertex nodes to reshape parcel)"
        onClick={() => handleToolClick('edit')}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4l6.5 15.5 2.5-6 6-2.5L4 4z" />
          <circle cx="19" cy="5" r="2" fill="currentColor" />
          <circle cx="5" cy="19" r="2" fill="currentColor" />
        </svg>
      </button>

      {/* 3. Drag Parcel */}
      <button
        type="button"
        className={`ag-drawing-tool-btn min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-all ${
          activeMode === 'drag'
            ? 'bg-teal-50 border border-teal-600 text-teal-800'
            : 'text-slate-700 hover:bg-slate-100 active:scale-[0.95]'
        }`}
        data-active={activeMode === 'drag'}
        aria-pressed={activeMode === 'drag'}
        aria-label="Drag Parcel"
        title="Drag Parcel (Translate entire parcel across map)"
        onClick={() => handleToolClick('drag')}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="5 9 2 12 5 15" />
          <polyline points="9 5 12 2 15 5" />
          <polyline points="15 19 12 22 9 19" />
          <polyline points="19 9 22 12 19 15" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="12" y1="2" x2="12" y2="22" />
        </svg>
      </button>

      {/* 4. Delete Parcel */}
      <button
        type="button"
        className={`ag-drawing-tool-btn min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-all ${
          activeMode === 'delete'
            ? 'bg-teal-50 border border-teal-600 text-teal-800'
            : 'text-slate-700 hover:bg-slate-100 active:scale-[0.95]'
        }`}
        data-active={activeMode === 'delete'}
        aria-pressed={activeMode === 'delete'}
        aria-label="Delete Parcel"
        title="Delete Parcel (Click a parcel to delete)"
        onClick={() => handleToolClick('delete')}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      {/* 5. Cancel / Finish (Visible when activeMode !== 'idle') */}
      {activeMode !== 'idle' && (
        <>
          <div className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />
          <button
            type="button"
            className="ag-drawing-tool-btn min-w-[40px] min-h-[40px] w-10 h-10 flex items-center justify-center rounded-md cursor-pointer transition-all text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.95]"
            aria-label="Cancel / Finish"
            title="Cancel drawing (Esc)"
            onClick={handleCancelClick}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
