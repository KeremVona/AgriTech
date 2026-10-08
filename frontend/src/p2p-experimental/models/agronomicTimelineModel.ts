/**
 * Agronomic Disease Progression & Microclimate Acceleration Engine
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 1)
 *
 * Implements:
 * 1. USDA Magarey et al. (2005) Beta temperature response function f(T) in [0, 1].
 * 2. Condensation / leaf wetness non-linear relative humidity saturation model g(RH) in [0.03, 1].
 * 3. Composite microclimate acceleration multiplier E(T, RH) = max(0.01, f(T) * g(RH)).
 * 4. Bi-directional translation:
 *    - Severity Percentage (0 - 100%) -> Projected Field Calendar Days
 *    - Calendar Days -> Severity Percentage (0 - 100%)
 * 5. Full epidemiological parameters for Tomato, Potato, Corn, and Apple.
 */


export type SupportedCropId =
  | 'tomato'
  | 'potato'
  | 'corn'
  | 'apple'
  | 'grape'
  | 'pepper'
  | 'peach'
  | 'squash';

export interface CardinalTemperatures {
  min: number;   // T_min: biological lower threshold below which development ceases (°C)
  opt: number;   // T_opt: optimum temperature for fastest lesion development (°C)
  max: number;   // T_max: upper lethal/suppression threshold (°C)
}

export interface HumidityThresholds {
  min: number;   // RH_min: minimum humidity to sustain active progression (%)
  crit: number;  // RH_crit: field threshold where infection risk surges (%)
  opt: number;   // RH_opt: optimum saturation humidity (%)
}

export interface StageAnchorDays {
  stage0_incubation: number; // Elapsed days from 0% to 30% (healthy folium to first microscopic flecks)
  stage1_spread: number;     // Elapsed days from 30% to 70% (primary lesions to active sporulation)
  stage2_severe: number;     // Elapsed days from 70% to 100% (severe necrosis and defoliation)
  totalOptimalDays: number;  // Total lifecycle days under optimal laboratory conditions
}

export interface DegreeDayParams {
  baseTemp: number;          // T_base for growing degree days (°C)
  cutoffTemp: number;        // T_cutoff upper ceiling (°C)
  degreeDaysTotal: number;   // Cumulative degree-days to terminal necrosis
}

export interface StageMilestoneInfo {
  stageOrder: 0 | 1 | 2;
  label: string;
  minSliderPct: number;
  maxSliderPct: number;
  pathologyMarker: string;
}

export interface AgronomicPathogenProfile {
  cropId: SupportedCropId;
  cropName: string;
  scientificName: string;
  diseaseName: string;
  pathogenScientific: string;
  cardinals: CardinalTemperatures;
  humidity: HumidityThresholds;
  baselineDays: StageAnchorDays;
  degreeDays: DegreeDayParams;
  milestones: StageMilestoneInfo[];
}

/**
 * Standardized Epidemiological Registry for the 4 Target Crops.
 * Based on empirical plant pathology literature (TOMCAST, BLITECAST, Mills Table, USDA NAPPFAST).
 */
