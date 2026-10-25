/**
 * Verification Suite for WebGL Shader Modes & ProgressionShaderRenderer (SPEC-UI-007, TODO-112).
 * Verifies GLSL uniform contracts, colormap gradient stops, view mode switching,
 * boundary continuity, and resource cleanup.
 * Run via: node --experimental-strip-types scripts/test_shader_modes.js
 */

import assert from 'node:assert';
import {
  VERTEX_SHADER_SOURCE,
  FRAGMENT_SHADER_SOURCE,
  ProgressionShaderRenderer,
  evaluateAttentionColormap,
} from '../src/components/DiseaseProgressionViewer/ProgressionShaderRenderer.ts';

console.log('[+] Starting WebGL Shader Modes & Pipeline Verification Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: GLSL Shader Uniform & Attribute Declarations
// ----------------------------------------------------------------------------
console.log('  [+] Test 1: Verifying GLSL Shader Uniform Declarations...');

const requiredAttributes = ['a_position', 'a_texCoord'];
for (const attr of requiredAttributes) {
  assert(
    VERTEX_SHADER_SOURCE.includes(`attribute vec2 ${attr};`),
    `Vertex shader must declare attribute '${attr}'`
  );
}

const requiredUniforms = [
  'sampler2D u_stage0',
  'sampler2D u_stage1',
  'sampler2D u_stage2',
  'sampler2D u_mask1',
  'sampler2D u_mask2',
  'float u_progress',
  'float u_has_mask1',
  'float u_has_mask2',
  'float u_view_mode',
  'float u_split_enabled',
  'float u_split_position',
];

for (const uniform of requiredUniforms) {
  assert(
    FRAGMENT_SHADER_SOURCE.includes(`uniform ${uniform};`),
    `Fragment shader must declare uniform '${uniform}'`
  );
}
console.log('  [✓] Test 1 Passed: All 11 uniforms and attributes declared in GLSL source');

// ----------------------------------------------------------------------------
// Test 2: Bio-Agronomic Colormap Color Stops (#0F766E -> #F59E0B -> #DC2626)
// ----------------------------------------------------------------------------
console.log('  [+] Test 2: Verifying Bio-Agronomic Colormap Color Calibration & Math...');

// Stop 1: Deep Teal #0F766E (15/255 = ~0.0588, 118/255 = ~0.4627, 110/255 = ~0.4314)
assert(
  FRAGMENT_SHADER_SOURCE.includes('vec3(0.0588, 0.4627, 0.4314)'),
  'Fragment shader must include Deep Teal #0F766E stop in getAttentionColormap()'
);

// Stop 2: Warm Amber #F59E0B (245/255 = ~0.9608, 158/255 = ~0.6196, 11/255 = ~0.0431)
assert(
  FRAGMENT_SHADER_SOURCE.includes('vec3(0.9608, 0.6196, 0.0431)'),
  'Fragment shader must include Warm Amber #F59E0B stop in getAttentionColormap()'
);

// Stop 3: Vivid Red #DC2626 (220/255 = ~0.8627, 38/255 = ~0.1490, 38/255 = ~0.1490)
assert(
  FRAGMENT_SHADER_SOURCE.includes('vec3(0.8627, 0.1490, 0.1490)'),
  'Fragment shader must include Vivid Red #DC2626 stop in getAttentionColormap()'
);

// Mathematical evaluations of colormap at boundary points
const cZero = evaluateAttentionColormap(0.0);
assert(Math.abs(cZero[0] - 0.0588) < 1e-4, 'Colormap at 0.0 must be Teal R');
assert(Math.abs(cZero[1] - 0.4627) < 1e-4, 'Colormap at 0.0 must be Teal G');
assert(Math.abs(cZero[2] - 0.4314) < 1e-4, 'Colormap at 0.0 must be Teal B');

const cMid = evaluateAttentionColormap(0.35);
assert(Math.abs(cMid[0] - 0.9608) < 1e-4, 'Colormap at 0.35 must be Amber R');
assert(Math.abs(cMid[1] - 0.6196) < 1e-4, 'Colormap at 0.35 must be Amber G');
assert(Math.abs(cMid[2] - 0.0431) < 1e-4, 'Colormap at 0.35 must be Amber B');

const cOne = evaluateAttentionColormap(1.0);
assert(Math.abs(cOne[0] - 0.8627) < 1e-4, 'Colormap at 1.0 must be Alert Red R');
assert(Math.abs(cOne[1] - 0.1490) < 1e-4, 'Colormap at 1.0 must be Alert Red G');
assert(Math.abs(cOne[2] - 0.1490) < 1e-4, 'Colormap at 1.0 must be Alert Red B');

console.log('  [✓] Test 2 Passed: 3-stop Bio-Agronomic colormap rigorously verified in GLSL and analytical math');

// ----------------------------------------------------------------------------
// Test 3: Split Curtain, Foliar Alpha & Midpoint Continuity in GLSL
// ----------------------------------------------------------------------------
console.log('  [+] Test 3: Verifying Split Curtain, Foliar Alpha & Midpoint Continuity in GLSL...');

assert(
  FRAGMENT_SHADER_SOURCE.includes('u_view_mode > 1.5'),
  'Fragment shader must support Difference Mask mode (mode 2)'
);
assert(
  FRAGMENT_SHADER_SOURCE.includes('modeColor = vec4(vec3(currentMask), rgbColor.a);'),
  'Difference mask mode must preserve foliar silhouette alpha (rgbColor.a)'
);
assert(
  FRAGMENT_SHADER_SOURCE.includes('currentMask = (u_has_mask1 > 0.5) ? (m1 * clamp(t * 1.5, 0.05, 1.0)) : u_progress;'),
  'Phase 1 currentMask without mask must track u_progress continuously'
);
assert(
  FRAGMENT_SHADER_SOURCE.includes('currentMask = (u_has_mask2 > 0.5) ? mix(m1, m2, t) : u_progress;'),
  'Phase 2 currentMask without mask must track u_progress continuously'
);
assert(
  FRAGMENT_SHADER_SOURCE.includes('u_split_enabled > 0.5'),
  'Fragment shader must support Split Curtain comparison'
);
assert(
  FRAGMENT_SHADER_SOURCE.includes('abs(splitDelta) < 0.002'),
  'Fragment shader must render crisp divider line at split boundary'
);
console.log('  [✓] Test 3 Passed: Split curtain, foliar alpha preservation & midpoint continuity validated');

// ----------------------------------------------------------------------------
// Test 4: ProgressionShaderRenderer API, Options & State Management
// ----------------------------------------------------------------------------
console.log('  [+] Test 4: Verifying ProgressionShaderRenderer Class API & Options...');

function createMockCanvas() {
  const listeners = {};
  return {
    width: 800,
    height: 800,
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    removeEventListener(event, fn) {
      if (listeners[event] === fn) delete listeners[event];
    },
    getContext(type) {
      if (type === '2d') {
        return {
          clearRect: () => {},
          drawImage: () => {},
          save: () => {},
          restore: () => {},
          beginPath: () => {},
          rect: () => {},
          clip: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fillRect: () => {},
          globalAlpha: 1.0,
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          filter: '',
        };
      }
      return null; // Simulate 2D fallback environment in Node
    },
  };
}

const mockCanvas = createMockCanvas();
const renderer = new ProgressionShaderRenderer(mockCanvas);

// View Mode API
assert.strictEqual(renderer.getViewMode(), 'rgb', 'Initial view mode must be "rgb"');

renderer.setViewMode('attention');
assert.strictEqual(renderer.getViewMode(), 'attention', 'setViewMode("attention") must update mode');

renderer.setViewMode('mask');
assert.strictEqual(renderer.getViewMode(), 'mask', 'setViewMode("mask") must update mode');

renderer.setViewMode(0);
assert.strictEqual(renderer.getViewMode(), 'rgb', 'setViewMode(0) must resolve to "rgb"');

renderer.setViewMode(1);
assert.strictEqual(renderer.getViewMode(), 'attention', 'setViewMode(1) must resolve to "attention"');

renderer.setViewMode(2);
assert.strictEqual(renderer.getViewMode(), 'mask', 'setViewMode(2) must resolve to "mask"');

// Unified setOptions API
renderer.setOptions({
  viewMode: 'attention',
  splitEnabled: true,
  splitPosition: 0.65,
});
assert.strictEqual(renderer.getViewMode(), 'attention', 'setOptions must update viewMode');
assert.strictEqual(renderer.getSplitCompare().enabled, true, 'setOptions must update splitEnabled');
assert.strictEqual(renderer.getSplitCompare().splitEnabled, true, 'getSplitCompare must return splitEnabled alias');
assert.strictEqual(renderer.getSplitCompare().position, 0.65, 'setOptions must update splitPosition');
assert.strictEqual(renderer.getSplitCompare().splitPosition, 0.65, 'getSplitCompare must return splitPosition alias');

// Clamping bounds
renderer.setSplitCompare(true, 1.8);
assert.strictEqual(renderer.getSplitCompare().position, 1.0, 'Split position > 1.0 must clamp to 1.0');

renderer.setSplitCompare(true, -0.4);
assert.strictEqual(renderer.getSplitCompare().position, 0.0, 'Split position < 0.0 must clamp to 0.0');

// Resize
renderer.resize(1024, 768, 1);
assert.strictEqual(mockCanvas.width, 1024, 'Canvas width must update on resize');
assert.strictEqual(mockCanvas.height, 768, 'Canvas height must update on resize');

// Disposal hygiene
renderer.dispose();
assert.strictEqual(renderer.isAvailable(), false, 'isAvailable() must be false after disposal');
assert.doesNotThrow(() => {
  // Double dispose must be idempotent and safe
  renderer.dispose();
}, 'Double dispose must not throw');

console.log('  [✓] Test 4 Passed: Unified options, mode switching, clamping, and disposal validated');

console.log('\n[✓] All WebGL Shader Modes & Pipeline Tests PASSED (4/4 suites).');
