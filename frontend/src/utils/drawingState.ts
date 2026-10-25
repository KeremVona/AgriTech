import type { DrawingMode, DrawingState } from '../types/farmMapDrawing.ts';

/**
 * Toggles a drawing tool on or off.
 * If the clicked tool is already active, resets back to 'idle'.
 * Otherwise, transitions to the target mode.
 */
export function toggleDrawingMode(currentMode: DrawingMode, targetMode: DrawingMode): DrawingMode {
  return currentMode === targetMode ? 'idle' : targetMode;
}

/**
 * Cancels active drawing or editing and resets mode to 'idle'.
 */
export function cancelDrawingMode(): DrawingMode {
  return 'idle';
}

/**
 * Handles keyboard shortcuts for the drawing workflow.
 * Pressing 'Escape' aborts the current tool and returns to 'idle'.
 */
export function handleDrawingKeydown(eventKey: string, currentMode: DrawingMode): DrawingMode {
  if (eventKey === 'Escape') {
    return 'idle';
  }
  return currentMode;
}

/**
 * Determines whether background actions and map navigation are restricted during drawing.
 * When any tool ('draw', 'edit', 'drag', 'delete') is engaged, actions are locked.
 */
export function isDrawingActionLocked(currentMode: DrawingMode): boolean {
  return currentMode !== 'idle';
}

/**
 * Computes the reactive DrawingState according to the UI state machine:
 * - 'IDLE_MAP' when idle and not completed
 * - 'POLYGON_COMPLETED' when completed
 * - 'DRAWING_INVALID_KINK' when active with detected kinks
 * - 'DRAWING_ACTIVE' when active without kinks
 */
export function getDrawingState(
  mode: DrawingMode,
  kinksCount: number,
  isCompleted: boolean
): DrawingState {
  if (isCompleted) {
    return 'POLYGON_COMPLETED';
  }
  if (mode === 'idle') {
    return 'IDLE_MAP';
  }
  if (kinksCount > 0) {
    return 'DRAWING_INVALID_KINK';
  }
  return 'DRAWING_ACTIVE';
}

/**
 * Safely extracts [lng, lat] coordinate rings from various Leaflet layer formats
 * (flat LatLng array, nested ring array, or GeoJSON feature geometry).
 */
export function extractCoordinates(layer: any): [number, number][] {
  if (!layer) return [];

  if (typeof layer.getLatLngs === 'function') {
    let latlngs = layer.getLatLngs();
    while (Array.isArray(latlngs) && latlngs.length > 0 && Array.isArray(latlngs[0])) {
      latlngs = latlngs[0];
    }
    if (Array.isArray(latlngs)) {
      return latlngs
        .filter((ll: any) => ll && typeof ll.lat === 'number' && typeof ll.lng === 'number')
        .map((ll: any) => [ll.lng, ll.lat]);
    }
  }

  if (typeof layer.toGeoJSON === 'function') {
    const geo = layer.toGeoJSON();
    if (geo?.geometry?.type === 'Polygon' && Array.isArray(geo.geometry.coordinates?.[0])) {
      return geo.geometry.coordinates[0];
    }
  }

  return [];
}
