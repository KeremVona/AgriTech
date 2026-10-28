import type {
  CropCategory,
  CropDefinition,
  CropPalette,
  DapCalculation,
  ParcelFormData,
  ParcelFormValidationResult,
  SoilDefinition,
} from '../types/parcelMetadata.ts';

/**
 * Standardized semantic color pairing palette for crop categories.
 * Tomato: Emerald 500 (#10B981)
 * Corn: Amber 500 (#F59E0B)
 * Potato: Violet 500 (#8B5CF6)
 * Apple: Pink 500 (#EC4899)
 */
export const CROP_PALETTES: Record<CropCategory, CropPalette> = {
  Tomato: {
    stroke: '#10B981',
    fill: 'rgba(16, 185, 129, 0.18)',
    selected: '#047857',
  },
  Corn: {
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.18)',
    selected: '#B45309',
  },
  Potato: {
    stroke: '#8B5CF6',
    fill: 'rgba(139, 92, 246, 0.18)',
    selected: '#6D28D9',
  },
  Apple: {
    stroke: '#EC4899',
    fill: 'rgba(236, 72, 153, 0.18)',
    selected: '#BE185D',
  },
};

/**
 * Fallback Bio-Teal color tokens for parcels without assigned crops or unknown varieties.
 */
export const DEFAULT_CROP_PALETTE: CropPalette = {
  stroke: '#0F766E',
  fill: 'rgba(15, 118, 110, 0.18)',
  selected: '#115E59',
};

/**
 * Canonical crop catalog defining the 4 standard agricultural varieties.
 */
export const CROPS: CropDefinition[] = [
  {
    id: 'crop-tomato',
    name: 'Tomato',
    commonName: 'Tomato',
    category: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    family: 'Solanaceae',
    emoji: '🍅',
    palette: CROP_PALETTES.Tomato,
  },
  {
    id: 'crop-corn',
    name: 'Corn (Maize)',
    commonName: 'Corn (Maize)',
    category: 'Corn',
    scientificName: 'Zea mays',
    family: 'Poaceae',
    emoji: '🌽',
    palette: CROP_PALETTES.Corn,
  },
  {
    id: 'crop-potato',
    name: 'Potato',
    commonName: 'Potato',
    category: 'Potato',
    scientificName: 'Solanum tuberosum',
    family: 'Solanaceae',
    emoji: '🥔',
    palette: CROP_PALETTES.Potato,
  },
  {
    id: 'crop-apple',
    name: 'Apple',
    commonName: 'Apple',
    category: 'Apple',
    scientificName: 'Malus domestica',
    family: 'Rosaceae',
    emoji: '🍏',
    palette: CROP_PALETTES.Apple,
  },
];

/**
 * Canonical soil profile catalog defining the 4 standard soil textures and agronomic properties.
 */
export const SOILS: SoilDefinition[] = [
  {
    id: 'sand',
    name: 'Sand',
    type: 'Sand',
    thetaFc: 0.12,
    fieldCapacity: 0.12,
    description: 'Low water retention, rapid drainage',
  },
  {
    id: 'sandy_loam',
    name: 'Sandy Loam',
    type: 'Sandy Loam',
    thetaFc: 0.22,
    fieldCapacity: 0.22,
    description: 'Recommended agronomic balance, optimal drainage',
  },
  {
    id: 'silt',
    name: 'Silt',
    type: 'Silt',
    thetaFc: 0.31,
    fieldCapacity: 0.31,
    description: 'High moisture retention, medium aeration',
  },
  {
    id: 'clay',
    name: 'Clay',
    type: 'Clay',
    thetaFc: 0.38,
    fieldCapacity: 0.38,
    description: 'Very high retention, heavy compaction risk',
  },
];

/**
 * Searches the canonical crops catalog for a match against candidate strings.
 * Candidates are evaluated in order; the first matching catalog definition is returned.
 */
