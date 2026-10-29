import type {
  NdviFrame,
  NdviJobAction,
  NdviJobPhaseStatus,
  NdviJobState,
} from '../types/satellite.ts';

const MS_PER_DAY = 86_400_000;

export const NDVI_COLOR_STOPS: ReadonlyArray<readonly [number, string]> = [
  [-0.2, '#8c510a'],
  [0.1, '#d8b365'],
  [0.3, '#f6e8c3'],
  [0.5, '#a6d96a'],
  [0.7, '#1a9641'],
  [0.9, '#00441b'],
] as const;

export function toDayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function frameBlendAt(
  frames: NdviFrame[],
  day: number
): { before: NdviFrame | null; after: NdviFrame | null; alpha: number } {
  if (frames.length === 0) {
    return { before: null, after: null, alpha: 0 };
  }
  if (frames.length === 1) {
    return { before: frames[0], after: null, alpha: 0 };
  }

  const firstDay = toDayNumber(frames[0].date);
  if (day <= firstDay) {
    return { before: frames[0], after: null, alpha: 0 };
  }

  const lastDay = toDayNumber(frames[frames.length - 1].date);
  if (day >= lastDay) {
    return { before: frames[frames.length - 1], after: null, alpha: 0 };
  }

  for (let i = 0; i < frames.length - 1; i++) {
    const cur = frames[i];
    const next = frames[i + 1];
    const curDay = toDayNumber(cur.date);
    const nextDay = toDayNumber(next.date);

    if (day === curDay) {
      return { before: cur, after: null, alpha: 0 };
    }
    if (day === nextDay) {
      return { before: next, after: null, alpha: 0 };
    }
    if (day > curDay && day < nextDay) {
      const alpha = (day - curDay) / (nextDay - curDay);
      return { before: cur, after: next, alpha };
    }
  }

  return { before: frames[frames.length - 1], after: null, alpha: 0 };
}

export function nearestFrame(frames: NdviFrame[], day: number): NdviFrame | null {
  if (frames.length === 0) {
    return null;
  }
  let best = frames[0];
  let bestDist = Math.abs(toDayNumber(best.date) - day);

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const dist = Math.abs(toDayNumber(frame.date) - day);
    if (dist < bestDist) {
      best = frame;
      bestDist = dist;
    }
  }

  return best;
}

export function chartScales(
  window: { start: string; end: string },
  width: number,
  height: number,
  padding: number
): {
  x: (day: number) => number;
  y: (ndvi: number) => number;
  dayAt: (px: number) => number;
} {
  const startDay = toDayNumber(window.start);
  const endDay = toDayNumber(window.end);
  const daySpan = endDay - startDay;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const yMin = -0.2;
  const yMax = 0.9;
  const ySpan = yMax - yMin;

  const x = (day: number): number => {
    if (daySpan <= 0) return padding;
    return padding + ((day - startDay) / daySpan) * innerWidth;
  };

  const y = (ndvi: number): number => {
    return padding + ((yMax - ndvi) / ySpan) * innerHeight;
  };

  const dayAt = (px: number): number => {
    if (innerWidth <= 0 || daySpan <= 0) return startDay;
    return Math.round(startDay + ((px - padding) / innerWidth) * daySpan);
  };

  return { x, y, dayAt };
}

function toPhase(status: NdviJobPhaseStatus): 'polling' | 'done' | 'failed' {
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  return 'polling';
}

export function ndviJobReducer(state: NdviJobState, action: NdviJobAction): NdviJobState {
  switch (action.type) {
    case 'select':
      return { phase: 'starting', parcelId: action.parcelId };

    case 'started': {
      if (!('parcelId' in state) || state.parcelId !== action.parcelId) {
        return state;
      }
      return {
        phase: toPhase(action.status.status),
        parcelId: action.parcelId,
        job: action.status,
      };
    }

    case 'polled': {
      if (!('job' in state)) {
        return state;
      }
      if (state.parcelId !== action.parcelId || state.job.job_id !== action.status.job_id) {
        return state;
      }
      return {
        phase: toPhase(action.status.status),
        parcelId: action.parcelId,
        job: action.status,
      };
    }

    case 'requestFailed': {
      if (!('parcelId' in state) || state.parcelId !== action.parcelId) {
        return state;
      }
      return {
        phase: 'error',
        parcelId: action.parcelId,
        kind: action.kind,
        message: action.message,
      };
    }

    case 'reset': {
      if (state.phase === 'idle') {
        return state;
      }
      return { phase: 'idle' };
    }

    default:
      return state;
  }
}
