/**
 * AgronomicTimelineSlider (SPEC-UI-007, Section 4.3).
 * Bi-directionally synchronized epidemiological field scrubber:
 * - Syncs elapsed field days (Magarey Beta projection) and foliar severity %
 * - Automated 4.5s Play/Pause loop with instant scrub interruptibility
 * - Pathology milestone tick marks & intervention checkpoint pin
 * - Light-mode design system tokens (#FFFFFF surface, #0F766E brand teal)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../../models/agronomicTimelineModel.ts';
import { AGRONOMIC_CALIBRATION_REGISTRY } from '../../models/agronomicTimelineModel.ts';

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

  // Play / Pause automated loop (sweeps from 0% to 100% in 4.5 seconds)
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const stepIntervalMs = 50; // 20 updates per second
      const totalDurationMs = 4500;
      const stepDeltaPct = (100 / (totalDurationMs / stepIntervalMs));

      playTimerRef.current = window.setInterval(() => {
        onSliderPercentageChange(
          sliderPercentage >= 100 ? 0 : Math.min(100, sliderPercentage + stepDeltaPct)
        );
      }, stepIntervalMs);
    } else if (playTimerRef.current !== null) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    return () => {
      if (playTimerRef.current !== null) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, sliderPercentage, onSliderPercentageChange]);

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

  const activeMilestone = profile.milestones[dynamicOutput.stageIndex];

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}
      role="region"
      aria-label="Agronomic Timeline Scrubber"
    >
      {/* Top Header: Active Stage & Calendar Countdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Epidemiological Field Timeline
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
              BIOLOGICALLY CALIBRATED
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized projection mapping foliar cellular necrosis to calendar days in the field.
          </p>
        </div>

        {/* Real-Time Elapsed Days HUD */}
        <div className="flex items-center gap-2">
          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={togglePlay}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
              isPlaying
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-teal-700 hover:bg-teal-800 text-white border-teal-800 shadow-xs'
            }`}
            title={isPlaying ? 'Pause timeline playback' : 'Play automated progression loop'}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
          >
            <span>{isPlaying ? '⏸' : '▶'}</span>
            <span>{isPlaying ? 'Pause' : 'Play 4.5s'}</span>
          </button>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex items-center gap-2">
            <span className="text-base">📅</span>
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 leading-tight">
                Projected Field Time
              </div>
              <div className="text-xs font-mono tabular-nums font-bold text-teal-800 leading-tight">
                Day {dynamicOutput.elapsedDays.toFixed(1)}{' '}
                <span className="text-slate-400 font-normal">
                  / ~{dynamicOutput.dayTimelineMax} d
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Scale Slider Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-700" />
            Infection Severity: <strong className="text-slate-900">{sliderPercentage.toFixed(1)}%</strong>
          </span>

          <span className="text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Active Milestone:{' '}
            <strong className="text-amber-800 font-semibold">
              {activeMilestone?.label || `Stage ${dynamicOutput.stageIndex}`}
            </strong>
          </span>
        </div>

        {/* Range Track */}
        <div className="relative pt-1">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={sliderPercentage}
            onChange={handlePercentageScrub}
            className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2.5 cursor-pointer transition-all"
            aria-label="Disease Progression Severity Percentage (0 to 100%)"
          />

          {/* Intervention Checkpoint Pin (if treatment simulated) */}
          {treatmentActive && interventionSeverity !== undefined && (
            <div
              className="absolute top-0 -translate-x-1/2 pointer-events-none transition-all duration-150"
              style={{ left: `${Math.min(98, Math.max(2, interventionSeverity))}%` }}
              title={`Treatment Application Point (${interventionSeverity}%)`}
            >
              <div className="flex flex-col items-center">
                <span className="text-xs drop-shadow-xs">🧪</span>
                <div className="w-0.5 h-3 bg-teal-700" />
              </div>
            </div>
          )}
        </div>

        {/* Milestone Tick Marks */}
        <div className="relative w-full flex justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
          {profile.milestones.map((m, idx) => {
            const isPassed = sliderPercentage >= m.minSliderPct;
            const isCurrent = dynamicOutput.stageIndex === idx;
            const baselineDay =
              m.stageOrder === 0
                ? 0.0
                : m.stageOrder === 1
                  ? profile.baselineDays.stage0_incubation
                  : profile.baselineDays.totalOptimalDays;

            return (
              <button
                key={m.stageOrder}
                type="button"
                onClick={() => handleMilestoneClick(m.minSliderPct)}
                className={`flex flex-col items-center transition-all duration-150 hover:text-slate-900 cursor-pointer ${
                  isCurrent
                    ? 'text-teal-800 font-bold scale-105'
                    : isPassed
                      ? 'text-slate-700 font-medium'
                      : 'text-slate-400'
                }`}
                title={`Jump to ${m.label} (${m.minSliderPct}%)`}
              >
                <div
                  className={`w-2 h-2 rounded-full border transition-all ${
                    isCurrent
                      ? 'bg-teal-700 border-teal-800 ring-2 ring-teal-200'
                      : isPassed
                        ? 'bg-teal-500 border-teal-600'
                        : 'bg-slate-200 border-slate-300'
                  }`}
                />
                <span className="mt-1 font-semibold">{m.label}</span>
                <span className="text-[9px] text-slate-400 tabular-nums">
                  Day {baselineDay.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
