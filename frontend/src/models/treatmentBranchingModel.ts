/**
 * Agronomic Pathology Treatment & Intervention Branching Engine
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 3)
 *
 * ILLUSTRATIVE model for teaching, not a field forecast:
 * - Spray effect: hand-tuned logistic curve — the later the spray, the smaller the effect.
 * - Protection wears off: each spray protects for the product's typical re-spray interval; while protected the
 *   disease runs at (1 - effect) of its normal speed. Re-spraying is optional.
 * - Season outcome: simple threshold-and-slope yield damage line per crop and an example crop value / spray cost.
 * - Product names, intervals and FRAC codes are examples; registrations and labels differ by country.
 */

import type { SupportedCropId } from './agronomicTimelineModel.ts';
import {
  AGRONOMIC_CALIBRATION_REGISTRY,
  calculateSliderFromDays,
  evaluateMicroclimate,
  getOptimalDaysForSlider,
} from './agronomicTimelineModel.ts';

export type FungicideCategory = 'systemic_curative' | 'protectant_contact' | 'bio_fungicide';

export interface ChemicalProductSpec {
  id: string;
  tradeName: string;
  activeIngredient: string;
  fracCode: string;
  category: FungicideCategory;
  modeOfAction: string;
  curativeKickbackHours: number; // 0 for pure contact protectant
  /** Typical days one spray keeps protecting before a re-spray is due (label interval; check the local label). */
  protectionDays: number;
  rainfastnessHours: number;
  preHarvestIntervalDays: number;
  resistanceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  isOrganicCertified: boolean;
  applicationNotes: string;
}

export interface BiologicalManifestationSpec {
  haloChlorosisEffect: string;
  necroticDesiccationEffect: string;
  sporulationSuppressionEffect: string;
  marginMorphology: string;
}

export interface CropInterventionCalibration {
  cropId: SupportedCropId;
  diseaseName: string;
  pathogenScientific: string;
  apparentInfectionRate: number; // r in logistic dS/dt (optimal conditions, day^-1)
  carryingCapacity: number;       // K (typically 100.0)

  // Efficacy logistic decay parameters: eta(S_int)
  efficacyMax: number;           // eta_max (e.g. 0.95 in early window)
  efficacyMin: number;           // eta_min (e.g. 0.05 residual suppression in late window)
  midpointSeverity: number;      // S_50 (% infection inflection point)
  logisticSteepness: number;     // k_eta (governs window transition curvature)

  // Post-intervention branching parameters
  leakageRatio: number;          // omega_leak (0.15 - 0.35 uncurable latent expansion ratio)
  arrestRateDay: number;         // k_arrest (0.65 - 1.20 day^-1 uptake and arrest speed)

  // Yield Loss & Economic Damage Parameters
  yieldDamageThreshold: number;  // S_thresh (%) below which no yield loss occurs
  yieldSlopeFactor: number;      // alpha (loss % per 1% severity above threshold)
  maxYieldLossCeiling: number;   // maximum attainable yield loss (%)
  marketValuePerHectareUSD: number; // typical harvest revenue ($/ha)
  sprayCostPerHectareUSD: number;   // estimated chemical + application cost ($/ha)

  // Biological manifestations & product portfolio
  manifestation: BiologicalManifestationSpec;
  products: ChemicalProductSpec[];
}