export const AGRONOMIC_CALIBRATION_REGISTRY: Record<SupportedCropId, AgronomicPathogenProfile> = {
  tomato: {
    cropId: 'tomato',
    cropName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    diseaseName: 'Early Blight',
    pathogenScientific: 'Alternaria solani',
    cardinals: { min: 8.0, opt: 25.0, max: 35.0 },
    humidity: { min: 65.0, crit: 85.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 3.5,
      stage1_spread: 12.0,
      stage2_severe: 21.0,
      totalOptimalDays: 21.0,
    },
    degreeDays: { baseTemp: 8.0, cutoffTemp: 32.0, degreeDaysTotal: 357.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Inoculation & Germination',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Sub-cuticular hyphal penetration; asymptomatic turgid leaflet.',
      },
      {
        stageOrder: 1,
        label: 'Target-Board Concentric Rings',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Concentric ring lesions with prominent chlorotic yellow halos.',
      },
      {
        stageOrder: 2,
        label: 'Foliar Blight & Defoliation',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Coalesced necrotic patches causing severe leaf shriveling and abscission.',
      },
    ],
  },
  potato: {
    cropId: 'potato',
    cropName: 'Potato',
    scientificName: 'Solanum tuberosum',
    diseaseName: 'Late Blight',
    pathogenScientific: 'Phytophthora infestans',
    cardinals: { min: 3.0, opt: 18.0, max: 28.0 },
    humidity: { min: 75.0, crit: 90.0, opt: 98.0 },
    baselineDays: {
      stage0_incubation: 3.0,
      stage1_spread: 7.0,
      stage2_severe: 12.0,
      totalOptimalDays: 12.0,
    },
    degreeDays: { baseTemp: 7.0, cutoffTemp: 26.0, degreeDaysTotal: 132.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Zoospore Encystment',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Biflagellate zoospores encyst in surface moisture film; pale translucent flecks.',
      },
      {
        stageOrder: 1,
        label: 'Water-Soaked Lesions & Sporulation',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Dark purplish-brown lesions with white downy sporangiophores on leaf abaxial.',
      },
      {
        stageOrder: 2,
        label: 'Catastrophic Vine Collapse',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Blackened necrotic collapse of full lamina; field appears scorched by frost.',
      },
    ],
  },
  corn: {
    cropId: 'corn',
    cropName: 'Corn (Maize)',
    scientificName: 'Zea mays',
    diseaseName: 'Common Rust',
    pathogenScientific: 'Puccinia sorghi',
    cardinals: { min: 5.0, opt: 21.0, max: 31.0 },
    humidity: { min: 70.0, crit: 90.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 6.0,
      stage1_spread: 14.0,
      stage2_severe: 25.0,
      totalOptimalDays: 25.0,
    },
    degreeDays: { baseTemp: 8.0, cutoffTemp: 28.0, degreeDaysTotal: 325.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Substomatal Vesicle Colonization',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Urediniospore germ tube entry; pinpoint chlorotic flecks along parallel veins.',
      },
      {
        stageOrder: 1,
        label: 'Powdery Pustule Eruption',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Epidermal rupture releasing millions of cinnamon-brown powdery urediniospores.',
      },
      {
        stageOrder: 2,
        label: 'Telia Coalescence & Desiccation',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Pustules coalesce into black overwintering teliospore strips causing premature leaf death.',
      },
    ],
  },
  apple: {
    cropId: 'apple',
    cropName: 'Apple',
    scientificName: 'Malus domestica',
    diseaseName: 'Apple Scab',
    pathogenScientific: 'Venturia inaequalis',
    cardinals: { min: 2.0, opt: 19.0, max: 28.0 },
    humidity: { min: 65.0, crit: 85.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 10.0,
      stage1_spread: 20.0,
      stage2_severe: 35.0,
      totalOptimalDays: 35.0,
    },
    degreeDays: { baseTemp: 2.0, cutoffTemp: 26.0, degreeDaysTotal: 595.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Subcuticular Stroma Incubation',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Prolonged symptomless incubation beneath waxy cuticle requiring ~140 GDD.',
      },
      {
        stageOrder: 1,
        label: 'Velvety Olive Scab Spotting',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Smoky olive-green velvety conidiophore tufts with lamina cupping and crinkling.',
      },
      {
        stageOrder: 2,
        label: 'Corky Scab Necrosis & Abscission',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Thickened corky necrotic patches, severe puckering, cracking, and premature leaf drop.',
      },
    ],
  },
  grape: {
    cropId: 'grape',
    cropName: 'Grape',
    scientificName: 'Vitis vinifera',
    diseaseName: 'Black Rot',
    pathogenScientific: 'Guignardia bidwellii / Phyllosticta ampelicida',
    cardinals: { min: 10.0, opt: 26.5, max: 32.0 },
    humidity: { min: 65.0, crit: 85.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 7.0,
      stage1_spread: 14.0,
      stage2_severe: 24.0,
      totalOptimalDays: 24.0,
    },
    degreeDays: { baseTemp: 10.0, cutoffTemp: 32.0, degreeDaysTotal: 380.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Inoculation & Subcuticular Infection',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Appressorial penetration peg breaches cuticle; microscopic translucent pinhead flecks.',
      },
      {
        stageOrder: 1,
        label: 'Chocolate Lesions & Pycnidial Rings',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Reddish-brown lesions with dark brown borders and concentric rings of black pycnidia.',
      },
      {
        stageOrder: 2,
        label: 'Foliar Blight & Berry Mummification',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Coalescent foliar necrotic scorch and petiole girdling; berries shrivel into black mummies.',
      },
    ],
  },
  pepper: {
    cropId: 'pepper',
    cropName: 'Pepper Bell',
    scientificName: 'Capsicum annuum',
    diseaseName: 'Bacterial Spot',
    pathogenScientific: 'Xanthomonas euvesicatoria',
    cardinals: { min: 10.0, opt: 28.0, max: 36.0 },
    humidity: { min: 70.0, crit: 85.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 4.0,
      stage1_spread: 9.0,
      stage2_severe: 16.0,
      totalOptimalDays: 16.0,
    },
    degreeDays: { baseTemp: 10.0, cutoffTemp: 35.0, degreeDaysTotal: 288.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Stomatal Ingress & Hydropic Flecks',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Substomatal cavity colonization via rain-splash; abaxial water-soaked pinpoint macules.',
      },
      {
        stageOrder: 1,
        label: 'Angular Necrotic Spots & Yellow Halos',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Vein-limited angular purplish-brown lesions with chlorotic halos and bacterial streaming.',
      },
      {
        stageOrder: 2,
        label: 'Greasy Blight & Abscission Defoliation',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Severe petiole abscission layer dissolution causing leaf dropping and fruit sunscald.',
      },
    ],
  },
  peach: {
    cropId: 'peach',
    cropName: 'Peach',
    scientificName: 'Prunus persica',
    diseaseName: 'Bacterial Spot',
    pathogenScientific: 'Xanthomonas arboricola pv. pruni',
    cardinals: { min: 5.0, opt: 28.9, max: 35.0 },
    humidity: { min: 70.0, crit: 85.0, opt: 95.0 },
    baselineDays: {
      stage0_incubation: 6.0,
      stage1_spread: 14.0,
      stage2_severe: 25.0,
      totalOptimalDays: 25.0,
    },
    degreeDays: { baseTemp: 7.0, cutoffTemp: 34.0, degreeDaysTotal: 450.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Substomatal Invasion & Abaxial Flecks',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Wind-blown rain splash ingress; polygonal pale-green water-soaked spots on leaf underside.',
      },
      {
        stageOrder: 1,
        label: 'Shot-Hole Abscission Perforations',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Purplish-black angular spots whose necrotic centers drop out, creating shot-holes.',
      },
      {
        stageOrder: 2,
        label: 'Apical Defoliation & Spring Cankers',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Tip-to-base foliar leaf shed leaving tufted shoots; sunken oozing twig cankers and pitted fruit.',
      },
    ],
  },
  squash: {
    cropId: 'squash',
    cropName: 'Squash',
    scientificName: 'Cucurbita pepo',
    diseaseName: 'Powdery Mildew',
    pathogenScientific: 'Podosphaera xanthii',
    cardinals: { min: 10.0, opt: 25.0, max: 35.0 },
    humidity: { min: 50.0, crit: 75.0, opt: 90.0 },
    baselineDays: {
      stage0_incubation: 3.5,
      stage1_spread: 7.0,
      stage2_severe: 12.0,
      totalOptimalDays: 12.0,
    },
    degreeDays: { baseTemp: 10.0, cutoffTemp: 32.0, degreeDaysTotal: 180.0 },
    milestones: [
      {
        stageOrder: 0,
        label: 'Ectophytic Infection & Haustoria',
        minSliderPct: 0.0,
        maxSliderPct: 30.0,
        pathologyMarker: 'Dry conidia germination without free water; initial white talcum specks on shaded foliage.',
      },
      {
        stageOrder: 1,
        label: 'Confluent Powdery Mats & Conidiophores',
        minSliderPct: 30.01,
        maxSliderPct: 70.0,
        pathologyMarker: 'Talc-like colonies merge across leaf lamina; erect conidiophore chains with fibrosin bodies.',
      },
      {
        stageOrder: 2,
        label: 'Parchment Desiccation & Canopy Collapse',
        minSliderPct: 70.01,
        maxSliderPct: 100.0,
        pathologyMarker: 'Complete foliar yellowing and brittle parchment drying; petiole collapse and fruit sunscald.',
      },
    ],
  },
};

