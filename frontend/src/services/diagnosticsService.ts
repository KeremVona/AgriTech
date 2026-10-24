import type {
  DiagnosticPrediction,
  CropSpecies,
  SeverityTier,
  SeverityIndex,
  TopProbability,
  ClinicalSamplePreset,
} from '../types/diagnostics';

const ML_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ML_URL) || 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 30000;
export const LOW_CONFIDENCE_THRESHOLD = 0.70; // SPEC-UI-006 §5 State 6

/**
 * Format raw model labels like "Tomato___Late_blight" -> "Tomato — Late Blight"
 */
export function formatClassLabel(rawLabel: string): string {
  if (!rawLabel) return 'Unknown Foliage';
  return rawLabel
    .split('___')
    .map((part) =>
      part
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim()
    )
    .join(' — ');
}

/**
 * Map raw severity and condition strings to the platform's 4-Tier Agronomic Severity Ramp.
 * Low confidence, watch states, or unclassified rescans default safely to Tier 1 (Amber Warning).
 */
export function mapAgronomicSeverity(
  rawSeverity?: string,
  condition?: string
): { severityTier: SeverityTier; severityIndex: SeverityIndex } {
  const norm = (rawSeverity || '').toLowerCase();
  const condNorm = (condition || '').toLowerCase();

  if (norm === 'healthy' || condNorm.includes('healthy')) {
    return { severityTier: 'Tier 0', severityIndex: 'Healthy' };
  }
  if (
    norm === 'low' ||
    norm === 'watch' ||
    condNorm.includes('low') ||
    condNorm.includes('watch') ||
    condNorm.includes('uncertain') ||
    condNorm.includes('rescan')
  ) {
    return { severityTier: 'Tier 1', severityIndex: 'Low' };
  }
  if (norm === 'moderate' || norm === 'medium' || norm === 'alert' || condNorm.includes('moderate')) {
    return { severityTier: 'Tier 2', severityIndex: 'Moderate' };
  }
  if (
    norm === 'critical' ||
    norm === 'high' ||
    norm === 'outbreak' ||
    condNorm.includes('blight') ||
    condNorm.includes('necrosis')
  ) {
    return { severityTier: 'Tier 3', severityIndex: 'Critical' };
  }

  // Safe fallback for low-confidence or unclassified foliage
  return { severityTier: 'Tier 1', severityIndex: 'Low' };
}

/**
 * Normalizes crop strings to the 4 supported staples
 */
export function normalizeCropSpecies(rawCrop: string): CropSpecies {
  const norm = (rawCrop || '').toLowerCase();
  if (norm.includes('potato')) return 'Potato';
  if (norm.includes('corn') || norm.includes('maize')) return 'Corn';
  if (norm.includes('apple')) return 'Apple';
  return 'Tomato';
}

/**
 * Verified clinical sample presets representing the 4 primary agricultural staples.
 * Available for instant offline inspection, demonstrations, and tests.
 */
