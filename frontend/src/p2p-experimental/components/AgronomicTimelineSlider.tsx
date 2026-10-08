import React, { useCallback } from 'react';
import type { SupportedCropId, ProgressionDynamicOutput } from '../models/agronomicTimelineModel';
import { AGRONOMIC_CALIBRATION_REGISTRY } from '../models/agronomicTimelineModel';

export interface AgronomicTimelineSliderProps {
  cropId: SupportedCropId;
  sliderPercentage: number;
  onSliderPercentageChange: (pct: number) => void;
  dynamicOutput: ProgressionDynamicOutput;
  className?: string;
}

export const AgronomicTimelineSlider: React.FC<AgronomicTimelineSliderProps> = ({
  cropId,
  sliderPercentage,
  onSliderPercentageChange,
  dynamicOutput,
  className = '',
}) => {
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];

  const handlePercentageScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSliderPercentageChange(parseFloat(e.target.value));
    },
    [onSliderPercentageChange]
  );

  const handleMilestoneClick = (targetPct: number) => {
    onSliderPercentageChange(targetPct);
  };

  const activeMilestone = profile.milestones[dynamicOutput.stageIndex];

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 ${className}`}
    >
      {/* Top Header: Active Stage & Calendar Countdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Epidemiological Field Timeline
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
              Biologically Calibrated
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized projection mapping foliar cellular necrosis to calendar days in the field.
          </p>
        </div>

        {/* Real-Time Elapsed Days HUD */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-emerald-500/30 rounded-xl px-3.5 py-1.5 shadow-md flex items-center gap-2">
            <span className="text-base">📅</span>
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 leading-tight">
                Projected Field Time
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 leading-tight">
                Day {dynamicOutput.elapsedDays.toFixed(1)}{' '}
                <span className="text-slate-500 font-normal">
                  / ~{dynamicOutput.dayTimelineMax} d
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Scale Slider Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Infection Severity: <strong className="text-white">{sliderPercentage.toFixed(1)}%</strong>
          </span>

          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Active Milestone:{' '}
            <strong className="text-amber-300">Stage {dynamicOutput.stageIndex}</strong>
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
            className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-3 cursor-pointer transition-all"
            aria-label="Disease Progression Severity Percentage (0 to 100%)"
          />

          {/* Interactive Milestone Indicator Ticks */}
          <div className="relative flex justify-between mt-2">
            {profile.milestones.map((milestone) => {
              const midPct = Math.round((milestone.minSliderPct + milestone.maxSliderPct) / 2);
              const isActive = dynamicOutput.stageIndex === milestone.stageOrder;

              return (
                <button
                  key={milestone.stageOrder}
                  type="button"
                  onClick={() => handleMilestoneClick(midPct)}
                  className={`flex flex-col items-center group transition-all cursor-pointer ${
                    isActive ? 'scale-105' : 'opacity-65 hover:opacity-95'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                      isActive
                        ? 'bg-emerald-400 border-white shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                        : 'bg-slate-700 border-slate-600 group-hover:bg-slate-500'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold mt-1 transition-colors ${
                      isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    Stage {milestone.stageOrder}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono hidden sm:inline-block">
                    {milestone.stageOrder === 0
                      ? '0% - 30%'
                      : milestone.stageOrder === 1
                      ? '30% - 70%'
                      : '70% - 100%'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Stage Biological Pathology Marker Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">
              🔬 {activeMilestone.label}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
              Stage {dynamicOutput.stageIndex} of 2
            </span>
          </div>

          {dynamicOutput.stageIndex < 2 && (
            <div className="text-[11px] font-mono text-amber-400/90">
              ⏱️ Time to Next Stage:{' '}
              <span className="font-bold text-amber-300">
                {dynamicOutput.stageDaysRemaining.toFixed(1)} days
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {activeMilestone.pathologyMarker}
        </p>
      </div>
    </div>
  );
};
