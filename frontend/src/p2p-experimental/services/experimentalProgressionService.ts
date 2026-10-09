import type { SupportedCropId } from '../models/agronomicTimelineModel.ts';
import type { ProgressionStage } from '../../types/progression';

export interface ExperimentalCropProgressionData {
  crop_id: SupportedCropId;
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

export interface ExperimentalProgressionManifest {
  version: string;
  description: string;
  asset_spec: {
    format: string;
    resolution: string;
    channels: string;
    target_size_limit_kb: number;
  };
  crops: ExperimentalCropProgressionData[];
}

/**
 * 8-Crop Complete Experimental Manifest.
 * Guarantees zero downtime and complete offline availability for all 8 priority crops.
 */
export const EXPERIMENTAL_8CROPS_MANIFEST: ExperimentalProgressionManifest = {
  version: '2.0.0-experimental-8crops',
  description: '8-Crop Precision AgriTech Disease Progression Manifest',
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
          symptom_markers:
            'Healthy turgid leaflet with intact lamina, normal chlorophyll pigmentation, and crisp venation.',
          agronomic_advice:
            'Maintain preventive cultural hygiene; ensure drip irrigation to avoid foliar wetness.',
          color_palette_hex: ['#2D6A4F', '#52B788', '#74C69D'],
          assets: {
            base_image_url: '/progression-experimental/tomato/tomato_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Early Concentric Lesions',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Discrete brown-black lesions with faint yellow chlorotic halos; emerging concentric target-like rings on lower foliage.',
          agronomic_advice:
            'Apply preventive copper hydroxide or chlorothalonil barrier before upcoming precipitation events.',
          color_palette_hex: ['#D4A373', '#E9C46A', '#582F0E'],
          assets: {
            base_image_url: '/progression-experimental/tomato/tomato_stage1_early.webp',
            mask_image_url: '/progression-experimental/tomato/tomato_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Severe Necrosis & Defoliation',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Extensive coalescing necrotic blotches, brittle necrotic leaf tissue collapse, and widespread chlorosis leading to blight defoliation.',
          agronomic_advice:
            'Immediately prune and isolate infected stems; apply systemic fungicide (mancozeb/difenoconazole); lock out overhead irrigation.',
          color_palette_hex: ['#BC6C25', '#3D2616', '#1D1208'],
          assets: {
            base_image_url: '/progression-experimental/tomato/tomato_stage2_severe.webp',
            mask_image_url: '/progression-experimental/tomato/tomato_stage2_mask.webp',
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
          symptom_markers:
            'Vibrant emerald green leaf blade with smooth ovate margins, healthy stomatal turgor, and zero necrotic marks.',
          agronomic_advice:
            'Inspect field margins; monitor ambient relative humidity and leaf wetness hours.',
          color_palette_hex: ['#285943', '#4A8B66', '#78B48C'],
          assets: {
            base_image_url: '/progression-experimental/potato/potato_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Water-Soaked Marginal Lesions',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Irregular water-soaked olive-brown lesions developing rapidly along leaf margins and tips; fine white downy fungal sporangia on underside under high RH.',
          agronomic_advice:
            'Immediate curative fungicide application (cymoxanil / mandipropamid); enforce zero overhead irrigation.',
          color_palette_hex: ['#6B705C', '#A5A58D', '#B7B7A4'],
          assets: {
            base_image_url: '/progression-experimental/potato/potato_stage1_early.webp',
            mask_image_url: '/progression-experimental/potato/potato_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Catastrophic Blight Collapse',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Large purplish-black rotting blotches engulfing entire leaf lamina; complete petiole collapse; field emits characteristic odor of rotting blight.',
          agronomic_advice:
            'Burn down foliage to prevent tuber contamination; destroy volunteer plants; rotate Solanaceous fields.',
          color_palette_hex: ['#3F4238', '#1C1D17', '#0A0B08'],
          assets: {
            base_image_url: '/progression-experimental/potato/potato_stage2_severe.webp',
            mask_image_url: '/progression-experimental/potato/potato_stage2_mask.webp',
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
          symptom_markers:
            'Long lanceolate healthy corn leaf blade with deep green parallel venation and zero visible fungal pustules.',
          agronomic_advice:
            'Scout upper whorl leaves weekly; assess regional rust spores carried by wind currents.',
          color_palette_hex: ['#386641', '#6A994E', '#A7C957'],
          assets: {
            base_image_url: '/progression-experimental/corn/corn_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Erupting Cinnamon Rust Pustules',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Elongated oval cinnamon-brown powdery pustules (uredinia) scattered across upper and lower surfaces, rupturing epidermal cells.',
          agronomic_advice:
            'Apply strobilurin (azoxystrobin) or triazole (propiconazole) if pustules reach ear leaf prior to silking.',
          color_palette_hex: ['#BC6C25', '#D4A373', '#7F4F24'],
          assets: {
            base_image_url: '/progression-experimental/corn/corn_stage1_early.webp',
            mask_image_url: '/progression-experimental/corn/corn_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Severe Confluent Telia Necrosis',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Pustules turn brownish-black (teliospores) and coalesce into extensive necrotic scorched strips, causing premature leaf drying and lodging.',
          agronomic_advice:
            'Select resistant hybrid corn cultivars for subsequent seasons; deep plow crop residue to bury spores.',
          color_palette_hex: ['#582F0E', '#3D1308', '#260802'],
          assets: {
            base_image_url: '/progression-experimental/corn/corn_stage2_severe.webp',
            mask_image_url: '/progression-experimental/corn/corn_stage2_mask.webp',
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
          symptom_markers:
            'Crisp elliptical dark-green apple leaf blade with finely serrated margins, bright central midrib, and intact cuticle.',
          agronomic_advice:
            'Apply protective fungicide barrier at green tip bud stage ahead of primary ascospore discharge.',
          color_palette_hex: ['#2D6A4F', '#40916C', '#52B788'],
          assets: {
            base_image_url: '/progression-experimental/apple/apple_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Velvety Olive Scab Spots',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Circular dull olive-green to smoky black velvety lesions on upper leaf surface, causing curling and crinkling of leaf blade.',
          agronomic_advice:
            'Apply curative DMI / anilinopyrimidine fungicide (cyprodinil / difenoconazole) within 72h Mills infection period.',
          color_palette_hex: ['#4A5320', '#606C38', '#283618'],
          assets: {
            base_image_url: '/progression-experimental/apple/apple_stage1_early.webp',
            mask_image_url: '/progression-experimental/apple/apple_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Corky Scab Necrosis & Abscission',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Lesions become thick, raised, and corky brown; severe distortion, cracking, and premature yellowing leading to total leaf drop.',
          agronomic_advice:
            'Mow fallen leaf litter post-harvest and spray 5% urea solution to accelerate winter leaf breakdown.',
          color_palette_hex: ['#3D2616', '#261405', '#140A02'],
          assets: {
            base_image_url: '/progression-experimental/apple/apple_stage2_severe.webp',
            mask_image_url: '/progression-experimental/apple/apple_stage2_mask.webp',
          },
        },
      ],
    },
    {
      crop_id: 'grape',
      crop_name: 'Grape',
      scientific_name: 'Vitis vinifera',
      disease_name: 'Black Rot',
      pathogen_scientific: 'Guignardia bidwellii / Phyllosticta ampelicida',
      pathogen_type: 'FUNGAL',
      resolution: { width: 800, height: 800 },
      stages: [
        {
          stage_order: 0,
          stage_label: 'Asymptomatic Baseline',
          min_slider_pct: 0.0,
          max_slider_pct: 30.0,
          symptom_markers:
            'Vibrant 5-lobed palmate healthy leaf blade with intact dentate margins and crisp radiating venation.',
          agronomic_advice:
            'Ensure adequate trellis airflow; apply preventive copper or mancozeb before extended rain events.',
          color_palette_hex: ['#2D6A4F', '#40916C', '#74C69D'],
          assets: {
            base_image_url: '/progression-experimental/grape/grape_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Early Pycnidial Spots',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Discrete reddish-brown circular spots with dark brown margins and an organized ring of black pycnidia.',
          agronomic_advice:
            'Apply curative DMI fungicide (Difenoconazole) within 72h kickback window post-infection.',
          color_palette_hex: ['#7F4F24', '#936639', '#DDB892'],
          assets: {
            base_image_url: '/progression-experimental/grape/grape_stage1_early.webp',
            mask_image_url: '/progression-experimental/grape/grape_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Severe Foliar Blight & Mummying',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Coalescing dark necrotic lesions, rings of black pycnidia, crisp margin curling, and berry mummification.',
          agronomic_advice:
            'Combine eradicant strobilurin with strict mechanical winter pruning and removal of dried mummies.',
          color_palette_hex: ['#493B2A', '#2E2214', '#17100A'],
          assets: {
            base_image_url: '/progression-experimental/grape/grape_stage2_severe.webp',
            mask_image_url: '/progression-experimental/grape/grape_stage2_mask.webp',
          },
        },
      ],
    },
    {
      crop_id: 'pepper',
      crop_name: 'Pepper Bell',
      scientific_name: 'Capsicum annuum',
      disease_name: 'Bacterial Spot',
      pathogen_scientific: 'Xanthomonas euvesicatoria',
      pathogen_type: 'BACTERIAL',
      resolution: { width: 800, height: 800 },
      stages: [
        {
          stage_order: 0,
          stage_label: 'Asymptomatic Baseline',
          min_slider_pct: 0.0,
          max_slider_pct: 30.0,
          symptom_markers:
            'Glossy smooth ovate healthy green leaf blade with firm turgor and unbroken stomatal surface.',
          agronomic_advice:
            'Use drip irrigation; ensure hot-water treated disease-free transplant stock.',
          color_palette_hex: ['#2D6A4F', '#52B788', '#74C69D'],
          assets: {
            base_image_url: '/progression-experimental/pepper/pepper_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Angular Water-Soaked Spots',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Angular vein-delineated water-soaked dark brown spots with vivid yellow chlorotic halos.',
          agronomic_advice:
            'Apply copper hydroxide tank-mixed with mancozeb to overcome copper resistance.',
          color_palette_hex: ['#CB997E', '#DDBEA9', '#6B705C'],
          assets: {
            base_image_url: '/progression-experimental/pepper/pepper_stage1_early.webp',
            mask_image_url: '/progression-experimental/pepper/pepper_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Severe Necrosis & Defoliation',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Coalesced ragged necrotic blotches, tear-out perforations, severe chlorosis, and petiole abscission.',
          agronomic_advice:
            'Sanitize fallen leaves; apply Kasugamycin or SAR inducers to protect emerging flushes.',
          color_palette_hex: ['#A5A58D', '#6B705C', '#3F4238'],
          assets: {
            base_image_url: '/progression-experimental/pepper/pepper_stage2_severe.webp',
            mask_image_url: '/progression-experimental/pepper/pepper_stage2_mask.webp',
          },
        },
      ],
    },
    {
      crop_id: 'peach',
      crop_name: 'Peach',
      scientific_name: 'Prunus persica',
      disease_name: 'Bacterial Spot',
      pathogen_scientific: 'Xanthomonas arboricola pv. pruni',
      pathogen_type: 'BACTERIAL',
      resolution: { width: 800, height: 800 },
      stages: [
        {
          stage_order: 0,
          stage_label: 'Asymptomatic Baseline',
          min_slider_pct: 0.0,
          max_slider_pct: 30.0,
          symptom_markers:
            'Slender lanceolate healthy green leaf blade with finely serrated margins and intact tip.',
          agronomic_advice:
            'Apply delayed-dormant copper at bud-swell; plant evergreen perimeter windbreaks.',
          color_palette_hex: ['#2D6A4F', '#52B788', '#95D5B2'],
          assets: {
            base_image_url: '/progression-experimental/peach/peach_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Shot-Hole Lesions',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Angular purplish-black spots whose necrotic centers separate and drop out, creating clean shot-holes.',
          agronomic_advice:
            'Apply low-rate copper or Oxytetracycline starting at petal fall to prevent twig cankers.',
          color_palette_hex: ['#7209B7', '#560BAD', '#480CA8'],
          assets: {
            base_image_url: '/progression-experimental/peach/peach_stage1_early.webp',
            mask_image_url: '/progression-experimental/peach/peach_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Severe Shot-Hole & Apical Scorch',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Dense riddled shot-hole perforations, necrotic tip scorch, yellowing, and terminal shoot defoliation.',
          agronomic_advice:
            'Prune blighted twigs during dry weather; spray post-harvest copper at 50% leaf drop in autumn.',
          color_palette_hex: ['#3A0CA3', '#3F37C9', '#4361EE'],
          assets: {
            base_image_url: '/progression-experimental/peach/peach_stage2_severe.webp',
            mask_image_url: '/progression-experimental/peach/peach_stage2_mask.webp',
          },
        },
      ],
    },
    {
      crop_id: 'squash',
      crop_name: 'Squash',
      scientific_name: 'Cucurbita pepo',
      disease_name: 'Powdery Mildew',
      pathogen_scientific: 'Podosphaera xanthii',
      pathogen_type: 'FUNGAL',
      resolution: { width: 800, height: 800 },
      stages: [
        {
          stage_order: 0,
          stage_label: 'Asymptomatic Baseline',
          min_slider_pct: 0.0,
          max_slider_pct: 30.0,
          symptom_markers:
            'Broad lobed healthy green leaf blade with prominent palmate venation and intact bristly cuticle.',
          agronomic_advice:
            'Ensure wide row spacing (1.5m) for maximum canopy airflow; inspect shaded lower leaves weekly.',
          color_palette_hex: ['#2D6A4F', '#40916C', '#52B788'],
          assets: {
            base_image_url: '/progression-experimental/squash/squash_stage0_healthy.webp',
            mask_image_url: null,
          },
        },
        {
          stage_order: 1,
          stage_label: 'Powdery Talc Spots',
          min_slider_pct: 30.01,
          max_slider_pct: 70.0,
          symptom_markers:
            'Discrete circular white talcum-powder-like fungal colonies spreading across lamina and veins.',
          agronomic_advice:
            'Apply translaminar DMI (Myclobutanil) or Potassium Bicarbonate to arrest superficial conidiophores.',
          color_palette_hex: ['#E9ECEF', '#CED4DA', '#ADB5BD'],
          assets: {
            base_image_url: '/progression-experimental/squash/squash_stage1_early.webp',
            mask_image_url: '/progression-experimental/squash/squash_stage1_mask.webp',
          },
        },
        {
          stage_order: 2,
          stage_label: 'Confluent Powdery Mats & Desiccation',
          min_slider_pct: 70.01,
          max_slider_pct: 100.0,
          symptom_markers:
            'Dense confluent white powdery mycelium covering lamina; severe chlorosis and crisp parchment margins.',
          agronomic_advice:
            'Protect younger crown leaves; maintain soil moisture; plow crop residues immediately after harvest.',
          color_palette_hex: ['#D4A373', '#BC6C25', '#A68A56'],
          assets: {
            base_image_url: '/progression-experimental/squash/squash_stage2_severe.webp',
            mask_image_url: '/progression-experimental/squash/squash_stage2_mask.webp',
          },
        },
      ],
    },
  ],
};

/**
 * Returns progression manifest containing all 8 priority crops.
 */
export async function getExperimentalProgressionManifest(): Promise<ExperimentalProgressionManifest> {
  return EXPERIMENTAL_8CROPS_MANIFEST;
}

/**
 * Retrieves progression data for any of the 8 supported crops.
 */
export async function getExperimentalCropProgression(
  cropId: SupportedCropId
): Promise<ExperimentalCropProgressionData | null> {
  const crop = EXPERIMENTAL_8CROPS_MANIFEST.crops.find((c) => c.crop_id === cropId);
  return crop ?? null;
}

/**
 * Resolves active progression stage for a given slider percentage.
 */
export function resolveExperimentalStage(
  stages: ProgressionStage[],
  percentage: number
): ProgressionStage {
  const clamped = Math.max(0, Math.min(100, percentage));
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const nextStage = stages[i + 1];
    if (clamped >= stage.min_slider_pct && (!nextStage || clamped < nextStage.min_slider_pct)) {
      return stage;
    }
  }
  return stages[stages.length - 1];
}