export const CLINICAL_SAMPLE_PRESETS: ClinicalSamplePreset[] = [
  {
    id: 'sample-tomato-late-blight',
    label: 'Tomato — Late Blight',
    icon: '🍅',
    crop: 'Tomato',
    condition: 'Late Blight',
    scientificName: 'Phytophthora infestans',
    confidenceScore: 0.9642,
    severityIndex: 'Critical',
    severityTier: 'Tier 3',
    executionTimeMs: 64.2,
    sampleImageUrl: '/progression/tomato/tomato_stage2_severe.webp',
    agronomicAdvisory: {
      immediateAction:
        'Isolate affected perimeter immediately. Restrict overhead sprinkler irrigation to reduce canopy wetness duration and slow fungal spore dispersal.',
      fungicideTreatments: [
        'Copper Hydroxide (Preventative contact application)',
        'Mancozeb 75 WG or Chlorothalonil prior to forecasted rain events',
        'Cymoxanil curative kick-back spray within 48h of observed lesions',
      ],
      environmentalRiskFactors:
        'Optimal pathogen pressure occurs under high relative humidity (>90%) with ambient temperatures between 15°C and 22°C.',
    },
    topProbabilities: [
      { label: 'Tomato___Late_blight', displayName: 'Tomato — Late Blight', probability: 0.9642 },
      { label: 'Tomato___Early_blight', displayName: 'Tomato — Early Blight', probability: 0.0281 },
      { label: 'Tomato___healthy', displayName: 'Tomato — Healthy Foliage', probability: 0.0077 },
    ],
  },
  {
    id: 'sample-potato-early-blight',
    label: 'Potato — Early Blight',
    icon: '🥔',
    crop: 'Potato',
    condition: 'Early Blight',
    scientificName: 'Alternaria solani',
    confidenceScore: 0.928,
    severityIndex: 'Moderate',
    severityTier: 'Tier 2',
    executionTimeMs: 58.4,
    sampleImageUrl: '/progression/potato/potato_stage1_early.webp',
    agronomicAdvisory: {
      immediateAction:
        'Prune affected lower canopy leaves with concentric ring lesions. Ensure balanced nitrogen nutrition to prevent premature plant senescence.',
      fungicideTreatments: [
        'Azoxystrobin or Pyraclostrobin strobilurin application',
        'Preventative Mancozeb protective barrier before high dew nights',
      ],
      environmentalRiskFactors:
        'Pathogen accelerates during alternating periods of warm dry days (24°C–29°C) and extended night canopy wetness.',
    },
    topProbabilities: [
      { label: 'Potato___Early_blight', displayName: 'Potato — Early Blight', probability: 0.928 },
      { label: 'Potato___Late_blight', displayName: 'Potato — Late Blight', probability: 0.051 },
      { label: 'Potato___healthy', displayName: 'Potato — Healthy Foliage', probability: 0.021 },
    ],
  },
  {
    id: 'sample-corn-common-rust',
    label: 'Corn — Common Rust',
    icon: '🌽',
    crop: 'Corn',
    condition: 'Common Rust',
    scientificName: 'Puccinia sorghi',
    confidenceScore: 0.895,
    severityIndex: 'Low',
    severityTier: 'Tier 1',
    executionTimeMs: 72.1,
    sampleImageUrl: '/progression/corn/corn_stage1_early.webp',
    agronomicAdvisory: {
      immediateAction:
        'Monitor pustule spread on middle and upper leaves prior to tassel emergence (VT stage). Low threshold does not warrant immediate fungicide.',
      fungicideTreatments: [
        'Foliar triazole or strobilurin fungicide if pustules reach upper 3 canopy leaves before blister stage (R2)',
      ],
      environmentalRiskFactors:
        'Favored by cool night temperatures (16°C–23°C) accompanied by heavy morning dew formations.',
    },
    topProbabilities: [
      { label: 'Corn_(maize)___Common_rust_', displayName: 'Corn — Common Rust', probability: 0.895 },
      { label: 'Corn_(maize)___Northern_Leaf_Blight', displayName: 'Corn — Northern Leaf Blight', probability: 0.082 },
      { label: 'Corn_(maize)___healthy', displayName: 'Corn — Healthy Foliage', probability: 0.023 },
    ],
  },
  {
    id: 'sample-apple-healthy',
    label: 'Apple — Healthy Foliage',
    icon: '🍏',
    crop: 'Apple',
    condition: 'Healthy Leaf',
    scientificName: 'Malus domestica',
    confidenceScore: 0.987,
    severityIndex: 'Healthy',
    severityTier: 'Tier 0',
    executionTimeMs: 51.6,
    sampleImageUrl: '/progression/apple/apple_stage0_healthy.webp',
    agronomicAdvisory: {
      immediateAction:
        'Canopy cellular structure asymptomatic. Maintain current IPM sanitation and regular scouting schedule.',
      fungicideTreatments: [
        'Routine dormant season preventative copper spray to protect emerging floral clusters',
      ],
      environmentalRiskFactors:
        'Optimal growing conditions. No fungal pathogen pressure currently detected.',
    },
    topProbabilities: [
      { label: 'Apple___healthy', displayName: 'Apple — Healthy Foliage', probability: 0.987 },
      { label: 'Apple___Apple_scab', displayName: 'Apple — Apple Scab', probability: 0.009 },
      { label: 'Apple___Cedar_apple_rust', displayName: 'Apple — Cedar Apple Rust', probability: 0.004 },
    ],
  },
];

/**
 * Convert a ClinicalSamplePreset into a full DiagnosticPrediction
 */
export function presetToPrediction(preset: ClinicalSamplePreset): DiagnosticPrediction {
  return {
    inferenceId: `preset-${preset.id}-${Date.now()}`,
    crop: preset.crop,
    condition: preset.condition,
    scientificName: preset.scientificName,
    confidenceScore: preset.confidenceScore,
    severityIndex: preset.severityIndex,
    severityTier: preset.severityTier,
    topProbabilities: preset.topProbabilities,
    agronomicAdvisory: preset.agronomicAdvisory,
    executionTimeMs: preset.executionTimeMs,
    sampleImageUrl: preset.sampleImageUrl,
  };
}

/**
 * Classify a leaf image file via the FastAPI machine learning service.
 * Supports timeout, pre-aborted signals, low-confidence (< 70%) detection, and response normalization.
 */
