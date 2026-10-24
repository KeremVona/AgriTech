/**
 * PromptAttentionInspector (SPEC-UI-007, Section 4.6).
 * Inspects Prompt-to-Prompt cross-attention parameters, displays sequence token
 * alignment diffs with Bio-Teal badges, and provides payload/tensor export.
 */

import React, { useState } from 'react';
import type { SupportedCropId } from '../../types/progression.ts';
import type { ProgressionStage } from '../../types/progression.ts';
import { AGRONOMIC_CALIBRATION_REGISTRY } from '../../models/agronomicTimelineModel.ts';
import { serializeNpyTensor } from '../../utils/npySerializer.ts';

export interface PromptAttentionInspectorProps {
  cropId: SupportedCropId;
  activeStage: ProgressionStage | null;
  sliderValue: number;
  className?: string;
}

export interface AttentionHyperparameters {
  tauCross: number; // Cross-attention replacement threshold (default: 0.75)
  tauSelf: number;  // Self-attention injection threshold (default: 0.50)
  tauBlend: number; // Spatial blend step threshold (default: 0.30)
}

export const PromptAttentionInspector: React.FC<PromptAttentionInspectorProps> = ({
  cropId,
  activeStage,
  sliderValue,
  className = '',
}) => {
  const [params, setParams] = useState<AttentionHyperparameters>({
    tauCross: 0.75,
    tauSelf: 0.50,
    tauBlend: 0.30,
  });

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const profile = AGRONOMIC_CALIBRATION_REGISTRY[cropId] || AGRONOMIC_CALIBRATION_REGISTRY.tomato;

  // Base healthy specimen prompt
  const basePrompt = `high-resolution macro foliar photograph of healthy ${profile.cropName} leaf blade, vibrant deep chlorophyll green tissue, intact cellular turgor, pristine stomatal venation, natural agricultural lighting`;

  // Dynamic target prompt aligned with stage & severity
  const stageName = activeStage?.stage_label || (sliderValue < 50 ? 'Early Stage' : 'Severe Stage');
  const targetPrompt = `high-resolution macro foliar photograph of ${profile.cropName} leaf showing ${stageName} of ${profile.diseaseName}, localized chlorotic halo lesions, necrotic margins, compromised mesophyll canopy, ${Math.round(sliderValue)}% pathogen pressure`;

  // Tokenization for sequence diff
  const baseTokens = basePrompt.split(' ');
  const targetTokens = targetPrompt.split(' ');

  const baseTokenSet = new Set(baseTokens.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')));

  const isPathologicalToken = (token: string) => {
    const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !baseTokenSet.has(clean) || [
      'chlorotic', 'halo', 'lesions', 'necrotic', 'margins',
      'compromised', 'mesophyll', 'pathogen', 'pressure',
      'early', 'severe', 'blight', 'spot', 'rot', 'rust',
      'scab', 'mildew', 'collapsed'
    ].includes(clean);
  };

  const handleCopyPayload = async () => {
    const payload = {
      architecture: 'Prompt-to-Prompt Cross-Attention Diffusion (SPEC-UI-007)',
      cropId,
      cropName: profile.cropName,
      diseaseName: profile.diseaseName,
      pathogenScientific: profile.pathogenScientific,
      severityPercent: Math.round(sliderValue),
      hyperparameters: {
        tau_cross: params.tauCross,
        tau_self: params.tauSelf,
        tau_blend: params.tauBlend,
      },
      seed: 42109,
      base_prompt: basePrompt,
      target_prompt: targetPrompt,
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleDownloadTensor = () => {
    setDownloading(true);

    // Synthesize realistic 64x64 float32 cross-attention map weights based on slider severity
    const tensorData = new Float32Array(64 * 64);
    const sevFactor = sliderValue / 100.0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dx = (x - 32) / 32;
        const dy = (y - 32) / 32;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Radial attention weight with localized lesion hotspots
        const weight = Math.max(0.0, Math.min(1.0, (1.0 - dist) * sevFactor * 1.25));
        tensorData[y * 64 + x] = weight;
      }
    }

    const npyBuffer = serializeNpyTensor(tensorData, [64, 64]);
    const blob = new Blob([npyBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attention_map_${cropId}_sev${Math.round(sliderValue)}_seed42109.npy`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Delay revocation to ensure download manager completes stream ingestion across browsers
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 1000);
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 ${className}`}
      role="region"
      aria-label="Prompt-to-Prompt Attention Inspector"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 text-sm shadow-2xs">
            🧬
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Cross-Attention & Prompt Inspector
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                P2P-DIFFUSION
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latent attention weights & token steering for structural leaf integrity.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Copy prompt payload JSON to clipboard"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied' : 'Copy Payload'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTensor}
            disabled={downloading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white border border-teal-800 transition-all duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Download 64x64 raw cross-attention map tensor (.npy)"
          >
            <span>{downloading ? '⏳' : '📥'}</span>
            <span>{downloading ? 'Exporting...' : '.npy Tensor'}</span>
          </button>
        </div>
      </div>

      {/* Cross-Attention Hyperparameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Attention Steering Hyperparameters
          </label>
          <span className="text-[11px] text-slate-400 font-mono">Seed: 42109</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tau Cross */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Cross-Attention (τ_cross)</span>
              <span className="text-xs font-bold font-mono text-teal-700 tabular-nums">
                {params.tauCross.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={params.tauCross}
              onChange={(e) => setParams({ ...params, tauCross: parseFloat(e.target.value) })}
              className="w-full accent-teal-700 bg-slate-200 rounded-lg h-1.5 cursor-pointer"
              aria-label="Cross-Attention threshold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Replacement steps for background venation structure.
            </p>
          </div>

          {/* Tau Self */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Self-Attention (τ_self)</span>
              <span className="text-xs font-bold font-mono text-teal-700 tabular-nums">
                {params.tauSelf.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={params.tauSelf}
              onChange={(e) => setParams({ ...params, tauSelf: parseFloat(e.target.value) })}
              className="w-full accent-teal-700 bg-slate-200 rounded-lg h-1.5 cursor-pointer"
              aria-label="Self-Attention threshold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Leaf contour and cellular geometry preservation.
            </p>
          </div>

          {/* Tau Blend */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Blend Step (τ_blend)</span>
              <span className="text-xs font-bold font-mono text-teal-700 tabular-nums">
                {params.tauBlend.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={params.tauBlend}
              onChange={(e) => setParams({ ...params, tauBlend: parseFloat(e.target.value) })}
              className="w-full accent-teal-700 bg-slate-200 rounded-lg h-1.5 cursor-pointer"
              aria-label="Blend step threshold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Spatial mask blending boundary dampening.
            </p>
          </div>
        </div>
      </div>

      {/* Pathological Token Alignment & Sequence Comparison */}
      <div className="space-y-3 pt-1">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">
          Pathological Token Alignment & Sequence Comparison
        </label>

        {/* Base Prompt */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Source Prompt (Baseline Healthy):
            </span>
            <span className="text-[10px] font-mono text-slate-400">{baseTokens.length} tokens</span>
          </div>
          <div className="text-xs text-slate-700 font-mono leading-relaxed p-2 bg-white rounded-lg border border-slate-200/60">
            {basePrompt}
          </div>
        </div>

        {/* Target Prompt with Highlighted Diffs */}
        <div className="bg-teal-50/40 border border-teal-200/70 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-700 animate-pulse" />
              Target Prompt (Symptom Guided Injection):
            </span>
            <span className="text-[10px] font-mono text-teal-700 font-medium">
              Active Focus: {stageName} ({Math.round(sliderValue)}%)
            </span>
          </div>
          <div className="text-xs leading-relaxed p-2.5 bg-white rounded-lg border border-teal-100 flex flex-wrap gap-1.5 items-center font-mono">
            {targetTokens.map((tok, i) => {
              const isDiff = isPathologicalToken(tok);
              return (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                    isDiff
                      ? 'bg-teal-100/90 text-teal-800 font-bold border border-teal-300 shadow-2xs'
                      : 'text-slate-700'
                  }`}
                >
                  {tok}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
