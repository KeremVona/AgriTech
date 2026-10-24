/**
 * Disease Progression Viewer Types & UI Contracts (SPEC-UI-007)
 */

import type { SupportedCropId } from '../../types/progression.ts';

export type ProgressionViewMode = 'rgb' | 'attention' | 'mask';

export type TrajectoryViewMode = 'untreated' | 'treated' | 'split';

export type ComparisonMode = 'single' | 'split' | 'overlay';

export interface TextureSources {
  stage0: string;
  stage1: string;
  stage2: string;
  mask1?: string | null;
  mask2?: string | null;
}

export interface ShaderRenderOptions {
  viewMode?: ProgressionViewMode;
  splitEnabled?: boolean;
  splitPosition?: number;
}

export interface CropSpecimenItem {
  id: SupportedCropId;
  label: string;
  icon: string;
  subtitle: string;
  family: string;
}

export const DEFAULT_CROP_SPECIMENS: CropSpecimenItem[] = [
  { id: 'tomato', label: 'Tomato', icon: '🍅', subtitle: 'Early Blight', family: 'Solanaceae' },
  { id: 'potato', label: 'Potato', icon: '🥔', subtitle: 'Late Blight', family: 'Solanaceae' },
  { id: 'corn', label: 'Corn', icon: '🌽', subtitle: 'Common Rust', family: 'Poaceae' },
  { id: 'apple', label: 'Apple', icon: '🍎', subtitle: 'Apple Scab', family: 'Rosaceae' },
  { id: 'grape', label: 'Grape', icon: '🍇', subtitle: 'Black Rot', family: 'Vitaceae' },
  { id: 'pepper', label: 'Pepper', icon: '🫑', subtitle: 'Bacterial Spot', family: 'Solanaceae' },
  { id: 'peach', label: 'Peach', icon: '🍑', subtitle: 'Bacterial Spot', family: 'Rosaceae' },
  { id: 'squash', label: 'Squash', icon: '🎃', subtitle: 'Powdery Mildew', family: 'Cucurbitaceae' },
];