export function findCrop(...candidates: unknown[]): CropDefinition | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim().toLowerCase();
    if (!trimmed) continue;
    const match = CROPS.find(
      (c) =>
        c.id.toLowerCase() === trimmed ||
        c.name.toLowerCase() === trimmed ||
        c.commonName.toLowerCase() === trimmed ||
        c.category.toLowerCase() === trimmed ||
        c.scientificName.toLowerCase() === trimmed
    );
    if (match) return match;
  }
  return undefined;
}

/**
 * Searches the canonical soil catalog for a match against candidate strings.
 * Candidates are evaluated in order; the first matching catalog definition is returned.
 */
export function findSoil(...candidates: unknown[]): SoilDefinition | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim().toLowerCase();
    if (!trimmed) continue;
    const match = SOILS.find(
      (s) =>
        s.id.toLowerCase() === trimmed ||
        s.name.toLowerCase() === trimmed ||
        s.type.toLowerCase() === trimmed
    );
    if (match) return match;
  }
  return undefined;
}



/**
 * Calculates Days After Planting (DAP) and determines the physiological growth stage.
 *
 * Growth Stages:
 * - days < 0: Pre-Planting (Upcoming)
 * - 0 <= days <= 20: Early / Germination
 * - 21 <= days <= 60: Development Stage
 * - 61 <= days <= 90: Mid-Season / Flowering
 * - days > 90: Late / Maturity
 *
 * @param plantingDate Planting date string in 'YYYY-MM-DD' format.
 * @param referenceDate Optional reference date (defaults to current date).
 */
export function calculateDap(
  plantingDate?: string | null,
  referenceDate: Date = new Date(),
): DapCalculation {
  if (!plantingDate || typeof plantingDate !== 'string' || !plantingDate.trim()) {
    return { days: 0, stage: 'Unknown', formatted: 'Date required' };
  }

  const match = plantingDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { days: 0, stage: 'Unknown', formatted: 'Date required' };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return { days: 0, stage: 'Unknown', formatted: 'Date required' };
  }

  const plantUtc = Date.UTC(year, month - 1, day);
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();
  const refUtc = Date.UTC(refYear, refMonth, refDay);

  const diffMs = refUtc - plantUtc;
  const days = Math.round(diffMs / 86400000);

  if (days < 0) {
    const upcomingDays = Math.abs(days);
    return {
      days,
      stage: 'Pre-Planting',
      formatted: `Upcoming (In ${upcomingDays} day${upcomingDays === 1 ? '' : 's'})`,
    };
  }

  if (days <= 20) {
    return {
      days,
      stage: 'Early / Germination',
      formatted: `DAP: ${days} Days (Early / Germination)`,
    };
  }

  if (days <= 60) {
    return {
      days,
      stage: 'Development Stage',
      formatted: `DAP: ${days} Days (Development Stage)`,
    };
  }

  if (days <= 90) {
    return {
      days,
      stage: 'Mid-Season / Flowering',
      formatted: `DAP: ${days} Days (Mid-Season / Flowering)`,
    };
  }

  return {
    days,
    stage: 'Late / Maturity',
    formatted: `DAP: ${days} Days (Late / Maturity)`,
  };
}

/**
 * Resolves the visual stroke and translucent fill palette for a given crop identifier or name.
 * Accepts common names, categories, scientific names, or crop IDs.
 * Falls back to the Bio-Teal palette for unassigned or unrecognized varieties.
 */
export function resolveCropPalette(cropIdentifier?: string | null): CropPalette {
  if (!cropIdentifier || typeof cropIdentifier !== 'string') {
    return DEFAULT_CROP_PALETTE;
  }

  const normalized = cropIdentifier.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_CROP_PALETTE;
  }

  if (
    normalized.includes('tomato') ||
    normalized.includes('lycopersicum') ||
    normalized === 'crop-tomato'
  ) {
    return CROP_PALETTES.Tomato;
  }

  if (
    normalized.includes('corn') ||
    normalized.includes('maize') ||
    normalized.includes('zea') ||
    normalized === 'crop-corn'
  ) {
    return CROP_PALETTES.Corn;
  }

  if (
    normalized.includes('potato') ||
    normalized.includes('tuberosum') ||
    normalized === 'crop-potato'
  ) {
    return CROP_PALETTES.Potato;
  }

  if (
    normalized.includes('apple') ||
    normalized.includes('malus') ||
    normalized === 'crop-apple'
  ) {
    return CROP_PALETTES.Apple;
  }

  return DEFAULT_CROP_PALETTE;
}

