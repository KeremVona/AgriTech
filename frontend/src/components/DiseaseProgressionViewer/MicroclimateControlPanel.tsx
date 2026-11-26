import React, { useId, useMemo } from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type { MicroclimateDiagnostics, WeatherPreset } from '../../models/agronomicTimelineModel.ts';
import {
  AGRONOMIC_CALIBRATION_REGISTRY,
  WEATHER_PRESETS,
  calculateTemperatureFactor,
} from '../../models/agronomicTimelineModel.ts';

export interface MicroclimateControlPanelProps {
  cropId: SupportedCropId;
  temperature: number;
  humidity: number;
  onTemperatureChange: (temp: number) => void;
  onHumidityChange: (humidity: number) => void;
  diagnostics: MicroclimateDiagnostics;
  className?: string;
}

export const MicroclimateControlPanel: React.FC<MicroclimateControlPanelProps> = ({
  cropId,
  temperature,
  humidity,
  onTemperatureChange,
  onHumidityChange,
  diagnostics,
  className = '',
}) => {
  const gradientId = useId();
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId] || AGRONOMIC_CALIBRATION_REGISTRY.tomato;

  const getStatusBadgeStyle = () => {
    if (diagnostics.isStalled) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (diagnostics.compositeFactor >= 0.8) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (diagnostics.compositeFactor >= 0.4) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-ui-warm text-ui-ink-2 border-ui-line';
  };

  const handleApplyPreset = (preset: WeatherPreset) => {
    onTemperatureChange(preset.temperature);
    onHumidityChange(preset.humidity);
  };

  // Generate SVG path points for the Magarey Beta Temperature Curve (scaled 0°C to 45°C)
  const svgWidth = 260;
  const svgHeight = 60;
  const tMinAxis = 0;
  const tMaxAxis = 45;

  const getX = (t: number) => ((t - tMinAxis) / (tMaxAxis - tMinAxis)) * svgWidth;
  const getY = (factor: number) => svgHeight - 8 - factor * (svgHeight - 16);

  const { curvePoints, areaPoints } = useMemo(() => {
    const cPoints: string[] = [];
    const aPoints: string[] = [`M ${getX(tMinAxis)} ${svgHeight - 4}`];

    for (let t = tMinAxis; t <= tMaxAxis; t += 0.5) {
      const factor = calculateTemperatureFactor(t, profile.cardinals);
      const x = getX(t);
      const y = getY(factor);
      if (cPoints.length === 0) {
        cPoints.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
      } else {
        cPoints.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      aPoints.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    aPoints.push(`L ${getX(tMaxAxis)} ${svgHeight - 4} Z`);
    return { curvePoints: cPoints, areaPoints: aPoints };
  }, [profile.cardinals]);

  // Current Temperature indicator position on SVG curve
  const currentTempFactor = calculateTemperatureFactor(temperature, profile.cardinals);
  const currentX = Math.max(2, Math.min(svgWidth - 2, getX(temperature)));
  const currentY = getY(currentTempFactor);

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Weather Controls">
      {/* Status: one big number + short label */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-ui-ink-3">Disease speed</div>
          <div className="text-3xl font-semibold tabular-nums text-ui-ink">
            {diagnostics.compositeFactor.toFixed(2)}×
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${getStatusBadgeStyle()}`}
        >
          {diagnostics.statusLabel}
        </span>
      </div>

      {diagnostics.agronomicAlert && (
        <div
          className={`rounded-xl border px-3.5 py-3 text-sm leading-snug ${
            diagnostics.isStalled
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {diagnostics.agronomicAlert}
        </div>
      )}

      {/* Temperature response curve */}
      <div className="rounded-xl border border-ui-line bg-ui-warm p-3.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ui-ink">Best temperature for {profile.diseaseName}</span>
          <span className="tabular-nums font-medium text-ui-accent-hover">{profile.cardinals.opt}°C</span>
        </div>

        <div className="flex w-full justify-center py-1">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="h-[72px] w-full max-w-[320px] overflow-visible"
            aria-label="Disease speed by temperature chart"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F766E" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0F766E" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaPoints.join(' ')} fill={`url(#${gradientId})`} />
            <line x1="0" y1={svgHeight - 4} x2={svgWidth} y2={svgHeight - 4} stroke="#CBD5E1" strokeWidth="1" />
            <path d={curvePoints.join(' ')} fill="none" stroke="#0F766E" strokeWidth="2.2" strokeLinecap="round" />
            <line
              x1={currentX}
              y1={currentY}
              x2={currentX}
              y2={svgHeight - 4}
              stroke="#0F766E"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle cx={currentX} cy={currentY} r="4.5" fill="#0F766E" stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex justify-between text-xs tabular-nums text-ui-ink-3">
          <span>{tMinAxis}°C</span>
          <span className="font-medium text-ui-accent-hover">{temperature.toFixed(1)}°C now</span>
          <span>{tMaxAxis}°C</span>
        </div>
      </div>

      {/* Presets */}
      <div>
        <div className="mb-2 text-[13px] font-medium text-ui-ink-3">Quick weather</div>
        <div className="grid grid-cols-2 gap-2">
          {WEATHER_PRESETS.map((preset) => {
            const isSelected =
              Math.abs(temperature - preset.temperature) < 1 &&
              Math.abs(humidity - preset.humidity) < 2;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                aria-pressed={isSelected}
                className={`min-h-11 cursor-pointer rounded-xl border p-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
                  isSelected
                    ? 'border-ui-accent-line bg-ui-accent-soft text-ui-ink'
                    : 'border-ui-line bg-ui-bg text-ui-ink hover:bg-ui-warm'
                }`}
              >
                <div className="truncate text-sm font-medium">{preset.label}</div>
                <div className="mt-0.5 text-xs tabular-nums text-ui-ink-2">
                  {preset.temperature}°C · {preset.humidity}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-ui-line bg-ui-warm p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ui-ink">Temperature</span>
            <span className="text-xl font-semibold tabular-nums text-ui-ink">{temperature.toFixed(1)}°C</span>
          </div>
          <input
            type="range"
            min={0}
            max={45}
            step={0.5}
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="h-6 w-full cursor-pointer accent-[var(--color-ui-accent)] focus-visible:outline-2 focus-visible:outline-ui-accent"
            aria-label="Ambient Temperature (°C)"
          />
          <div className="flex justify-between text-xs tabular-nums text-ui-ink-3">
            <span>0°C</span>
            <span>Best {profile.cardinals.opt}°C</span>
            <span>45°C</span>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-ui-line bg-ui-warm p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ui-ink">Humidity</span>
            <span className="text-xl font-semibold tabular-nums text-ui-ink">{humidity.toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            step={1}
            value={humidity}
            onChange={(e) => onHumidityChange(parseFloat(e.target.value))}
            className="h-6 w-full cursor-pointer accent-[var(--color-ui-accent)] focus-visible:outline-2 focus-visible:outline-ui-accent"
            aria-label="Relative Humidity (%)"
          />
          <div className="flex justify-between text-xs tabular-nums text-ui-ink-3">
            <span>20%</span>
            <span className="text-amber-700">Risky above {profile.humidity.crit}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