export interface MicroclimateDiagnostics {
  temperatureFactor: number;   // f(T) in [0, 1]
  humidityFactor: number;      // g(RH) in [0.03, 1]
  compositeFactor: number;     // E(T, RH) in [0.01, 1]
  isThermalSuppressed: boolean;
  isHumiditySuppressed: boolean;
  isStalled: boolean;
  statusLabel: 'Optimal Epidemic' | 'Favorable' | 'Slowed' | 'Critically Inhibited' | 'Stalled / Inactive';
  agronomicAlert?: string;
}

export interface ProgressionDynamicOutput {
  sliderPercentage: number;
  elapsedDays: number;
  stageIndex: 0 | 1 | 2;
  stageName: string;
  stageDaysRemaining: number;
  microclimate: MicroclimateDiagnostics;
  dayTimelineMax: number;      // Maximum day scale under current microclimate for UI rendering
}

/**
 * Computes the USDA Magarey et al. (2005) Beta Temperature Response function.
 * Smoothly reaches 1.0 at T_opt, drops to 0.0 at T_min and T_max.
 */
export function calculateTemperatureFactor(tempC: number, cardinals: CardinalTemperatures): number {
  const { min, opt, max } = cardinals;
  if (!Number.isFinite(tempC) || tempC <= min || tempC >= max) {
    return 0.0;
  }
  const alpha = (opt - min) / (max - opt);
  const term1 = (max - tempC) / (max - opt);
  const term2 = Math.pow((tempC - min) / (opt - min), alpha);
  const response = term1 * term2;
  return Math.max(0, Math.min(1.0, response));
}

