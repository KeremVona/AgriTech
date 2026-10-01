import type { ProgressionManifest, CropProgressionData, CropId, ProgressionStage } from '../types/progression';

let cachedManifest: ProgressionManifest | null = null;

/**
 * Service to load and query disease progression manifest and assets.
 * Operates client-side with zero backend dependency (offline-ready).
 */
export async function getProgressionManifest(): Promise<ProgressionManifest> {
  if (cachedManifest) {
    return cachedManifest;
  }

  try {
    const response = await fetch('/progression/manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to load progression manifest: HTTP ${response.status}`);
    }
    const data: ProgressionManifest = await response.json();
    cachedManifest = data;
    return data;
  } catch (error) {
    console.warn('[progressionService] Falling back to embedded manifest cache:', error);
    // Return embedded baseline if network/server fetch fails
    return getFallbackManifest();
  }
}

/**
 * Retrieves the progression configuration for a specific crop.
 */
export async function getCropProgression(cropId: CropId): Promise<CropProgressionData | null> {
  const manifest = await getProgressionManifest();
  const crop = manifest.crops.find((c) => c.crop_id === cropId);
  return crop ?? null;
}

/**
 * Resolves active progression stage for a given percentage (0 to 100).
 */
export function resolveStageByPercentage(stages: ProgressionStage[], percentage: number): ProgressionStage {
  const clamped = Math.max(0, Math.min(100, percentage));
  const matched = stages.find((s) => clamped >= s.min_slider_pct && clamped <= s.max_slider_pct);
  return matched ?? stages[stages.length - 1];
}

/**
 * Embedded fallback manifest guaranteeing zero downtime when offline or backend unavailable.
 */
