import type { SeverityTier } from '../../types/diagnostics';
import { AlertCircleIcon, AlertIcon, CheckCircleIcon, OctagonIcon } from './icons.tsx';
import { SEVERITY } from './styles.ts';

const ICON = { 'Tier 0': CheckCircleIcon, 'Tier 1': AlertIcon, 'Tier 2': AlertCircleIcon, 'Tier 3': OctagonIcon } as const;

/** Severity as colour + icon + word, so it never relies on colour alone. */
export function SeverityPill({ tier, label }: { tier: SeverityTier; label?: string }) {
  const { word, tone } = SEVERITY[tier] ?? SEVERITY['Tier 3'];
  const TierIcon = ICON[tier] ?? OctagonIcon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium ${tone}`}>
      <TierIcon className="h-4 w-4" />
      {label ?? word}
    </span>
  );
}
