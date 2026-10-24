import React, { useState } from 'react';
import type { DiagnosticPrediction, SeverityTier } from '../../types/diagnostics';

export interface DiagnosticVerdictCardProps {
  verdict: DiagnosticPrediction;
  onNewScan: () => void;
  onRetake: () => void;
  className?: string;
}

export const DiagnosticVerdictCard: React.FC<DiagnosticVerdictCardProps> = ({
  verdict,
  onNewScan,
  onRetake,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const confidencePct = (verdict.confidenceScore * 100).toFixed(1);
  const isRescan = Boolean(verdict.requiresRescan);

  const handleCopySummary = async () => {
    const summary = `Ag-Intelligence Diagnosis: ${verdict.crop} — ${verdict.condition} (${verdict.scientificName})
Confidence: ${confidencePct}% | Severity: ${verdict.severityTier} (${verdict.severityIndex})
Immediate Action: ${verdict.agronomicAdvisory.immediateAction}
Recommended Treatments: ${verdict.agronomicAdvisory.fungicideTreatments.join(', ') || 'None required'}
Environmental Risk: ${verdict.agronomicAdvisory.environmentalRiskFactors}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  /**
   * Dual-Coded Severity Badge helper adhering to SPEC-UI-006 & FOUNDATIONS.md §1.2
   * Contract: Color Fill/Stroke + Distinct Icon Glyph + Explicit Text Label
   */
  const renderSeverityBadge = (tier: SeverityTier) => {
    switch (tier) {
      case 'Tier 0':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ag-risk-healthy-bg border border-ag-risk-healthy-border text-ag-risk-healthy shadow-xs text-xs font-bold tracking-wide">
            {/* CheckCircle Glyph */}
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>TIER 0: HEALTHY / NORMAL</span>
          </div>
        );
      case 'Tier 1':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ag-risk-low-bg border border-ag-risk-low-border text-ag-risk-low shadow-xs text-xs font-bold tracking-wide">
            {/* AlertTriangle Glyph */}
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{isRescan ? 'TIER 1: RESCAN ADVISORY' : 'TIER 1: LOW / WATCH'}</span>
          </div>
        );
      case 'Tier 2':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ag-risk-moderate-bg border border-ag-risk-moderate-border text-ag-risk-moderate shadow-xs text-xs font-bold tracking-wide">
            {/* AlertCircle Glyph */}
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>TIER 2: MODERATE ALERT</span>
          </div>
        );
      case 'Tier 3':
      default:
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ag-risk-critical-bg border border-ag-risk-critical-border text-ag-risk-critical shadow-xs text-xs font-bold tracking-wide">
            {/* OctagonAlert Glyph */}
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M12 8v4m0 4h.01M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"
              />
            </svg>
            <span>TIER 3: CRITICAL OUTBREAK</span>
          </div>
        );
    }
  };

  return (
    <div
      className={`bg-ag-surface border border-ag-border rounded-xl p-6 sm:p-7 shadow-xs space-y-6 transition-all duration-200 ${className}`}
      style={{
        animation: 'hero-fade-up 0.25s var(--ag-ease-out) forwards',
      }}
    >
      {/* 1. Header Section: Crop, Condition, Binomial Name, Confidence and Latency */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-ag-border">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-ag-ink tracking-tight">
              {verdict.crop} — {verdict.condition}
            </h2>
          </div>
          <p className="text-sm italic text-ag-ink-secondary">{verdict.scientificName}</p>
        </div>

        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-ag-ink ag-tabular-numeric">
              {confidencePct}%
            </span>
          </div>
          <span className="text-xs font-mono text-ag-ink-secondary ag-tabular-numeric">
            LATENCY: {verdict.executionTimeMs} ms
          </span>
        </div>
      </div>

      {/* 2. Dual-Coded Agronomic Severity Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renderSeverityBadge(verdict.severityTier)}
        <span className="text-xs text-ag-ink-secondary font-mono">ID: {verdict.inferenceId.slice(0, 16)}</span>
      </div>

      {/* 3. Top-3 Class Probability Distribution Bars */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ag-ink-secondary uppercase tracking-wider">
            Top Classifications (CNN Output)
          </h3>
          <span className="text-[11px] text-ag-ink-tertiary">Softmax Probability</span>
        </div>

        <div className="space-y-3">
          {verdict.topProbabilities.slice(0, 3).map((prob) => {
            const pct = (prob.probability * 100).toFixed(1);
            return (
              <div key={prob.label} className="space-y-1">
                <div className="flex justify-between text-xs ag-tabular-numeric">
                  <span className="font-medium text-ag-ink truncate mr-2">
                    {prob.displayName || prob.label}
                  </span>
                  <span className="font-mono font-semibold text-ag-ink-secondary shrink-0">{pct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ag-brand rounded-full transition-all duration-400 ease-out"
                    style={{ width: `${Math.max(2, Number(pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Rescan / Low-Confidence Advisory Box (If applicable) */}
      {isRescan && verdict.rescanInstructions && verdict.rescanInstructions.length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 space-y-2 text-xs"
        >
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <span aria-hidden="true">⚠️</span>
            <span>Low-Confidence Re-sampling Protocol Recommended</span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            {verdict.agronomicAdvisory.immediateAction}
          </p>
          <ul className="list-disc pl-5 space-y-1 text-amber-900 font-medium">
            {verdict.rescanInstructions.map((instruction, idx) => (
              <li key={idx}>{instruction}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Immediate Agronomic Action Banner */}
      {!isRescan && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1.5">
          <p className="font-bold text-amber-950 flex items-center gap-1.5">
            <span aria-hidden="true">🚨</span>
            <span>IMMEDIATE CROP ACTION:</span>
          </p>
          <p className="text-amber-900 leading-relaxed">{verdict.agronomicAdvisory.immediateAction}</p>
        </div>
      )}

      {/* 6. Recommended Treatments & Environmental Factors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Fungicide Interventions */}
        <div className="p-3.5 rounded-lg bg-ag-surface-muted border border-ag-border space-y-2">
          <h4 className="text-xs font-semibold text-ag-ink uppercase tracking-wider flex items-center gap-1.5">
            <span aria-hidden="true">🧪</span>
            <span>Recommended Treatments</span>
          </h4>
          {verdict.agronomicAdvisory.fungicideTreatments.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-ag-ink-secondary">
              {verdict.agronomicAdvisory.fungicideTreatments.map((treatment, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-ag-brand font-bold">•</span>
                  <span>{treatment}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ag-ink-tertiary italic">No chemical interventions indicated.</p>
          )}
        </div>

        {/* Environmental Risk Factors */}
        <div className="p-3.5 rounded-lg bg-ag-surface-muted border border-ag-border space-y-2">
          <h4 className="text-xs font-semibold text-ag-ink uppercase tracking-wider flex items-center gap-1.5">
            <span aria-hidden="true">🌤️</span>
            <span>Microclimate Risk</span>
          </h4>
          <p className="text-xs text-ag-ink-secondary leading-relaxed">
            {verdict.agronomicAdvisory.environmentalRiskFactors}
          </p>
        </div>
      </div>

      {/* 7. Action Button Toolbar (48px Touch Targets) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-ag-border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <button
            type="button"
            onClick={onRetake}
            className="min-h-[48px] px-4 py-2.5 rounded-lg bg-ag-brand hover:bg-ag-brand-hover text-white text-xs font-semibold ag-interactive cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            <span>Scan Another Leaf</span>
          </button>

          <button
            type="button"
            onClick={onNewScan}
            className="min-h-[48px] px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-ag-ink text-xs font-semibold ag-interactive cursor-pointer shadow-xs flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload New Photo</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopySummary}
          className="min-h-[48px] px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-ag-ink text-xs font-medium ag-interactive cursor-pointer shadow-xs flex items-center justify-center gap-2"
        >
          <span>{copied ? '✓ Copied' : '📋 Copy Summary'}</span>
        </button>
      </div>
    </div>
  );
};
