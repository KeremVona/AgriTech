import { useState, useEffect } from 'react';
import type { CropId, CropProgressionData, ProgressionStage, ProgressionManifest } from '../types/progression';
import { getProgressionManifest, getCropProgression, resolveStageByPercentage } from '../services/progressionService';

interface UseProgressionDataResult {
  manifest: ProgressionManifest | null;
  cropData: CropProgressionData | null;
  activeStage: ProgressionStage | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to consume disease progression assets and active stage based on selected crop and slider percentage.
 */
export function useProgressionData(selectedCrop: CropId, sliderPercentage: number): UseProgressionDataResult {
  const [manifest, setManifest] = useState<ProgressionManifest | null>(null);
  const [cropData, setCropData] = useState<CropProgressionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getProgressionManifest(), getCropProgression(selectedCrop)])
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

  const activeStage = cropData ? resolveStageByPercentage(cropData.stages, sliderPercentage) : null;

  return {
    manifest,
    cropData,
    activeStage,
    loading,
    error,
  };
}