export const AGRONOMIC_INTERVENTION_REGISTRY: Record<SupportedCropId, CropInterventionCalibration> = {
  tomato: {
    cropId: 'tomato',
    diseaseName: 'Early Blight',
    pathogenScientific: 'Alternaria solani',
    apparentInfectionRate: 0.28,
    carryingCapacity: 100.0,
    efficacyMax: 0.95,
    efficacyMin: 0.06,
    midpointSeverity: 43.0,
    logisticSteepness: 0.14,
    leakageRatio: 0.22,
    arrestRateDay: 0.85,
    yieldDamageThreshold: 5.0,
    yieldSlopeFactor: 0.62,
    maxYieldLossCeiling: 55.0,
    marketValuePerHectareUSD: 6200,
    sprayCostPerHectareUSD: 75,
    manifestation: {
      haloChlorosisEffect:
        'Phytotoxin alternaric acid and solanapyrone diffusion ceases within 18h; yellow chlorotic halo stops radial spread.',
      necroticDesiccationEffect:
        'Concentric "target-board" rings desiccate into crisp papery tissue; host deposits lignin/suberin barrier.',
      sporulationSuppressionEffect:
        'Velvety dark conidiophore chains collapse; active airborne conidiogenesis suppressed by >95%.',
      marginMorphology:
        'Hydropic yellow halo collapses into a sharp, dark brown, suberized cicatrization ring.',
    },
    products: [
      {
        id: 'tomato-inspire',
        protectionDays: 10,
        tradeName: 'Score 250 EC (Difenoconazole)',
        activeIngredient: 'Difenoconazole',
        fracCode: 'FRAC 3',
        category: 'systemic_curative',
        modeOfAction: 'Demethylation inhibitor (DMI); halts sterol biosynthesis and haustorial elongation',
        curativeKickbackHours: 72,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 7,
        resistanceRisk: 'MEDIUM',
        isOrganicCertified: false,
        applicationNotes: 'Maximum 3 applications per season. Rotate with non-DMI chemistry to preserve efficacy.',
      },
      {
        id: 'tomato-bravo',
        protectionDays: 7,
        tradeName: 'Bravo Weather Stik (Chlorothalonil 720 SC)',
        activeIngredient: 'Chlorothalonil',
        fracCode: 'FRAC M05',
        category: 'protectant_contact',
        modeOfAction: 'Multi-site thiol reactant binding fungal enzyme systems and preventing conidia germination',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Apply prior to predicted precipitation events. Re-apply every 7–10 days in high RH.',
      },
      {
        id: 'tomato-doublenickel',
        protectionDays: 5,
        tradeName: 'Double Nickel 55 WDG',
        activeIngredient: 'Bacillus amyloliquefaciens strain D747',
        fracCode: 'FRAC BM02',
        category: 'bio_fungicide',
        modeOfAction: 'Cyclic lipopeptide bacterial biofilm forming physical and osmotic membrane barrier',
        curativeKickbackHours: 12,
        rainfastnessHours: 4,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI listed. Apply proactively at first blossom cluster or early symptom onset.',
      },
    ],
  },

  potato: {
    cropId: 'potato',
    diseaseName: 'Late Blight',
    pathogenScientific: 'Phytophthora infestans',
    apparentInfectionRate: 0.45,
    carryingCapacity: 100.0,
    efficacyMax: 0.94,
    efficacyMin: 0.04,
    midpointSeverity: 40.0,
    logisticSteepness: 0.16,
    leakageRatio: 0.30,
    arrestRateDay: 1.10,
    yieldDamageThreshold: 2.0,
    yieldSlopeFactor: 1.05,
    maxYieldLossCeiling: 88.0,
    marketValuePerHectareUSD: 5400,
    sprayCostPerHectareUSD: 85,
    manifestation: {
      haloChlorosisEffect:
        'Water-soaked translucent margin arrested; oomycete haustorial lysis halts radial cytoplasmic expansion.',
      necroticDesiccationEffect:
        'Soft rotting leaf tissue desiccates rapidly within 24–48h into thin, black, crispy "scorched" patches.',
      sporulationSuppressionEffect:
        'White cottony sporangiophores on leaf abaxial surface shrivel, turn dull grayish-brown, and detach.',
      marginMorphology:
        'Spreading water-soaked edges transition into razor-sharp, charred, dry necrotic borders.',
    },
    products: [
      {
        id: 'potato-ridomil',
        protectionDays: 14,
        tradeName: 'Ridomil Gold MZ (Mefenoxam + Mancozeb)',
        activeIngredient: 'Metalaxyl-M (Mefenoxam) + Mancozeb',
        fracCode: 'FRAC 4 + FRAC M03',
        category: 'systemic_curative',
        modeOfAction: 'RNA polymerase I inhibitor with multi-site contact partner for anti-resistance protection',
        curativeKickbackHours: 48,
        rainfastnessHours: 1.5,
        preHarvestIntervalDays: 14,
        resistanceRisk: 'HIGH',
        isOrganicCertified: false,
        applicationNotes: 'Strongest curative kickback for late blight; limit to 2 block sprays to prevent resistance surge.',
      },
      {
        id: 'potato-curzate',
        protectionDays: 5,
        tradeName: 'Curzate 60DF (Cymoxanil 60%)',
        activeIngredient: 'Cymoxanil',
        fracCode: 'FRAC 27',
        category: 'systemic_curative',
        modeOfAction: 'Locally systemic amino acid & nucleic acid synthesis inhibitor ("stop effect" kickback)',
        curativeKickbackHours: 48,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 7,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Fast knockdown within 24h. Always tank-mix with a protectant fungicide.',
      },
      {
        id: 'potato-dithane',
        protectionDays: 7,
        tradeName: 'Dithane F-45 (Mancozeb 80%)',
        activeIngredient: 'Mancozeb',
        fracCode: 'FRAC M03',
        category: 'protectant_contact',
        modeOfAction: 'Non-specific contact disruptor inactivating amino acids and sulfhydryl enzymes',
        curativeKickbackHours: 0,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 3,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Foundation protectant for season-long canopy cover. Spray before rain events.',
      },
      {
        id: 'potato-serenade',
        protectionDays: 5,
        tradeName: 'Serenade Opti WDG',
        activeIngredient: 'Bacillus subtilis QST 713',
        fracCode: 'FRAC BM02',
        category: 'bio_fungicide',
        modeOfAction: 'Lipopeptide membrane disruption and induction of Systemic Acquired Resistance (SAR)',
        curativeKickbackHours: 6,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'Organic approved. Ideal for low-to-moderate infection pressure or organic tuber production.',
      },
    ],
  },

  corn: {
    cropId: 'corn',
    diseaseName: 'Common Rust',
    pathogenScientific: 'Puccinia sorghi',
    apparentInfectionRate: 0.22,
    carryingCapacity: 100.0,
    efficacyMax: 0.96,
    efficacyMin: 0.08,
    midpointSeverity: 45.0,
    logisticSteepness: 0.13,
    leakageRatio: 0.18,
    arrestRateDay: 0.70,
    yieldDamageThreshold: 8.0,
    yieldSlopeFactor: 0.60,
    maxYieldLossCeiling: 42.0,
    marketValuePerHectareUSD: 2100,
    sprayCostPerHectareUSD: 52,
    manifestation: {
      haloChlorosisEffect:
        'Chlorotic bands along parallel leaf veins halt; haustorial sucrose drain to dikaryotic mycelia ceases.',
      necroticDesiccationEffect:
        'Uredinial pustule beds dry out; host perimeter forms sterile lignified necrotic barrier.',
      sporulationSuppressionEffect:
        'Airborne ejection of powdery cinnamon-brown urediniospores terminates; pustules darken and desiccate.',
      marginMorphology:
        'Powdery rust halos vanish, leaving discrete, sterile, dark brown eruptive epidermal scars.',
    },
    products: [
      {
        id: 'corn-tilt',
        protectionDays: 14,
        tradeName: 'Tilt (Propiconazole 25% EC)',
        activeIngredient: 'Propiconazole',
        fracCode: 'FRAC 3',
        category: 'systemic_curative',
        modeOfAction: 'Sterol C14-demethylase inhibitor; halts haustorial formation in corn leaf mesophyll',
        curativeKickbackHours: 72,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 30,
        resistanceRisk: 'MEDIUM',
        isOrganicCertified: false,
        applicationNotes: 'Apply at VT to R1 stage when rust is scouted on lower canopy leaves.',
      },
      {
        id: 'corn-quilt',
        protectionDays: 14,
        tradeName: 'Quilt Xcel (Azoxystrobin + Propiconazole)',
        activeIngredient: 'Azoxystrobin + Propiconazole',
        fracCode: 'FRAC 11 + FRAC 3',
        category: 'systemic_curative',
        modeOfAction: 'Dual-action: Qo-site mitochondrial respiration block + sterol biosynthesis shutdown',
        curativeKickbackHours: 72,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 30,
        resistanceRisk: 'HIGH',
        isOrganicCertified: false,
        applicationNotes: 'Broad-spectrum curative plus plant-health stay-green physiological enhancement.',
      },
      {
        id: 'corn-dithane',
        protectionDays: 7,
        tradeName: 'Dithane DF (Mancozeb 75% WDG)',
        activeIngredient: 'Mancozeb',
        fracCode: 'FRAC M03',
        category: 'protectant_contact',
        modeOfAction: 'Multi-site contact inhibition preventing rust spore germination and penetration',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 7,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Apply preventatively or tank-mix with triazole when high dew periods are forecasted.',
      },
      {
        id: 'corn-regalia',
        protectionDays: 7,
        tradeName: 'Regalia Biofungicide',
        activeIngredient: 'Reynoutria sachalinensis extract (5%)',
        fracCode: 'FRAC P05',
        category: 'bio_fungicide',
        modeOfAction: 'Induced Systemic Resistance (ISR) via phytoalexins, phenolic compounds, and lignin strengthening',
        curativeKickbackHours: 0,
        rainfastnessHours: 4,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'Activates internal plant immune defense. Spray in early vegetative stages before tassel emergence.',
      },
    ],
  },

  apple: {
    cropId: 'apple',
    diseaseName: 'Apple Scab',
    pathogenScientific: 'Venturia inaequalis',
    apparentInfectionRate: 0.20,
    carryingCapacity: 100.0,
    efficacyMax: 0.95,
    efficacyMin: 0.05,
    midpointSeverity: 42.0,
    logisticSteepness: 0.14,
    leakageRatio: 0.20,
    arrestRateDay: 0.75,
    yieldDamageThreshold: 4.0,
    yieldSlopeFactor: 0.40,
    maxYieldLossCeiling: 45.0,
    marketValuePerHectareUSD: 9800,
    sprayCostPerHectareUSD: 110,
    manifestation: {
      haloChlorosisEffect:
        'Subcuticular stroma lateral elongation ceases; foliar distortion and puckering stabilizes.',
      necroticDesiccationEffect:
        'Cuticle and epidermal parenchyma undergo active suberization, forming hard corky russet scars.',
      sporulationSuppressionEffect:
        'Smoky olive-green conidiophore tufts collapse and shed ("burned-out scab", >95% viable conidia loss).',
      marginMorphology:
        'Feathery diffuse smoky borders transform into discrete, cracked, dark corky scab borders.',
    },
    products: [
      {
        id: 'apple-inspire',
        protectionDays: 7,
        tradeName: 'Inspire Super (Difenoconazole + Cyprodinil)',
        activeIngredient: 'Difenoconazole + Cyprodinil',
        fracCode: 'FRAC 3 + FRAC 9',
        category: 'systemic_curative',
        modeOfAction: 'Sterol demethylase inhibition + anilinopyrimidine methionine biosynthesis inhibition',
        curativeKickbackHours: 96,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 14,
        resistanceRisk: 'MEDIUM',
        isOrganicCertified: false,
        applicationNotes: 'Industry-standard 72–96h post-infection kickback for apple scab control.',
      },
      {
        id: 'apple-captan',
        protectionDays: 7,
        tradeName: 'Captan 80 WDG',
        activeIngredient: 'Captan (Phthalimide)',
        fracCode: 'FRAC M04',
        category: 'protectant_contact',
        modeOfAction: 'Multi-site thiol disruptor in respiratory enzymes preventing conidial germination',
        curativeKickbackHours: 0,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Foundation protectant for secondary scab season. Do not mix with horticultural oils.',
      },
      {
        id: 'apple-armicarb',
        protectionDays: 5,
        tradeName: 'Armicarb 100 / MilStop',
        activeIngredient: 'Potassium Bicarbonate (85%)',
        fracCode: 'FRAC NC',
        category: 'bio_fungicide',
        modeOfAction: 'Disruption of potassium ion balance, cellular wall osmotic collapse and surface pH shock',
        curativeKickbackHours: 24,
        rainfastnessHours: 1,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI listed. Provides immediate contact knockdown of active sporulating mycelia.',
      },
    ],
  },

  grape: {
    cropId: 'grape',
    diseaseName: 'Black Rot',
    pathogenScientific: 'Guignardia bidwellii / Phyllosticta ampelicida',
    apparentInfectionRate: 0.18,
    carryingCapacity: 100.0,
    efficacyMax: 0.95,
    efficacyMin: 0.05,
    midpointSeverity: 40.0,
    logisticSteepness: 0.14,
    leakageRatio: 0.20,
    arrestRateDay: 0.75,
    yieldDamageThreshold: 5.0,
    yieldSlopeFactor: 0.55,
    maxYieldLossCeiling: 60.0,
    marketValuePerHectareUSD: 8500,
    sprayCostPerHectareUSD: 95,
    manifestation: {
      haloChlorosisEffect:
        'Halts radial expansion of pycnidia rings within 24h; yellow margins stabilize without necrosis.',
      necroticDesiccationEffect:
        'Reddish-brown centers desiccate into crisp papery tissue; host deposits suberin barrier.',
      sporulationSuppressionEffect:
        'Mucilaginous cirrhi exuding from pycnidia desiccate; secondary conidia release arrested by >95%.',
      marginMorphology:
        'Chocolate-brown lesions develop a sharp, dark, suberized margin; cluster rachis protected.',
    },
    products: [
      {
        id: 'grape-inspire',
        protectionDays: 10,
        tradeName: 'Inspire Super (Difenoconazole + Cyprodinil)',
        activeIngredient: 'Difenoconazole + Cyprodinil',
        fracCode: 'FRAC 3 + FRAC 9',
        category: 'systemic_curative',
        modeOfAction: 'Demethylation inhibitor (DMI); arrests sterol biosynthesis with 72-96h kick-back',
        curativeKickbackHours: 72,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 14,
        resistanceRisk: 'MEDIUM',
        isOrganicCertified: false,
        applicationNotes: 'Maximum 3 applications per season. Rotate with non-FRAC 3 modes of action.',
      },
      {
        id: 'grape-dithane',
        protectionDays: 7,
        tradeName: 'Dithane F-45 Rainshield',
        activeIngredient: 'Mancozeb',
        fracCode: 'FRAC M03',
        category: 'protectant_contact',
        modeOfAction: 'Multi-site dithiocarbamate inactivating fungal sulfhydryl enzymes; prevents conidial germination',
        curativeKickbackHours: 0,
        rainfastnessHours: 4,
        preHarvestIntervalDays: 66,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Apply preventatively prior to precipitation events. 66-day PHI in viticulture.',
      },
      {
        id: 'grape-doublenickel',
        protectionDays: 5,
        tradeName: 'Double Nickel 55',
        activeIngredient: 'Bacillus amyloliquefaciens strain D747',
        fracCode: 'FRAC BM02',
        category: 'bio_fungicide',
        modeOfAction: 'Colonizes foliar surface and secretes lipopeptides disrupting spore membranes',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI-listed bio-fungicide. Re-apply on a 5-7 day schedule under moderate disease pressure.',
      },
    ],
  },

  pepper: {
    cropId: 'pepper',
    diseaseName: 'Bacterial Spot',
    pathogenScientific: 'Xanthomonas euvesicatoria',
    apparentInfectionRate: 0.24,
    carryingCapacity: 100.0,
    efficacyMax: 0.94,
    efficacyMin: 0.08,
    midpointSeverity: 42.0,
    logisticSteepness: 0.15,
    leakageRatio: 0.18,
    arrestRateDay: 0.80,
    yieldDamageThreshold: 6.0,
    yieldSlopeFactor: 0.58,
    maxYieldLossCeiling: 50.0,
    marketValuePerHectareUSD: 7200,
    sprayCostPerHectareUSD: 85,
    manifestation: {
      haloChlorosisEffect:
        'Bacterial lipopolysaccharide toxin dissipation; bright yellow halos fade and cease spreading.',
      necroticDesiccationEffect:
        'Water-soaked greasy angular spots dry into brittle papery brown cicatrices.',
      sporulationSuppressionEffect:
        'Bacterial ooze streaming from torn cell walls arrests; secondary rain-splash spread stopped.',
      marginMorphology:
        'Angular water-soaked boundaries resolve into crisp, dry, non-oozing necrotic margins.',
    },
    products: [
      {
        id: 'pepper-kocide-mancozeb',
        protectionDays: 7,
        tradeName: 'Kocide 3000 + Manzate Pro-Stick Tank Mix',
        activeIngredient: 'Copper Hydroxide + Mancozeb',
        fracCode: 'FRAC M01 + FRAC M03',
        category: 'protectant_contact',
        modeOfAction: 'Synergistic membrane permeabilization and protein denaturation overcoming copper resistance',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 7,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Mancozeb releases Zn/Mn ions that restore copper efficacy against resistant Xanthomonas strains.',
      },
      {
        id: 'pepper-agriphage',
        protectionDays: 3,
        tradeName: 'AgriPhage',
        activeIngredient: 'Xanthomonas euvesicatoria-specific Bacteriophages',
        fracCode: 'Bacteriophage',
        category: 'bio_fungicide',
        modeOfAction: 'Lytic phage infection selectively lysing target bacterial cells',
        curativeKickbackHours: 12,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI listed. Apply in late afternoon or evening to minimize ultraviolet light degradation.',
      },
    ],
  },

  peach: {
    cropId: 'peach',
    diseaseName: 'Bacterial Spot',
    pathogenScientific: 'Xanthomonas arboricola pv. pruni',
    apparentInfectionRate: 0.20,
    carryingCapacity: 100.0,
    efficacyMax: 0.92,
    efficacyMin: 0.06,
    midpointSeverity: 40.0,
    logisticSteepness: 0.14,
    leakageRatio: 0.22,
    arrestRateDay: 0.72,
    yieldDamageThreshold: 5.0,
    yieldSlopeFactor: 0.50,
    maxYieldLossCeiling: 48.0,
    marketValuePerHectareUSD: 11000,
    sprayCostPerHectareUSD: 120,
    manifestation: {
      haloChlorosisEffect:
        'Spongy parenchyma electrolyte leakage stabilizes; chlorotic margin halts progression.',
      necroticDesiccationEffect:
        'Necrotic core drops out cleanly via host suberin periderm ("shot-hole" stabilization) without tear expansion.',
      sporulationSuppressionEffect:
        'Bacterial multiplication in spongy parenchyma arrested; gum exudation on twigs ceases.',
      marginMorphology:
        'Shot-hole borders develop clean, hardened, suberized rings preventing secondary fungal entry.',
    },
    products: [
      {
        id: 'peach-kocide-micro',
        protectionDays: 7,
        tradeName: 'Kocide 3000 (Low-Rate Foliar)',
        activeIngredient: 'Copper Hydroxide',
        fracCode: 'FRAC M01',
        category: 'protectant_contact',
        modeOfAction: 'Denatures bacterial enzyme systems upon direct surface contact',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: false,
        applicationNotes: 'Use strictly micro-rates (0.5-1.0 oz metallic copper/acre) post-bloom to avoid severe foliar burning.',
      },
      {
        id: 'peach-serenade',
        protectionDays: 5,
        tradeName: 'Serenade ASO',
        activeIngredient: 'Bacillus subtilis QST 713',
        fracCode: 'FRAC BM02',
        category: 'bio_fungicide',
        modeOfAction: 'Disrupts bacterial cell wall integrity and induces systemic acquired resistance',
        curativeKickbackHours: 0,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI listed. Safe rotational partner during hot humid periods where copper phytotoxicity risk is severe.',
      },
    ],
  },

  squash: {
    cropId: 'squash',
    diseaseName: 'Powdery Mildew',
    pathogenScientific: 'Podosphaera xanthii',
    apparentInfectionRate: 0.26,
    carryingCapacity: 100.0,
    efficacyMax: 0.98,
    efficacyMin: 0.10,
    midpointSeverity: 45.0,
    logisticSteepness: 0.16,
    leakageRatio: 0.15,
    arrestRateDay: 0.85,
    yieldDamageThreshold: 10.0,
    yieldSlopeFactor: 0.52,
    maxYieldLossCeiling: 40.0,
    marketValuePerHectareUSD: 5400,
    sprayCostPerHectareUSD: 68,
    manifestation: {
      haloChlorosisEffect:
        'Superficial mycelial feeding halts; underlying leaf chlorosis ceases radial spread.',
      necroticDesiccationEffect:
        'White powdery talc mats dry into thin, non-sporulating translucent gray patches.',
      sporulationSuppressionEffect:
        'Erect conidiophore chains collapse and desiccate; airborne conidia release drops by >98%.',
      marginMorphology:
        'Powdery patches become clearly demarcated by desiccated gray mycelial boundaries; green lamina saved.',
    },
    products: [
      {
        id: 'squash-rally',
        protectionDays: 10,
        tradeName: 'Rally 40WSP',
        activeIngredient: 'Myclobutanil',
        fracCode: 'FRAC 3',
        category: 'systemic_curative',
        modeOfAction: 'Sterol demethylation inhibitor (DMI) with acropetal and translaminar curative mobility',
        curativeKickbackHours: 48,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'HIGH',
        isOrganicCertified: false,
        applicationNotes: 'Rotate every application with different modes of action (FRAC 7, FRAC U06) to manage resistance.',
      },
      {
        id: 'squash-microthiol',
        protectionDays: 7,
        tradeName: 'Microthiol Disperss (Micronized Sulfur)',
        activeIngredient: 'Sulfur (80%)',
        fracCode: 'FRAC M02',
        category: 'protectant_contact',
        modeOfAction: 'Multi-site non-specific vapor disruptor interfering with electron transport and fungal respiration',
        curativeKickbackHours: 0,
        rainfastnessHours: 3,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'OMRI listed. Do not apply when temperatures exceed 32°C (causes phytotoxic cucurbit foliar burning).',
      },
      {
        id: 'squash-milstop',
        protectionDays: 5,
        tradeName: 'MilStop / Kaligreen',
        activeIngredient: 'Potassium Bicarbonate (85%)',
        fracCode: 'FRAC NC',
        category: 'bio_fungicide',
        modeOfAction: 'Cell membrane osmotic collapse, potassium ion balance disruption and rapid pH shock',
        curativeKickbackHours: 24,
        rainfastnessHours: 1,
        preHarvestIntervalDays: 0,
        resistanceRisk: 'LOW',
        isOrganicCertified: true,
        applicationNotes: 'Provides rapid curative knockdown of active powdery conidia colonies on both leaf surfaces.',
      },
    ],
  },
};

