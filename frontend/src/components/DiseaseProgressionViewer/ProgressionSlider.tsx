import React, { useCallback } from 'react';

export interface ProgressionSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  activeStageLabel?: string;
  className?: string;
}

export const ProgressionSlider: React.FC<ProgressionSliderProps> = ({
  value,
  onChange,
  disabled = false,
  activeStageLabel = '',
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      let nextValue = value;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          nextValue = Math.max(0, value - (e.shiftKey ? 5 : 1));
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          nextValue = Math.min(100, value + (e.shiftKey ? 5 : 1));
          break;
        case 'PageDown':
          nextValue = Math.max(0, value - 10);
          break;
        case 'PageUp':
          nextValue = Math.min(100, value + 10);
          break;
        case 'Home':
          nextValue = 0;
          break;
        case 'End':
          nextValue = 100;
          break;
        default:
          return;
      }

      e.preventDefault();
      onChange(Math.round(nextValue * 10) / 10);
    },
    [value, onChange, disabled]
  );

  const getStageColor = (val: number) => {
    if (val <= 30) return 'text-emerald-400';
    if (val <= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const ariaValueText = `Infection level ${value.toFixed(1)} percent, ${activeStageLabel || 'Stage'}`;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Stage Range Headings with Visual Accents */}
      <div className="flex justify-between items-center text-xs font-semibold tracking-wider">
        <button
          type="button"
          onClick={() => onChange(0)}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            value <= 30 ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Jump to Stage 0: Early Inoculation (0% - 30%)"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Stage 0: Early Inoculation (0–30%)</span>
        </button>

        <button
          type="button"
          onClick={() => onChange(50)}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            value > 30 && value <= 70 ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Jump to Stage 1: Active Spread (31% - 70%)"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Stage 1: Active Spread (31–70%)</span>
        </button>

        <button
          type="button"
          onClick={() => onChange(100)}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            value > 70 ? 'text-red-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Jump to Stage 2: Tissue Necrosis (71% - 100%)"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>Stage 2: Tissue Necrosis (71–100%)</span>
        </button>
      </div>

      {/* Styled Slider Track Container */}
      <div className="relative py-2">
        {/* Visual Multi-Segment Stage Track Background */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2.5 rounded-full bg-slate-800 overflow-hidden flex pointer-events-none">
          <div className="w-[30%] h-full bg-emerald-500/25 border-r border-slate-900" />
          <div className="w-[40%] h-full bg-amber-500/25 border-r border-slate-900" />
          <div className="w-[30%] h-full bg-red-500/25" />
        </div>

        {/* Milestone Indicator Ticks */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-1 pointer-events-none">
          <span className="w-1.5 h-3.5 bg-emerald-400/80 rounded-xs shadow-xs" title="0% - Healthy" />
          <span className="w-1.5 h-3.5 bg-emerald-500/80 rounded-xs ml-[28%]" title="30% - Early Boundary" />
          <span className="w-1.5 h-3.5 bg-amber-400/80 rounded-xs ml-[18%]" title="50% - Mid Spread" />
          <span className="w-1.5 h-3.5 bg-amber-500/80 rounded-xs ml-[18%]" title="70% - Necrosis Boundary" />
          <span className="w-1.5 h-3.5 bg-red-400/80 rounded-xs" title="100% - Severe Collapse" />
        </div>

        {/* Semantic Accessible Native Range Input */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onKeyDown={handleKeyDown}
          aria-label="Crop disease progression infection level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={ariaValueText}
          className="relative z-10 w-full h-3 appearance-none bg-transparent cursor-pointer accent-emerald-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg"
        />
      </div>

      {/* Scrub Helper Bar */}
      <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
        <span>0%</span>
        <span>
          Scrub Position: <span className={`font-bold ${getStageColor(value)}`}>{value.toFixed(1)}%</span>
        </span>
        <span>100%</span>
      </div>
    </div>
  );
};
