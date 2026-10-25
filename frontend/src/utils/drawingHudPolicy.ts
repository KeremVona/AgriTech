import type { DrawingMode, DrawingState, ParcelMetrics } from '../types/farmMapDrawing.ts';

/**
 * Formats live parcel metrics for tabular display in the map drawing HUD.
 * Format: "${metrics.areaHa.toFixed(2)} ha (${metrics.acres.toFixed(2)} acres) • ${metrics.vertexCount} Vertices • Perimeter: ${Math.round(metrics.perimeterM)}m"
 */
export function formatDrawingHudMetrics(metrics: ParcelMetrics): string {
  if (!metrics) {
    return '0.00 ha (0.00 acres) • 0 Vertices • Perimeter: 0m';
  }
  return `${metrics.areaHa.toFixed(2)} ha (${metrics.acres.toFixed(2)} acres) • ${metrics.vertexCount} Vertices • Perimeter: ${Math.round(metrics.perimeterM)}m`;
}

/**
 * Resolves context-sensitive guidance microcopy and error status for the HUD badge.
 */
export function getDrawingHudMicrocopy(
  state: DrawingState,
  mode?: DrawingMode
): { prompt: string; isError: boolean } {
  if (state === 'DRAWING_INVALID_KINK') {
    return {
      prompt: 'Self-intersecting polygon. Uncross boundary lines to complete parcel.',
      isError: true,
    };
  }

  if (state === 'POLYGON_COMPLETED') {
    return {
      prompt: 'Parcel boundary recorded. Ready for metadata.',
      isError: false,
    };
  }

  if (mode === 'edit') {
    return {
      prompt: 'Drag vertices to reshape • Click midpoint to add vertex • Click Finish when done.',
      isError: false,
    };
  }

  if (mode === 'drag') {
    return {
      prompt: 'Click and drag parcel to reposition • Click Finish when done.',
      isError: false,
    };
  }

  if (mode === 'delete') {
    return {
      prompt: 'Click any parcel to delete • Click Finish when done.',
      isError: false,
    };
  }

  if (mode === 'draw' || state === 'DRAWING_ACTIVE') {
    return {
      prompt: 'Click initial vertex to complete polygon • Press ESC to cancel.',
      isError: false,
    };
  }

  if (state === 'IDLE_MAP' || mode === 'idle') {
    return {
      prompt: '',
      isError: false,
    };
  }

  return {
    prompt: '',
    isError: false,
  };
}

/**
 * Hard guard checking if a polygon is topologically sound and eligible for commit.
 * Returns true only if metrics !== null, metrics.vertexCount >= 3, metrics.areaHa > 0, and !hasKinks.
 */
export function canSubmitPolygon(metrics: ParcelMetrics | null, hasKinks: boolean): boolean {
  if (!metrics || hasKinks) {
    return false;
  }
  return metrics.vertexCount >= 3 && metrics.areaHa > 0;
}