// ============================================================================
// Core Agronomic Simulation Algorithms
// ============================================================================

export type InterventionWindowTier = 'early' | 'mid' | 'late' | 'terminal';

export interface InterventionEfficacyResult {
  efficacy: number;          // [0.01, 1.0] continuous curative coefficient
  efficacyPct: number;       // [1, 100]%
  windowTier: InterventionWindowTier;
  windowLabel: string;
  agronomicAssessment: string;
}

/**
 * 1. Calculates intervention efficacy eta(S_int) based on Generalized Logistic Decay.
 */
export function calculateInterventionEfficacy(
  cropId: SupportedCropId,
  sIntPct: number,
  modality: FungicideCategory = 'systemic_curative'
): InterventionEfficacyResult {
  const cal = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  const s = Math.max(0, Math.min(100, sIntPct));

  // Base systemic curative logistic decay
  const denom = 1 + Math.exp(cal.logisticSteepness * (s - cal.midpointSeverity));
  let baseEfficacy = cal.efficacyMin + (cal.efficacyMax - cal.efficacyMin) / denom;

  // Modality multiplier
  if (modality === 'protectant_contact') {
    // Protectants prevent new lesions but have lower curative kickback on established lesions
    baseEfficacy *= 0.72;
  } else if (modality === 'bio_fungicide') {
    // Bio-fungicides provide moderate suppression and biofilm shielding
    baseEfficacy *= 0.58;
  }

  const clampedEfficacy = Math.max(0.02, Math.min(0.98, baseEfficacy));
  const roundedEfficacy = Math.round(clampedEfficacy * 1000) / 1000;
  const efficacyPct = Math.round(roundedEfficacy * 100);

  let windowTier: InterventionWindowTier = 'early';
  let windowLabel = 'Early Prophylactic / Eradication Window';
  let agronomicAssessment =
    'Optimal intervention timing. Pathogen mycelia fully penetrable; near-total lesion arrest with rapid tissue cicatrization.';

  if (s > 70.0) {
    windowTier = 'terminal';
    windowLabel = 'Terminal Irreversible Phase';
    agronomicAssessment =
      'Canopy structure collapsed. Systemic vascular damage is irreversible; chemical intervention cannot salvage destroyed leaf area.';
  } else if (s > 50.0) {
    windowTier = 'late';
    windowLabel = 'Late Emergency Rescue Window';
    agronomicAssessment =
      'Sub-optimal intervention. Sporulation will be arrested, but significant permanent foliar loss and yield penalty are locked in.';
  } else if (s > 35.0) {
    windowTier = 'mid';
    windowLabel = 'Economic Action Threshold Window';
    agronomicAssessment =
      'Acceptable field threshold. Secondary spread is contained; active lesion margins will scarify with minor latent breakthrough.';
  }

  return {
    efficacy: roundedEfficacy,
    efficacyPct,
    windowTier,
    windowLabel,
    agronomicAssessment,
  };
}

