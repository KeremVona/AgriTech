/**
 * Field Diagnostic Advisory Report Model & Data Assembly
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 4)
 *
 * Assembles clinical field report data combining:
 * 1. Pathogen taxonomy & classification
 * 2. Active microclimate telemetry (Temp, RH, Magarey multiplier)
 * 3. Progression timeline metrics (Severity %, Calibrated Field Days, Stage)
 * 4. Treatment intervention status (Treated vs Untreated, GLA %, Yield Salvaged, Net $/ha)
 * 5. Chemical product recommendation with FRAC codes & application stewardship
 * 6. Cultural sanitation & biological disease prevention controls
 */

import type { SupportedCropId, ProgressionDynamicOutput } from './agronomicTimelineModel.ts';
import type {
  FungicideCategory,
  ChemicalProductSpec,
  YieldRetentionAnalyticsResult,
  InterventionEfficacyResult,
} from './treatmentBranchingModel.ts';
import {
  AGRONOMIC_INTERVENTION_REGISTRY,
  getTreatmentProducts,
} from './treatmentBranchingModel.ts';

export interface ReportTelemetrySnapshot {
  temperatureC: number;
  humidityPct: number;
  microclimateMultiplier: number;
  alertBadge: string | null;
  environmentalConditionLabel: string;
}

export interface ReportFoliarMetrics {
  cropId: SupportedCropId;
  cropName: string;
  diseaseName: string;
  pathogenScientific: string;
  pathogenType: string;
  severityPercentage: number;
  calibratedFieldDays: number;
  stageOrder: number;
  stageLabel: string;
  greenLeafAreaPct: number;
}

export interface ReportTreatmentSection {
  isTreatmentSimulated: boolean;
  interventionSeverityPct: number;
  interventionDay: number;
  curativeEfficacyPct: number;
  efficacyWindowTier: string;
  activeProduct: ChemicalProductSpec | null;
  yieldSalvagedPct: number;
  retainedYieldPct: number;
  netEconomicBenefitUSD: number;
  returnOnInvestment: number;
  biologicalManifestation: {
    haloChlorosis: string;
    necroticDesiccation: string;
    sporulationSuppression: string;
    marginMorphology: string;
  };
}

export interface AgronomicFieldReportData {
  reportId: string;
  generatedAtISO: string;
  generatedDateFormatted: string;
  telemetry: ReportTelemetrySnapshot;
  foliar: ReportFoliarMetrics;
  treatment: ReportTreatmentSection;
  culturalControls: string[];
  canvasSnapshotDataUrl: string | null;
}

/**
 * Generates a clean, sanitized filename for exported assets.
 */
export function generateExportFilename(
  cropId: string,
  diseaseName: string,
  extension: 'webm' | 'png' | 'pdf'
): string {
  const sanitize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const crop = sanitize(cropId);
  const disease = sanitize(diseaseName);
  const dateStr = new Date().toISOString().slice(0, 10);

  return `${crop}_${disease}_progression_${dateStr}.${extension}`;
}

/**
 * Assembles the full field report dataset ready for PDF preview and printing.
 */
