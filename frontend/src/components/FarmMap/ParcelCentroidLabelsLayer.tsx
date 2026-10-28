import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Marker, useMap } from 'react-leaflet';
import type { ParcelFeatureCollection } from '../../types/farmMap.ts';
import { extractParcelCentroidData } from '../../utils/parcelStyling.ts';

export interface ParcelCentroidLabelsLayerProps {
  collection: ParcelFeatureCollection;
  selectedParcelId?: string | number | null;
  onParcelSelect?: (feature: GeoJSON.Feature<GeoJSON.Polygon>) => void;
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Child component of MapContainer that renders zoom-responsive micro-badges
 * at polygon geometric centroids in a dedicated z-index: 500 Leaflet pane.
 *
 * Density policy:
 * - Zoom >= 14: Expanded micro-badge (.ag-parcel-tooltip) showing crop color dot,
 *   name • crop, and areaHa • soil texture.
 * - Zoom < 14: Collapsed dot badge (.ag-parcel-dot-badge) indicating spatial parcel center.
 */
export function ParcelCentroidLabelsLayer({
  collection,
  selectedParcelId,
  onParcelSelect,
}: ParcelCentroidLabelsLayerProps): React.JSX.Element | null {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const onParcelSelectRef = useRef(onParcelSelect);

  useEffect(() => {
    onParcelSelectRef.current = onParcelSelect;
  }, [onParcelSelect]);

  // Ensure dedicated z-index: 500 pane exists for centroid labels
  if (!map.getPane('parcelCentroidPane')) {
    const pane = map.createPane('parcelCentroidPane');
    pane.style.zIndex = '500';
  }

  useEffect(() => {
    const pane = map.getPane('parcelCentroidPane');
    if (pane) {
      pane.style.zIndex = '500';
    }

    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  const centroidItems = useMemo(() => {
    return extractParcelCentroidData(collection);
  }, [collection]);

  const isExpanded = zoom >= 14;

  const attachDomInteractions = (element?: HTMLElement | null) => {
    if (!element) return;
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
  };

  return (
    <>
      {centroidItems.map((item) => {
        if (item.lat === 0 && item.lng === 0) {
          return null;
        }

        const isSelected =
          selectedParcelId !== undefined &&
          selectedParcelId !== null &&
          String(selectedParcelId) === String(item.id);

        const cropColor = isSelected ? item.palette.selected : item.palette.stroke;

        const html = isExpanded
          ? `<div class="ag-parcel-tooltip ${isSelected ? 'ag-parcel-tooltip-selected' : ''}" role="tooltip">` +
            `<div class="ag-parcel-tooltip-header">` +
            `<span class="ag-parcel-crop-dot w-2 h-2 rounded-full inline-block" style="background-color: ${cropColor};"></span>` +
            `<span class="ag-parcel-tooltip-title">${escapeHtml(item.name)} • ${escapeHtml(item.cropName)}</span>` +
            `</div>` +
            `<div class="ag-parcel-tooltip-subtitle">${item.areaHa.toFixed(2)} ha • ${escapeHtml(item.soilName)}</div>` +
            `</div>`
          : `<div class="ag-parcel-dot-badge w-2.5 h-2.5 rounded-full border border-white shadow-sm ${isSelected ? 'ag-parcel-dot-badge-selected' : ''}" style="background-color: ${cropColor};"></div>`;

        const icon = L.divIcon({
          className: 'ag-parcel-div-icon',
          html,
          iconSize: isExpanded ? undefined : [10, 10],
          iconAnchor: isExpanded ? undefined : [5, 5],
        });

        return (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            icon={icon}
            pane="parcelCentroidPane"
            interactive={true}
            eventHandlers={{
              add: (e) => {
                attachDomInteractions(e.target.getElement());
              },
              click: (e) => {
                if (!onParcelSelectRef.current) return;
                L.DomEvent.stopPropagation(e);
                if (item.feature) {
                  onParcelSelectRef.current(item.feature as GeoJSON.Feature<GeoJSON.Polygon>);
                }
              },
            }}
            ref={(marker) => {
              if (marker) {
                attachDomInteractions(marker.getElement());
              }
            }}
          />
        );
      })}
    </>
  );
}