export interface TreatedSeverityTrajectoryResult {
  /** Disease progress (%) on the treated branch at the current moment. */
  currentSeverityPct: number;
  /** Disease progress (%) at season end on the treated branch (name kept for existing callers). */
  plateauSeverityPct: number;
  /** Extra progress after the first spray, until season end. */
  expansionDeltaPct: number;
  efficacyPct: number;
  /** True when the current moment is already the season end. */
  isFullyArrested: boolean;
  /** Sprays applied up to the current moment / over the whole season. */
  spraysSoFar: number;
  spraysSeason: number;
  protectionDays: number;
}

export interface TreatmentScenarioOptions {
  /** Air temperature (°C); defaults to the crop's best temperature for the pathogen. */
  temperatureC?: number;
  /** Relative humidity (%); defaults to the crop's best humidity for the pathogen. */
  humidityPct?: number;
  /** Days one spray protects; defaults to the selected product, else the category default. */
  protectionDays?: number;
  /** Re-spray every time protection runs out (default true). */
  keepSpraying?: boolean;
}

/** Typical protection days when no product is chosen. */
export const CATEGORY_PROTECTION_DAYS: Record<FungicideCategory, number> = {
  systemic_curative: 10,
  protectant_contact: 7,
  bio_fungicide: 5,
};

