import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldAutoLoadBackgroundVideo } from '../src/utils/backgroundVideoPolicy.ts';

const base = { reducedMotion: false, narrowScreen: false, saveData: false };

test('desktop with no preferences auto-loads the 14.8 MB background video', () => {
  assert.equal(shouldAutoLoadBackgroundVideo(base), true);
});

test('phones, reduced motion and Data Saver never download it automatically', () => {
  assert.equal(shouldAutoLoadBackgroundVideo({ ...base, narrowScreen: true }), false);
  assert.equal(shouldAutoLoadBackgroundVideo({ ...base, reducedMotion: true }), false);
  assert.equal(shouldAutoLoadBackgroundVideo({ ...base, saveData: true }), false);
});
