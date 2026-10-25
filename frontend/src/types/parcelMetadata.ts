/**
 * Domain types and models for parcel metadata, crop categorization palettes,
 * soil definitions, Days After Planting (DAP), and geometric centroid calculations.
 */

export type CropCategory = 'Tomato' | 'Corn' | 'Potato' | 'Apple';

export type SoilType = 'Sand' | 'Sandy Loam' | 'Silt' | 'Clay';

export interface CropPalette {
  stroke: string;
  fill: string;
  selected: string;
}

export interface CropDefinition {
  id: string;
  name: string;
  commonName: string;
  category: CropCategory;
  scientificName: string;
  family: string;
  emoji: string;
  palette: CropPalette;
}

export interface SoilDefinition {
  id: string;
  name: string;
  type: SoilType;
  thetaFc: number;
  fieldCapacity: number;
  description: string;
}

export interface ParcelFormData {
  id?: string | number;
  name: string;
  cropId: string;
  cropName: string;
  soilProfileId: string;
  soilProfileName: string;
  plantingDate: string; // YYYY-MM-DD
  fieldId?: string | null;
  crop?: string;
  soil?: string;
}

export interface DapCalculation {
  days: number;
  stage: string;
  formatted: string;
}

export interface ParcelCentroid {
  lng: number;
  lat: number;
}

export interface ParcelFormValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ParcelFormData, string>>;
}

export {
  CROP_PALETTES,
  DEFAULT_CROP_PALETTE,
  CROPS,
  SOILS,
  calculateDap,
  validateParcelForm,
  resolveCropPalette,
  buildParcelCreatePayload,
} from '../utils/parcelMetadataPolicy.ts';

export {
  calculatePolygonCentroid,
} from '../utils/parcelCentroid.ts';

export type {
  ParcelFeatureStyle,
  ParcelCentroidData,
} from '../utils/parcelStyling.ts';

export {
  resolveParcelFeatureStyle,
  extractParcelCentroidData,
} from '../utils/parcelStyling.ts';

