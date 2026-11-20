import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

const { ProgressionShaderRenderer } = await import('../src/components/DiseaseProgressionViewer/ProgressionShaderRenderer.ts');

/** A stub WebGL context: every method is a no-op that returns a truthy handle. */
function fakeGl(state) {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'isContextLost') return () => state.lost;
      if (typeof prop === 'string' && /^[A-Z_0-9]+$/.test(prop)) return 1;
      if (prop === 'getAttribLocation') return () => 0;
      if (prop === 'getShaderInfoLog' || prop === 'getProgramInfoLog') return () => '';
      return () => ({});
    },
  });
}

function fakeCanvas() {
  const state = { lost: false };
  const listeners = {};
  const gl = fakeGl(state);
  const canvas = {
    width: 800,
    height: 800,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
    getContext: (kind) => (kind === 'webgl' ? gl : null),
  };
  const fire = (type) => listeners[type]?.({ preventDefault() {} });
  return { canvas, state, fire, listeners };
}

test('renderer recovers after the browser restores a lost WebGL context', () => {
  const { canvas, state, fire } = fakeCanvas();
  const renderer = new ProgressionShaderRenderer(canvas);
  assert.equal(renderer.isAvailable(), true);

  state.lost = true;
  fire('webglcontextlost');
  assert.equal(renderer.isAvailable(), false);

  state.lost = false;
  fire('webglcontextrestored');
  assert.equal(renderer.isAvailable(), true, 'pipeline must be rebuilt on webglcontextrestored');
  renderer.dispose();
});

test('dispose removes the restore listener', () => {
  const { canvas, listeners } = fakeCanvas();
  const renderer = new ProgressionShaderRenderer(canvas);
  renderer.dispose();
  assert.equal(listeners.webglcontextrestored, undefined);
  assert.equal(listeners.webglcontextlost, undefined);
});
