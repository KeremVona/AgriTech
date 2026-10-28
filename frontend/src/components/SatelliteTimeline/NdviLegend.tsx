import { NDVI_COLOR_STOPS } from '../../utils/satelliteTimeline.ts';

export function NdviLegend(): React.JSX.Element {
  const minVal = -0.2;
  const maxVal = 0.9;
  const span = maxVal - minVal;

  const gradientStops = NDVI_COLOR_STOPS.map(([val, hex]) => {
    const pct = (((val - minVal) / span) * 100).toFixed(1);
    return `${hex} ${pct}%`;
  }).join(', ');

  return (
    <div className="flex flex-col gap-1 w-full max-w-xs" aria-label="NDVI color scale">
      <div className="text-[11px] font-medium text-ag-ink-secondary">NDVI Scale</div>
      <div
        className="h-2.5 w-full rounded border border-ag-border"
        style={{ background: `linear-gradient(to right, ${gradientStops})` }}
      />
      <div className="flex justify-between text-[10px] font-mono text-ag-ink-tertiary">
        <span>-0.2</span>
        <span>0.3</span>
        <span>0.9</span>
      </div>
    </div>
  );
}