export async function classifyLeafImage(
  file: File,
  signal?: AbortSignal,
  cropHint?: CropSpecies
): Promise<DiagnosticPrediction> {
  const formData = new FormData();
  formData.append('file', file);
  if (cropHint) {
    formData.append('crop_hint', cropHint);
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), DEFAULT_TIMEOUT_MS);

  // Handle incoming abort signal with pre-aborted check and one-time listener
  if (signal) {
    if (signal.aborted) {
      abortController.abort();
    } else {
      signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
  }

  const startTime = performance.now();

  try {
    let response: Response;
    try {
      response = await fetch(`${ML_URL}/api/v1/classify-leaf`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'AbortError' || abortController.signal.aborted) {
        throw new DOMException('Classification request timed out or was cancelled.', 'AbortError');
      }
      throw new Error(
        `Unable to reach the AI vision service at ${ML_URL}. Check server connection or use a verified clinical sample.`
      );
    }

    const elapsed = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let errorMsg = `Inference failed with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (Array.isArray(errorJson.detail)) {
          errorMsg = errorJson.detail
            .map((d: { msg?: string; loc?: string[] }) => d.msg || 'Validation error')
            .join('; ');
        } else if (typeof errorJson.detail === 'string') {
          errorMsg = errorJson.detail;
        } else if (errorJson.message) {
          errorMsg = errorJson.message;
        }
      } catch {
        // Fallback to default status message
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawPred = data.prediction || {};
    const confidenceScore = Number(rawPred.confidence_score ?? 0);

    // SPEC-UI-006 §5 State 6: Centralized Low-Confidence (< 70%) or Explicit Server Rescan
    const isLowConfidence =
      Boolean(data.requires_rescan) || (confidenceScore > 0 && confidenceScore < LOW_CONFIDENCE_THRESHOLD);

    if (isLowConfidence) {
      const rescanInst: string[] =
        data.low_confidence_advisory?.rescan_instructions ||
        data.rescan_instructions || [
          'Ensure the leaf is well lit by direct natural light without heavy shadows.',
          'Position a single leaf flat within the center reticle frame.',
          'Wipe dust or moisture droplets from the camera lens and leaf surface.',
          'Focus on actively symptomatic lesions rather than completely necrotic dried tissue.',
        ];

      const crop = normalizeCropSpecies(rawPred.crop);
      const condition = rawPred.condition || 'Low Confidence Foliage';
      // Low confidence states map to Tier 1 (Amber Warning Pill)
      const severity = { severityTier: 'Tier 1' as SeverityTier, severityIndex: 'Low' as SeverityIndex };

      return {
        inferenceId: data.inference_id || `rescan-${Date.now()}`,
        crop,
        condition: `${condition} (Low Confidence)`,
        scientificName: rawPred.scientific_name || 'Uncertain Foliar Pathogen',
        confidenceScore: confidenceScore || 0.582,
        severityIndex: severity.severityIndex,
        severityTier: severity.severityTier,
        topProbabilities: (data.top_probabilities || []).map((tp: { label: string; probability: number }) => ({
          label: tp.label,
          displayName: formatClassLabel(tp.label),
          probability: tp.probability,
        })),
        agronomicAdvisory: {
          immediateAction:
            data.low_confidence_advisory?.message ||
            `Low confidence diagnosis (${(confidenceScore * 100).toFixed(1)}%). Poor lighting or obscured foliage detected. Re-sampling is recommended before chemical intervention.`,
          fungicideTreatments: [],
          environmentalRiskFactors:
            'Uncertain microclimate risk. Confirm foliar symptoms with a secondary in-field scan.',
        },
        executionTimeMs: data.execution_time_ms || elapsed,
        requiresRescan: true,
        rescanInstructions: rescanInst,
      };
    }

    if (!data.prediction) {
      throw new Error('Invalid response structure received from vision service.');
    }

    const crop = normalizeCropSpecies(rawPred.crop);
    const condition = rawPred.condition || 'Unknown Condition';
    const severity = mapAgronomicSeverity(rawPred.severity_index, condition);

    const topProbabilities: TopProbability[] = (data.top_probabilities || []).map(
      (tp: { label: string; probability: number }) => ({
        label: tp.label,
        displayName: formatClassLabel(tp.label),
        probability: tp.probability,
      })
    );

    const advisory = data.agronomic_advisory || {};

    return {
      inferenceId: data.inference_id || `inf-${Date.now()}`,
      crop,
      condition,
      scientificName: rawPred.scientific_name || 'Plant Pathogen',
      confidenceScore,
      severityIndex: severity.severityIndex,
      severityTier: severity.severityTier,
      topProbabilities,
      agronomicAdvisory: {
        immediateAction: advisory.immediate_action || 'Inspect field foliage for symptom confirmation.',
        fungicideTreatments: advisory.fungicide_treatments || [],
        environmentalRiskFactors: advisory.environmental_risk_factors || 'Standard crop growing conditions.',
      },
      executionTimeMs: data.execution_time_ms || elapsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
