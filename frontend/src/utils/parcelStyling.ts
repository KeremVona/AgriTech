import type { CropPalette } from '../types/parcelMetadata.ts';
import { resolveCropPalette } from './parcelMetadataPolicy.ts';
import { calculatePolygonCentroid } from './parcelCentroid.ts';

export interface ParcelFeatureStyle {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
  opacity: number;
  className: string;
  stroke?: boolean;
  fill?: boolean;
}

export interface ParcelCentroidData {
  id: string | number;
  lat: number;
  lng: number;
  name: string;
  crop: string;
  cropName: string;
  areaHa: number;
  soil: string;
  soilName: string;
  palette: CropPalette;
}

/**
 * Resolves dynamic vector polygon path styling options for a given parcel GeoJSON feature.
 *
 * Normal unselected styling:
 * - stroke color from crop category palette
 * - stroke weight: 2px
 * - fill: crop translucent fill color (0.18 opacity)
 *
 * Selected styling:
 * - stroke color: crop selected accent token (#047857 / #B45309 / #6D28D9 / #BE185D / #115E59)
 * - stroke weight: 3px
 * - className includes 'ag-parcel-polygon-selected' for SVG glow halo
 */
export function resolveParcelFeatureStyle(
  feature?: any,
  selectedParcelIdOrIsSelected?: string | number | null | boolean,
): ParcelFeatureStyle {
  const cropIdentifier = feature?.properties?.crop_name ?? feature?.properties?.crop ?? null;
  const palette = resolveCropPalette(cropIdentifier);

  let isSelected = false;
  if (typeof selectedParcelIdOrIsSelected === 'boolean') {
    isSelected = selectedParcelIdOrIsSelected;
  } else if (selectedParcelIdOrIsSelected !== null && selectedParcelIdOrIsSelected !== undefined && feature) {
    const featId = feature.id ?? feature.properties?.id;
    isSelected = featId !== undefined && featId !== null && String(featId) === String(selectedParcelIdOrIsSelected);
  }

  const color = isSelected ? palette.selected : palette.stroke;
  const weight = isSelected ? 3 : 2;
  const fillColor = palette.fill;
  const fillOpacity = 1;
  const opacity = 1;
  const className = isSelected
    ? 'ag-parcel-polygon ag-parcel-polygon-selected'
    : 'ag-parcel-polygon';

  const style: ParcelFeatureStyle = {
    color,
    weight,
    fillColor,
    fillOpacity,
    opacity,
    className,
    stroke: true,
    fill: true,
  };

  // Provide non-enumerable stroke and fill getters so consumers asserting style.stroke/style.fill
  // receive the resolved color/fillColor strings without breaking Leaflet's PathOptions typing.
  Object.defineProperties(style, {
    stroke: {
      get() {
        return color;
      },
      enumerable: false,
      configurable: true,
    },
    fill: {
      get() {
        return fillColor;
      },
      enumerable: false,
      configurable: true,
    },
  });

  return style;
}

/**
 * Extracts centroid coordinates and badge telemetry data across all features in a collection.
 * Pure mathematical helper free of Leaflet and browser DOM bindings.
 */
export function extractParcelCentroidData(
  collection?: any,
): ParcelCentroidData[] {
  if (!collection) {
    return [];
  }

  const features: any[] = Array.isArray(collection)
    ? collection
    : Array.isArray(collection.features)
      ? collection.features
      : [];

  return features.map((feature, index) => {
    let coordinates: [number, number][] | [number, number][][] = [];
    if (feature?.geometry?.coordinates) {
      if (feature.geometry.type === 'MultiPolygon' && Array.isArray(feature.geometry.coordinates[0])) {
        coordinates = feature.geometry.coordinates[0];
      } else {
        coordinates = feature.geometry.coordinates;
      }
    }

    const centroid = calculatePolygonCentroid(coordinates);
    const id = feature?.id ?? feature?.properties?.id ?? `parcel-${index}`;
    const name = feature?.properties?.name || 'Unnamed Parcel';
    const crop = feature?.properties?.crop_name || feature?.properties?.crop || 'Unassigned';
    const cropName = crop;
    const rawArea = feature?.properties?.area_hectares;
    const areaHa = typeof rawArea === 'number' ? rawArea : (Number(rawArea) || 0);
    const soil = feature?.properties?.soil_profile_name || feature?.properties?.soil || 'Unspecified';
    const soilName = soil;
    const palette = resolveCropPalette(crop === 'Unassigned' ? null : crop);

    return {
      id,
      lat: centroid.lat,
      lng: centroid.lng,
      name,
      crop,
      cropName,
      areaHa,
      soil,
      soilName,
      palette,
    };
  });
}
