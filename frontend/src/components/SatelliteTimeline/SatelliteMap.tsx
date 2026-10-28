import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParcelFeatureCollection } from '../../types/farmMap.ts';

export interface SatelliteMapOverlay {
  bounds: [[number, number], [number, number]];
  before: { url: string; opacity: number } | null;
  after: { url: string; opacity: number } | null;
}

export interface SatelliteMapProps {
  parcels: ParcelFeatureCollection['features'];
  selectedId: string | null;
  onSelect: (id: string) => void;
  overlay: SatelliteMapOverlay | null;
}

const ESRI_WORLD_IMAGERY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function FitSelectedParcel({
  parcels,
  selectedId,
}: {
  parcels: ParcelFeatureCollection['features'];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const parcel = parcels.find(
      (p) => String(p.properties?.id ?? p.id) === selectedId && p.geometry
    );
    if (!parcel || !parcel.geometry) return;

    try {
      const layer = L.geoJSON(parcel as any);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      }
    } catch {
      // Ignore geometry parsing errors
    }
  }, [parcels, selectedId, map]);

  return null;
}

export function SatelliteMap({
  parcels,
  selectedId,
  onSelect,
  overlay,
}: SatelliteMapProps): React.JSX.Element {
  const validParcels = parcels.filter((p) => Boolean(p && p.geometry));

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[39.0, 35.0]}
        zoom={6}
        maxZoom={22}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url={ESRI_WORLD_IMAGERY_URL}
          attribution={ESRI_ATTRIBUTION}
          maxNativeZoom={19}
          maxZoom={22}
        />

        <FitSelectedParcel parcels={validParcels} selectedId={selectedId} />

        <GeoJSON
          key={`parcels-${selectedId ?? 'none'}`}
          data={
            {
              type: 'FeatureCollection',
              features: validParcels,
            } as any
          }
          style={(feature) => {
            const id = String(feature?.properties?.id ?? feature?.id);
            const isSelected = id === selectedId;
            return {
              color: isSelected ? '#38bdf8' : '#22c55e',
              weight: isSelected ? 3 : 2,
              opacity: 0.9,
              fillColor: isSelected ? '#38bdf8' : '#22c55e',
              fillOpacity: isSelected ? 0.2 : 0.05,
            };
          }}
          onEachFeature={(feature, layer) => {
            layer.on({
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                const id = String(feature.properties?.id ?? feature.id);
                onSelect(id);
              },
            });
          }}
        />

        {overlay && (
          <>
            <ImageOverlay
              url={overlay.before?.url || TRANSPARENT_PIXEL}
              bounds={overlay.bounds}
              opacity={overlay.before ? overlay.before.opacity : 0}
              zIndex={10}
              interactive={false}
            />
            <ImageOverlay
              url={overlay.after?.url || TRANSPARENT_PIXEL}
              bounds={overlay.bounds}
              opacity={overlay.after ? overlay.after.opacity : 0}
              zIndex={11}
              interactive={false}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
