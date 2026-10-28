import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { resolveParcelFeatureStyle } from '../../utils/parcelStyling.ts';
import { ParcelCentroidLabelsLayer } from './ParcelCentroidLabelsLayer.tsx';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { ParcelFeatureCollection } from '../../types/farmMap.ts';
import type { DrawingMode, DrawingState, ParcelMetrics } from '../../types/farmMapDrawing.ts';
import { getDrawingState } from '../../utils/drawingState.ts';
import { getParcelBounds } from '../../utils/farmMapGeometry.ts';
import { FarmMapViewport } from './FarmMapViewport.tsx';
import { FarmMapControls } from './FarmMapControls.tsx';
import type { BaseLayer, TileStatus } from './FarmMapControls.tsx';
import { DrawingToolbar } from './DrawingToolbar.tsx';
import { DrawingLiveAreaBadge } from './DrawingLiveAreaBadge.tsx';
import { FarmMapDrawingManager } from './FarmMapDrawingManager.tsx';
import { KinkMarkersLayer } from './KinkMarkersLayer.tsx';
import 'leaflet/dist/leaflet.css';
import './farmMap.css';

const maxZoom = 22;
const layers = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 19,
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
};
function ParcelLayer({
  collection,
  selectedParcelId,
  onParcelSelect,
  onParcelGeometryChange,
}: {
  collection: ParcelFeatureCollection;
  selectedParcelId?: string | number | null;
  onParcelSelect?: (feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => void;
  onParcelGeometryChange?: (id: string, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
}) {
  const layer = useRef<L.GeoJSON>(null);
  const onParcelSelectRef = useRef(onParcelSelect);
  const onParcelGeometryChangeRef = useRef(onParcelGeometryChange);

  useEffect(() => {
    onParcelSelectRef.current = onParcelSelect;
  }, [onParcelSelect]);

  useEffect(() => {
    onParcelGeometryChangeRef.current = onParcelGeometryChange;
  }, [onParcelGeometryChange]);

  const styleFunction = useCallback(
    (feature: any) => resolveParcelFeatureStyle(feature, selectedParcelId),
    [selectedParcelId],
  );

  const onEachFeature = (feature: any, featureLayer: L.Layer) => {
    featureLayer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onParcelSelectRef.current?.(feature);
      },
      'pm:edit': () => {
        const id = String(feature.id ?? feature.properties?.id);
        const geom = (featureLayer as L.Polygon).toGeoJSON().geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        onParcelGeometryChangeRef.current?.(id, geom);
      },
      'pm:dragend': () => {
        const id = String(feature.id ?? feature.properties?.id);
        const geom = (featureLayer as L.Polygon).toGeoJSON().geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        onParcelGeometryChangeRef.current?.(id, geom);
      },
    });
  };

  useEffect(() => {
    if (layer.current) {
      layer.current.clearLayers();
      layer.current.addData(collection);
    }
  }, [collection]);

  useEffect(() => {
    if (layer.current) {
      layer.current.setStyle(styleFunction as any);
      layer.current.eachLayer((subLayer: any) => {
        const el = subLayer.getElement?.();
        if (el && subLayer.feature) {
          const featId = subLayer.feature.id ?? subLayer.feature.properties?.id;
          const isSelected =
            selectedParcelId !== undefined &&
            selectedParcelId !== null &&
            String(featId) === String(selectedParcelId);
          if (isSelected) {
            L.DomUtil.addClass(el, 'ag-parcel-polygon-selected');
          } else {
            L.DomUtil.removeClass(el, 'ag-parcel-polygon-selected');
          }
        }
      });
    }
  }, [styleFunction, selectedParcelId]);

  return (
    <GeoJSON
      key={collection.features.length}
      ref={layer}
      data={collection}
      style={styleFunction as any}
      onEachFeature={onEachFeature}
      interactive={true}
    />
  );
}

export interface FarmMapContainerProps {
  collection: ParcelFeatureCollection;
  editable?: boolean;
  selectedParcelId?: string | number | null;
  onParcelSelect?: (feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) => void;
  onParcelGeometryChange?: (id: string, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) => void;
  onPolygonComplete?: (feature: GeoJSON.Feature<GeoJSON.Polygon>, metrics: ParcelMetrics) => void;
  onPolygonDelete?: (parcelId: string | number) => void;
}

