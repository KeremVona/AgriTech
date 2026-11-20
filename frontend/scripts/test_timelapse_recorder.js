import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordProgressionTimelapse } from '../src/utils/timelapseRecorder.ts';

/** Minimal MediaRecorder fake: emits one chunk and fires onstop/onerror asynchronously. */
class FakeMediaRecorder {
  static isTypeSupported() { return true; }
  static failNext = false;
  constructor(stream, options) { this.stream = stream; this.options = options; }
  start() {}
  stop() {
    setTimeout(() => {
      if (FakeMediaRecorder.failNext) { this.onerror?.(new Error('encoder failed')); return; }
      this.ondataavailable?.({ data: new Blob(['frame']) });
      this.onstop?.();
    }, 0);
  }
}

function fakeCanvas() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  return { tracks, canvas: { captureStream: () => ({ getTracks: () => tracks }) } };
}

globalThis.window = globalThis;
globalThis.MediaRecorder = FakeMediaRecorder;

test('capture stream tracks are stopped once the recording finishes', async () => {
  FakeMediaRecorder.failNext = false;
  const { canvas, tracks } = fakeCanvas();
  const blob = await recordProgressionTimelapse({ canvas, onSetSliderPercentage() {}, totalDurationMs: 60, fps: 50 });
  assert.ok(blob.size > 0);
  assert.equal(tracks[0].stopped, true, 'canvas capture must not keep running after the video is made');
});

test('capture stream tracks are stopped when recording fails', async () => {
  FakeMediaRecorder.failNext = true;
  const { canvas, tracks } = fakeCanvas();
  await assert.rejects(recordProgressionTimelapse({ canvas, onSetSliderPercentage() {}, totalDurationMs: 60, fps: 50 }));
  assert.equal(tracks[0].stopped, true);
});
