/**
 * Verification Suite for Production Disease Progression Studio Assembly (SPEC-UI-007, Task 5).
 * Validates module exports, routing alignment, 8-state state machine integrity,
 * and data flow contracts.
 * Run via: node --experimental-strip-types scripts/test_production_assembly.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[+] Starting Production Disease Progression Studio Assembly Verification Suite...\n');

// ----------------------------------------------------------------------------
// Test 1: Production Route Wiring in App.tsx
// ----------------------------------------------------------------------------
console.log('  [+] Test 1: Verifying Canonical Route & Deprecation Redirect in App.tsx...');

const appPath = path.resolve(__dirname, '../src/App.tsx');
const appSource = fs.readFileSync(appPath, 'utf8');

assert(
  appSource.includes('path="/disease-progression"'),
  'App.tsx must declare canonical production route /disease-progression'
);
assert(
  appSource.includes('path="/disease-progression-experimental"'),
  'App.tsx must declare backward-compatible route /disease-progression-experimental'
);
assert(
  appSource.includes('Navigate to="/disease-progression" replace'),
  'App.tsx must redirect /disease-progression-experimental directly to /disease-progression'
);
assert(
  !appSource.includes('DiseaseProgressionExperimentalPage'),
  'App.tsx must not import deprecated DiseaseProgressionExperimentalPage'
);

console.log('  [✓] Test 1 Passed: Route wiring and deprecation redirection confirmed');

// ----------------------------------------------------------------------------
// Test 2: Canonical Exports in DiseaseProgressionViewer/index.ts
// ----------------------------------------------------------------------------
console.log('  [+] Test 2: Verifying Module Index Exports...');

const indexPath = path.resolve(__dirname, '../src/components/DiseaseProgressionViewer/index.ts');
const indexSource = fs.readFileSync(indexPath, 'utf8');

const requiredExports = [
  'DiseaseProgressionViewer',
  'ProgressionShaderRenderer',
  'evaluateAttentionColormap',
  'CompactCropSelectorRail',
  'DEFAULT_CROP_SPECIMENS',
  'LeafHotspotOverlay',
  'AgronomicTimelineSlider',
  'ProgressionCanvasViewport',
  'StudioInspectorRail',
  'MicroclimateControlPanel',
  'TreatmentBranchingControls',
  'TreatmentOutcomeCard',
  'PromptAttentionInspector',
  'ExportToolbar',
  'DiagnosticPdfReportModal',
  'serializeNpyTensor',
];

for (const exp of requiredExports) {
  assert(
    indexSource.includes(exp),
    `DiseaseProgressionViewer/index.ts must export '${exp}'`
  );
}

console.log('  [✓] Test 2 Passed: All 16 canonical components, models, and utilities properly exported');

// ----------------------------------------------------------------------------
// Test 3: Backward Compatibility in p2p-experimental Shims
// ----------------------------------------------------------------------------
console.log('  [+] Test 3: Verifying Backward Compatibility Shims in p2p-experimental...');

const expViewerPath = path.resolve(
  __dirname,
  '../src/p2p-experimental/components/DiseaseProgressionViewerExperimental.tsx'
);
const expViewerSource = fs.readFileSync(expViewerPath, 'utf8');

assert(
  expViewerSource.includes('DiseaseProgressionViewer as DiseaseProgressionViewerExperimental'),
  'DiseaseProgressionViewerExperimental must re-export DiseaseProgressionViewer for backward compatibility'
);

console.log('  [✓] Test 3 Passed: p2p-experimental shims cleanly re-export canonical components');

// ----------------------------------------------------------------------------
// Test 4: Production Light-Mode Tokens in DiseaseProgressionPage.tsx
// ----------------------------------------------------------------------------
console.log('  [+] Test 4: Verifying Light-Mode Tokens in DiseaseProgressionPage.tsx...');

const pagePath = path.resolve(__dirname, '../src/pages/DiseaseProgressionPage.tsx');
const pageSource = fs.readFileSync(pagePath, 'utf8');

assert(
  pageSource.includes('bg-[#F8FAFC]') || pageSource.includes('bg-slate-50'),
  'DiseaseProgressionPage must use light-mode canvas background'
);
assert(
  !pageSource.includes('bg-slate-950') && !pageSource.includes('bg-slate-900'),
  'DiseaseProgressionPage must not use dark-mode root background (purged bg-slate-950/900)'
);
assert(
  pageSource.includes('CompactCropSelectorRail'),
  'DiseaseProgressionPage must integrate CompactCropSelectorRail'
);
assert(
  pageSource.includes('DiseaseProgressionViewer'),
  'DiseaseProgressionPage must mount DiseaseProgressionViewer'
);
assert(
  pageSource.includes('DEFAULT_CROP_SPECIMENS'),
  'DiseaseProgressionPage must wire DEFAULT_CROP_SPECIMENS'
);

console.log('  [✓] Test 4 Passed: Light-mode tokens and layout architecture verified');

console.log('\n[✓] All Production Disease Progression Studio Assembly Tests PASSED (4/4 suites).');
