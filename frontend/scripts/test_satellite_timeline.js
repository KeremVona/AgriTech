import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
  NDVI_COLOR_STOPS,
  toDayNumber,
  fromDayNumber,
  frameBlendAt,
  nearestFrame,
  chartScales,
  ndviJobReducer,
} from '../src/utils/satelliteTimeline.ts';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/ndvi_job_done.json', import.meta.url), 'utf8')
);

test('day numbers round-trip across DST dates', () => {
  // '2026-03-29','2026-10-25','2024-02-29' → fromDayNumber(toDayNumber(d)) === d; consecutive dates differ by exactly 1
  const dates = ['2026-03-29', '2026-10-25', '2024-02-29'];
  for (const d of dates) {
    assert.equal(fromDayNumber(toDayNumber(d)), d);
  }

  assert.equal(toDayNumber('2026-03-30') - toDayNumber('2026-03-29'), 1);
  assert.equal(toDayNumber('2026-10-26') - toDayNumber('2026-10-25'), 1);
  assert.equal(toDayNumber('2024-03-01') - toDayNumber('2024-02-29'), 1);
});

test('frameBlendAt with no frames', () => {
  const result = frameBlendAt([], 20500);
  assert.deepEqual(result, { before: null, after: null, alpha: 0 });
});

test('frameBlendAt with one frame clamps everywhere', () => {
  const frame = fixture.frames[0];
  for (const day of [toDayNumber('2020-01-01'), toDayNumber(frame.date), toDayNumber('2030-01-01')]) {
    assert.deepEqual(frameBlendAt([frame], day), { before: frame, after: null, alpha: 0 });
  }
});

test('frameBlendAt exact frame day', () => {
  const f1 = fixture.frames[0];
  const f2 = fixture.frames[1];
  assert.deepEqual(frameBlendAt([f1, f2], toDayNumber(f1.date)), { before: f1, after: null, alpha: 0 });
  assert.deepEqual(frameBlendAt([f1, f2], toDayNumber(f2.date)), { before: f2, after: null, alpha: 0 });
});

test('frameBlendAt between frames', () => {
  const d0 = toDayNumber('2026-05-10');
  const f1 = {
    date: fromDayNumber(d0),
    scene_id: 's1',
    mean_ndvi: 0.5,
    valid_fraction: 0.9,
    png_url: '/p1.png',
  };
  const f2 = {
    date: fromDayNumber(d0 + 10),
    scene_id: 's2',
    mean_ndvi: 0.7,
    valid_fraction: 0.9,
    png_url: '/p2.png',
  };

  const blend = frameBlendAt([f1, f2], d0 + 4);
  assert.equal(blend.before, f1);
  assert.equal(blend.after, f2);
  assert.equal(Math.round(blend.alpha * 100) / 100, 0.4);
});

test('frameBlendAt outside range clamps', () => {
  const d0 = toDayNumber('2026-05-10');
  const f1 = {
    date: fromDayNumber(d0),
    scene_id: 's1',
    mean_ndvi: 0.5,
    valid_fraction: 0.9,
    png_url: '/p1.png',
  };
  const f2 = {
    date: fromDayNumber(d0 + 10),
    scene_id: 's2',
    mean_ndvi: 0.7,
    valid_fraction: 0.9,
    png_url: '/p2.png',
  };

  assert.deepEqual(frameBlendAt([f1, f2], d0 - 5), { before: f1, after: null, alpha: 0 });
  assert.deepEqual(frameBlendAt([f1, f2], d0 + 15), { before: f2, after: null, alpha: 0 });
});

test('nearestFrame picks closest, ties to earlier', () => {
  assert.equal(nearestFrame([], 20000), null);

  const d0 = toDayNumber('2026-05-10');
  const f1 = {
    date: fromDayNumber(d0),
    scene_id: 's1',
    mean_ndvi: 0.5,
    valid_fraction: 0.9,
    png_url: '/p1.png',
  };
  const f2 = {
    date: fromDayNumber(d0 + 10),
    scene_id: 's2',
    mean_ndvi: 0.7,
    valid_fraction: 0.9,
    png_url: '/p2.png',
  };

  assert.equal(nearestFrame([f1, f2], d0 + 2), f1);
  assert.equal(nearestFrame([f1, f2], d0 + 8), f2);
  // Tie at d0 + 5 should pick earlier frame f1
  assert.equal(nearestFrame([f1, f2], d0 + 5), f1);
});

test('chartScales maps domain to padded range and dayAt inverts x', () => {
  const window = { start: '2025-10-27', end: '2026-10-26' };
  const width = 600;
  const height = 200;
  const padding = 20;
  const scales = chartScales(window, width, height, padding);

  assert.equal(scales.y(-0.2), height - padding);
  assert.equal(scales.y(0.9), padding);

  const startDay = toDayNumber(window.start);
  const endDay = toDayNumber(window.end);
  assert.equal(scales.x(startDay), padding);
  assert.equal(scales.x(endDay), width - padding);

  for (const d of [startDay, startDay + 50, startDay + 180, endDay]) {
    const px = scales.x(d);
    assert.equal(scales.dayAt(px), d);
  }
});

