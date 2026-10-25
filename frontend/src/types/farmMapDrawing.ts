/**
 * Types and interfaces for interactive parcel vector drawing, topology validation, and metrics.
 */

export type DrawingMode = 'idle' | 'draw' | 'edit' | 'drag' | 'delete';

export type DrawingState =
  | 'IDLE_MAP'
  | 'DRAWING_ACTIVE'
  | 'DRAWING_INVALID_KINK'
  | 'POLYGON_COMPLETED';

export interface ParcelMetrics {
  areaM2: number;
  areaHa: number;
  acres: number;
  perimeterM: number;
  vertexCount: number;
}

export interface TopologyValidationResult {
  isValid: boolean;
  kinks: [number, number][];
  errorMessage: string | null;
}

export {
  toggleDrawingMode,
  cancelDrawingMode,
  handleDrawingKeydown,
  isDrawingActionLocked,
  getDrawingState,
  extractCoordinates,
} from '../utils/drawingState.ts';

export {
  formatDrawingHudMetrics,
  getDrawingHudMicrocopy,
  canSubmitPolygon,
} from '../utils/drawingHudPolicy.ts';