export function FarmMapContainer({
  collection,
  editable = true,
  selectedParcelId,
  onParcelSelect,
  onParcelGeometryChange,
  onPolygonComplete,
  onPolygonDelete,
}: FarmMapContainerProps): React.JSX.Element {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satellite');
  const [tileStatus, setTileStatus] = useState<TileStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const [fitRequest, setFitRequest] = useState(0);

  // Drawing state
  const [activeMode, setActiveMode] = useState<DrawingMode>('idle');
  const [metrics, setMetrics] = useState<ParcelMetrics | null>(null);
  const [kinks, setKinks] = useState<[number, number][]>([]);

  // When not editable or idle, activeMode evaluates to 'idle', and metrics/kinks evaluate to empty/null
  const effectiveActiveMode: DrawingMode = editable ? activeMode : 'idle';
  const effectiveMetrics = effectiveActiveMode === 'idle' ? null : metrics;
  const effectiveKinks = effectiveActiveMode === 'idle' ? [] : kinks;

  const handleModeChange = (mode: DrawingMode) => {
    setActiveMode(mode);
    if (mode === 'idle') {
      setMetrics(null);
      setKinks([]);
    }
  };

  const handleCancel = () => {
    handleModeChange('idle');
  };

  const handlePolygonComplete = (feature: GeoJSON.Feature<GeoJSON.Polygon>, completedMetrics: ParcelMetrics) => {
    handleModeChange('idle');
    onPolygonComplete?.(feature, completedMetrics);
  };

  const handlePolygonDelete = (parcelId: string | number) => {
    onPolygonDelete?.(parcelId);
  };

  const drawingState: DrawingState = getDrawingState(activeMode, effectiveKinks.length, false);

  const bounds = useMemo(() => getParcelBounds(collection), [collection]);
  const active = layers[baseLayer];
  const changeLayer = (layer: BaseLayer) => {
    if (layer === baseLayer) return;
    setTileStatus('loading');
    setBaseLayer(layer);
  };
  const retryTiles = () => {
    setTileStatus('loading');
    setAttempt((value) => value + 1);
  };

  return (
    <div
      className="ag-map-surface"
      role="region"
      aria-label="Interactive farm parcel map"
    >
      {editable && (
        <DrawingToolbar
          activeMode={effectiveActiveMode}
          onModeChange={handleModeChange}
          onCancel={handleCancel}
        />
      )}
      {editable && effectiveActiveMode !== 'idle' && (
        <DrawingLiveAreaBadge
          state={drawingState}
          activeMode={effectiveActiveMode}
          metrics={effectiveMetrics}
          hasKinks={effectiveKinks.length > 0}
          onCancel={handleCancel}
        />
      )}
      <MapContainer
        className="ag-farm-map"
        center={[39, 35]}
        zoom={6}
        minZoom={2}
        maxZoom={maxZoom}
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          key={`${baseLayer}-${attempt}`}
          {...active}
          maxZoom={maxZoom}
          eventHandlers={{
            loading: () => setTileStatus((status) => (status === 'error' ? status : 'loading')),
            load: () => setTileStatus((status) => (status === 'error' ? status : 'ready')),
            tileerror: () => setTileStatus('error'),
          }}
        />
        <ParcelLayer
          collection={collection}
          selectedParcelId={selectedParcelId}
          onParcelSelect={onParcelSelect}
          onParcelGeometryChange={onParcelGeometryChange}
        />
        <ParcelCentroidLabelsLayer
          collection={collection}
          selectedParcelId={selectedParcelId}
          onParcelSelect={onParcelSelect}
        />
        <FarmMapViewport bounds={bounds} fitRequest={fitRequest} />
        <FarmMapControls
          baseLayer={baseLayer}
          onLayerChange={changeLayer}
          tileStatus={tileStatus}
          onRetryTiles={retryTiles}
          canFit={bounds !== null}
          onFit={() => setFitRequest((value) => value + 1)}
        />
        {editable && (
          <>
            <FarmMapDrawingManager
              enabled={editable}
              activeMode={effectiveActiveMode}
              onModeChange={handleModeChange}
              onMetricsUpdate={setMetrics}
              onKinksChange={setKinks}
              onPolygonComplete={handlePolygonComplete}
              onPolygonDelete={handlePolygonDelete}
            />
            <KinkMarkersLayer kinks={effectiveKinks} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
