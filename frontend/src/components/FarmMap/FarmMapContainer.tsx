import { useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { ParcelFeatureCollection } from '../../types/farmMap';
import { getParcelBounds } from '../../utils/farmMapGeometry';
import { FarmMapViewport } from './FarmMapViewport';
import { FarmMapControls } from './FarmMapControls';
import type { BaseLayer, TileStatus } from './FarmMapControls';
import 'leaflet/dist/leaflet.css';
import './farmMap.css';

const layers = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 19,
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
};
const parcelStyle = { color: '#0F766E', weight: 2, fillColor: '#0F766E', fillOpacity: 0.18 };

function ParcelLayer({ collection }: { collection: ParcelFeatureCollection }) {
  const layer = useRef<L.GeoJSON>(null);
  useEffect(() => {
    layer.current?.clearLayers();
    layer.current?.addData(collection);
  }, [collection]);
  return <GeoJSON ref={layer} data={collection} style={parcelStyle} interactive={false} />;
}

export function FarmMapContainer({ collection }: { collection: ParcelFeatureCollection }): React.JSX.Element {
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satellite');
  const [tileStatus, setTileStatus] = useState<TileStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const [fitRequest, setFitRequest] = useState(0);
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
    <div className="ag-map-surface" role="region" aria-label="Read-only farm parcel map">
      <MapContainer className="ag-farm-map" center={[39, 35]} zoom={6} minZoom={2} maxZoom={22}
        zoomControl={false} scrollWheelZoom>
        <TileLayer key={`${baseLayer}-${attempt}`} {...active} eventHandlers={{
          loading: () => setTileStatus((status) => status === 'error' ? status : 'loading'),
          load: () => setTileStatus((status) => status === 'error' ? status : 'ready'),
          tileerror: () => setTileStatus('error'),
        }} />
        <ParcelLayer collection={collection} />
        <FarmMapViewport bounds={bounds} fitRequest={fitRequest} />
        <FarmMapControls baseLayer={baseLayer} onLayerChange={changeLayer} tileStatus={tileStatus}
          onRetryTiles={retryTiles} canFit={bounds !== null} onFit={() => setFitRequest((value) => value + 1)} />
      </MapContainer>
    </div>
  );
}
