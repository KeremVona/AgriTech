import React from 'react';

export const VerdictSkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-ag-surface border border-ag-border rounded-xl p-6 sm:p-7 shadow-xs space-y-6 ${className}`}
      role="status"
      aria-label="Loading diagnostic classification"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-ag-border">
        <div className="space-y-2.5 w-full sm:w-2/3">
          <div className="h-6 w-3/4 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex flex-col sm:items-end gap-1.5 w-28">
          <div className="h-7 w-20 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Severity Badge Skeleton */}
      <div className="h-7 w-44 bg-slate-100 rounded-full animate-pulse" />

      {/* Probability Bars Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-3.5 w-36 bg-slate-200/80 rounded animate-pulse" />
        <div className="space-y-2.5">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-200/80 rounded-full animate-pulse"
                  style={{ width: idx === 1 ? '75%' : idx === 2 ? '18%' : '7%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Banner Skeleton */}
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
        <div className="h-4 w-40 bg-slate-200/80 rounded animate-pulse" />
        <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
        <div className="h-3.5 w-4/5 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Treatments Skeleton */}
      <div className="space-y-2 pt-1">
        <div className="h-4 w-48 bg-slate-200/80 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
      </div>

      <span className="sr-only">Analyzing foliar pathology...</span>
    </div>
  );
};
