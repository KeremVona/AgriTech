import type {
  ParcelFormData,
  ParcelFormValidationResult,
} from '../types/parcelMetadata.ts';
import type { ParcelMetrics } from '../types/farmMapDrawing.ts';
import {
  CROPS,
  SOILS,
  findCrop,
  findSoil,
  validateParcelForm,
} from './parcelMetadataPolicy.ts';

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function getTodayDateString(refDate: Date = new Date()): string {
  const year = refDate.getFullYear();
  const month = String(refDate.getMonth() + 1).padStart(2, '0');
  const day = String(refDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolves initial drawer form data from existing properties or default create values.
 * Supports both snake_case (e.g. from GeoJSON properties) and camelCase properties.
 */
export function getInitialDrawerFormData(
  mode: 'create' | 'edit',
  initialData?: Partial<ParcelFormData> | Record<string, any> | null,
  defaultFieldId?: string | null,
): ParcelFormData {
  const raw = (initialData ?? {}) as Record<string, any>;

  // Extract name
  const name = typeof raw.name === 'string' ? raw.name : '';

  // Extract crop
  const matchedCrop = findCrop(
    raw.cropName,
    raw.crop_name,
    raw.crop,
    raw.cropId,
    raw.crop_id,
  );

  let cropId = matchedCrop ? matchedCrop.id : (raw.cropId ?? raw.crop_id ?? '');
  let cropName = matchedCrop ? matchedCrop.name : (raw.cropName ?? raw.crop_name ?? raw.crop ?? '');
  let crop = matchedCrop ? matchedCrop.name : (raw.crop ?? cropName);

  if (!matchedCrop && mode === 'create') {
    const defaultCrop = CROPS.find((c) => c.category === 'Tomato') ?? CROPS[0];
    cropId = defaultCrop.id;
    cropName = defaultCrop.name;
    crop = defaultCrop.name;
  }

  // Extract soil
  const matchedSoil = findSoil(
    raw.soilProfileName,
    raw.soil_profile_name,
    raw.soil,
    raw.soilProfileId,
    raw.soil_profile_id,
  );

  let soilProfileId = matchedSoil ? matchedSoil.id : (raw.soilProfileId ?? raw.soil_profile_id ?? '');
  let soilProfileName = matchedSoil ? matchedSoil.name : (raw.soilProfileName ?? raw.soil_profile_name ?? raw.soil ?? '');
  let soil = matchedSoil ? matchedSoil.name : (raw.soil ?? soilProfileName);

  if (!matchedSoil && mode === 'create') {
    const defaultSoil = SOILS.find((s) => s.type === 'Sandy Loam') ?? SOILS[1] ?? SOILS[0];
    soilProfileId = defaultSoil.id;
    soilProfileName = defaultSoil.name;
    soil = defaultSoil.name;
  }

  // Extract planting date
  let plantingDate = '';
  if (typeof raw.plantingDate === 'string' && raw.plantingDate.trim()) {
    plantingDate = raw.plantingDate.trim();
  } else if (typeof raw.planting_date === 'string' && raw.planting_date.trim()) {
    plantingDate = raw.planting_date.trim();
  } else if (mode === 'create') {
    plantingDate = getTodayDateString();
  }

  // Extract field ID
  const fieldId = raw.fieldId ?? raw.field_id ?? defaultFieldId ?? null;

  return {
    name,
    cropId,
    cropName,
    crop,
    soilProfileId,
    soilProfileName,
    soil,
    plantingDate,
    fieldId,
  };
}

export interface AreaSummaryStrings {
  areaText: string;
  perimeterText: string;
  verticesText: string;
}

/**
 * Formats parcel metrics into standardized human-readable strings for the area summary banner:
 * Area: "2.45 ha (6.05 acres)"
 * Perimeter: "Perimeter: 624 m"
 * Vertices: "Vertices: 5"
 */
export function formatAreaSummary(metrics?: ParcelMetrics | null): AreaSummaryStrings {
  if (!metrics) {
    return {
      areaText: '0.00 ha (0.00 acres)',
      perimeterText: 'Perimeter: 0 m',
      verticesText: 'Vertices: 0',
    };
  }

  const areaHa = typeof metrics.areaHa === 'number' && !isNaN(metrics.areaHa) ? metrics.areaHa : 0;
  const acres =
    typeof metrics.acres === 'number' && !isNaN(metrics.acres)
      ? metrics.acres
      : areaHa * 2.47105;
  const perimeterM =
    typeof metrics.perimeterM === 'number' && !isNaN(metrics.perimeterM)
      ? Math.round(metrics.perimeterM)
      : 0;
  const vertexCount =
    typeof metrics.vertexCount === 'number' && !isNaN(metrics.vertexCount)
      ? metrics.vertexCount
      : 0;

  return {
    areaText: `${areaHa.toFixed(2)} ha (${acres.toFixed(2)} acres)`,
    perimeterText: `Perimeter: ${perimeterM} m`,
    verticesText: `Vertices: ${vertexCount}`,
  };
}

/**
 * Normalizes parcel form fields and validates canonical identifiers.
 */
export function buildDrawerSubmitData(data: Partial<ParcelFormData>): ParcelFormData {
  const name = (data.name ?? '').trim();
  const matchedCrop = findCrop(
    data.cropName,
    (data as any)?.crop_name,
    data.crop,
    data.cropId,
    (data as any)?.crop_id,
  );

  const cropId = matchedCrop ? matchedCrop.id : (data.cropId || '');
  const cropName = matchedCrop ? matchedCrop.name : (data.cropName || data.crop || '');
  const crop = matchedCrop ? matchedCrop.name : (data.crop || cropName);

  const matchedSoil = findSoil(
    data.soilProfileName,
    (data as any)?.soil_profile_name,
    data.soil,
    data.soilProfileId,
    (data as any)?.soil_profile_id,
  );

  const soilProfileId = matchedSoil ? matchedSoil.id : (data.soilProfileId || '');
  const soilProfileName = matchedSoil ? matchedSoil.name : (data.soilProfileName || data.soil || '');
  const soil = matchedSoil ? matchedSoil.name : (data.soil || soilProfileName);

  const plantingDate = (data.plantingDate ?? '').trim();
  const fieldId = data.fieldId ?? null;

  return {
    name,
    cropId,
    cropName,
    crop,
    soilProfileId,
    soilProfileName,
    soil,
    plantingDate,
    fieldId,
  };
}

/**
 * Validates drawer form data.
 */
export function validateDrawerForm(data: Partial<ParcelFormData>): ParcelFormValidationResult {
  return validateParcelForm(data);
}

export interface DrawerSubmitResult {
  success: boolean;
  errors: Partial<Record<keyof ParcelFormData, string>>;
  data?: ParcelFormData;
}

/**
 * Handles drawer submission with validation gate.
 * If invalid, blocks callback and returns validation errors.
 * If valid, triggers onSave callback and returns normalized data.
 */
export function handleDrawerSubmit(
  data: Partial<ParcelFormData>,
  onSave?: (data: ParcelFormData) => Promise<void> | void,
): DrawerSubmitResult {
  const normalized = buildDrawerSubmitData(data);
  const validation = validateDrawerForm(normalized);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  if (onSave) {
    onSave(normalized);
  }

  return {
    success: true,
    errors: {},
    data: normalized,
  };
}
