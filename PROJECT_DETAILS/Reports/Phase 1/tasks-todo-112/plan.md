# Disease Progression Studio: Integration & Light-Mode Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MANDATORY REVIEW GATE:** As explicitly instructed by the user, **after EACH task** of this plan, a specialized subagent (`code-reviewer`) MUST be invoked to inspect and review the code for visual fidelity against `design/DISEASE_PROGRESSION_SPEC.md` (`SPEC-UI-007`), token correctness, and functional edge cases before proceeding to the next task.

**Goal:** Integrate and refactor the experimental Prompt-to-Prompt Disease Progression Studio (`/disease-progression-experimental`) into the platform's primary production route (`/disease-progression`), adopting the standardized "Precision Ag-Intelligence" light-mode design system (`#F8FAFC` canvas, `#FFFFFF` surfaces, `#0F172A` ink, and `#0F766E` brand accents).

**Architecture:** A responsive 12-column engineering workbench (7 cols left / 5 cols right on desktop, stacking into a mobile-first field viewport) featuring an 8-crop selector rail, a 60 FPS two-phase WebGL fragment shader with cross-attention heatmaps and difference masks, interactive anatomical symptom hotspots, a bi-directional Magarey Beta timeline scrubber, a 4-tab docked parameter inspector rail (microclimate, treatment branching, prompt diff, media export), and safe GPU context disposal.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, WebGL 1.0 GLSL Fragment Shaders, HTML5 Canvas 2D fallback, MediaRecorder API (`canvas.captureStream()`), Lucide Icons.

