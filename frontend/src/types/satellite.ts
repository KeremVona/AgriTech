export type NdviJobPhaseStatus = 'queued' | 'running' | 'done' | 'failed';

export type SatelliteErrorKind = 'offline' | 'invalid' | 'other';

export interface NdviFrame {
  date: string;
  scene_id: string;
  mean_ndvi: number;
  valid_fraction: number;
  png_url: string;
}

export interface NdviSkipped {
  date: string;
  scene_id: string;
  reason: 'cloudy' | 'no_data' | 'read_error';
  valid_fraction: number | null;
}

export interface NdviJobStatus {
  job_id: string;
  parcel_id: string | null;
  status: NdviJobPhaseStatus;
  window: { start: string; end: string };
  bounds: [[number, number], [number, number]];
  progress: { processed: number; total: number | null };
  frames: NdviFrame[];
  skipped: NdviSkipped[];
  error: string | null;
}

export type NdviJobState =
  | { phase: 'idle' }
  | { phase: 'starting'; parcelId: string }
  | { phase: 'polling' | 'done' | 'failed'; parcelId: string; job: NdviJobStatus }
  | { phase: 'error'; parcelId: string; kind: SatelliteErrorKind; message: string };

export type NdviJobAction =
  | { type: 'select'; parcelId: string }
  | { type: 'started'; parcelId: string; status: NdviJobStatus }
  | { type: 'polled'; parcelId: string; status: NdviJobStatus }
  | { type: 'requestFailed'; parcelId: string; kind: SatelliteErrorKind; message: string }
  | { type: 'reset' };
