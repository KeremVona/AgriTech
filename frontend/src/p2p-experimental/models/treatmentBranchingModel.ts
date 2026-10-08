/**
 * Agronomic Pathology Treatment & Intervention Branching Engine
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 3)
 *
 * Grounded in:
 * - Van der Plank (1963) plant disease epidemiology
 * - Generalized Logistic Decay efficacy curve eta(S_int)
 * - Latency buffer & biological incubation leakage model (omega_leak)
 * - Asymptotic continuous time relaxation post-intervention (k_arrest)
 * - Classical damage functions: Shtienberg (Tomato), James/Van der Zaag (Potato),
 *   Pataky (Corn), MacHardy (Apple)
 * - FRAC (Fungicide Resistance Action Committee) chemical modes of action
 */

import type { SupportedCropId } from './agronomicTimelineModel.ts';

export type FungicideCategory = 'systemic_curative' | 'protectant_contact' | 'bio_fungicide';

export interface ChemicalProductSpec {
  id: string;
  tradeName: string;
  activeIngredient: string;
  fracCode: string;
  category: FungicideCategory;
  modeOfAction: string;
  curativeKickbackHours: number; // 0 for pure contact protectant
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
        tradeName: 'Inspire Super (Difenoconazole 25% EC)',
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
        tradeName: 'Inspire Super (Difenoconazole + Cyprodinil)',
        activeIngredient: 'Difenoconazole',
        fracCode: 'FRAC 3',
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
        id: 'pepper-kasumin',
        tradeName: 'Kasumin 2L',
        activeIngredient: 'Kasugamycin hydrochloride',
        fracCode: 'FRAC 24',
        category: 'systemic_curative',
        modeOfAction: 'Hexopyranosyl antibiotic inhibiting bacterial 30S ribosomal protein synthesis',
        curativeKickbackHours: 36,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 1,
        resistanceRisk: 'MEDIUM',
        isOrganicCertified: false,
        applicationNotes: 'Translaminar bactericide. Limit to 4 applications per season. Do not use in greenhouses.',
      },
      {
        id: 'pepper-kocide-mancozeb',
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
        id: 'peach-firewall',
        tradeName: 'FireWall 17 WP / Mycoshield',
        activeIngredient: 'Oxytetracycline',
        fracCode: 'FRAC 41',
        category: 'systemic_curative',
        modeOfAction: 'Tetracycline antibiotic binding 30S ribosomal subunit to arrest bacterial translation',
        curativeKickbackHours: 24,
        rainfastnessHours: 2,
        preHarvestIntervalDays: 21,
        resistanceRisk: 'HIGH',
        isOrganicCertified: false,
        applicationNotes: 'Apply from petal fall through cover sprays on a 7-10 day interval. 21-day PHI.',
      },
      {
        id: 'peach-kocide-micro',
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
  currentSeverityPct: number;
  plateauSeverityPct: number;
  expansionDeltaPct: number;
  efficacyPct: number;
  isFullyArrested: boolean;
}

/**
 * 2. Calculates post-treatment branched severity at timeline day t:
 *    S_treated(t) = S_plateau - (S_plateau - S_int) * exp(-k_arrest * (t - t_int))
 */
export function calculateTreatedSeverity(
  cropId: SupportedCropId,
  sIntPct: number,
  daysPostIntervention: number,
  modality: FungicideCategory = 'systemic_curative'
): TreatedSeverityTrajectoryResult {
  const cal = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  const { efficacy, efficacyPct } = calculateInterventionEfficacy(cropId, sIntPct, modality);
  const sInt = Math.max(0, Math.min(100, sIntPct));

  // Latency buffer: uncurable latent expansion ratio omega_leak
  const maxRoom = cal.carryingCapacity - sInt;
  const deltaLeak = maxRoom * (1.0 - efficacy) * cal.leakageRatio;
  const sPlateau = Math.min(cal.carryingCapacity, sInt + deltaLeak);

  // Time relaxation asymptotic arrest
  const dt = Math.max(0, daysPostIntervention);
  const sTreated = sPlateau - (sPlateau - sInt) * Math.exp(-cal.arrestRateDay * dt);

  const roundedTreated = Math.round(sTreated * 10) / 10;
  const roundedPlateau = Math.round(sPlateau * 10) / 10;
  const roundedDelta = Math.round((roundedPlateau - sInt) * 10) / 10;
  const isFullyArrested = Math.abs(roundedPlateau - roundedTreated) <= 0.2;

  return {
    currentSeverityPct: roundedTreated,
    plateauSeverityPct: roundedPlateau,
    expansionDeltaPct: Math.max(0, roundedDelta),
    efficacyPct,
    isFullyArrested,
  };
}

