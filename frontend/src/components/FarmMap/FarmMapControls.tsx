import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { formatCoordinates, getScale } from './farmMapPolicy';

export type BaseLayer = 'satellite' | 'streets';
export type TileStatus = 'loading' | 'ready' | 'error';
type Props = {
  baseLayer: BaseLayer;
  onLayerChange: (layer: BaseLayer) => void;
  tileStatus: TileStatus;
  onRetryTiles: () => void;
  canFit: boolean;
  onFit: () => void;
};

export function FarmMapControls({ baseLayer, onLayerChange, tileStatus, onRetryTiles, canFit, onFit }: Props) {
  const map = useMap();
  const root = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState(() => ({ coordinate: map.getCenter(), meters: 0, zoom: map.getZoom() }));

  useEffect(() => {
    const element = root.current!;
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
    let frame = 0;
    let cursor: L.LatLng | null = null;
    const update = () => {
      frame = 0;
      const y = map.getSize().y / 2;
      const meters = map.distance(map.containerPointToLatLng([0, y]), map.containerPointToLatLng([90, y]));
      setTelemetry({ coordinate: cursor ?? map.getCenter(), meters, zoom: map.getZoom() });
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    const pointer = (event: L.LeafletMouseEvent) => { cursor = event.latlng; queue(); };
    const leave = () => { cursor = null; queue(); };
    map.on('mousemove', pointer);
    map.on('mouseout', leave);
    map.on('moveend zoomend resize', queue);
    queue();
    return () => {
      map.off('mousemove', pointer);
      map.off('mouseout', leave);
      map.off('moveend zoomend resize', queue);
      L.DomEvent.off(element);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map]);

  const metric = getScale(telemetry.meters, false);
  const imperial = getScale(telemetry.meters, true);
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div ref={root} className="ag-map-hud" onKeyDown={(event) => event.stopPropagation()}>
      <div className="ag-map-basemap ag-map-control-card" role="group" aria-label="Base map">
        <button type="button" aria-pressed={baseLayer === 'satellite'} onClick={() => onLayerChange('satellite')}
          title="Esri World Imagery">Satellite</button>
        <button type="button" aria-pressed={baseLayer === 'streets'} onClick={() => onLayerChange('streets')}
          title="OpenStreetMap">Streets</button>
      </div>

      {tileStatus !== 'ready' && (
        <div className="ag-map-tile-status ag-map-control-card" role="status">
          <span>{tileStatus === 'error' ? `${baseLayer === 'satellite' ? 'Satellite' : 'Street'} imagery unavailable. Parcel boundaries remain available.`
            : `Loading ${baseLayer === 'satellite' ? 'satellite' : 'street'} imagery…`}</span>
          {tileStatus === 'error' && <div className="ag-map-tile-actions">
            <button type="button" onClick={onRetryTiles}>Retry tiles</button>
            {baseLayer === 'satellite' && <button type="button" onClick={() => onLayerChange('streets')}>Switch to Streets</button>}
          </div>}
        </div>
      )}

      <div className="ag-map-navigation ag-map-control-card" role="group" aria-label="Map navigation">
        <button type="button" aria-label="Zoom in" title="Zoom in" disabled={telemetry.zoom >= map.getMaxZoom()}
          onClick={() => map.zoomIn(1, { animate: !reducedMotion() })}>+</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" disabled={telemetry.zoom <= map.getMinZoom()}
          onClick={() => map.zoomOut(1, { animate: !reducedMotion() })}>−</button>
        <button type="button" aria-label="Fit all parcels" title="Fit all parcels" disabled={!canFit} onClick={onFit}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <div className="ag-map-telemetry">
        <div className="ag-map-compass ag-map-control-card" role="img" aria-label="North is up">
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <text x="16" y="10" textAnchor="middle" fontSize="8" fill="currentColor">N</text>
            <path d="m16 12-5 14 5-3 5 3Z" fill="var(--ag-brand)" />
          </svg>
        </div>
        <div className="ag-map-readout ag-map-control-card">
          <div className="ag-map-coordinates" role="group" aria-label="Map coordinates">{formatCoordinates(telemetry.coordinate.lat, telemetry.coordinate.lng)}</div>
          <div className="ag-map-scales" role="group" aria-label="Map scale">
            {metric && <span className="ag-map-scale" style={{ width: metric.width }}>{metric.label}</span>}
            {imperial && <span className="ag-map-scale" style={{ width: imperial.width }}>{imperial.label}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