/**
 * Computes non-linear Relative Humidity response function.
 * Represents free water film / stomatal condensation dynamics with dormant baseline.
 */
export function calculateHumidityFactor(humidityPct: number, thresholds: HumidityThresholds): number {
  if (!Number.isFinite(humidityPct)) {
    return 0.03;
  }
  const clampedRh = Math.max(0, Math.min(100, humidityPct));
  const kDormant = 0.03; // Dormant baseline preventing division by zero
  if (clampedRh < thresholds.min) {
    return kDormant;
  }
  if (clampedRh >= thresholds.opt) {
    return 1.0;
  }
  const gamma = 1.8; // Non-linear surge as humidity approaches saturation
  const normalized = (clampedRh - thresholds.min) / (thresholds.opt - thresholds.min);
  const response = kDormant + (1 - kDormant) * Math.pow(normalized, gamma);
  return Math.max(0.01, Math.min(1.0, response));
}

/**
 * Evaluates ambient environmental conditions for a specific crop pathogen.
 */
export function evaluateMicroclimate(
  cropId: SupportedCropId,
  tempC: number,
  humidityPct: number
): MicroclimateDiagnostics {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  const fT = calculateTemperatureFactor(tempC, profile.cardinals);
  const gRh = calculateHumidityFactor(humidityPct, profile.humidity);
  const composite = Math.max(0.01, fT * gRh);

  const isThermalSuppressed = fT < 0.15;
  const isHumiditySuppressed = gRh < 0.15;
  const isStalled = composite <= 0.05;

  let statusLabel: MicroclimateDiagnostics['statusLabel'] = 'Optimal Epidemic';
  if (composite >= 0.8) statusLabel = 'Optimal Epidemic';
  else if (composite >= 0.5) statusLabel = 'Favorable';
  else if (composite >= 0.2) statusLabel = 'Slowed';
  else if (composite > 0.05) statusLabel = 'Critically Inhibited';
  else statusLabel = 'Stalled / Inactive';

  let agronomicAlert: string | undefined;
  if (isStalled) {
    if (tempC >= profile.cardinals.max) {
      agronomicAlert = `Thermal arrest: ambient temperature (${tempC.toFixed(1)}°C) exceeds lethal threshold (${profile.cardinals.max}°C). Pathogen development arrested.`;
    } else if (tempC <= profile.cardinals.min) {
      agronomicAlert = `Cold suppression: ambient temperature (${tempC.toFixed(1)}°C) is below minimum metabolic threshold (${profile.cardinals.min}°C).`;
    } else if (humidityPct < profile.humidity.min) {
      agronomicAlert = `Arid suppression: relative humidity (${humidityPct.toFixed(0)}%) is too dry for spore germination (requires ≥${profile.humidity.min}%).`;
    } else {
      agronomicAlert = `Environmental stall: combined thermal and humidity stressors inhibit disease progression.`;
    }
  } else if (composite >= 0.85) {
    agronomicAlert = `High epidemic risk: conditions are near optimal for rapid ${profile.diseaseName} proliferation.`;
  }

  return {
    temperatureFactor: Math.round(fT * 1000) / 1000,
    humidityFactor: Math.round(gRh * 1000) / 1000,
    compositeFactor: Math.round(composite * 1000) / 1000,
    isThermalSuppressed,
    isHumiditySuppressed,
    isStalled,
    statusLabel,
    agronomicAlert,
  };
}

/**
 * Calculates baseline days under optimal laboratory conditions for a given slider percentage (0–100%).
 */
export function getOptimalDaysForSlider(cropId: SupportedCropId, sliderPct: number): number {
  const { baselineDays } = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  const s = Math.max(0, Math.min(100, sliderPct));

  if (s <= 30.0) {
    // Stage 0: 0% -> 30%
    return (s / 30.0) * baselineDays.stage0_incubation;
  } else if (s <= 70.0) {
    // Stage 1: 30% -> 70%
    const ratio = (s - 30.0) / 40.0;
    return baselineDays.stage0_incubation + ratio * (baselineDays.stage1_spread - baselineDays.stage0_incubation);
  } else {
    // Stage 2: 70% -> 100%
    const ratio = (s - 70.0) / 30.0;
    return baselineDays.stage1_spread + ratio * (baselineDays.stage2_severe - baselineDays.stage1_spread);
  }
}