export function assembleFieldReportData(params: {
  cropId: SupportedCropId;
  cropName: string;
  diseaseName: string;
  pathogenScientific: string;
  pathogenType: string;
  currentSeverityPct: number;
  dynamicOutput: ProgressionDynamicOutput;
  temperatureC: number;
  humidityPct: number;
  stageOrder: number;
  stageLabel: string;
  treatmentActive: boolean;
  interventionSeverity: number;
  interventionDays: number;
  selectedCategory: FungicideCategory;
  selectedProductId: string;
  efficacyResult: InterventionEfficacyResult;
  yieldAnalytics: YieldRetentionAnalyticsResult;
  canvasSnapshotDataUrl: string | null;
}): AgronomicFieldReportData {
  const {
    cropId,
    cropName,
    diseaseName,
    pathogenScientific,
    pathogenType,
    currentSeverityPct,
    dynamicOutput,
    temperatureC,
    humidityPct,
    stageOrder,
    stageLabel,
    treatmentActive,
    interventionSeverity,
    interventionDays,
    selectedCategory,
    selectedProductId,
    efficacyResult,
    yieldAnalytics,
    canvasSnapshotDataUrl,
  } = params;

  const profile = AGRONOMIC_INTERVENTION_REGISTRY[cropId];
  const products = getTreatmentProducts(cropId, selectedCategory);
  const activeProduct =
    products.find((p) => p.id === selectedProductId) || products[0] || null;

  // Determine environmental condition label
  const mult = dynamicOutput.microclimate.compositeFactor;
  let conditionLabel = 'Standard Field Norm (1.0×)';
  if (mult >= 1.8) {
    conditionLabel = `Epidemic Surge (${mult.toFixed(1)}× acceleration)`;
  } else if (mult <= 0.4) {
    conditionLabel = `Suppressed / Dormant (${mult.toFixed(1)}× rate)`;
  } else if (mult > 1.0) {
    conditionLabel = `Elevated Pathogen Activity (${mult.toFixed(1)}×)`;
  }

  // Cultural controls based on pathosystem
  const culturalControls = getCulturalControls(cropId);

  const now = new Date();
  const reportId = `AGR-${cropId.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    reportId,
    generatedAtISO: now.toISOString(),
    generatedDateFormatted: now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    telemetry: {
      temperatureC,
      humidityPct,
      microclimateMultiplier: mult,
      alertBadge: dynamicOutput.microclimate.agronomicAlert || null,
      environmentalConditionLabel: conditionLabel,
    },
    foliar: {
      cropId,
      cropName,
      diseaseName,
      pathogenScientific,
      pathogenType,
      severityPercentage: Math.round(currentSeverityPct * 10) / 10,
      calibratedFieldDays: Math.round(dynamicOutput.elapsedDays * 10) / 10,
      stageOrder,
      stageLabel,
      greenLeafAreaPct: treatmentActive
        ? yieldAnalytics.greenLeafAreaPct
        : Math.max(0, Math.round((100 - currentSeverityPct) * 10) / 10),
    },
    treatment: {
      isTreatmentSimulated: treatmentActive,
      interventionSeverityPct: Math.round(interventionSeverity * 10) / 10,
      interventionDay: Math.round(interventionDays * 10) / 10,
      curativeEfficacyPct: efficacyResult.efficacyPct,
      efficacyWindowTier: efficacyResult.windowTier,
      activeProduct,
      yieldSalvagedPct: yieldAnalytics.salvagedYieldPct,
      retainedYieldPct: yieldAnalytics.retainedYieldPct,
      netEconomicBenefitUSD: yieldAnalytics.netEconomicBenefitUSDPerHectare,
      returnOnInvestment: yieldAnalytics.returnOnInvestmentRatio,
      biologicalManifestation: {
        haloChlorosis: profile.manifestation.haloChlorosisEffect,
        necroticDesiccation: profile.manifestation.necroticDesiccationEffect,
        sporulationSuppression: profile.manifestation.sporulationSuppressionEffect,
        marginMorphology: profile.manifestation.marginMorphology,
      },
    },
    culturalControls,
    canvasSnapshotDataUrl,
  };
}

/**
 * Standard agronomic cultural control guidelines per crop.
 */
function getCulturalControls(cropId: SupportedCropId): string[] {
  switch (cropId) {
    case 'tomato':
      return [
        'Prune lower foliar canopy (bottom 30 cm) to eliminate soil splash transmission.',
        'Shift to drip irrigation or micro-sprinklers; maintain zero overhead canopy wetting.',
        'Apply organic straw or plastic mulch to seal soil surface conidial reservoirs.',
        'Implement 3-year Solanaceous crop rotation (avoid planting after potato or eggplant).',
      ];
    case 'potato':
      return [
        'Maintain vigorous hilling to create a minimum 10 cm soil barrier over developing tubers.',
        'Destroy volunteer potato plants and cull piles within a 2 km radius.',
        'Schedule preventative fungicide sprays ahead of BLITECAST high-risk rain periods.',
        'Allow minimum 14 days between vine desiccation (chemical vine kill) and tuber harvest.',
      ];
    case 'corn':
      return [
        'Select hybrid cultivars displaying high general resistance (Puccinia sorghi Rp gene complex).',
        'Incorporate post-harvest crop residue via deep tillage to accelerate fungal decomposition.',
        'Monitor ear leaf and adjacent leaves weekly from tasseling (VT) through milk stage (R3).',
        'Avoid high-density planting in river valleys or high morning fog corridors.',
      ];
    case 'apple':
      return [
        'Prune dense canopy shoots in dormant season to maximize internal sunlight penetration and airflow.',
        'Shred or remove fallen autumn leaf litter, or spray urea (5%) at leaf drop to promote decay.',
        'Apply protective copper spray at green tip stage prior to first spring ascospore release.',
        'Flail mow orchard floor post-harvest to chop overwintering Venturia pseudothecia.',
      ];
  }
}
