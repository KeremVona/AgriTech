/**
 * Timeline: play/pause sweep (4.5 s), severity slider synced to field days, three stage markers
 * and the treatment point when a treatment is simulated.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../../models/agronomicTimelineModel.ts';
import { AGRONOMIC_CALIBRATION_REGISTRY, getOptimalDaysForSlider } from '../../models/agronomicTimelineModel.ts';

/** Plain stage names for the three markers; the scientific milestone label stays in the tooltip. */
const STAGE_NAMES = ['Healthy', 'Early', 'Severe'] as const;

export interface AgronomicTimelineSliderProps {
  cropId: SupportedCropId;
  sliderPercentage: number;
  onSliderPercentageChange: (pct: number) => void;
  dynamicOutput: ProgressionDynamicOutput;
  treatmentActive?: boolean;
  interventionSeverity?: number;
  className?: string;
}

export const AgronomicTimelineSlider: React.FC<AgronomicTimelineSliderProps> = ({
  cropId,
  sliderPercentage,
  onSliderPercentageChange,
  dynamicOutput,
  treatmentActive = false,
  interventionSeverity,
  className = '',
}) => {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId] || AGRONOMIC_CALIBRATION_REGISTRY.tomato;
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<number | null>(null);
  const sliderPctRef = useRef(sliderPercentage);

  useEffect(() => {
    sliderPctRef.current = sliderPercentage;
  }, [sliderPercentage]);

  // Play / Pause automated loop (sweeps from 0% to 100% in 4.5 seconds)
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current !== null) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    const stepIntervalMs = 50; // 20 updates per second
    const totalDurationMs = 4500;
    const stepDeltaPct = 100 / (totalDurationMs / stepIntervalMs);

    playTimerRef.current = window.setInterval(() => {
      const current = sliderPctRef.current;
      onSliderPercentageChange(
        current >= 100 ? 0 : Math.min(100, current + stepDeltaPct)
      );
    }, stepIntervalMs);

    return () => {
      if (playTimerRef.current !== null) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, onSliderPercentageChange]);

  const handlePercentageScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // User manual scrub pauses autoplay immediately
      if (isPlaying) setIsPlaying(false);
      onSliderPercentageChange(parseFloat(e.target.value));
    },
    [isPlaying, onSliderPercentageChange]
  );

  const handleMilestoneClick = (targetPct: number) => {
    if (isPlaying) setIsPlaying(false);
    onSliderPercentageChange(targetPct);
  };

  return (
    <div className={`rounded-2xl border border-ui-line bg-ui-bg p-4 sm:p-5 ${className}`} role="region" aria-label="Timeline">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ui-ink text-white transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent"
          aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" aria-hidden="true">
              <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
            </svg>
          )}
        </button>

        <div className="relative flex-1 pt-1">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={sliderPercentage}
            onChange={handlePercentageScrub}
            className="h-2 w-full cursor-pointer accent-[var(--color-ui-accent)]"
            aria-label="Disease severity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sliderPercentage * 10) / 10}
            aria-valuetext={dynamicOutput.microclimate.isStalled ? `${sliderPercentage.toFixed(0)}% disease progress, no change in this weather` : `${sliderPercentage.toFixed(0)}% disease progress, day ${dynamicOutput.elapsedDays.toFixed(0)}`}
          />
          {treatmentActive && interventionSeverity !== undefined && (
            <div
              className="pointer-events-none absolute -top-2 -translate-x-1/2"
              style={{ left: `${Math.min(98, Math.max(2, interventionSeverity))}%` }}
              title={`Treatment applied at ${interventionSeverity.toFixed(0)}%`}
            >
              <span className="block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-ui-accent" aria-hidden="true" />
            </div>
          )}
        </div>

        <p className="w-24 shrink-0 text-right">
          {dynamicOutput.microclimate.isStalled ? (
            <>
              <span className="block text-lg font-medium leading-tight text-ui-ink">No change</span>
              <span className="block text-xs text-ui-ink-3">in this weather</span>
            </>
          ) : (
            <>
              <span className="block text-lg font-medium tabular-nums leading-tight text-ui-ink">Day {dynamicOutput.elapsedDays.toFixed(0)}</span>
              <span className="block text-xs tabular-nums text-ui-ink-3">of ~{dynamicOutput.dayTimelineMax}</span>
            </>
          )}
        </p>
      </div>

      <ol role="list" className="mt-3 grid grid-cols-3 gap-2 border-t border-ui-line pt-3">
        {profile.milestones.map((m, idx) => {
          const isCurrent = dynamicOutput.stageIndex === idx;
          const isPassed = sliderPercentage >= m.minSliderPct;
          // Day this stage starts under the current weather (same scaling as the live day readout).
          const stageStartDay = getOptimalDaysForSlider(cropId, m.stageOrder === 0 ? 0 : m.minSliderPct) / dynamicOutput.microclimate.compositeFactor;
          return (
            <li key={m.stageOrder} className={idx === 1 ? 'text-center' : idx === 2 ? 'text-right' : ''}>
              <button
                type="button"
                onClick={() => handleMilestoneClick(m.minSliderPct)}
                title={m.label}
                aria-current={isCurrent ? 'step' : undefined}
                className={`inline-flex min-h-10 cursor-pointer flex-col justify-center rounded-lg px-2 transition-colors hover:bg-ui-warm focus-visible:outline-2 focus-visible:outline-ui-accent ${
                  idx === 1 ? 'items-center' : idx === 2 ? 'items-end' : 'items-start'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-ui-accent ring-4 ring-ui-accent-soft' : isPassed ? 'bg-ui-accent' : 'bg-ui-warm-strong'}`}
                    aria-hidden="true"
                  />
                  <span className={`text-sm ${isCurrent ? 'font-medium text-ui-ink' : 'text-ui-ink-2'}`}>{STAGE_NAMES[idx] ?? m.label}</span>
                </span>
                <span className="text-xs tabular-nums text-ui-ink-3">{dynamicOutput.microclimate.isStalled ? '—' : `day ${stageStartDay.toFixed(0)}`}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
