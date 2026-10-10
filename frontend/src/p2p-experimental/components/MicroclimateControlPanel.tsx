import React from 'react';
import type { SupportedCropId, MicroclimateDiagnostics, WeatherPreset } from '../models/agronomicTimelineModel';
import { AGRONOMIC_CALIBRATION_REGISTRY, WEATHER_PRESETS } from '../models/agronomicTimelineModel';

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
  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId];

  const getStatusBadgeStyle = () => {
    if (diagnostics.isStalled) {
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    }
    if (diagnostics.compositeFactor >= 0.8) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    if (diagnostics.compositeFactor >= 0.4) {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
  };

  const handleApplyPreset = (preset: WeatherPreset) => {
    onTemperatureChange(preset.temperature);
    onHumidityChange(preset.humidity);
  };

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 sm:space-y-5 transition-all ${className}`}
    >
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm shadow-inner">
            🌡️
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Microclimate Modifiers
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700/60">
                Magarey Beta
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulate ambient weather to dynamically accelerate or arrest pathogen development.
            </p>
          </div>
        </div>

        {/* Live Multiplier Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-2 shadow-sm ${getStatusBadgeStyle()}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                diagnostics.isStalled ? 'bg-rose-500' : 'bg-current animate-pulse'
              }`}
            />
            <span>{diagnostics.statusLabel}</span>
            <span className="font-mono tabular-nums opacity-80">
              ({diagnostics.compositeFactor.toFixed(2)}× speed)
            </span>
          </div>
        </div>
      </div>

      {/* Agronomic Warning / Alert Banner */}
      {diagnostics.agronomicAlert && (
        <div
          className={`px-3.5 py-2 rounded-xl text-xs flex items-start gap-2.5 border transition-all ${
            diagnostics.isStalled
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
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

      {/* Quick Weather Presets */}
      <div>
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">
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
                className={`p-2.5 rounded-xl border text-left transition-all duration-150 ease-out cursor-pointer active:scale-[0.97] ${
                  isSelected
                    ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                  <span>{preset.icon}</span>
                  <span className="truncate">{preset.label}</span>
                </div>
                <div className="text-[10px] font-mono tabular-nums text-emerald-400/90 mt-1">
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
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🌡️</span>
              <span className="text-xs font-semibold text-slate-200">Ambient Temperature</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-xs font-bold text-emerald-400">{temperature.toFixed(1)}°C</span>
              <span className="text-[10px] text-slate-500">
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
            className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2 cursor-pointer transition-all"
            aria-label="Ambient Temperature (°C)"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0°C (Min: {profile.cardinals.min}°C)</span>
            <span className="text-emerald-500 font-semibold">{profile.cardinals.opt}°C Optimal</span>
            <span>45°C (Max: {profile.cardinals.max}°C)</span>
          </div>
        </div>

        {/* Relative Humidity Slider */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">💧</span>
              <span className="text-xs font-semibold text-slate-200">Relative Humidity (RH)</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-xs font-bold text-emerald-400">{humidity.toFixed(0)}%</span>
              <span className="text-[10px] text-slate-500">
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
            className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2 cursor-pointer transition-all"
            aria-label="Relative Humidity (%)"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>20% (Dry)</span>
            <span className="text-amber-400">{profile.humidity.crit}% Critical Risk</span>
            <span>100% Saturation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
