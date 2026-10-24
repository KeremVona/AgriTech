import { useState, useEffect } from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel.ts';
import type {
  ExperimentalCropProgressionData,
  ExperimentalProgressionManifest,
} from '../services/progressionService.ts';
import type { ProgressionStage } from '../types/progression';
import {
  getExperimentalProgressionManifest,
  getExperimentalCropProgression,
  resolveExperimentalStage,
} from '../services/progressionService.ts';

export interface UseExperimentalProgressionDataResult {
  manifest: ExperimentalProgressionManifest | null;
  cropData: ExperimentalCropProgressionData | null;
  activeStage: ProgressionStage | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to consume 8-crop disease progression assets and active stage.
 */
export function useExperimentalProgressionData(
  selectedCrop: SupportedCropId,
  sliderPercentage: number
): UseExperimentalProgressionDataResult {
  const [manifest, setManifest] = useState<ExperimentalProgressionManifest | null>(null);
  const [cropData, setCropData] = useState<ExperimentalCropProgressionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getExperimentalProgressionManifest(),
      getExperimentalCropProgression(selectedCrop),
    ])
      .then(([loadedManifest, loadedCrop]) => {
        if (isMounted) {
          setManifest(loadedManifest);
          setCropData(loadedCrop);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCrop]);

  const activeStage = cropData
    ? resolveExperimentalStage(cropData.stages, sliderPercentage)
    : null;

  return {
    manifest,
    cropData,
    activeStage,
    loading,
    error,
  };
}

export const useProgressionData = useExperimentalProgressionData;
export type UseProgressionDataResult = UseExperimentalProgressionDataResult;