interface ScenarioClock {
  daysAt: (pct: number) => number;
  pctAt: (days: number) => number;
}

function scenarioClock(cropId: SupportedCropId, temperatureC: number, humidityPct: number): ScenarioClock {
  const factor = evaluateMicroclimate(cropId, temperatureC, humidityPct).compositeFactor;
  return {
    daysAt: (pct) => getOptimalDaysForSlider(cropId, pct) / factor,
    pctAt: (days) => calculateSliderFromDays(cropId, days, temperatureC, humidityPct),
  };
}

/**
 * Moves the disease "clock" from the first spray to `untilDays`.
 * While a spray protects, the disease advances at (1 - efficacy) of its normal speed; efficacy is re-evaluated
 * at every re-spray from the progress reached by then (so late sprays help less). Without re-spraying the
 * disease runs at full speed once protection ends.
 */
function advanceTreatedClock(
  cropId: SupportedCropId,
  clock: ScenarioClock,
  sprayAtPct: number,
  untilDays: number,
  category: FungicideCategory,
  protectionDays: number,
  keepSpraying: boolean,
): { diseaseDays: number; sprays: number } {
  const sprayDay = clock.daysAt(sprayAtPct);
  if (untilDays <= sprayDay) return { diseaseDays: untilDays, sprays: 0 };
  const segment = Math.max(0.5, protectionDays);
  let elapsed = sprayDay;
  let diseaseDays = sprayDay;
  let progress = sprayAtPct;
  let sprays = 0;
  while (elapsed < untilDays) {
    sprays += 1;
    const step = Math.min(segment, untilDays - elapsed);
    const efficacy = calculateInterventionEfficacy(cropId, progress, category).efficacy;
    diseaseDays += step * (1 - efficacy);
    elapsed += step;
    progress = clock.pctAt(diseaseDays);
    if (!keepSpraying) {
      diseaseDays += untilDays - elapsed;
      break;
    }
    if (sprays > 500) break; // safety for pathological inputs
  }
  return { diseaseDays, sprays };
}

