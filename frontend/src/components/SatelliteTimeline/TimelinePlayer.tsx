import { useEffect, useRef, useState } from 'react';
import type { NdviFrame } from '../../types/satellite.ts';
import { nearestFrame, toDayNumber } from '../../utils/satelliteTimeline.ts';

export interface TimelinePlayerProps {
  frames: NdviFrame[];
  day: number | null;
  onDayChange: (day: number) => void;
}

export function TimelinePlayer({
  frames,
  day,
  onDayChange,
}: TimelinePlayerProps): React.JSX.Element {
  const hasFrames = frames.length > 0;
  const minDay = hasFrames ? toDayNumber(frames[0].date) : 0;
  const maxDay = hasFrames ? toDayNumber(frames[frames.length - 1].date) : 0;
  const currentDay = day ?? maxDay;

  const [isPlaying, setIsPlaying] = useState(false);
  const dayRef = useRef<number | null>(day);
  const onDayChangeRef = useRef(onDayChange);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  useEffect(() => {
    onDayChangeRef.current = onDayChange;
  }, [onDayChange]);

  const togglePlay = () => {
    if (!hasFrames) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (dayRef.current === null || dayRef.current >= maxDay) {
        onDayChangeRef.current(minDay);
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!isPlaying || !hasFrames) return;
    const interval = setInterval(() => {
      const cur = dayRef.current ?? minDay;
      const next = cur + 1;
      if (next > maxDay) {
        setIsPlaying(false);
      } else {
        onDayChangeRef.current(next);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, hasFrames, minDay, maxDay]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasFrames || day === null) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevFrames = frames.filter((f) => toDayNumber(f.date) < day);
      if (prevFrames.length > 0) {
        const prev = prevFrames[prevFrames.length - 1];
        onDayChange(toDayNumber(prev.date));
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextFrames = frames.filter((f) => toDayNumber(f.date) > day);
      if (nextFrames.length > 0) {
        const next = nextFrames[0];
        onDayChange(toDayNumber(next.date));
      }
    }
  };

  const nearest = hasFrames && day !== null ? nearestFrame(frames, day) : null;
  const labelText = nearest
    ? `${nearest.date} · NDVI ${nearest.mean_ndvi.toFixed(2)} · ${Math.round(nearest.valid_fraction * 100)}% cloud-free`
    : '';

  return (
    <div
      className="flex flex-col gap-2 w-full select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Satellite timeline player"
    >
      <div className="flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasFrames}
            aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-ag-border bg-ag-surface hover:bg-ag-surface-muted text-ag-ink disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
          >
            {isPlaying ? (
              <span className="text-xs">⏸</span>
            ) : (
              <span className="text-xs ml-0.5">▶</span>
            )}
          </button>
          <span className="font-mono font-medium text-ag-ink text-xs">
            {labelText}
          </span>
        </div>
        {hasFrames && (
          <span className="text-[11px] text-ag-ink-tertiary">
            Use ← / → to jump frames
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 w-full">
        <input
          type="range"
          min={minDay}
          max={maxDay}
          step={1}
          value={currentDay}
          disabled={!hasFrames}
          onChange={(e) => onDayChange(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          aria-label="Timeline day slider"
          className="w-full h-2 bg-ag-border rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed accent-ag-brand"
        />
      </div>
    </div>
  );
}
