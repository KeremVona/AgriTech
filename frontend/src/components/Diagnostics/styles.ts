import type { SeverityTier } from '../../types/diagnostics';

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors duration-150 ' +
  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent';

export const BUTTON = {
  dark: `${BUTTON_BASE} bg-ui-ink text-white hover:bg-black`,
  light: `${BUTTON_BASE} bg-ui-warm text-ui-ink hover:bg-ui-warm-strong`,
  outline: `${BUTTON_BASE} border border-ui-line bg-ui-bg text-ui-ink hover:bg-ui-warm`,
} as const;

/** Plain-language severity words and colours (text colours darkened for 4.5:1 contrast). */
export const SEVERITY: Record<SeverityTier, { word: string; tone: string }> = {
  'Tier 0': { word: 'Healthy', tone: 'bg-ag-risk-healthy-bg border-ag-risk-healthy-border text-emerald-700' },
  'Tier 1': { word: 'Watch', tone: 'bg-ag-risk-low-bg border-ag-risk-low-border text-amber-700' },
  'Tier 2': { word: 'Act soon', tone: 'bg-ag-risk-moderate-bg border-ag-risk-moderate-border text-orange-700' },
  'Tier 3': { word: 'Urgent', tone: 'bg-ag-risk-critical-bg border-ag-risk-critical-border text-red-700' },
};

export function severityWord(tier: SeverityTier): string {
  return (SEVERITY[tier] ?? SEVERITY['Tier 3']).word;
}