function resolveOptions(cropId: SupportedCropId, modality: FungicideCategory, options: TreatmentScenarioOptions) {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];
  return {
    temperatureC: options.temperatureC ?? profile.cardinals.opt,
    humidityPct: options.humidityPct ?? profile.humidity.opt,
    protectionDays: options.protectionDays ?? CATEGORY_PROTECTION_DAYS[modality],
    keepSpraying: options.keepSpraying ?? true,
  };
}

/**
 * 2. Treated branch at a moment on the timeline.
 * `currentPct` is the untreated progress shown by the main slider; the treated branch shares the same calendar.
 */
export function simulateTreatment(
  cropId: SupportedCropId,
  sprayAtPct: number,
  currentPct: number,
  modality: FungicideCategory = 'systemic_curative',
  options: TreatmentScenarioOptions = {},
): TreatedSeverityTrajectoryResult {
  const o = resolveOptions(cropId, modality, options);
  const clock = scenarioClock(cropId, o.temperatureC, o.humidityPct);
  const sprayAt = Math.max(0, Math.min(100, sprayAtPct));
  const nowDays = clock.daysAt(Math.max(0, Math.min(100, currentPct)));
  const seasonDays = clock.daysAt(100);

  const now = advanceTreatedClock(cropId, clock, sprayAt, nowDays, modality, o.protectionDays, o.keepSpraying);
  const season = advanceTreatedClock(cropId, clock, sprayAt, seasonDays, modality, o.protectionDays, o.keepSpraying);
  const currentSeverity = now.sprays === 0 ? Math.max(0, Math.min(100, currentPct)) : clock.pctAt(now.diseaseDays);
  const seasonSeverity = season.sprays === 0 ? 100 : clock.pctAt(season.diseaseDays);

  return {
    currentSeverityPct: Math.round(currentSeverity * 10) / 10,
    plateauSeverityPct: Math.round(seasonSeverity * 10) / 10,
    expansionDeltaPct: Math.max(0, Math.round((seasonSeverity - sprayAt) * 10) / 10),
    efficacyPct: calculateInterventionEfficacy(cropId, sprayAt, modality).efficacyPct,
    isFullyArrested: nowDays >= seasonDays,
    spraysSoFar: now.sprays,
    spraysSeason: season.sprays,
    protectionDays: o.protectionDays,
  };
}

