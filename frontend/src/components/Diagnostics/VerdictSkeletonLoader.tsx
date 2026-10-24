import React from 'react';

export const VerdictSkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-ag-surface border border-ag-border rounded-xl p-6 sm:p-7 shadow-xs space-y-6 ${className}`}
      role="status"
      aria-label="Loading diagnostic classification"
    >
      {/* 1. Header Skeleton with Responsive Mobile Readout Alignment */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-ag-border">
        <div className="space-y-2.5 w-full sm:w-2/3">
          <div className="h-7 w-3/4 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <div className="h-8 w-24 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* 2. Severity Badge & ID Row Skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-48 bg-slate-100 rounded-full animate-pulse" />
        <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* 3. Probability Bars Skeleton (Height 6px per SPEC-UI-006 §3.3) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-48 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-200/80 rounded-full animate-pulse"
                  style={{ width: idx === 1 ? '75%' : idx === 2 ? '18%' : '7%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action Banner Skeleton */}
      <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200/60 space-y-2">
        <div className="h-4 w-44 bg-amber-200/60 rounded animate-pulse" />
        <div className="h-3.5 w-full bg-amber-100/80 rounded animate-pulse" />
        <div className="h-3.5 w-4/5 bg-amber-100/80 rounded animate-pulse" />
      </div>

      {/* 5. Treatments & Microclimate 2-Column Boxed Skeleton Grid (Eliminates CLS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="p-3.5 rounded-lg bg-ag-surface-muted border border-ag-border space-y-2.5">
          <div className="h-4 w-36 bg-slate-200/80 rounded animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-4/5 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-3/5 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-ag-surface-muted border border-ag-border space-y-2.5">
          <div className="h-4 w-32 bg-slate-200/80 rounded animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* 6. Action Button Toolbar Skeleton (48px Touch Targets) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-ag-border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="min-h-[48px] w-full sm:w-40 bg-slate-200/80 rounded-lg animate-pulse" />
          <div className="min-h-[48px] w-full sm:w-40 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="min-h-[48px] w-full sm:w-32 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      <span className="sr-only">Analyzing foliar cellular pathology...</span>
    </div>
  );
};