/**
 * Forward Mapping:
 * Maps slider percentage [0, 100]% to Elapsed Calendar Days based on ambient microclimate.
 */
export function calculateElapsedDays(
  cropId: SupportedCropId,
  sliderPct: number,
  tempC: number,
  humidityPct: number
): ProgressionDynamicOutput {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  const microclimate = evaluateMicroclimate(cropId, tempC, humidityPct);
  const optimalDays = getOptimalDaysForSlider(cropId, sliderPct);
  const elapsedDays = Math.round((optimalDays / microclimate.compositeFactor) * 10) / 10;

  // Compute maximum timeline under current conditions with denominator clipping protection
  const maxUncapped = (profile.baselineDays.totalOptimalDays / microclimate.compositeFactor);
  const baselineMax = Math.min(90, Math.max(profile.baselineDays.totalOptimalDays, Math.round(maxUncapped)));
  const dayTimelineMax = Math.max(Math.ceil(elapsedDays), baselineMax);

  const s = Math.max(0, Math.min(100, sliderPct));
  let stageIndex: 0 | 1 | 2 = 0;
  let stageName = profile.milestones[0].label;
  let stageMaxPct = 30.0;

  if (s > 70.0) {
    stageIndex = 2;
    stageName = profile.milestones[2].label;
    stageMaxPct = 100.0;
  } else if (s > 30.0) {
    stageIndex = 1;
    stageName = profile.milestones[1].label;
    stageMaxPct = 70.0;
  }

  const stageTargetOptDays = getOptimalDaysForSlider(cropId, stageMaxPct);
  const stageTargetRealDays = Math.round((stageTargetOptDays / microclimate.compositeFactor) * 10) / 10;
  const stageDaysRemaining = Math.max(0, Math.round((stageTargetRealDays - elapsedDays) * 10) / 10);

  return {
    sliderPercentage: sliderPct,
    elapsedDays,
    stageIndex,
    stageName,
    stageDaysRemaining,
    microclimate,
    dayTimelineMax,
  };
}

/**
 * Inverse Mapping:
 * Maps elapsed calendar days back to slider percentage [0, 100]% given microclimate conditions.
 */
export function calculateSliderFromDays(
  cropId: SupportedCropId,
  calendarDays: number,
  tempC: number,
  humidityPct: number
): number {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  const microclimate = evaluateMicroclimate(cropId, tempC, humidityPct);
  const effectiveOptimalDays = calendarDays * microclimate.compositeFactor;
  const { stage0_incubation, stage1_spread, stage2_severe } = profile.baselineDays;

  if (effectiveOptimalDays <= stage0_incubation) {
    const s = (effectiveOptimalDays / stage0_incubation) * 30.0;
    return Math.max(0, Math.min(30.0, Math.round(s * 10) / 10));
  } else if (effectiveOptimalDays <= stage1_spread) {
    const ratio = (effectiveOptimalDays - stage0_incubation) / (stage1_spread - stage0_incubation);
    const s = 30.0 + ratio * 40.0;
    return Math.max(30.0, Math.min(70.0, Math.round(s * 10) / 10));
  } else {
    const ratio = (effectiveOptimalDays - stage1_spread) / (stage2_severe - stage1_spread);
    const s = 70.0 + ratio * 30.0;
    return Math.max(70.0, Math.min(100.0, Math.round(s * 10) / 10));
  }
}

/**
 * Standard Microclimate Presets for intuitive UI selection.
 */
export interface WeatherPreset {
  id: string;
  label: string;
  icon: string;
  temperature: number;
  humidity: number;
  description: string;
}

export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    id: 'optimal',
    label: 'Optimal Epidemic',
    icon: '🌦️',
    temperature: 22,
    humidity: 95,
    description: 'Warm & saturated leaf wetness (Maximum pathogen acceleration)',
  },
  {
    id: 'spring_norm',
    label: 'Spring Field Norm',
    icon: '🌾',
    temperature: 18,
    humidity: 78,
    description: 'Mild temperature with morning dew cycles (Standard field timeline)',
  },
  {
    id: 'hot_arid',
    label: 'Hot & Arid Summer',
    icon: '☀️',
    temperature: 34,
    humidity: 35,
    description: 'High heat and dry air (Arrests late blight and spore germination)',
  },
  {
    id: 'cold_dry',
    label: 'Cold & Dry Autumn',
    icon: '❄️',
    temperature: 6,
    humidity: 45,
    description: 'Low metabolic activity (Slows development by 3× to 5×)',
  },
];