function getFallbackManifest(): ProgressionManifest {
  return {
    version: '1.0.0-fallback',
    description: 'Embedded Fallback Morphological Leaf Disease Progression Manifest',
    asset_spec: {
      format: 'WEBP',
      resolution: '800x800',
      channels: 'RGBA',
      target_size_limit_kb: 150,
    },
    crops: [
      {
        crop_id: 'tomato',
        crop_name: 'Tomato',
        scientific_name: 'Solanum lycopersicum',
        disease_name: 'Early Blight',
        pathogen_scientific: 'Alternaria solani',
        pathogen_type: 'FUNGAL',
        resolution: { width: 800, height: 800 },
        stages: [
          {
            stage_order: 0,
            stage_label: 'Asymptomatic Baseline',
            min_slider_pct: 0.0,
            max_slider_pct: 30.0,
            symptom_markers: 'Healthy turgid leaflet with intact lamina and normal chlorophyll pigmentation.',
            agronomic_advice: 'Maintain preventive cultural hygiene; ensure drip irrigation to avoid foliar wetness.',
            color_palette_hex: ['#2D6A4F', '#52B788', '#74C69D'],
            assets: {
              base_image_url: '/progression/tomato/tomato_stage0_healthy.webp',
              mask_image_url: null,
            },
          },
          {
            stage_order: 1,
            stage_label: 'Early Concentric Lesions',
            min_slider_pct: 30.01,
            max_slider_pct: 70.0,
            symptom_markers: 'Discrete brown-black lesions with faint yellow chlorotic halos and emerging concentric rings.',
            agronomic_advice: 'Apply preventive copper hydroxide or chlorothalonil barrier before upcoming rain.',
            color_palette_hex: ['#D4A373', '#E9C46A', '#582F0E'],
            assets: {
              base_image_url: '/progression/tomato/tomato_stage1_early.webp',
              mask_image_url: '/progression/tomato/tomato_stage1_mask.webp',
            },
          },
          {
            stage_order: 2,
            stage_label: 'Severe Necrosis & Defoliation',
            min_slider_pct: 70.01,
            max_slider_pct: 100.0,
            symptom_markers: 'Extensive coalescing necrotic blotches and tissue collapse leading to blight defoliation.',
            agronomic_advice: 'Isolate infected stems; apply systemic fungicide; lock out overhead irrigation.',
            color_palette_hex: ['#BC6C25', '#3D2616', '#1D1208'],
            assets: {
              base_image_url: '/progression/tomato/tomato_stage2_severe.webp',
              mask_image_url: '/progression/tomato/tomato_stage2_mask.webp',
            },
          },
        ],
      },
      {
        crop_id: 'potato',
        crop_name: 'Potato',
        scientific_name: 'Solanum tuberosum',
        disease_name: 'Late Blight',
        pathogen_scientific: 'Phytophthora infestans',
        pathogen_type: 'OOMYCETE / FUNGAL',
        resolution: { width: 800, height: 800 },
        stages: [
          {
            stage_order: 0,
            stage_label: 'Asymptomatic Baseline',
            min_slider_pct: 0.0,
            max_slider_pct: 30.0,
            symptom_markers: 'Vibrant emerald green leaf blade with smooth margins and healthy stomatal turgor.',
            agronomic_advice: 'Inspect field margins; monitor ambient relative humidity and leaf wetness hours.',
            color_palette_hex: ['#285943', '#4A8B66', '#78B48C'],
            assets: {
              base_image_url: '/progression/potato/potato_stage0_healthy.webp',
              mask_image_url: null,
            },
          },
          {
            stage_order: 1,
            stage_label: 'Water-Soaked Margins',
            min_slider_pct: 30.01,
            max_slider_pct: 70.0,
            symptom_markers: 'Irregular pale water-soaked grayish lesions emerging on leaf margins.',
            agronomic_advice: 'Initiate protective spray program (metalaxyl/mancozeb) prior to prolonged wet periods.',
            color_palette_hex: ['#859B7A', '#6B8E6B', '#C8B88A'],
            assets: {
              base_image_url: '/progression/potato/potato_stage1_early.webp',
              mask_image_url: '/progression/potato/potato_stage1_mask.webp',
            },
          },
          {
            stage_order: 2,
            stage_label: 'Severe Necrotic Blight',
            min_slider_pct: 70.01,
            max_slider_pct: 100.0,
            symptom_markers: 'Dark purplish-black necrotic collapse with white sporulation mycelial halos.',
            agronomic_advice: 'Emergency systemic intervention; halt overhead watering immediately.',
            color_palette_hex: ['#2B1D19', '#3D231E', '#9A988D'],
            assets: {
              base_image_url: '/progression/potato/potato_stage2_severe.webp',
              mask_image_url: '/progression/potato/potato_stage2_mask.webp',
            },
          },
        ],
      },
      {
        crop_id: 'corn',
        crop_name: 'Corn (Maize)',
        scientific_name: 'Zea mays',
        disease_name: 'Common Rust',
        pathogen_scientific: 'Puccinia sorghi',
        pathogen_type: 'FUNGAL',
        resolution: { width: 800, height: 800 },
        stages: [
          {
            stage_order: 0,
            stage_label: 'Asymptomatic Baseline',
            min_slider_pct: 0.0,
            max_slider_pct: 30.0,
            symptom_markers: 'Uniform linear blade with prominent central midrib and parallel striations.',
            agronomic_advice: 'Ensure balanced nitrogen nutrition; scout lower canopy during early vegetative stages.',
            color_palette_hex: ['#386641', '#6A994E', '#B5E48C'],
            assets: {
              base_image_url: '/progression/corn/corn_stage0_healthy.webp',
              mask_image_url: null,
            },
          },
          {
            stage_order: 1,
            stage_label: 'Active Pustule Eruption',
            min_slider_pct: 30.01,
            max_slider_pct: 70.0,
            symptom_markers: 'Small oval cinnamon-brown pustules erupting along parallel veins with chlorotic halos.',
            agronomic_advice: 'Monitor rust pustule coverage on ear leaf; evaluate triazole or strobilurin threshold.',
            color_palette_hex: ['#CB6824', '#D97724', '#E9D8A6'],
            assets: {
              base_image_url: '/progression/corn/corn_stage1_early.webp',
              mask_image_url: '/progression/corn/corn_stage1_mask.webp',
            },
          },
          {
            stage_order: 2,
            stage_label: 'Severe Pustule Coalescence',
            min_slider_pct: 70.01,
            max_slider_pct: 100.0,
            symptom_markers: 'Dense coalescent dark reddish-brown to black teliospores causing premature leaf death.',
            agronomic_advice: 'Apply fungicide if rust threatens upper canopy before dent stage (R5).',
            color_palette_hex: ['#49111C', '#5E1914', '#2E080D'],
            assets: {
              base_image_url: '/progression/corn/corn_stage2_severe.webp',
              mask_image_url: '/progression/corn/corn_stage2_mask.webp',
            },
          },
        ],
      },
      {
        crop_id: 'apple',
        crop_name: 'Apple',
        scientific_name: 'Malus domestica',
        disease_name: 'Apple Scab',
        pathogen_scientific: 'Venturia inaequalis',
        pathogen_type: 'FUNGAL',
        resolution: { width: 800, height: 800 },
        stages: [
          {
            stage_order: 0,
            stage_label: 'Asymptomatic Baseline',
            min_slider_pct: 0.0,
            max_slider_pct: 30.0,
            symptom_markers: 'Broad elliptical glossy apple foliage with fine marginal serrations and rich green cuticle.',
            agronomic_advice: 'Maintain seasonal primary scab ascospore monitoring; schedule preventive cover sprays.',
            color_palette_hex: ['#2D5A27', '#539032', '#80B918'],
            assets: {
              base_image_url: '/progression/apple/apple_stage0_healthy.webp',
              mask_image_url: null,
            },
          },
          {
            stage_order: 1,
            stage_label: 'Velvety Olive Lesions',
            min_slider_pct: 30.01,
            max_slider_pct: 70.0,
            symptom_markers: 'Dull olive-green to smoky velvety spots developing with slight leaf crinkling.',
            agronomic_advice: 'Apply kick-back curative fungicides (difenoconazole) within 72 hours of infection.',
            color_palette_hex: ['#555B38', '#474E2B', '#8C8343'],
            assets: {
              base_image_url: '/progression/apple/apple_stage1_early.webp',
              mask_image_url: '/progression/apple/apple_stage1_mask.webp',
            },
          },
          {
            stage_order: 2,
            stage_label: 'Corky Scab Necrosis',
            min_slider_pct: 70.01,
            max_slider_pct: 100.0,
            symptom_markers: 'Thickened dark corky scab lesions, extensive chlorotic yellowing, and puckered distortion.',
            agronomic_advice: 'Apply autumn urea spray or shredded leaf sanitation to reduce overwintering inocula.',
            color_palette_hex: ['#1F2416', '#2D1F14', '#C9A227'],
            assets: {
              base_image_url: '/progression/apple/apple_stage2_severe.webp',
              mask_image_url: '/progression/apple/apple_stage2_mask.webp',
            },
          },
        ],
      },
    ],
  };
}