/**
 * Treated branch `daysPostIntervention` days after the first spray (calendar days at the given weather).
 */
export function calculateTreatedSeverity(
  cropId: SupportedCropId,
  sIntPct: number,
  daysPostIntervention: number,
  modality: FungicideCategory = 'systemic_curative',
  options: TreatmentScenarioOptions = {},
): TreatedSeverityTrajectoryResult {
  const o = resolveOptions(cropId, modality, options);
  const clock = scenarioClock(cropId, o.temperatureC, o.humidityPct);
  const untreatedPctThen = clock.pctAt(clock.daysAt(sIntPct) + Math.max(0, daysPostIntervention));
  return simulateTreatment(cropId, sIntPct, untreatedPctThen, modality, o);
}

export interface YieldRetentionAnalyticsResult {
  retainedYieldPct: number;
  yieldLossPct: number;
  salvagedYieldPct: number;
  greenLeafAreaPct: number;
  grossSavedUSDPerHectare: number;
  netEconomicBenefitUSDPerHectare: number;
  returnOnInvestmentRatio: number;
  /** Sprays over the season (0 when untreated). */
  sprayCount: number;
  sprayCostUSDPerHectare: number;
}

function yieldLossPct(cal: CropInterventionCalibration, severityPct: number): number {
  return Math.min(cal.maxYieldLossCeiling, Math.max(0, severityPct - cal.yieldDamageThreshold) * cal.yieldSlopeFactor);
}