**Spec:** [`design/DISEASE_PROGRESSION_SPEC.md`](file:///f:/Okul/Graduation%20Project/Project/design/DISEASE_PROGRESSION_SPEC.md) (`SPEC-UI-007`)  
**Foundations:** [`design/FOUNDATIONS.md`](file:///f:/Okul/Graduation%20Project/Project/design/FOUNDATIONS.md), [`design/COMPONENTS.md`](file:///f:/Okul/Graduation%20Project/Project/design/COMPONENTS.md), [`design/MOTION_AND_INTERACTION.md`](file:///f:/Okul/Graduation%20Project/Project/design/MOTION_AND_INTERACTION.md), [`design/MOBILE_AND_OUTDOOR_SPEC.md`](file:///f:/Okul/Graduation%20Project/Project/design/MOBILE_AND_OUTDOOR_SPEC.md)

---

## Global Constraints

- **Default Light Mode:** Root canvas `#F8FAFC` (`--ag-canvas`), cards/surfaces `#FFFFFF` (`--ag-surface`), primary ink `#0F172A` ($15.8:1$ AAA), brand `#0F766E` (`--ag-brand`). Purge all dark mode styles (`bg-slate-950`, `bg-slate-900`, `border-white/10`).
- **Rigid Tabular Numerals:** All elapsed days (`Day 4.2`), temperature readouts (`24.0°C`), humidity (`88.0%`), and severity percentages (`25.0%`) MUST use `font-variant-numeric: tabular-nums` (`.ag-tabular-numeric`) to prevent metric jitter.
- **Dual Coding Severity:** Never use color alone. Every severity level and intervention alert MUST display semantic color, icon glyph, and explicit textual status label.
- **Outdoor Touch Ergonomics:** 48px minimum touch targets on mobile viewports; 44px+ on crop selector pills and secondary triggers; direct pointer tracking on sliders with `setPointerCapture`.
- **Non-Zero Scale Entrances:** Modals, tooltips, and popovers enter from `scale(0.96)` and opacity 0 over 200ms.
- **WebGL Context Safety:** All GPU textures, buffers, and shader programs MUST be cleaned up via `renderer.dispose()` on unmount to prevent GPU memory leaks across navigation switches.

---

## Review Focus

1. **WebGL Context Loss & Restoration:** If hardware acceleration is lost or unavailable, the system must smoothly fall back to multi-layer HTML5 2D canvas cross-dissolving without breaking the timeline scrubber.
2. **Tabular Numerals Alignment:** Scrubbing at 60 FPS must not shift neighboring controls or cause metric jitter in temperature, humidity, days, or severity badges.
3. **High-Sunlight Outdoor Contrast:** All text must meet WCAG AAA contrast ($15.8:1$) against `#F8FAFC` and white surfaces.
4. **Treatment Branching Calculation Consistency:** When treatment intervention is toggled at Day $D_{\text{int}}$, the treated curve must plateau smoothly at the predicted ceiling without negative deltas or division by zero.
5. **Prompt Attention Token Diff Integrity:** Needleman-Wunsch prompt token comparison must cleanly separate common background tokens from newly injected disease tokens with appropriate Bio-Teal badges.

---

## Task Breakdown

### Task 1: Domain Model Promotion, Canonical Services & Test Backward Compatibility

**Files:**
- Create: `frontend/src/models/agronomicTimelineModel.ts`
- Create: `frontend/src/models/treatmentBranchingModel.ts`
- Create: `frontend/src/models/hotspotRegistry.ts`
- Create: `frontend/src/models/exportReportModel.ts`
- Create: `frontend/src/utils/timelapseRecorder.ts`
- Create: `frontend/src/services/progressionService.ts`
- Create: `frontend/src/hooks/useProgressionData.ts`
- Modify: `frontend/src/p2p-experimental/models/agronomicTimelineModel.ts` (re-export aliases)
- Modify: `frontend/src/p2p-experimental/models/treatmentBranchingModel.ts` (re-export aliases)
- Modify: `frontend/src/p2p-experimental/models/hotspotRegistry.ts` (re-export aliases)
- Modify: `frontend/src/p2p-experimental/models/exportReportModel.ts` (re-export aliases)
- Modify: `frontend/src/p2p-experimental/utils/timelapseRecorder.ts` (re-export aliases)

**Interfaces:**
- Consumes: Mathematical specifications from `SPEC-UI-007` and empirical pathology datasets.
- Produces: Canonical domain types `SupportedCropId`, `ProgressionDynamicOutput`, `FungicideCategory`, `InterventionEfficacyResult`, `YieldRetentionAnalyticsResult`, `AgronomicFieldReportData`, and progression hooks.

- [ ] **Step 1: Promote models and utilities into `frontend/src/models/` and `frontend/src/utils/`**
- [ ] **Step 2: Add backward-compatible re-exports in `frontend/src/p2p-experimental/`**
- [ ] **Step 3: Run existing unit test suites to verify zero regressions**
  - Run: `npm --prefix frontend run test:agronomy`
  - Run: `npm --prefix frontend run test:crops`
  - Run: `npm --prefix frontend run test:treatment`
  - Run: `npm --prefix frontend run test:hotspots`
  - Run: `npm --prefix frontend run test:export`
  - Expected: 100% PASS across all existing test suites.
- [ ] **Step 4: Commit**
  - `git commit -m "feat(progression): promote canonical models, services and recorder utilities"`
- [ ] **Step 5: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit promoted models, type definitions, and backward compatibility.

---

### Task 2: WebGL Shader View Mode Extension & Attention Map Colormap

**Files:**
- Modify: `frontend/src/components/DiseaseProgressionViewer/ProgressionShaderRenderer.ts`
- Create: `frontend/src/components/DiseaseProgressionViewer/types.ts`
- Create: `frontend/scripts/test_shader_modes.js`

**Interfaces:**
- Consumes: Image textures ($S_0, S_1, S_2$), difference masks ($M_1, M_2$), `u_view_mode`, `u_progress`, split curtain position.
- Produces: 60 FPS GLSL shader rendering with 3 view modes (Standard RGB, Cross-Attention Heatmap, Difference Mask) and split compare curtain.

- [ ] **Step 1: Write verification script `frontend/scripts/test_shader_modes.js`**
  - Validate view mode constants (0 = RGB, 1 = Attention Heatmap, 2 = Difference Mask).
  - Verify shader sources compile cleanly and uniform locations are properly bound.
- [ ] **Step 2: Extend `ProgressionShaderRenderer.ts` with `u_view_mode` and attention colormap**
  - Add `uniform float u_view_mode;` in fragment shader.
  - Implement Viridis/Turbo colormap ramp in GLSL: Deep Teal `#0F766E` $\to$ Warm Amber `#F59E0B` $\to$ Vivid Red `#DC2626`.
  - Add Difference Mask mode rendering isolated high-pass lesion contours.
  - Add Split Curtain compare divider support.
  - Ensure `renderer.dispose()` cleanly frees textures, buffers, and programs.
- [ ] **Step 3: Run test script and build check**
  - Run: `node --experimental-strip-types frontend/scripts/test_shader_modes.js`
  - Run: `npm --prefix frontend run build`
  - Expected: PASS
- [ ] **Step 4: Commit**
  - `git commit -m "feat(progression): implement WebGL view modes, attention heatmap shader and split curtain"`
- [ ] **Step 5: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit GLSL shader compilation, colormap formulas, and context management.

---

### Task 3: Studio Parameter Inspector Rail & Prompt Attention Inspector (Light Mode)

**Files:**
- Create: `frontend/src/components/DiseaseProgressionViewer/PromptAttentionInspector.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/MicroclimateControlPanel.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/TreatmentBranchingControls.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/TreatmentOutcomeCard.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/ExportToolbar.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/DiagnosticPdfReportModal.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/StudioInspectorRail.tsx`

**Interfaces:**
- Consumes: Microclimate state, treatment state, prompt tokens, export actions.
- Produces: 4-tab docked parameter inspector in light mode with tactile tab switching.

- [ ] **Step 1: Implement `<PromptAttentionInspector />`**
  - Needleman-Wunsch prompt token comparison displaying common tokens in slate and newly injected disease tokens in Bio-Teal badges.
  - Hyperparameter readouts ($\tau_{\text{cross}}=0.75, \tau_{\text{self}}=0.50, \tau_{\text{blend}}=0.30$) with `.ag-tabular-numeric`.
  - Attention map tensor download trigger.
- [ ] **Step 2: Refactor `<MicroclimateControlPanel />` into light mode**
  - `#FFFFFF` surface card, `--ag-brand` sliders, real-time sporulation acceleration factor, and interactive cardinal curve mini-SVG.
- [ ] **Step 3: Refactor `<TreatmentBranchingControls />` & `<TreatmentOutcomeCard />` into light mode**
  - What-if intervention checkpoint, curative vs protectant vs bio-control selection, FRAC code details, trajectory plateau, and yield retention ($+38.5\%$).
- [ ] **Step 4: Refactor `<ExportToolbar />` and `<DiagnosticPdfReportModal />` into light mode**
  - 60 FPS WebM timelapse recorder, snapshot download, and multi-page field PDF report generator.
- [ ] **Step 5: Assemble `<StudioInspectorRail />` with tactile tab switching**
  - Tab 1: Climate, Tab 2: Treatment, Tab 3: Prompts, Tab 4: Export.
  - Emil Kowalski tactile active scale (`scale(0.97)`).
- [ ] **Step 6: Build verification and commit**
  - Run: `npm --prefix frontend run build`
  - Expected: Clean compilation.
  - `git commit -m "feat(progression): build light-mode parameter inspector rail and prompt attention inspector"`
- [ ] **Step 7: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit inspector tabs, contrast ratios, and prompt diff visualizer.

---

### Task 4: Interactive Foliar Canvas Viewport, Hotspots & Agronomic Scrubber (Light Mode)

**Files:**
- Create: `frontend/src/components/DiseaseProgressionViewer/CompactCropSelectorRail.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/LeafHotspotOverlay.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/AgronomicTimelineSlider.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/ProgressionCanvasViewport.tsx`
- Create: `frontend/src/components/DiseaseProgressionViewer/index.ts`

**Interfaces:**
- Consumes: Crop profiles, progression progress, WebGL canvas, symptom hotspots.
- Produces: Interactive foliar canvas stage with toolbar, 24 anatomical hotspot pins, and bi-directional Magarey Beta timeline scrubber.

- [ ] **Step 1: Refactor `<CompactCropSelectorRail />` in light mode**
  - 8-crop selector with `#FFFFFF` background, active pill in `#F0FDFA` with `1.5px solid #0F766E` border, smooth auto-scroll into view, and 44px+ hit targets.
- [ ] **Step 2: Refactor `<LeafHotspotOverlay />` in light mode**
  - 24 registered anatomical pins with glassmorphic light-mode circular badges (`bg-white/95 text-slate-900 border border-slate-300`).
  - Active biological window detection with pulsating emerald halo (`ring-2 ring-teal-600 animate-pulse`).
  - Hover/tap popover with anatomical structure, microscopic sporulation description, and canopy loss %.
- [ ] **Step 3: Refactor `<AgronomicTimelineSlider />` in light mode**
  - Bi-directional sync between elapsed days ($0\to 18\text{ days}$) and severity % ($0\to 100\%$) with `.ag-tabular-numeric`.
  - Play/Pause automated 4.5s loop with instant interruptibility.
  - Milestone tick marks (`Day 0.0`, `Day 3.5`, `Day 8.0`, `Day 14.0`) and intervention marker pin.
  - Direct touch tracking with `setPointerCapture`.
- [ ] **Step 4: Assemble `<ProgressionCanvasViewport />` and export barrel**
  - Viewport toolbar with View Mode pills (RGB, Attention, Mask), Split Compare toggle, and Trajectory Mode.
  - Canvas container with WebGL shader and 2D fallback.
  - Export all components in `index.ts`.
- [ ] **Step 5: Build verification and commit**
  - Run: `npm --prefix frontend run build`
  - Expected: Clean compilation.
  - `git commit -m "feat(progression): build light-mode crop selector rail, hotspot overlay and timeline scrubber"`
- [ ] **Step 6: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit touch ergonomics, 60fps tracking, and accessibility.

---

### Task 5: Production Page Assembly, Experimental Route Deprecation & End-to-End Verification

**Files:**
- Modify: `frontend/src/pages/DiseaseProgressionPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/LandingHero/Navbar.tsx` & `frontend/src/pages/LandingPage.tsx`
- Create: `PROJECT_DETAILS/Reports/Phase 1/TODO-112-disease-progression-studio.md`

**Interfaces:**
- Consumes: All promoted components and routing system.
- Produces: Complete production `/disease-progression` studio page, redirect from experimental route, and formal completion report.

- [ ] **Step 1: Assemble `<DiseaseProgressionPage />` in `frontend/src/pages/DiseaseProgressionPage.tsx`**
  - Implement 12-column responsive layout (Top 12 cols: Crop Rail; Left 7 cols: Canvas + Scrubber; Right 5 cols: Inspector Rail).
  - Manage 8-state state machine (`LOADING`, `SCRUBBING`, `PLAYBACK`, `ATTENTION_MAP`, `TREATMENT_BRANCHING`, `RECORDING`, `FALLBACK_2D`, `ERROR`).
  - Sticky breadcrumbs bar with quick actions (Snapshot, Timelapse, PDF Report).
  - Context disposal in `useEffect` cleanup.
- [ ] **Step 2: Update routing in `frontend/src/App.tsx`**
  - Route `/disease-progression` to upgraded `DiseaseProgressionPage`.
  - Redirect `/disease-progression-experimental` to `/disease-progression`.
- [ ] **Step 3: Update navigation links in `Navbar.tsx` and `LandingPage.tsx`**
- [ ] **Step 4: Full automated verification run**
  - Run: `npm --prefix frontend run test:agronomy`
  - Run: `npm --prefix frontend run test:crops`
  - Run: `npm --prefix frontend run test:treatment`
  - Run: `npm --prefix frontend run test:hotspots`
  - Run: `npm --prefix frontend run test:export`
  - Run: `npm --prefix frontend run test:diagnostics`
  - Run: `npm --prefix frontend run lint` (`oxlint` with 0 warnings, 0 errors)
  - Run: `npm --prefix frontend run build` (Clean production bundle)
- [ ] **Step 5: Generate completion report in `PROJECT_DETAILS/Reports/Phase 1/TODO-112-disease-progression-studio.md`**
- [ ] **Step 6: Final whole-feature subagent code review**
  - Launch `code-reviewer` subagent for comprehensive audit against `SPEC-UI-007`.
- [ ] **Step 7: Final commit and sign-off**
  - `git commit -m "docs(progression): complete disease progression studio integration and light-mode refactor"`

---

## Plan Self-Review Checklist

- [x] **Spec Coverage:** Every requirement in `design/DISEASE_PROGRESSION_SPEC.md` (`SPEC-UI-007`) is addressed (WebGL view modes, attention heatmap, difference mask, 8-crop selector, hotspots, scrubber, treatment branching, prompt diff, media export, 8-state machine).
- [x] **Subagent Gate Integration:** As explicitly requested, every single task ends with a mandatory `code-reviewer` subagent review gate.
- [x] **Design Tokens & Light Mode:** Enforces `#F8FAFC` canvas, `#FFFFFF` containers, `#0F172A` ink, and `.ag-tabular-numeric`.
- [x] **Zero Regressions:** Preserves 100% green status across all existing automated test suites.
- [x] **Right-Sized Slices:** 5 focused tasks touching 2–5 files each, with checkable steps.
