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
    <div className={`flex items-center gap-2.5 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="compare-toggle-label"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent ${
          enabled ? 'bg-ui-accent' : 'bg-ui-warm-strong hover:bg-[#E2DFDB]'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span id="compare-toggle-label" className="text-sm text-ui-ink-2">
        Compare with healthy
      </span>
    </div>
  );
};
