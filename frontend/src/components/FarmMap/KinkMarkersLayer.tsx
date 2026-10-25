import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

export interface KinkMarkersLayerProps {
  kinks: Array<[number, number]>;
}

/**
 * Child component of MapContainer that renders pulsing non-interactive
 * visual warning markers at detected self-intersection (kink) coordinates.
 */
export function KinkMarkersLayer({ kinks }: KinkMarkersLayerProps): null {
  const map = useMap();

  useEffect(() => {
    if (!map || !kinks || kinks.length === 0) {
      return;
    }

    const layerGroup = L.layerGroup();

    const kinkIcon = L.divIcon({
      className: 'ag-kink-marker-container',
      html: '<span class="ag-kink-marker-pulse"></span><span class="ag-kink-marker-core"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    kinks.forEach(([first, second]) => {
      // Turf/GeoJSON provides [lng, lat]. Leaflet requires [lat, lng].
      const [lng, lat] = [first, second];

      const marker = L.marker([lat, lng], {
        icon: kinkIcon,
        interactive: false,
      });

      marker.addTo(layerGroup);
    });

    layerGroup.addTo(map);

    return () => {
      layerGroup.clearLayers();
      if (map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
      }
    };
  }, [map, kinks]);

  return null;
}
