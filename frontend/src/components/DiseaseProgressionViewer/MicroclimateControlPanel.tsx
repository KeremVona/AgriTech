/**
 * MicroclimateControlPanel (SPEC-UI-007, Section 4.7).
 * Precision Ag-Intelligence light-mode microclimate simulator featuring:
 * - Dual ambient weather sliders (Temperature & Relative Humidity)
 * - Interactive SVG Magarey Beta cardinal temperature response curve with live pin
 * - Dynamic epidemic speed multiplier badge & agronomic alert banner
 * - Preset scenarios for immediate epidemiology stress testing
 */

import React, { useId } from 'react';
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
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    if (diagnostics.compositeFactor >= 0.8) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (diagnostics.compositeFactor >= 0.4) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    return 'bg-sky-50 text-sky-800 border-sky-200';
  };

  const handleApplyPreset = (preset: WeatherPreset) => {
    onTemperatureChange(preset.temperature);
    onHumidityChange(preset.humidity);
  };

  // Generate SVG path points for the Magarey Beta Temperature Curve
  const svgWidth = 260;
  const svgHeight = 60;
  const tMinAxis = Math.max(0, profile.cardinals.min - 4);
  const tMaxAxis = Math.min(45, profile.cardinals.max + 4);

  const getX = (t: number) => ((t - tMinAxis) / (tMaxAxis - tMinAxis)) * svgWidth;
  const getY = (factor: number) => svgHeight - 8 - factor * (svgHeight - 16);

  const curvePoints: string[] = [];
  const areaPoints: string[] = [`M ${getX(tMinAxis)} ${svgHeight - 4}`];

  for (let t = tMinAxis; t <= tMaxAxis; t += 0.5) {
    const factor = calculateTemperatureFactor(t, profile.cardinals);
    const x = getX(t);
    const y = getY(factor);
    if (curvePoints.length === 0) {
      curvePoints.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
    } else {
      curvePoints.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    areaPoints.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  areaPoints.push(`L ${getX(tMaxAxis)} ${svgHeight - 4} Z`);

  // Current Temperature indicator position on SVG curve
  const currentTempFactor = calculateTemperatureFactor(temperature, profile.cardinals);
  const currentX = Math.max(4, Math.min(svgWidth - 4, getX(temperature)));
  const currentY = getY(currentTempFactor);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 ${className}`}
      role="region"
      aria-label="Microclimate Simulation Controls"
    >
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 text-sm shadow-2xs">
            🌡️
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Microclimate Modifiers
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                MAGAREY BETA
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate ambient weather to dynamically accelerate or arrest pathogen development.
            </p>
          </div>
        </div>

        {/* Live Multiplier Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-2 shadow-2xs ${getStatusBadgeStyle()}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                diagnostics.isStalled ? 'bg-rose-500' : 'bg-current animate-pulse'
              }`}
            />
            <span>{diagnostics.statusLabel}</span>
            <span className="font-mono tabular-nums opacity-85">
              ({diagnostics.compositeFactor.toFixed(2)}× speed)
            </span>
          </div>
        </div>
      </div>

      {/* Agronomic Warning / Alert Banner */}
      {diagnostics.agronomicAlert && (
        <div
          className={`px-3.5 py-2.5 rounded-xl text-xs flex items-start gap-2.5 border transition-all ${
            diagnostics.isStalled
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <span className="text-sm mt-0.5">{diagnostics.isStalled ? '🛑' : '⚠️'}</span>
          <div className="leading-relaxed">
            <span className="font-semibold">
              {diagnostics.isStalled ? 'Epidemic Arrested: ' : 'Epidemiological Notice: '}
            </span>
            {diagnostics.agronomicAlert}
          </div>
        </div>
      )}

      {/* Interactive Cardinal Curve SVG Mini-Visualizer */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <span>📈</span>
            <span>Thermal Response Beta Curve ({profile.diseaseName})</span>
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span>T_opt: <strong className="text-teal-700">{profile.cardinals.opt}°C</strong></span>
            <span>Range: {profile.cardinals.min}–{profile.cardinals.max}°C</span>
          </div>
        </div>

        <div className="w-full flex justify-center py-1">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full max-w-[320px] h-[72px] overflow-visible"
            aria-label="Magarey Beta Temperature Curve Chart"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F766E" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0F766E" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Shaded Area under Curve */}
            <path d={areaPoints.join(' ')} fill={`url(#${gradientId})`} />

            {/* Base Line */}
            <line
              x1="0"
              y1={svgHeight - 4}
              x2={svgWidth}
              y2={svgHeight - 4}
              stroke="#CBD5E1"
              strokeWidth="1"
            />

            {/* Cardinal Curve */}
            <path
              d={curvePoints.join(' ')}
              fill="none"
              stroke="#0F766E"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Vertical Marker for Current Temperature */}
            <line
              x1={currentX}
              y1={currentY}
              x2={currentX}
              y2={svgHeight - 4}
              stroke="#0F766E"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />

            {/* Current Temperature Pin Point */}
            <circle
              cx={currentX}
              cy={currentY}
              r="4.5"
              fill="#0F766E"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
          <span>{tMinAxis}°C (Min: {profile.cardinals.min}°C)</span>
          <span className="text-teal-700 font-semibold">{temperature.toFixed(1)}°C Live Position</span>
          <span>{tMaxAxis}°C (Max: {profile.cardinals.max}°C)</span>
        </div>
      </div>

      {/* Quick Weather Presets */}
      <div>
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-2">
          Microclimate Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WEATHER_PRESETS.map((preset) => {
            const isSelected =
              Math.abs(temperature - preset.temperature) < 1 &&
              Math.abs(humidity - preset.humidity) < 2;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition-all duration-150 active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>{preset.icon}</span>
                  <span className="truncate">{preset.label}</span>
                </div>
                <div className="text-[10px] font-mono tabular-nums text-teal-700 font-medium mt-1">
                  {preset.temperature}°C • {preset.humidity}% RH
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid: Temperature & Relative Humidity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Temperature Slider */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🌡️</span>
              <span className="text-xs font-semibold text-slate-700">Ambient Temperature</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-xs font-bold text-teal-700">{temperature.toFixed(1)}°C</span>
              <span className="text-[10px] text-slate-400">
                (Opt: {profile.cardinals.opt}°C)
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={45}
            step={0.5}
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2 cursor-pointer"
            aria-label="Ambient Temperature (°C)"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0°C (Min: {profile.cardinals.min}°C)</span>
            <span className="text-teal-700 font-semibold">{profile.cardinals.opt}°C Peak</span>
            <span>45°C (Max: {profile.cardinals.max}°C)</span>
          </div>
        </div>

        {/* Relative Humidity Slider */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">💧</span>
              <span className="text-xs font-semibold text-slate-700">Relative Humidity (RH)</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-xs font-bold text-teal-700">{humidity.toFixed(0)}%</span>
              <span className="text-[10px] text-slate-400">
                (Crit: {profile.humidity.crit}%)
              </span>
            </div>
          </div>

          <input
            type="range"
            min={20}
            max={100}
            step={1}
            value={humidity}
            onChange={(e) => onHumidityChange(parseFloat(e.target.value))}
            className="w-full accent-teal-700 bg-slate-200 rounded-lg h-2 cursor-pointer"
            aria-label="Relative Humidity (%)"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>20% (Dry)</span>
            <span className="text-amber-600 font-medium">{profile.humidity.crit}% Critical Risk</span>
            <span>100% Saturated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
