/**
 * AI Foliar Pathology & Vision Diagnostics Domain Models
 * Aligned with design/AI_Leaf_Diagnostics_Spec.md (SPEC-UI-006)
 */

export type CropSpecies = 'Tomato' | 'Potato' | 'Corn' | 'Apple';

export type SeverityTier = 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';

export type SeverityIndex = 'Healthy' | 'Low' | 'Moderate' | 'Critical';

export interface TopProbability {
  label: string;
  probability: number;
  displayName?: string;
}

export interface AgronomicAdvisory {
  immediateAction: string;
  fungicideTreatments: string[];
  environmentalRiskFactors: string;
}

export interface DiagnosticPrediction {
  inferenceId: string;
  crop: CropSpecies;
  condition: string;
  scientificName: string;
  confidenceScore: number;
  severityIndex: SeverityIndex;
  severityTier: SeverityTier;
  topProbabilities: TopProbability[];
  agronomicAdvisory: AgronomicAdvisory;
  executionTimeMs: number;
  requiresRescan?: boolean;
  rescanInstructions?: string[];
}

export type DiagnosticUIState =
  | 'IDLE'
  | 'DRAG_OVER'
  | 'VALIDATING'
  | 'INFERENCING'
  | 'SUCCESS'
  | 'LOW_CONFIDENCE'
  | 'REJECTED'
  | 'ERROR';

export interface ClinicalSamplePreset {
  id: string;
  label: string;
  icon: string;
  crop: CropSpecies;
  condition: string;
  scientificName: string;
  confidenceScore: number;
  severityIndex: SeverityIndex;
  severityTier: SeverityTier;
  agronomicAdvisory: AgronomicAdvisory;
  topProbabilities: TopProbability[];
  executionTimeMs: number;
  sampleImageUrl?: string;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  fileSizeMb?: number;
  mimeType?: string;
}