/**
 * Validates parcel form data before boundary creation or metadata updates.
 */
export function validateParcelForm(
  data: Partial<ParcelFormData>,
): ParcelFormValidationResult {
  const errors: Partial<Record<keyof ParcelFormData, string>> = {};

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.name = 'Parcel name is required';
  }

  const matchedCrop = findCrop(
    data.cropName,
    (data as any)?.crop_name,
    data.crop,
    data.cropId,
    (data as any)?.crop_id,
  );
  const hasValidCrop = Boolean(matchedCrop);

  if (!hasValidCrop) {
    errors.cropId = 'Please select a valid crop';
    errors.cropName = 'Please select a valid crop';
    errors.crop = 'Please select a valid crop';
  }

  const matchedSoil = findSoil(
    data.soilProfileName,
    (data as any)?.soil_profile_name,
    data.soil,
    data.soilProfileId,
    (data as any)?.soil_profile_id,
  );
  const hasValidSoil = Boolean(matchedSoil);

  if (!hasValidSoil) {
    errors.soilProfileId = 'Please select a valid soil profile';
    errors.soilProfileName = 'Please select a valid soil profile';
    errors.soil = 'Please select a valid soil profile';
  }

  const isDateValid = Boolean(
    data.plantingDate &&
      typeof data.plantingDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.plantingDate.trim()) &&
      !isNaN(Date.parse(data.plantingDate.trim())),
  );

  if (!isDateValid) {
    errors.plantingDate = 'Please provide a valid planting date';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Constructs an RFC 7946 GeoJSON compliant parcel creation DTO payload.
 * Supports both canonical names (cropId, cropName, soilProfileId, soilProfileName)
 * and shorthand fields (crop, soil).
 */
export function buildParcelCreatePayload(
  data: ParcelFormData,
  geometry: any,
  areaHa: number,
): Record<string, any> {
  const cropValue = (data.cropId || data.cropName || data.crop || '').trim().toLowerCase();
  const matchedCrop = CROPS.find(
    (c) =>
      c.id.toLowerCase() === cropValue ||
      c.name.toLowerCase() === cropValue ||
      c.commonName.toLowerCase() === cropValue ||
      c.category.toLowerCase() === cropValue ||
      c.scientificName.toLowerCase() === cropValue,
  );

  const soilValue = (data.soilProfileId || data.soilProfileName || data.soil || '').trim().toLowerCase();
  const matchedSoil = SOILS.find(
    (s) =>
      s.id.toLowerCase() === soilValue ||
      s.name.toLowerCase() === soilValue ||
      s.type.toLowerCase() === soilValue,
  );

  const cropId = data.cropId || matchedCrop?.id || data.crop || '';
  const cropName = data.cropName || matchedCrop?.name || matchedCrop?.commonName || data.crop || '';
  const soilProfileId = data.soilProfileId || matchedSoil?.id || data.soil || '';
  const soilProfileName = data.soilProfileName || matchedSoil?.name || matchedSoil?.type || data.soil || '';

  return {
    field_id: data.fieldId ?? null,
    name: data.name,
    crop_id: cropId,
    crop_name: cropName,
    soil_profile_id: soilProfileId,
    soil_profile_name: soilProfileName,
    planting_date: data.plantingDate,
    area_hectares: areaHa,
    irrigation_method: 'DRIP',
    system_flow_rate_lpm: 100.0,
    irrigation_efficiency: 0.88,
    geometry,
  };
}
