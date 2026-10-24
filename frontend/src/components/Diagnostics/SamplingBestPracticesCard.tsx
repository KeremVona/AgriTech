import React from 'react';

export const SamplingBestPracticesCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-ag-surface border border-ag-border rounded-lg p-5 shadow-xs space-y-3.5 ${className}`}>
      <div className="flex items-center gap-2 pb-2 border-b border-ag-border">
        <span className="text-base">📋</span>
        <h4 className="text-sm font-semibold text-ag-ink">Field Sampling Best Practices</h4>
      </div>

      <ul className="space-y-2 text-xs text-ag-ink-secondary leading-relaxed">
        <li className="flex items-start gap-2">
          <span className="text-ag-brand font-bold shrink-0">1.</span>
          <span>
            <strong className="text-ag-ink font-semibold">Single Leaf Framing:</strong> Center a single representative leaf within the viewfinder reticle. Avoid capturing multiple overlapping leaves.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-ag-brand font-bold shrink-0">2.</span>
          <span>
            <strong className="text-ag-ink font-semibold">Lighting & Glare:</strong> Photograph under diffuse daylight. Avoid harsh noon reflections, heavy cast shadows, or flash highlights.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-ag-brand font-bold shrink-0">3.</span>
          <span>
            <strong className="text-ag-ink font-semibold">Active Lesions:</strong> Target foliage showing early chlorotic halos or developing necrotic spots rather than completely dead, dried tissue.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-ag-brand font-bold shrink-0">4.</span>
          <span>
            <strong className="text-ag-ink font-semibold">Focus & Distance:</strong> Hold camera parallel to the leaf surface at roughly 15–25cm to preserve venation and lesion margin resolution.
          </span>
        </li>
      </ul>

      <div className="p-2.5 rounded bg-ag-brand-subtle border border-emerald-200 text-[11px] text-teal-900 flex items-center gap-2">
        <span className="text-ag-brand font-bold">💡</span>
        <span>Resolution threshold: minimum <code className="font-mono font-semibold">224x224 px</code> required.</span>
      </div>
    </div>
  );
};
