# TODO-112: Disease Progression Studio Integration & Light-Mode Refactor

## Current Status: READY FOR APPROVAL
**Assignee:** Senior Front-End Engineer  
**Phase:** Phase 1 — Prompt-to-Prompt Cross-Attention Progression Core  
**Spec:** `design/DISEASE_PROGRESSION_SPEC.md` (SPEC-UI-007)  
**Plan:** `tasks/plan.md`  
**Artifact:** `Disease_Progression_Studio_Implementation_Plan.md`

---

### Task List & Subagent Review Cadence

- [x] **Task 1: Domain Model Promotion, Canonical Services & Test Backward Compatibility**
  - [x] Promote domain models from `p2p-experimental/models/` to canonical `frontend/src/models/`
  - [x] Promote `timelapseRecorder.ts` to `frontend/src/utils/timelapseRecorder.ts`
  - [x] Promote progression service & hook to `frontend/src/services/` and `frontend/src/hooks/`
  - [x] Provide backward-compatible aliases in `frontend/src/p2p-experimental/`
  - [x] Verify existing test suites pass: `npm run test:agronomy`, `npm run test:crops`, `npm run test:treatment`, `npm run test:hotspots`, `npm run test:export`
  - [x] Commit changes
  - [x] **Mandatory Subagent Review Gate:** Audit with `code-reviewer` subagent

- [x] **Task 2: WebGL Shader View Mode Extension & Attention Map Colormap**
  - [x] Create test script `frontend/scripts/test_shader_modes.js`
  - [x] Extend `ProgressionShaderRenderer.ts` with `u_view_mode` (RGB, Attention Heatmap, Difference Mask)
  - [x] Implement Turbo/Viridis color-coded attention heatmap gradient in GLSL
  - [x] Implement difference mask mode & split curtain support
  - [x] Verify WebGL context disposal hygiene
  - [x] Verify compilation: `npm run build`
  - [x] Commit changes
  - [x] **Mandatory Subagent Review Gate:** Audit with `code-reviewer` subagent

- [x] **Task 3: Studio Parameter Inspector Rail & Prompt Attention Inspector (Light Mode)**
  - [x] Implement `<PromptAttentionInspector />` with Needleman-Wunsch prompt diff token visualizer & hyperparameters
  - [x] Refactor `<MicroclimateControlPanel />` into light-mode tokens with interactive cardinal curve mini-SVG
  - [x] Refactor `<TreatmentBranchingControls />` & `<TreatmentOutcomeCard />` into light mode with dual-coded severity callouts
  - [x] Refactor `<ExportToolbar />` and `<DiagnosticPdfReportModal />` into light mode
  - [x] Assemble `<StudioInspectorRail />` with tactile tab switching and light-mode tokens
  - [x] Verify compilation: `npm run build`
  - [x] Commit changes
  - [ ] **Mandatory Subagent Review Gate:** Audit with `code-reviewer` subagent

- [ ] **Task 4: Interactive Foliar Canvas Viewport, Hotspots & Agronomic Scrubber (Light Mode)**
  - [ ] Refactor `<CompactCropSelectorRail />` in light mode with auto-scrolling active pill and 44px+ hit targets
  - [ ] Refactor `<LeafHotspotOverlay />` in light mode with 24 registered anatomical pins and popover cards
  - [ ] Refactor `<AgronomicTimelineSlider />` in light mode with Magarey Beta days $\longleftrightarrow$ severity sync, tabular numerals, play/pause loop, milestone tick marks, and `setPointerCapture`
  - [ ] Assemble `<ProgressionCanvasViewport />` with view mode toolbar, WebGL canvas, and 2D fallback
  - [ ] Export components in `frontend/src/components/DiseaseProgressionViewer/index.ts`
  - [ ] Verify compilation: `npm run build`
  - [ ] Commit changes
  - [ ] **Mandatory Subagent Review Gate:** Audit with `code-reviewer` subagent

- [ ] **Task 5: Production Page Assembly, Route Deprecation & End-to-End Verification**
  - [ ] Assemble `<DiseaseProgressionPage />` in `frontend/src/pages/DiseaseProgressionPage.tsx` with 12-column responsive layout (7 cols left / 5 cols right)
  - [ ] Manage 8-state state machine with zero memory leaks
  - [ ] Wire `/disease-progression` route and redirect `/disease-progression-experimental`
  - [ ] Update navigation links in `Navbar.tsx` and `LandingPage.tsx`
  - [ ] Run full automated verification: `test:agronomy`, `test:crops`, `test:treatment`, `test:hotspots`, `test:export`, `test:diagnostics`
  - [ ] Run linter: `npm run lint` (`oxlint` 0 warnings, 0 errors)
  - [ ] Run production build: `npm run build`
  - [ ] Generate completion report `PROJECT_DETAILS/Reports/Phase 1/TODO-112-disease-progression-studio.md`
  - [ ] Final whole-feature code review subagent gate
  - [ ] Final commit and sign-off
