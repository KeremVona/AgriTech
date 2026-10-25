import React from 'react';

export interface CompareHealthyToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const CompareHealthyToggle: React.FC<CompareHealthyToggleProps> = ({
  enabled,
  onToggle,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span id="compare-toggle-label" className="text-xs font-semibold text-slate-700">
        Compare Healthy Baseline
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="compare-toggle-label"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
          enabled ? 'bg-teal-700' : 'bg-slate-200 hover:bg-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>

      <span className="text-[11px] font-mono text-slate-500">
        {enabled ? 'Side-by-Side (A/B)' : 'Single View'}
      </span>
    </div>
  );
};
