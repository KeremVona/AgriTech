/**
 * Disease Progression Viewer Types & UI Contracts (SPEC-UI-007)
 */

import type { SupportedCropId } from '../../models/agronomicTimelineModel.ts';

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