/**
 * 3. Season outcome: yield kept and a rough money example.
 * "Season end" is when an untreated leaf would reach 100 % at the same weather. Losses use a simple
 * threshold-and-slope damage line per crop; money uses one example crop value and spray cost per spray.
 */
export function evaluateYieldRetention(
  cropId: SupportedCropId,
  sIntPct: number,
  isTreated: boolean,
  modality: FungicideCategory = 'systemic_curative',
  options: TreatmentScenarioOptions = {},
): YieldRetentionAnalyticsResult {
  const cal = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  const untreatedLoss = yieldLossPct(cal, cal.carryingCapacity);

  if (!isTreated) {
    return {
      retainedYieldPct: Math.round((100 - untreatedLoss) * 10) / 10,
      yieldLossPct: Math.round(untreatedLoss * 10) / 10,
      salvagedYieldPct: 0,
      greenLeafAreaPct: 0,
      grossSavedUSDPerHectare: 0,
      netEconomicBenefitUSDPerHectare: 0,
      returnOnInvestmentRatio: 0,
      sprayCount: 0,
      sprayCostUSDPerHectare: 0,
    };
  }

  const season = simulateTreatment(cropId, sIntPct, 100, modality, options);
  const treatedLoss = yieldLossPct(cal, season.plateauSeverityPct);
  const salvaged = Math.max(0, untreatedLoss - treatedLoss);
  const gross = Math.round((salvaged / 100) * cal.marketValuePerHectareUSD);
  const sprayCost = season.spraysSeason * cal.sprayCostPerHectareUSD;

  return {
    retainedYieldPct: Math.round((100 - treatedLoss) * 10) / 10,
    yieldLossPct: Math.round(treatedLoss * 10) / 10,
    salvagedYieldPct: Math.round(salvaged * 10) / 10,
    greenLeafAreaPct: Math.round(Math.max(0, 100 - season.plateauSeverityPct) * 10) / 10,
    grossSavedUSDPerHectare: gross,
    netEconomicBenefitUSDPerHectare: Math.round(gross - sprayCost),
    returnOnInvestmentRatio: sprayCost > 0 ? Math.round((gross / sprayCost) * 10) / 10 : 0,
    sprayCount: season.spraysSeason,
    sprayCostUSDPerHectare: sprayCost,
  };
}

/**
 * 4. Retrieves chemical and biological products registered for the crop.
 */
export function getTreatmentProducts(
  cropId: SupportedCropId,
  category?: FungicideCategory
): ChemicalProductSpec[] {
  const products = AGRONOMIC_INTERVENTION_REGISTRY[cropId]?.products || [];
  if (!category) return products;
  return products.filter((p) => p.category === category);
}
