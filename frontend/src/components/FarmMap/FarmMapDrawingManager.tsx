import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { DrawingMode, ParcelMetrics } from '../../types/farmMapDrawing.ts';
import { calculateParcelMetrics, validateParcelTopology, normalizeClosedRing } from '../../utils/parcelTopology.ts';
import { extractCoordinates } from '../../utils/drawingState.ts';

export interface FarmMapDrawingManagerProps {
  enabled?: boolean;
  activeMode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  onMetricsUpdate?: (metrics: ParcelMetrics) => void;
  onKinksChange?: (kinks: [number, number][]) => void;
  onPolygonComplete?: (feature: GeoJSON.Feature<GeoJSON.Polygon>, metrics: ParcelMetrics) => void;
  onPolygonDelete?: (layerId: string | number) => void;
}

export function FarmMapDrawingManager({
  enabled = true,
  activeMode,
  onModeChange,
  onMetricsUpdate,
  onKinksChange,
  onPolygonComplete,
  onPolygonDelete,
}: FarmMapDrawingManagerProps): null {
  const map = useMap();

  // Stable callbacks using refs to avoid re-binding Geoman listeners on every render
  const callbacksRef = useRef({
    onModeChange,
    onMetricsUpdate,
    onKinksChange,
    onPolygonComplete,
    onPolygonDelete,
  });

  useEffect(() => {
    callbacksRef.current = {
      onModeChange,
      onMetricsUpdate,
      onKinksChange,
      onPolygonComplete,
      onPolygonDelete,
    };
  }, [onModeChange, onMetricsUpdate, onKinksChange, onPolygonComplete, onPolygonDelete]);

  // Global Geoman configuration
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    const pm = (map as any).pm;

    // Do NOT call map.pm.addControls() - controls are driven strictly by DrawingToolbar.tsx React state
    const precisionAgPathOptions: L.PathOptions = {
      color: '#0F766E', // Bio-Teal
      weight: 2,
      dashArray: '6, 4',
      fillColor: '#0F766E',
      fillOpacity: 0.14,
    };

    if (typeof pm.setPathOptions === 'function') {
      pm.setPathOptions(precisionAgPathOptions);
    }
    if (typeof pm.setGlobalOptions === 'function') {
      pm.setGlobalOptions({
        pathOptions: precisionAgPathOptions,
        snappable: true,
        snapDistance: 20,
      });
    }
  }, [map]);

  const isInternalSyncRef = useRef(false);

  // Reactive Geoman mode synchronization
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    const pm = (map as any).pm;
    const container = map.getContainer();

    const disableAllGeomanModes = () => {
      isInternalSyncRef.current = true;
      try {
        if (typeof pm.disableDraw === 'function') pm.disableDraw();
        if (typeof pm.disableGlobalEditMode === 'function') pm.disableGlobalEditMode();
        if (typeof pm.disableGlobalDragMode === 'function') pm.disableGlobalDragMode();
        if (typeof pm.disableGlobalRemovalMode === 'function') pm.disableGlobalRemovalMode();
        container.classList.remove('ag-map-drawing-active');
      } finally {
        isInternalSyncRef.current = false;
      }
    };

    if (!enabled) {
      disableAllGeomanModes();
      return;
    }

    switch (activeMode) {
      case 'draw':
        // Disable other modes first
        isInternalSyncRef.current = true;
        try {
          if (typeof pm.disableGlobalEditMode === 'function') pm.disableGlobalEditMode();
          if (typeof pm.disableGlobalDragMode === 'function') pm.disableGlobalDragMode();
          if (typeof pm.disableGlobalRemovalMode === 'function') pm.disableGlobalRemovalMode();
        } finally {
          isInternalSyncRef.current = false;
        }

        container.classList.add('ag-map-drawing-active');
        if (typeof pm.enableDraw === 'function') {
          pm.enableDraw('Polygon', {
            snappable: true,
            snapDistance: 20,
            allowSelfIntersection: false,
            finishOn: 'dblclick',
          });
        }
        break;

      case 'edit':
        isInternalSyncRef.current = true;
        try {
          if (typeof pm.disableDraw === 'function') pm.disableDraw();
          if (typeof pm.disableGlobalDragMode === 'function') pm.disableGlobalDragMode();
          if (typeof pm.disableGlobalRemovalMode === 'function') pm.disableGlobalRemovalMode();
        } finally {
          isInternalSyncRef.current = false;
        }

        container.classList.remove('ag-map-drawing-active');
        if (typeof pm.enableGlobalEditMode === 'function') {
          pm.enableGlobalEditMode({
            snappable: true,
            snapDistance: 20,
            allowSelfIntersection: false,
          });
        }
        break;

      case 'drag':
        isInternalSyncRef.current = true;
        try {
          if (typeof pm.disableDraw === 'function') pm.disableDraw();
          if (typeof pm.disableGlobalEditMode === 'function') pm.disableGlobalEditMode();
          if (typeof pm.disableGlobalRemovalMode === 'function') pm.disableGlobalRemovalMode();
        } finally {
          isInternalSyncRef.current = false;
        }

        container.classList.remove('ag-map-drawing-active');
        if (typeof pm.enableGlobalDragMode === 'function') {
          pm.enableGlobalDragMode();
        }
        break;

      case 'delete':
        isInternalSyncRef.current = true;
        try {
          if (typeof pm.disableDraw === 'function') pm.disableDraw();
          if (typeof pm.disableGlobalEditMode === 'function') pm.disableGlobalEditMode();
          if (typeof pm.disableGlobalDragMode === 'function') pm.disableGlobalDragMode();
        } finally {
          isInternalSyncRef.current = false;
        }

        container.classList.remove('ag-map-drawing-active');
        if (typeof pm.enableGlobalRemovalMode === 'function') {
          pm.enableGlobalRemovalMode();
        }
        break;

      case 'idle':
      default:
        disableAllGeomanModes();
        break;
    }

    return () => {
      // Cleanup on unmount or mode switch
      disableAllGeomanModes();
    };
  }, [map, activeMode, enabled]);

  // Geoman event listeners
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    const container = map.getContainer();

    const handleDrawStart = () => {
      container.classList.add('ag-map-drawing-active');
    };

    const handleDrawEnd = () => {
      container.classList.remove('ag-map-drawing-active');
      // If draw was cancelled or ended by Geoman (not internal React sync), sync React state back to 'idle'
      if (!isInternalSyncRef.current) {
        callbacksRef.current.onModeChange('idle');
      }
    };

    const handleCreate = (e: any) => {
      const layer = e.layer;
      if (!layer) return;

      const coords = extractCoordinates(layer);
      const validation = validateParcelTopology(coords);

      if (!validation.isValid) {
        // Prevent layer adoption if invalid (e.g. self-intersecting or degenerate)
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
        callbacksRef.current.onKinksChange?.(validation.kinks);
        console.warn(`[FarmMapDrawingManager] Parcel creation rejected: ${validation.errorMessage}`);
        return;
      }

      const metrics = calculateParcelMetrics(coords);
      let feature: GeoJSON.Feature<GeoJSON.Polygon>;

      if (typeof layer.toGeoJSON === 'function') {
        feature = layer.toGeoJSON();
      } else {
        feature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [normalizeClosedRing(coords)],
          },
          properties: {},
        };
      }

      callbacksRef.current.onPolygonComplete?.(feature, metrics);
      callbacksRef.current.onKinksChange?.([]);
      callbacksRef.current.onModeChange('idle');
    };

    const handleRemove = (e: any) => {
      const layer = e.layer;
      const layerId =
        layer?.feature?.id ??
        layer?.feature?.properties?.id ??
        layer?._leaflet_id ??
        layer?.options?.id;

      if (layerId !== undefined) {
        callbacksRef.current.onPolygonDelete?.(layerId);
      }
    };

    const handleVertexUpdate = (e: any) => {
      const layer = e.workingLayer || e.layer || (map as any).pm?.Draw?.Polygon?._layer;
      const coords = extractCoordinates(layer);

      if (coords.length > 0) {
        const metrics = calculateParcelMetrics(coords);
        callbacksRef.current.onMetricsUpdate?.(metrics);

        const validation = validateParcelTopology(coords);
        callbacksRef.current.onKinksChange?.(validation.kinks);
      } else {
        callbacksRef.current.onMetricsUpdate?.({
          areaM2: 0,
          areaHa: 0,
          acres: 0,
          perimeterM: 0,
          vertexCount: 0,
        });
        callbacksRef.current.onKinksChange?.([]);
      }
    };

    map.on('pm:drawstart', handleDrawStart);
    map.on('pm:drawend', handleDrawEnd);
    map.on('pm:create', handleCreate);
    map.on('pm:remove', handleRemove);
    map.on('pm:vertexadded', handleVertexUpdate);
    map.on('pm:vertexremoved', handleVertexUpdate);
    map.on('pm:markerdrag', handleVertexUpdate);
    map.on('pm:snap', handleVertexUpdate);
    map.on('pm:snapdrag', handleVertexUpdate);

    return () => {
      map.off('pm:drawstart', handleDrawStart);
      map.off('pm:drawend', handleDrawEnd);
      map.off('pm:create', handleCreate);
      map.off('pm:remove', handleRemove);
      map.off('pm:vertexadded', handleVertexUpdate);
      map.off('pm:vertexremoved', handleVertexUpdate);
      map.off('pm:markerdrag', handleVertexUpdate);
      map.off('pm:snap', handleVertexUpdate);
      map.off('pm:snapdrag', handleVertexUpdate);
      container.classList.remove('ag-map-drawing-active');
    };
  }, [map]);

  return null;
}
