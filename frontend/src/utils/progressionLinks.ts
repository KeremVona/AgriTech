import type { SupportedCropId } from '../types/progression.ts';

/**
 * Progression simulations whose disease the leaf-diagnosis model can also detect, as ml-service
 * `SUPPORTED_CLASSES` keys (`crop/condition`). `null` = simulation only (the scan can't detect it).
 * Kept in sync with ml-service by scripts/test_progression_links.js.
 */
export const PROGRESSION_DIAGNOSIS_KEY: Record<SupportedCropId, string | null> = {
  tomato: 'tomato/early_blight',
  potato: 'potato/late_blight',
  corn: 'corn/common_rust',
  apple: 'apple/scab',
  grape: null, // simulation shows black rot; the scan detects downy mildew and esca
  pepper: null,
  peach: null,
  squash: null,
};

const PROGRESSION_CROPS = Object.keys(PROGRESSION_DIAGNOSIS_KEY) as SupportedCropId[];

const slug = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** The `crop/condition` key of a diagnosis (uses the model's class key when present). */
export function diagnosisKey(crop: string, condition: string, classKey?: string | null): string {
  return classKey?.trim() ? classKey.trim().toLowerCase() : `${slug(crop)}/${slug(condition)}`;
}

/** Progression crop to open for a diagnosis, or null when no simulation matches it. */
export function progressionCropForDiagnosis(crop: string, condition: string, classKey?: string | null): SupportedCropId | null {
  const key = diagnosisKey(crop, condition, classKey);
  return PROGRESSION_CROPS.find((id) => PROGRESSION_DIAGNOSIS_KEY[id] === key) ?? null;
}

export function isScanDetectable(cropId: SupportedCropId): boolean {
  return PROGRESSION_DIAGNOSIS_KEY[cropId] !== null;
}

export function progressionPath(cropId: SupportedCropId): string {
  return `/disease-progression?crop=${encodeURIComponent(cropId)}`;
}

/** Reads `?crop=` from a location search string; ignores unknown values. */
export function readProgressionCrop(search: string): SupportedCropId | null {
  const value = new URLSearchParams(search).get('crop');
  return value && (PROGRESSION_CROPS as string[]).includes(value) ? (value as SupportedCropId) : null;
}
