/**
 * Type definitions for Leaf Disease Progression Engine (Feature #1 / TODO-107).
 * Corresponds to master database schema entities:
 * - diseases
 * - disease_progression_stages
 * - progression_visual_assets
 */

export type CropId = 'tomato' | 'potato' | 'corn' | 'apple';

export interface ProgressionAssetReference {
  base_image_url: string;
  mask_image_url: string | null;
}

export interface ProgressionStage {
  stage_order: number;
  stage_label: string;
  min_slider_pct: number;
  max_slider_pct: number;
  symptom_markers: string;
  agronomic_advice: string;
  color_palette_hex: string[];
  assets: ProgressionAssetReference;
}

export interface CropProgressionData {
  crop_id: CropId;
  crop_name: string;
  scientific_name: string;
  disease_name: string;
  pathogen_scientific: string;
  pathogen_type: string;
  resolution: {
    width: number;
    height: number;
  };
  stages: ProgressionStage[];
}

export interface ProgressionManifest {
  version: string;
  description: string;
  asset_spec: {
    format: string;
    resolution: string;
    channels: string;
    target_size_limit_kb: number;
  };
  crops: CropProgressionData[];
}
