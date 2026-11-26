import React, { useEffect, useRef, useState } from 'react';
import type { AdvisorySource, DiagnosticPrediction } from '../../types/diagnostics';
import { formatConfidence, LOW_CONFIDENCE_THRESHOLD } from '../../services/diagnosticsService';
import { AlertIcon, CameraIcon, CheckCircleIcon, ClipboardCheckIcon, CopyIcon } from './icons.tsx';
import { SeverityPill } from './SeverityPill.tsx';
import { BUTTON, severityWord } from './styles.ts';

export interface DiagnosticVerdictCardProps {
  verdict: DiagnosticPrediction;
  onNewScan: () => void;
  onRetake: () => void;
  className?: string;
}

const SOURCE_LABEL: Record<AdvisorySource, string> = {
  database_cache: 'Advice: AI (saved)',
  llm_generated: 'Advice: AI (Gemini)',
  knowledge_base: 'Advice: built-in knowledge base',
  sample: 'Sample result',
};

/** Confidence as a ring: the number is the headline, the ring is the picture. */
function ConfidenceRing({ score, low }: { score: number; low: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const value = Math.min(1, Math.max(0, score));
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-ui-warm-strong)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={low ? 'var(--color-ag-risk-low)' : 'var(--color-ui-accent)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-ui-ink">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export const DiagnosticVerdictCard: React.FC<DiagnosticVerdictCardProps> = ({ verdict, onNewScan, onRetake, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const advisory = verdict.agronomicAdvisory;
  const confidencePct = formatConfidence(verdict.confidenceScore);
  const isRescan = Boolean(verdict.requiresRescan);
  const treatments = advisory?.fungicideTreatments ?? [];
  const matches = (verdict.topProbabilities || []).slice(0, 3);

  const handleCopySummary = async () => {
    const sciSuffix = verdict.scientificName ? ` (${verdict.scientificName})` : '';
    const summary = `AgriTech diagnosis: ${verdict.crop} — ${verdict.condition}${sciSuffix}
Confidence: ${confidencePct} | Severity: ${severityWord(verdict.severityTier)} (${verdict.severityTier}, ${verdict.severityIndex})
Do today: ${advisory?.immediateAction || 'Inspect field foliage.'}
Treatments: ${treatments.join(', ') || 'None required'}
Risk factors: ${advisory?.environmentalRiskFactors || 'Standard conditions.'}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); the button simply does nothing.
    }
  };

  return (
    <article aria-labelledby="verdict-title" className={`animate-verdict-entrance rounded-2xl border border-ui-line bg-ui-bg ${className}`}>
      {/* 1. What it is, how bad, how sure */}
      <header className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ui-ink-3">{verdict.crop}</p>
          <h2 id="verdict-title" className="mt-0.5 text-2xl font-medium leading-tight tracking-[-0.01em] text-ui-ink sm:text-[28px]">
            {isRescan ? 'Not sure yet' : verdict.condition}
          </h2>
          {isRescan && <p className="mt-1 text-sm text-ui-ink-2">Possibly {verdict.condition.toLowerCase()}</p>}
          {verdict.scientificName && !isRescan && <p className="mt-1 text-sm italic text-ui-ink-3">{verdict.scientificName}</p>}
          <div className="mt-3">
            <SeverityPill tier={isRescan ? 'Tier 1' : verdict.severityTier} label={isRescan ? 'Retake photo' : undefined} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ConfidenceRing score={verdict.confidenceScore} low={isRescan} />
          <span className="text-xs text-ui-ink-3">confidence</span>
        </div>
      </header>

      {/* 2. Do today / retake */}
      <div className="px-5 sm:px-6">
        {isRescan ? (
          <div role="alert" className="rounded-xl border border-ag-risk-low-border bg-ag-risk-low-bg p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertIcon className="h-[18px] w-[18px]" />
              Retake the photo
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-900">
              {advisory?.immediateAction || `The model is less than ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}% sure about this leaf.`}
            </p>
            {verdict.rescanInstructions && verdict.rescanInstructions.length > 0 && (
              <ul role="list" className="mt-2 space-y-1 text-sm text-amber-900">
                {verdict.rescanInstructions.map((instruction) => (
                  <li key={instruction} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    {instruction}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-ui-accent-line bg-ui-accent-soft p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ui-accent-hover">
              <ClipboardCheckIcon className="h-[18px] w-[18px]" />
              Do today
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ui-ink">{advisory?.immediateAction || 'Inspect the field for the same symptoms.'}</p>
          </div>
        )}
      </div>

      {/* 3. Treatments + risk factors */}
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <section aria-labelledby="treatments-title">
          <h3 id="treatments-title" className="text-[13px] font-medium text-ui-ink-3">
            Treatments
          </h3>
          {treatments.length > 0 ? (
            <ul role="list" className="mt-2 space-y-2 text-sm leading-snug text-ui-ink-2">
              {treatments.map((treatment) => (
                <li key={treatment} className="flex gap-2">
                  <CheckCircleIcon className="mt-px h-4 w-4 shrink-0 text-ui-accent" />
                  {treatment}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ui-ink-3">No treatment listed.</p>
          )}
        </section>
        <section aria-labelledby="risk-title">
          <h3 id="risk-title" className="text-[13px] font-medium text-ui-ink-3">
            Risk factors
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ui-ink-2">{advisory?.environmentalRiskFactors || 'Normal growing conditions.'}</p>
        </section>
      </div>

      {/* 4. Other matches the model considered */}
      {matches.length > 0 && (
        <section aria-labelledby="matches-title" className="border-t border-ui-line p-5 sm:p-6">
          <h3 id="matches-title" className="text-[13px] font-medium text-ui-ink-3">
            Closest matches
          </h3>
          <ul role="list" className="mt-3 space-y-2.5">
            {matches.map((match, index) => {
              const pct = match.probability * 100;
              const name = match.displayName || match.label;
              return (
                <li key={match.label}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className={`truncate ${index === 0 ? 'font-medium text-ui-ink' : 'text-ui-ink-2'}`}>{name}</span>
                    <span className="shrink-0 tabular-nums text-ui-ink-3">{pct.toFixed(1)}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-ui-warm-strong"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${name} probability`}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${index === 0 ? 'bg-ui-accent' : 'bg-ui-ink-3/50'}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 5. Actions */}
      <footer className="flex flex-col gap-3 border-t border-ui-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-xs text-ui-ink-3" title={advisory?.llmModel ? `Model: ${advisory.llmModel}` : undefined}>
          {advisory?.source ? SOURCE_LABEL[advisory.source] : 'Advice: built-in knowledge base'}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={handleCopySummary} className={BUTTON.outline}>
            <CopyIcon className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <span role="status" className="sr-only">{copied ? 'Summary copied' : ''}</span>
          <button type="button" onClick={isRescan ? onRetake : onNewScan} className={BUTTON.dark}>
            <CameraIcon className="h-[18px] w-[18px]" />
            {isRescan ? 'Retake photo' : 'Scan another leaf'}
          </button>
        </div>
      </footer>
    </article>
  );
};
