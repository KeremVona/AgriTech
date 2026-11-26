import React from 'react';

const BAR = 'rounded bg-ui-warm-strong animate-pulse';

/** Placeholder with the same shape as the result card, so nothing jumps when the result arrives. */
export const VerdictSkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="status" className={`rounded-2xl border border-ui-line bg-ui-bg ${className}`}>
    <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
      <div className="w-2/3 space-y-2.5">
        <div className={`h-3 w-16 ${BAR}`} />
        <div className={`h-7 w-3/4 ${BAR}`} />
        <div className={`h-3.5 w-1/2 ${BAR}`} />
        <div className={`mt-3 h-7 w-24 rounded-full ${BAR}`} />
      </div>
      <div className="h-[72px] w-[72px] animate-pulse rounded-full border-[6px] border-ui-warm-strong" />
    </div>
    <div className="px-5 sm:px-6">
      <div className="space-y-2 rounded-xl bg-ui-warm p-4">
        <div className={`h-3.5 w-24 ${BAR}`} />
        <div className={`h-3.5 w-full ${BAR}`} />
        <div className={`h-3.5 w-4/5 ${BAR}`} />
      </div>
    </div>
    <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      {[0, 1].map((column) => (
        <div key={column} className="space-y-2">
          <div className={`h-3 w-20 ${BAR}`} />
          <div className={`h-3 w-full ${BAR}`} />
          <div className={`h-3 w-2/3 ${BAR}`} />
        </div>
      ))}
    </div>
    <span className="sr-only">Reading the leaf…</span>
  </div>
);