export interface YieldRetentionAnalyticsResult {
  retainedYieldPct: number;
  yieldLossPct: number;
  salvagedYieldPct: number;
  greenLeafAreaPct: number;
  grossSavedUSDPerHectare: number;
  netEconomicBenefitUSDPerHectare: number;
  returnOnInvestmentRatio: number;
}

/**
 * 3. Evaluates Quantitative Yield Salvage / Retention and Financial Economics.
 */
export function evaluateYieldRetention(
  cropId: SupportedCropId,
  sIntPct: number,
  isTreated: boolean,
  modality: FungicideCategory = 'systemic_curative'
): YieldRetentionAnalyticsResult {
  const cal = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  const sFinalUntreated = cal.carryingCapacity; // 100% destruction in unchecked epidemic

  // Untreated baseline loss
  const effectiveUntreatedS = Math.max(0, sFinalUntreated - cal.yieldDamageThreshold);
  const untreatedLossPct = Math.min(cal.maxYieldLossCeiling, effectiveUntreatedS * cal.yieldSlopeFactor);
  const untreatedRetainedPct = Math.max(0, 100 - untreatedLossPct);

  if (!isTreated) {
    return {
      retainedYieldPct: Math.round(untreatedRetainedPct * 10) / 10,
      yieldLossPct: Math.round(untreatedLossPct * 10) / 10,
      salvagedYieldPct: 0.0,
      greenLeafAreaPct: 0.0,
      grossSavedUSDPerHectare: 0,
      netEconomicBenefitUSDPerHectare: 0,
      returnOnInvestmentRatio: 0,
    };
  }

  // Treated scenario at full asymptotic maturity (dt = 30 days)
  const { plateauSeverityPct } = calculateTreatedSeverity(cropId, sIntPct, 30.0, modality);
  const effectiveTreatedS = Math.max(0, plateauSeverityPct - cal.yieldDamageThreshold);
  const treatedLossPct = Math.min(cal.maxYieldLossCeiling, effectiveTreatedS * cal.yieldSlopeFactor);
  const treatedRetainedPct = Math.max(0, 100 - treatedLossPct);

  const salvagedYieldPct = Math.max(0, treatedRetainedPct - untreatedRetainedPct);
  const greenLeafAreaPct = Math.max(0, 100 - plateauSeverityPct);

  // Economic calculations
  const grossSavedUSD = Math.round((salvagedYieldPct / 100.0) * cal.marketValuePerHectareUSD);
  const sprayCost = cal.sprayCostPerHectareUSD;
  const netSavedUSD = Math.round(grossSavedUSD - sprayCost);
  const roi = sprayCost > 0 ? Math.round((grossSavedUSD / sprayCost) * 10) / 10 : 0;

  return {
    retainedYieldPct: Math.round(treatedRetainedPct * 10) / 10,
    yieldLossPct: Math.round(treatedLossPct * 10) / 10,
    salvagedYieldPct: Math.round(salvagedYieldPct * 10) / 10,
    greenLeafAreaPct: Math.round(greenLeafAreaPct * 10) / 10,
    grossSavedUSDPerHectare: grossSavedUSD,
    netEconomicBenefitUSDPerHectare: netSavedUSD,
    returnOnInvestmentRatio: roi,
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
