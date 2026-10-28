import type { NdviJobStatus } from '../../types/satellite.ts';
import { chartScales, toDayNumber } from '../../utils/satelliteTimeline.ts';

export interface NdviChartProps {
  job: NdviJobStatus;
  day: number | null;
  onDayChange: (day: number) => void;
}

export function NdviChart({
  job,
  day,
  onDayChange,
}: NdviChartProps): React.JSX.Element {
  const width = 640;
  const height = 150;
  const padding = 28;

  const scales = chartScales(job.window, width, height, padding);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const svgX = (clickX / rect.width) * width;
    const clickedDay = scales.dayAt(svgX);
    const startDay = toDayNumber(job.window.start);
    const endDay = toDayNumber(job.window.end);
    const clampedDay = Math.max(startDay, Math.min(endDay, clickedDay));
    onDayChange(clampedDay);
  };

  const polylinePoints = job.frames
    .map(
      (f) =>
        `${scales.x(toDayNumber(f.date)).toFixed(1)},${scales.y(f.mean_ndvi).toFixed(1)}`
    )
    .join(' ');

  const cursorX = day !== null ? scales.x(day) : null;
  const chartLabel = `NDVI over time from ${job.window.start} to ${job.window.end}`;

  return (
    <div className="w-full flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={chartLabel}
        onClick={handleClick}
        className="w-full h-auto cursor-pointer select-none bg-ag-surface rounded-lg border border-ag-border"
      >
        {/* Horizontal grid lines & labels */}
        {[-0.2, 0.3, 0.9].map((val) => {
          const yPos = scales.y(val);
          return (
            <g key={val}>
              <line
                x1={padding}
                y1={yPos}
                x2={width - padding}
                y2={yPos}
                stroke="#e2e8f0"
                strokeDasharray={val === 0.3 ? '3 3' : undefined}
                strokeWidth={1}
              />
              <text
                x={padding - 6}
                y={yPos + 3}
                textAnchor="end"
                fontSize={9}
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis base line */}
        <line
          x1={padding}
          y1={scales.y(-0.2)}
          x2={width - padding}
          y2={scales.y(-0.2)}
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        {/* Skipped dates ticks on X-axis */}
        {job.skipped.map((s) => {
          const xPos = scales.x(toDayNumber(s.date));
          const yBase = scales.y(-0.2);
          return (
            <line
              key={s.date}
              x1={xPos}
              y1={yBase - 3}
              x2={xPos}
              y2={yBase + 3}
              stroke="#94a3b8"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Line through mean_ndvi */}
        {job.frames.length >= 2 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Frame dots */}
        {job.frames.map((f) => {
          const cx = scales.x(toDayNumber(f.date));
          const cy = scales.y(f.mean_ndvi);
          return (
            <circle
              key={f.date}
              cx={cx}
              cy={cy}
              r={3}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Vertical cursor line */}
        {cursorX !== null && (
          <line
            x1={cursorX}
            y1={padding}
            x2={cursorX}
            y2={scales.y(-0.2)}
            stroke="#0284c7"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
      </svg>

      {/* Visually hidden table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>NDVI satellite passes and cloud-skipped dates</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Mean NDVI</th>
              <th scope="col">Cloud-free</th>
            </tr>
          </thead>
          <tbody>
            {job.frames.map((frame) => (
              <tr key={frame.date}>
                <td>{frame.date}</td>
                <td>{frame.mean_ndvi.toFixed(2)}</td>
                <td>{Math.round(frame.valid_fraction * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