test('reducer: select → starting; started → polling/done/failed by status', () => {
  const s0 = { phase: 'idle' };
  const s1 = ndviJobReducer(s0, { type: 'select', parcelId: 'p1' });
  assert.deepEqual(s1, { phase: 'starting', parcelId: 'p1' });

  // started with queued status → polling
  const jobQueued = { ...fixture, status: 'queued' };
  const s2a = ndviJobReducer(s1, { type: 'started', parcelId: 'p1', status: jobQueued });
  assert.deepEqual(s2a, { phase: 'polling', parcelId: 'p1', job: jobQueued });

  // started with running status → polling
  const jobRunning = { ...fixture, status: 'running' };
  const s2b = ndviJobReducer(s1, { type: 'started', parcelId: 'p1', status: jobRunning });
  assert.deepEqual(s2b, { phase: 'polling', parcelId: 'p1', job: jobRunning });

  // started with done status → done
  const jobDone = { ...fixture, status: 'done' };
  const s3 = ndviJobReducer(s1, { type: 'started', parcelId: 'p1', status: jobDone });
  assert.deepEqual(s3, { phase: 'done', parcelId: 'p1', job: jobDone });

  // started with failed status → failed
  const jobFailed = { ...fixture, status: 'failed', error: 'STAC failure' };
  const s4 = ndviJobReducer(s1, { type: 'started', parcelId: 'p1', status: jobFailed });
  assert.deepEqual(s4, { phase: 'failed', parcelId: 'p1', job: jobFailed });
});

test('reducer ignores started/polled for another parcel or job', () => {
  const currentJob = { ...fixture, job_id: 'job-1', status: 'running' };
  const state = { phase: 'polling', parcelId: 'p1', job: currentJob };

  // started for another parcel
  const otherParcelStarted = ndviJobReducer(state, {
    type: 'started',
    parcelId: 'other-p',
    status: currentJob,
  });
  assert.equal(otherParcelStarted, state);

  // polled for another parcel
  const otherParcelPolled = ndviJobReducer(state, {
    type: 'polled',
    parcelId: 'other-p',
    status: currentJob,
  });
  assert.equal(otherParcelPolled, state);

  // polled for another job_id
  const otherJob = { ...fixture, job_id: 'job-2', status: 'done' };
  const otherJobPolled = ndviJobReducer(state, {
    type: 'polled',
    parcelId: 'p1',
    status: otherJob,
  });
  assert.equal(otherJobPolled, state);

  // polled when state is starting
  const startingState = { phase: 'starting', parcelId: 'p1' };
  assert.equal(
    ndviJobReducer(startingState, { type: 'polled', parcelId: 'p1', status: currentJob }),
    startingState
  );

  // started when state is idle
  const idleState = { phase: 'idle' };
  assert.equal(
    ndviJobReducer(idleState, { type: 'started', parcelId: 'p1', status: currentJob }),
    idleState
  );
});

test('reducer: requestFailed for current parcel → error; for other parcel ignored', () => {
  const state = { phase: 'starting', parcelId: 'p1' };

  // requestFailed for another parcel is ignored
  const ignored = ndviJobReducer(state, {
    type: 'requestFailed',
    parcelId: 'other-p',
    kind: 'offline',
    message: 'offline',
  });
  assert.equal(ignored, state);

  // requestFailed for current parcel transitions to error
  const errorState = ndviJobReducer(state, {
    type: 'requestFailed',
    parcelId: 'p1',
    kind: 'offline',
    message: 'Satellite service is offline.',
  });
  assert.deepEqual(errorState, {
    phase: 'error',
    parcelId: 'p1',
    kind: 'offline',
    message: 'Satellite service is offline.',
  });
});

test('reducer: reset → idle', () => {
  const activeState = { phase: 'polling', parcelId: 'p1', job: fixture };
  const resetState = ndviJobReducer(activeState, { type: 'reset' });
  assert.deepEqual(resetState, { phase: 'idle' });

  // reset from idle returns same reference
  assert.equal(ndviJobReducer(resetState, { type: 'reset' }), resetState);
});

test('NDVI_COLOR_STOPS matches spec table', () => {
  assert.equal(NDVI_COLOR_STOPS.length, 6);
  assert.deepEqual(NDVI_COLOR_STOPS, [
    [-0.2, '#8c510a'],
    [0.1, '#d8b365'],
    [0.3, '#f6e8c3'],
    [0.5, '#a6d96a'],
    [0.7, '#1a9641'],
    [0.9, '#00441b'],
  ]);
});

test('fixture validates against expected structure and constraints', () => {
  assert.equal(fixture.status, 'done');
  assert.equal(fixture.frames.length, 8);
  assert.equal(fixture.skipped.length, 3);
  assert.equal(fixture.progress.processed, 11);
  assert.equal(fixture.progress.total, 11);

  const reasons = new Set(fixture.skipped.map((s) => s.reason));
  assert.ok(reasons.has('cloudy'));
  assert.ok(reasons.has('no_data'));
  assert.ok(reasons.has('read_error'));

  // Ensure dates are sorted ascending
  for (let i = 1; i < fixture.frames.length; i++) {
    assert.ok(toDayNumber(fixture.frames[i].date) > toDayNumber(fixture.frames[i - 1].date));
  }
  for (let i = 1; i < fixture.skipped.length; i++) {
    assert.ok(toDayNumber(fixture.skipped[i].date) > toDayNumber(fixture.skipped[i - 1].date));
  }
});
