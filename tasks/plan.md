# AI Leaf Diagnostics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MANDATORY REVIEW GATE:** As explicitly instructed by the user, **after EACH task** of this plan, a specialized subagent (`code-reviewer`) MUST be invoked to inspect and review the code for visual fidelity against `design/AI_Leaf_Diagnostics_Spec.md`, token correctness, and functional edge cases before proceeding to the next task.

**Goal:** Implement the dedicated, high-precision AI Leaf Diagnostics page (`/diagnostics` and `/leaf-scanner`) adhering strictly to `design/AI_Leaf_Diagnostics_Spec.md` (SPEC-UI-006) and the platform design foundations.

**Architecture:** A focused dual-panel workbench (5 cols / 7 cols desktop grid, stacking into a mobile-first field inspection viewport) featuring client-side pre-flight image validation (MIME, size, resolution), an in-flight telemetry laser scan beam with a tabular elapsed timer, an animated dual-coded diagnostic verdict card (4-tier severity ramp, top-3 class probabilities, and immediate agronomic action banners), and a resilient dual-mode API service (FastAPI `/api/v1/classify-leaf` with clinical sample fallback).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, HTML5 File & Camera API (`capture="environment"`).

**Spec:** [`design/AI_Leaf_Diagnostics_Spec.md`](file:///f:/Okul/Graduation%20Project/Project/design/AI_Leaf_Diagnostics_Spec.md)  
**Foundations:** [`design/FOUNDATIONS.md`](file:///f:/Okul/Graduation%20Project/Project/design/FOUNDATIONS.md), [`design/MOTION_AND_INTERACTION.md`](file:///f:/Okul/Graduation%20Project/Project/design/MOTION_AND_INTERACTION.md), [`design/MOBILE_AND_OUTDOOR_SPEC.md`](file:///f:/Okul/Graduation%20Project/Project/design/MOBILE_AND_OUTDOOR_SPEC.md)

---

## Global Constraints

- **Default Light Mode:** Root canvas `#F8FAFC`, cards/surfaces `#FFFFFF`, primary ink `#0F172A` ($15.8:1$ AAA), brand `#0F766E`.
- **Rigid Tabular Numerals:** All confidence percentages, latency values, and elapsed timer readouts MUST use `font-variant-numeric: tabular-nums` (`.ag-tabular-numeric`) to prevent metric jitter.
- **Dual Coding Severity:** Never use color alone. Every severity level MUST display: (1) color fill/stroke, (2) icon glyph (`CheckCircle`, `AlertTriangle`, `AlertCircle`, `OctagonAlert`), and (3) explicit status label.
- **Outdoor Touch Ergonomics:** 48px minimum touch targets on mobile viewports; 16px minimum input font size to prevent iOS Safari auto-zoom.
- **Non-Zero Scale Entrances:** Modals, tooltips, and verdict cards must animate in from `scale(0.96)` with opacity 0; never from `scale(0)`.
- **Tactile Feedback:** Interactive buttons compress on `:active` with `transform: scale(0.97)` and respond on `pointerdown`.

---

## Review Focus

1. **Undersized Image Upload:** Uploading an image with resolution below $224 \times 224\text{ px}$ must be caught client-side and display an informative error before calling the backend.
2. **Payload Limit Exceeded:** Files exceeding 10 MB must trigger a client pre-flight rejection with a clear size warning.
3. **Invalid File Type:** Non-JPEG/PNG files must be rejected with helpful user guidance.
4. **Low-Confidence Diagnosis ($< 70\%$):** Inference returning confidence below 0.70 must render an Amber warning disclaimer advising re-sampling before chemical intervention.
5. **Network Outage / ML Service Offline:** If the FastAPI backend is unreachable or times out (30s), render an offline banner with a retry action and provide verified clinical specimen presets for demonstration.

---

## Task Breakdown

### Task 1: Foundations, CSS Tokens, Animation Keyframes & TypeScript Domain Models

**Files:**
- Create: `frontend/src/types/diagnostics.ts`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: Token specifications from `FOUNDATIONS.md` and `AI_Leaf_Diagnostics_Spec.md`.
- Produces: `DiagnosticPrediction`, `DiagnosticState`, `AgronomicAdvisory`, `TopProbability`, and CSS classes `.ag-telemetry-scan-beam`, `.ag-tabular-numeric`, and `--ag-*` theme tokens.

- [x] **Step 1: Define TypeScript domain interfaces in `frontend/src/types/diagnostics.ts`**
  ```typescript
  export type CropSpecies = 'Tomato' | 'Potato' | 'Corn' | 'Apple';
  export type SeverityTier = 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3';
  export type SeverityIndex = 'Healthy' | 'Low' | 'Moderate' | 'Critical';

  export interface TopProbability {
    label: string;
    probability: number;
    displayName: string;
  }

  export interface AgronomicAdvisory {
    immediateAction: string;
    fungicideTreatments: string[];
    environmentalRiskFactors: string;
  }

  export interface DiagnosticPrediction {
    inferenceId: string;
    crop: CropSpecies;
    condition: string;
    scientificName: string;
    confidenceScore: number;
    severityIndex: SeverityIndex;
    severityTier: SeverityTier;
    topProbabilities: TopProbability[];
    agronomicAdvisory: AgronomicAdvisory;
    executionTimeMs: number;
    requiresRescan?: boolean;
    rescanInstructions?: string[];
  }

  export type DiagnosticUIState =
    | 'IDLE'
    | 'DRAG_OVER'
    | 'VALIDATING'
    | 'INFERENCING'
    | 'SUCCESS'
    | 'LOW_CONFIDENCE'
    | 'REJECTED'
    | 'ERROR';
  ```

- [x] **Step 2: Add `--ag-*` CSS tokens, tabular numerals rule, and `@keyframes telemetryScanBeam` to `frontend/src/index.css`**
  - Add light mode semantic variables (`--ag-canvas`, `--ag-surface`, `--ag-border`, `--ag-border-field`, `--ag-ink`, `--ag-brand`, `--ag-scan-beam`, etc.).
  - Add `.ag-tabular-numeric` utility class with `font-variant-numeric: tabular-nums`.
  - Add `@keyframes telemetryScanBeam` and `.ag-telemetry-scan-beam` (Cyan 400 `#38BDF8` line traveling vertically with box-shadow glow).
  - Scope dark landing page styles away from root so default pages render in Light Mode.

- [x] **Step 3: Verification check**
  - Run: `npm run build` in `frontend/`
  - Expected: Clean TypeScript compilation without errors.

- [x] **Step 4: Commit**
  - `git commit -m "feat(diagnostics): add domain models, design tokens and scan beam keyframes"`

- [x] **Step 5: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit `types/diagnostics.ts` and `index.css` against `design/AI_Leaf_Diagnostics_Spec.md` and `design/FOUNDATIONS.md`.
  - Fix any identified issues before moving to Task 2.

---

### Task 2: Client Pre-Flight Validation Utility & Diagnostic Service Layer

**Files:**
- Create: `frontend/src/utils/imageValidation.ts`
- Create: `frontend/src/services/diagnosticsService.ts`
- Create: `frontend/scripts/test_diagnostics_validation.js`

**Interfaces:**
- Consumes: HTML File/Blob inputs, `VITE_ML_URL` environment configuration.
- Produces: `validateLeafImage(file: File): Promise<ValidationResult>`, `classifyLeafImage(file: File, abortSignal?: AbortSignal): Promise<DiagnosticPrediction>`, and verified clinical sample presets.

- [x] **Step 1: Write test script `frontend/scripts/test_diagnostics_validation.js`**
  - Test format validation (rejection of non-JPEG/PNG).
  - Test file size capping (rejection of > 10MB).
  - Test resolution checks (< 224x224 rejected, >= 224x224 accepted).
  - Test clinical sample presets match the 4 target crops (Tomato, Potato, Corn, Apple).

- [x] **Step 2: Run test script to verify failure**
  - Run: `node frontend/scripts/test_diagnostics_validation.js`
  - Expected: FAIL ("modules not found").

- [x] **Step 3: Implement `frontend/src/utils/imageValidation.ts`**
  - Validate MIME types (`image/jpeg`, `image/png`).
  - Validate file size $\le 10\text{ MB}$ ($10 \times 1024 \times 1024$ bytes).
  - Load image in-memory to check natural width and height $\ge 224\text{ px}$.
  - Return typed `{ valid: boolean; error?: string; width?: number; height?: number }`.

- [x] **Step 4: Implement `frontend/src/services/diagnosticsService.ts`**
  - Build `classifyLeafImage(file: File, signal?: AbortSignal)` calling `POST /api/v1/classify-leaf`.
  - Map backend response payload to typed `DiagnosticPrediction` (including 4-tier severity mapping: Healthy $\to$ Tier 0, Low $\to$ Tier 1, Moderate $\to$ Tier 2, Critical/High $\to$ Tier 3).
  - Handle low-confidence $(< 70\%)$ flag `requiresRescan` and map advisory instructions.
  - Implement clinical specimen fallback presets (Tomato Late Blight, Potato Late Blight, Corn Common Rust, Apple Scab) for zero-latency testing and offline defense mode.

- [x] **Step 5: Run test script to verify passing**
  - Run: `node frontend/scripts/test_diagnostics_validation.js`
  - Expected: PASS (all validation and mapper checks pass).

- [x] **Step 6: Commit**
  - `git commit -m "feat(diagnostics): implement image validation and diagnostics API service"`

- [x] **Step 7: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit `imageValidation.ts` and `diagnosticsService.ts` for security, edge cases, and compliance with `SPEC-UI-006`.
  - Address feedback before moving to Task 3.

---

### Task 3: Leaf Image Dropzone & In-Flight Telemetry Scan Viewport

**Files:**
- Create: `frontend/src/components/Diagnostics/LeafImageDropzone.tsx`
- Create: `frontend/src/components/Diagnostics/TelemetryScanBeam.tsx`
- Create: `frontend/src/components/Diagnostics/SamplingBestPracticesCard.tsx`

**Interfaces:**
- Consumes: Drag-and-drop events, file picker events, mobile camera capture, in-flight state.
- Produces: Trigger callbacks `onImageSelected(file: File)`, `onClear()`, `onAbort()`, and rendering of the scanning viewfinder.

- [x] **Step 1: Implement `<TelemetryScanBeam />` in `frontend/src/components/Diagnostics/TelemetryScanBeam.tsx`**
  - Cyan 400 (`#38BDF8`) laser line traveling vertically across leaf preview with infinite alternate animation.
  - Live timer readout ticking in milliseconds with `.ag-tabular-numeric` fixed font.
  - Informative status caption: *"Analyzing foliar cellular structure on ONNX Runtime..."*
  - Prominent "Cancel Scan" button to abort in-flight requests.

- [x] **Step 2: Implement `<SamplingBestPracticesCard />` in `frontend/src/components/Diagnostics/SamplingBestPracticesCard.tsx`**
  - Render field operator tips: single leaf center frame, avoid heavy shadows/motion blur, target active lesions rather than desiccated foliage.
  - High-sunlight light mode styling with `#F8FAFC` background and `#475569` secondary text.

- [x] **Step 3: Implement `<LeafImageDropzone />` in `frontend/src/components/Diagnostics/LeafImageDropzone.tsx`**
  - Idle state: `2px dashed #CBD5E1`, foliar icon, "Upload or Drop Leaf Photo", helper text.
  - Drag-over state: transitions to `2px dashed #0F766E`, `#F0FDFA` background, icon scale `1.08x`.
  - Mobile camera integration: `<input type="file" accept="image/jpeg,image/png" capture="environment" />` with full-width 52px CTA `[ (Camera Icon) Take Leaf Photo ]` on mobile viewports.
  - Active preview state: 1:1 aspect ratio container (`aspect-square`), displaying image preview with centered scan beam during `INFERENCING`.
  - Action buttons: "Upload New Photo", "Retake Photo", and image metadata chip (file name, size, resolution).

- [x] **Step 4: Verification check**
  - Run: `npm run build`
  - Expected: Clean TypeScript compilation.

- [x] **Step 5: Commit**
  - `git commit -m "feat(diagnostics): build leaf dropzone, telemetry scan beam and best practices card"`

- [x] **Step 6: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit dropzone ergonomics, touch targets, and mobile camera integration against `design/MOBILE_AND_OUTDOOR_SPEC.md` and `design/AI_Leaf_Diagnostics_Spec.md`.
  - Address feedback before moving to Task 4.

---

### Task 4: Diagnostic Verdict Card, Probability Bars & Agronomic Advisory

**Files:**
- Create: `frontend/src/components/Diagnostics/DiagnosticVerdictCard.tsx`
- Create: `frontend/src/components/Diagnostics/VerdictSkeletonLoader.tsx`

**Interfaces:**
- Consumes: `DiagnosticPrediction`, `DiagnosticUIState`, `onRetake()`, `onNewScan()`.
- Produces: Dual-coded severity pill (Tier 0-3), tabular confidence score, top-3 animated probability bars, immediate action banner, fungicide recommendations, and environmental risk correlation.

- [x] **Step 1: Implement `<VerdictSkeletonLoader />` in `frontend/src/components/Diagnostics/VerdictSkeletonLoader.tsx`**
  - Render animated pulse skeletons (`bg-slate-100 animate-pulse rounded`) mirroring the verdict card layout to eliminate Cumulative Layout Shift (CLS).

- [x] **Step 2: Implement `<DiagnosticVerdictCard />` in `frontend/src/components/Diagnostics/DiagnosticVerdictCard.tsx`**
  - **Header:** Latency badge (`Geist Mono`, e.g. `64.2 ms`), crop and condition title (`Geist Sans 20px`), scientific Latin nomenclature (`Inter 14px italic`).
  - **Dual-Coded Severity Badge:**
    - Tier 0: Emerald `#ECFDF5` / `#065F46` / `CheckCircle`
    - Tier 1: Amber `#FFFBEB` / `#78350F` / `AlertTriangle`
    - Tier 2: Orange `#FFF7ED` / `#7C2D12` / `AlertCircle`
    - Tier 3: Red `#FEF2F2` / `#7F1D1D` / `OctagonAlert`
  - **Confidence Readout:** `24px` `Geist Mono` Bold with `.ag-tabular-numeric` formatting.
  - **Probability Distribution:** Top-3 predictions with 6px rounded progress track (`#F1F5F9`) and animated `#0F766E` fill (`transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1)`).
  - **Immediate Agronomic Action Banner:** Solid Amber 50 background (`#FFFBEB`), 1px Amber 200 border (`#FDE68A`), bold action text.
  - **Treatment & Environmental Risk Callouts:** Bulleted list of preventative/curative chemical and biological interventions, and ambient risk triggers (humidity/temperature).
  - **Tactile CTAs:** "Upload Another Photo", "Retake Scan", and "Copy Summary" with Emil Kowalski press physics (`scale(0.97)` on active).
  - **Entrance Transition:** Smooth non-zero scale entrance from `scale(0.96)` and opacity 0 to `scale(1.0)` over 200ms.

- [x] **Step 3: Verification check**
  - Run: `npm run build`
  - Expected: Clean compilation.

- [x] **Step 4: Commit**
  - `git commit -m "feat(diagnostics): build diagnostic verdict card and skeleton loader"`

- [x] **Step 5: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit dual-coding compliance, typography contrast ratios, and motion curves against `SPEC-DES-002` and `SPEC-DES-004`.
  - Address feedback before moving to Task 5.

---

### Task 5: Dedicated AI Leaf Diagnostics Page Assembly & Route Integration

**Files:**
- Create: `frontend/src/pages/LeafDiagnosticsPage.tsx`
- Create: `frontend/src/components/Diagnostics/index.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: All diagnostic components, routing from `react-router-dom`.
- Produces: Fully interactive page mounted at `/diagnostics` and `/leaf-scanner`.

- [x] **Step 1: Export all diagnostics components in `frontend/src/components/Diagnostics/index.ts`**

- [x] **Step 2: Assemble `<LeafDiagnosticsPage />` in `frontend/src/pages/LeafDiagnosticsPage.tsx`**
  - Breadcrumbs navigation: `Operations / Agronomy Intelligence / AI Leaf Diagnostics`.
  - Action toolbar: Clinical sample quick-selector pills (Tomato Late Blight, Potato Late Blight, Corn Rust, Apple Scab), Clear button.
  - Dual-panel workbench layout:
    - Left Panel (Cols 1-5 / ~42% width): `<LeafImageDropzone />` + `<SamplingBestPracticesCard />`.
    - Right Panel (Cols 6-12 / ~58% width): Empty state placeholder, `<VerdictSkeletonLoader />` during in-flight, or `<DiagnosticVerdictCard />` on completion.
  - State machine management: Clean transitions across `IDLE`, `DRAG_OVER`, `VALIDATING`, `INFERENCING`, `SUCCESS`, `LOW_CONFIDENCE`, `REJECTED`, and `ERROR`.
  - Toast / notification banner for pre-flight validation errors (file size > 10MB, resolution < 224x224).

- [x] **Step 3: Register `/diagnostics` and `/leaf-scanner` routes in `frontend/src/App.tsx`**
  - Add `<Route path="/diagnostics" element={<LeafDiagnosticsPage />} />`
  - Add `<Route path="/leaf-scanner" element={<LeafDiagnosticsPage />} />`

- [x] **Step 4: Verification check**
  - Run: `npm run build`
  - Expected: Clean Vite build producing production bundles without warnings.

- [x] **Step 5: Commit**
  - `git commit -m "feat(diagnostics): assemble leaf diagnostics page and register routes"`

- [x] **Step 6: Mandatory Subagent Review Gate**
  - Launch `code-reviewer` subagent to audit the integrated page flow, keyboard navigation, responsive layout stacking, and route registration.
  - Address feedback before moving to Task 6.

---

### Task 6: End-to-End Verification, Outdoor Mobile Polish & Documentation

**Files:**
- Modify: `tasks/todo.md`
- Create: `PROJECT_DETAILS/Reports/Phase 1/TODO-111-ai-leaf-diagnostics-page.md`

**Interfaces:**
- Consumes: Completed diagnostics page, build pipeline, test scripts.
- Produces: Verified end-to-end user journeys, mobile touch target verification, and formal DoD completion report.

- [x] **Step 1: Run comprehensive build & lint validation**
  - Run: `npm run build` in `frontend/`
  - Run: `npm run lint` (or `npx oxlint`)
  - Run: `node frontend/scripts/test_diagnostics_validation.js`
  - Expected: 100% passing across all checks.

- [x] **Step 2: Mobile Viewport & High-Sunlight Verification**
  - Verify that mobile viewports ($375\text{px} - 430\text{px}$) stack vertically with:
    - 48px minimum touch targets on all interactive triggers.
    - 16px minimum text input size (no iOS Safari auto-zoom).
    - Clear distinction between dropzone and camera capture.

- [x] **Step 3: Generate Definition of Done (DoD) Completion Report**
  - Record completion report in `PROJECT_DETAILS/Reports/Phase 1/TODO-111-ai-leaf-diagnostics-page.md`.
  - Update `tasks/todo.md` marking all subtasks complete.

- [x] **Step 4: Final Whole-Feature Subagent Code Review**
  - Launch `code-reviewer` subagent for a comprehensive review across all files modified in this feature.
  - Confirm all acceptance criteria from `design/AI_Leaf_Diagnostics_Spec.md` are 100% satisfied.

- [x] **Step 5: Final Commit**
  - `git commit -m "docs(diagnostics): complete AI leaf diagnostics page and add completion report"`

---

## Plan Self-Review Checklist

- [x] **Spec Coverage:** Every requirement in `design/AI_Leaf_Diagnostics_Spec.md` (dropzone, scan beam, timer, dual-coded verdict card, probability bars, immediate action banner, mobile camera, 8 state matrix) maps directly to a task.
- [x] **Subagent Gate Integration:** As requested, every single task explicitly defines a dedicated Subagent Review Step with `code-reviewer`.
- [x] **Light Mode & Design Tokens:** Enforces `#F8FAFC` canvas, `#FFFFFF` containers, `#0F172A` ink, and tabular numerals.
- [x] **Right-Sized Tasks:** Each task touches 2–4 files with explicit interfaces, testable steps, and verification commands.
- [x] **Review Focus Pinned:** All 5 failure modes (undersized, oversized, invalid type, low confidence, offline service) have explicit test steps in the tasks.
