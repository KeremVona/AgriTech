# AI Leaf Diagnostics: UX & Visual Specification
**System Designation:** "Precision Ag-Intelligence"  
**Page Module:** AI Foliar Pathology & Vision Diagnostics  
**Route:** `/diagnostics` | `/leaf-scanner`  
**Document Code:** `SPEC-UI-006`  
**Status:** PRODUCTION READY SPECIFICATION (FOCUSED SCOPE)  

---

## 1. Executive Summary & Page Purpose

The **AI Leaf Diagnostics** page is a focused, high-precision foliar pathology inspection tool. Its sole job is to ingest a photo of an agricultural plant leaf (via direct mobile camera capture or desktop file upload), execute the deep learning computer vision pipeline (ONNX runtime / FastAPI `/api/v1/classify-leaf`), and present an immediate diagnostic verdict with confidence metrics, severity ratings, and actionable agronomic advisories.

### Scope Boundaries
* **In Scope:**
  * Leaf photo ingestion (drag-and-drop dropzone, desktop file picker, and native mobile camera capture).
  * Client-side validation (file size, MIME type check, resolution sanity).
  * In-flight machine learning inference state with scanning telemetry indicators.
  * Comprehensive diagnostic verdict card: predicted crop and disease condition, scientific Latin nomenclature, confidence score percentage, top-3 class probability distribution, 4-tier agronomic severity rating, and detailed chemical/organic treatment advisories.
  * Full responsive adaptation for desktop workstations and outdoor mobile PWA use.
* **Explicitly Out of Scope:**
  * Interactive Disease Progression Slider Engine (separated into dedicated agronomic modeling modules).
  * GIS Maps, spatial polygon overlays, and DBSCAN outbreak cluster layers (separated into the main GIS Map Dashboard).

---

## 2. Page Architecture & Layout Hierarchy

By focusing exclusively on the diagnostic pipeline, the interface eliminates cognitive clutter and directs full attention to the foliar sample and the resulting machine learning verdict.

### 2.1 Desktop Viewport Wireframe ($\ge 1024\text{px}$)

* **Grid Configuration:** 12-column baseline grid with 24px gutters, max-width `1280px` centered.
* **Layout Structure (Dual-Panel Workbench):**
  * **Left Panel (5 Columns / ~42% width):** Leaf Image Viewport & Ingestion Dropzone.
  * **Right Panel (7 Columns / ~58% width):** Diagnostic Verdict, Probability Distribution, and Agronomic Advisory Card.

```
+-------------------------------------------------------------------------------------------------------------------+
| BREADCRUMBS: Operations / Agronomy Intelligence / AI Leaf Diagnostics                         [ CLEAR ] [ EXPORT ]|
+-------------------------------------------------------------------------------------------------------------------+
| LEFT PANEL (COLS 1-5): INGESTION & VIEWPORT       | RIGHT PANEL (COLS 6-12): DIAGNOSTIC VERDICT CARD              |
|                                                   |                                                               |
| +-----------------------------------------------+ | +-----------------------------------------------------------+ |
| | [ LEAF PHOTO VIEWPORT / DROPZONE ]            | | | [!] DIAGNOSTIC VERDICT               LATENCY: 64.2 ms     | |
| |                                               | | |                                                           | |
| |  +-----------------------------------------+  | | | Tomato - Late Blight         [ TIER 3: CRITICAL ALERT ]   | |
| |  | [Captured / Uploaded Leaf Preview]      |  | | | Scientific: Phytophthora infestans   Confidence: 96.42%   | |
| |  |                                         |  | | +-----------------------------------------------------------+ |
| |  | (Telemetry Laser Scan Line in-flight)   |  | | | TOP PROBABILITIES (CNN CLASSIFICATION)                    | |
| |  |                                         |  | | Late Blight  96.4% [==================================]     | |
| |  +-----------------------------------------+  | | | Early Blight  2.8% [=                                 ]     | |
| |                                               | | | Healthy       0.8% [                                  ]     | |
| | File: IMG_9421.JPG | 3.4 MB | 2048x1536       | | +-----------------------------------------------------------+ |
| |                                               | | | AGRONOMIC INTERVENTION & ADVISORY                         | |
| | [ UPLOAD NEW PHOTO ]     [ RETAKE PHOTO ]     | | |                                                           | |
| |                                               | | | (!) IMMEDIATE ACTION:                                     | |
| +-----------------------------------------------+ | | Discontinue overhead irrigation immediately. High canopy  | |
|                                                   | | moisture accelerates spore germination.                   | |
| [ SAMPLING BEST PRACTICES CARD ]                  | |                                                           | |
| - Ensure single leaf fills center frame           | | RECOMMENDED FUNGICIDE TREATMENTS:                         | |
| - Avoid heavy shadows or blurred edges            | | [ Copper Hydroxide (Preventative) ]                       | |
| - Target active lesions, not dried dead foliage   | | [ Mancozeb / Chlorothalonil (Curative) ]                  | |
|                                                   | +-----------------------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------------------+
```

---

### 2.2 Mobile Viewport Wireframe ($375\text{px} - 430\text{px}$)

On mobile devices, the interface stacks into an intuitive vertical pipeline tailored for one-handed outdoor field operation.

```
+------------------------------------+
| [<-] AI Leaf Diagnostics        (o)|
| Field Scanner | 4 Target Crops     |
+------------------------------------+
|                                    |
| [ CAMERA CAPTURE / VIEWFINDER ]    |
| Fixed 1:1 Aspect Ratio             |
|                                    |
|     ┌──                        ──┐ |
|         ALIGN SINGLE LEAF HERE     |
|     └──                        ──┘ |
|                                    |
| [ TAKE PHOTO ] [ CHOOSE FROM ALBUM]|
|                                    |
+------------------------------------+
|                                    |
| [!] TOMATO LATE BLIGHT       96.4% |
| Scientific: Phytophthora infestans |
| Severity: CRITICAL [TIER 3]        |
|                                    |
| [!] IMMEDIATE ACTION:              |
| Restrict overhead irrigation.      |
| Spore germination risk is HIGH.    |
|                                    |
| Top Probabilities:                 |
| - Late Blight:              96.4%  |
| - Early Blight:              2.8%  |
| - Healthy:                   0.8%  |
|                                    |
| Recommended Fungicides:            |
| - Copper Hydroxide (2.5 kg/ha)     |
| - Mancozeb 75 WG preventative      |
|                                    |
| [ RETAKE SCAN ] [ SHARE DIAGNOSIS ]|
|                                    |
+------------------------------------+
```

---

## 3. Core Feature Workflows & UX Specifications

### 3.1 Leaf Image Ingestion & Pre-flight Validation

The ingestion component serves both high-resolution desktop uploads and fast in-field mobile captures.

```
[ User Action: Capture / Drop Photo ]
       │
       ├── 1. Client-Side Pre-Flight Checks
       │      ├── Format validation (image/jpeg, image/png only)
       │      ├── Payload size limiter (Max 10 MB)
       │      └── Resolution sanity check (>= 224 x 224 px)
       │
       ├── 2. Preview Generation (Instant object URL display)
       │
       ├── 3. Multipart Request Dispatch: POST /api/v1/classify-leaf
       │
       └── 4. State Machine Transition -> 'INFERENCE_IN_FLIGHT'
```

#### Dropzone Component Specifications (`<LeafImageDropzone />`)
* **Idle State:**
  * Background: Pure white `#FFFFFF`.
  * Border: `2px dashed #CBD5E1` (Slate 300).
  * Padding: `32px` vertical, `24px` horizontal.
  * Border Radius: `12px`.
  * Visual Elements: Centered foliar leaf outline icon (`w-12 h-12 text-slate-400`), prominent primary action button (*"Upload Leaf Photo"*), and helper caption (*"JPEG or PNG up to 10MB"*).
* **Drag-Over / Active Hover State:**
  * Border: Transitions to `2px dashed #0F766E` (Bio-Teal 700).
  * Surface Tint: Subtly shifts to `rgba(240, 253, 250, 0.8)` (`#F0FDFA`).
  * Icon Transition: Scales smoothly by `1.08x` with a `150ms ease-out` curve.
* **Direct Mobile Camera Integration:**
  * Utilizes native HTML5 file capture targeting the device's rear environment camera:
    ```html
    <input 
      type="file" 
      accept="image/jpeg,image/png" 
      capture="environment" 
      id="leaf-camera-input" 
      class="sr-only" 
    />
    ```
  * On mobile viewports, the primary CTA is a full-width 52px button: `[ (Camera Icon) Take Leaf Photo ]`.

---

### 3.2 In-Flight Machine Learning Inference State

While the FastAPI backend executes the ONNX MobileNetV3/EfficientNet-B0 model ($< 100\text{ ms}$ server-side latency), the interface provides clear visual feedback that machine intelligence is at work.

```
+-----------------------------------------------------------------------------------+
|  [ IN-FLIGHT INFERENCE PREVIEW ]                                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |  [ Leaf Specimen Image ]                                                    |  |
|  |                                                                             |  |
|  |  ------------------------- TELEMETRY SCAN BEAM ---------------------------- |  |
|  |  (Cyan horizontal line traveling vertically across leaf surface)            |  |
|  |                                                                             |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  Status: Analyzing foliar cellular structure on ONNX Runtime...                   |
|  Timer: 00:00:48 ms [TABULAR NUMS]                                                 |
+-----------------------------------------------------------------------------------+
```

#### Scan Beam Animation Specification
```css
@keyframes telemetryScanBeam {
  0% {
    top: 0%;
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0.9;
  }
}

.ag-telemetry-scan-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #38BDF8; /* Cyan 400 */
  box-shadow: 0 0 12px 2px rgba(56, 189, 248, 0.75);
  animation: telemetryScanBeam 1.6s ease-in-out infinite alternate;
  pointer-events: none;
}
```

* **Right Panel Skeleton:** The verdict card renders shimmering skeleton placeholders (`bg-slate-100 animate-pulse rounded`) across the title, confidence bar, and advisory sections during inference, preventing cumulative layout shifts (CLS).

---

### 3.3 Diagnostic Verdict & Severity Card (`<DiagnosticVerdictCard />`)

Upon successful classification, the verdict card renders the complete agronomic intelligence payload received from the FastAPI endpoint:

```json
{
  "inference_id": "c7a9b1c2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
  "prediction": {
    "crop": "Tomato",
    "condition": "Late Blight",
    "scientific_name": "Phytophthora infestans",
    "confidence_score": 0.9642,
    "severity_index": "High"
  },
  "top_probabilities": [
    { "label": "Tomato___Late_blight", "probability": 0.9642 },
    { "label": "Tomato___Early_blight", "probability": 0.0281 },
    { "label": "Tomato___healthy", "probability": 0.0077 }
  ],
  "agronomic_advisory": {
    "immediate_action": "Isolate affected perimeter; restrict overhead irrigation to reduce foliage moisture duration.",
    "fungicide_treatments": [
      "Copper-based preventative spray (Copper Hydroxide)",
      "Mancozeb or Chlorothalonil application before rain events"
    ],
    "environmental_risk_factors": "High humidity (>90%) with moderate temperatures (15°C to 22°C)."
  },
  "execution_time_ms": 64.2
}
```

```
+-----------------------------------------------------------------------------------+
|  DIAGNOSTIC VERDICT                                           LATENCY: 64.2 ms    |
|                                                                                   |
|  Tomato - Late Blight                             [ TIER 3: CRITICAL ALERT ]      |
|  Scientific: Phytophthora infestans               Confidence: 96.42%              |
+-----------------------------------------------------------------------------------+
|  PROBABILITY DISTRIBUTION (TOP 3 CLASSIFICATIONS)                                 |
|                                                                                   |
|  Late Blight (Phytophthora infestans)  96.4% [==============================]      |
|  Early Blight (Alternaria solani)       2.8% [=                             ]      |
|  Healthy Foliage                        0.8% [                              ]      |
+-----------------------------------------------------------------------------------+
|  AGRONOMIC ADVISORY & INTERVENTION                                                |
|                                                                                   |
|  (!) IMMEDIATE CROP ACTION:                                                       |
|  Isolate affected perimeter immediately. Restrict overhead sprinkler irrigation    |
|  to reduce canopy wetness duration and slow fungal spore dispersal.               |
|                                                                                   |
|  RECOMMENDED CHEMICAL & BIOLOGICAL TREATMENTS:                                    |
|  * Copper Hydroxide (Preventative contact application)                            |
|  * Mancozeb or Chlorothalonil application prior to forecasted rain events         |
|                                                                                   |
|  ENVIRONMENTAL RISK CORRELATION:                                                  |
|  Optimal pathogen pressure occurs under high relative humidity (>90%) with       |
|  temperatures between 15°C and 22°C.                                              |
+-----------------------------------------------------------------------------------+
```

#### Visual Styling Specifications
* **Container:** `#FFFFFF` background, `1px solid #E2E8F0` border, `shadow-xs`, 8px radii.
* **Crop & Condition Title:** `20px` / `1.25rem` `Geist Sans`, SemiBold 600, color `#0F172A`.
* **Scientific Binomial Taxonomy:** `14px` italicized `Inter`, Regular 400, color `#475569`.
* **Confidence Readout:** `24px` `Geist Mono` Bold 700 with fixed tabular numerals (`font-variant-numeric: tabular-nums`), color `#0F172A`.
* **Severity Pill (Dual-Coded):**
  * **Tier 0 (Healthy):** `#ECFDF5` background, `#065F46` text, `#A7F3D0` border, `CheckCircle` icon.
  * **Tier 1 (Early / Low):** `#FFFBEB` background, `#78350F` text, `#FDE68A` border, `AlertTriangle` icon.
  * **Tier 2 (Moderate):** `#FFF7ED` background, `#7C2D12` text, `#FDBA74` border, `AlertCircle` icon.
  * **Tier 3 (Critical / Blight):** `#FEF2F2` background, `#7F1D1D` text, `#FCA5A5` border, `OctagonAlert` icon.
* **Top-3 Probability Progress Bars:**
  * Track: Height `6px`, background `#F1F5F9`, border radius `9999px`.
  * Active Fill: `#0F766E` (Bio-Teal 700) with a smooth transition (`transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1)`).
* **Immediate Action Banner:**
  * Background: `#FFFBEB` (Amber 50).
  * Border: `1px solid #FDE68A` (Amber 200).
  * Padding: `14px 16px`.
  * Typography: Body Regular 14px, line-height 1.5, color `#78350F`.

---

## 4. Design System & Token Application

This page adheres strictly to the **"Precision Ag-Intelligence"** design tokens.

### 4.1 Color Token Mapping

| UI Element | Token Name | Hex Code | Purpose & Function |
| :--- | :--- | :--- | :--- |
| **Page Ground** | `--ag-canvas` | `#F8FAFC` | Base page canvas; soft Slate 50 eliminates glare. |
| **Containers & Cards** | `--ag-surface` | `#FFFFFF` | Pure white container cards for high micro-contrast. |
| **Standard Borders** | `--ag-border` | `#E2E8F0` | Hairline 1px borders defining desktop layout cards. |
| **Field Mobile Borders**| `--ag-border-field` | `#9CA3AF` | Reinforced 1.5px borders for mobile outdoor viewports. |
| **Primary Typography** | `--ag-ink` | `#0F172A` | Slate 900 for headings, condition labels, and metrics ($15.8:1$ contrast). |
| **Secondary Metadata** | `--ag-ink-secondary`| `#475569` | Slate 600 for scientific names, file metadata, and units. |
| **Primary Brand Accent**| `--ag-brand` | `#0F766E` | Bio-Teal 700 for primary action buttons and confidence bars. |
| **Primary Brand Hover** | `--ag-brand-hover` | `#115E59` | Bio-Teal 800 for active hover and press feedback. |
| **Scan Beam Indicator** | `--ag-scan-beam` | `#38BDF8` | Cyan 400 for live in-flight ML scanning beam animation. |
| **Tier 0 Badge (Healthy)**| `--ag-risk-healthy` | `#059669` | Emerald 700 text on `#ECFDF5` background. |
| **Tier 1 Badge (Low)** | `--ag-risk-low` | `#D97706` | Amber 600 text on `#FFFBEB` background. |
| **Tier 2 Badge (Moderate)**|`--ag-risk-moderate`| `#EA580C` | Orange 600 text on `#FFF7ED` background. |
| **Tier 3 Badge (Critical)**|`--ag-risk-critical`| `#DC2626` | Red 600 text on `#FEF2F2` background. |

---

### 4.2 Typography Hierarchy

* **Page Title:** `Geist Sans`, 24px / 1.5rem, Bold 700, tracking `-0.025em`, color `#0F172A`.
* **Diagnostic Disease Title:** `Geist Sans`, 20px / 1.25rem, SemiBold 600, tracking `-0.020em`, color `#0F172A`.
* **Scientific Nomenclature:** `Inter`, 14px / 0.875rem, Italic Regular 400, color `#475569`.
* **Numeric Confidence Readout:** `Geist Mono`, 24px / 1.5rem, Bold 700, `font-variant-numeric: tabular-nums`, color `#0F172A`.
* **Execution Latency Badge:** `Geist Mono`, 12px / 0.75rem, Regular 400, `tabular-nums`, color `#64748B`.
* **Body / Advisory Prose:** `Inter`, 14px / 0.875rem, Regular 400, line-height 1.55, color `#334155`.

---

### 4.3 Tactile Interaction Details (Emil Kowalski & Apple WWDC)

* **Button Press Feedback:** All interactive buttons compress on `:active` (`transform: scale(0.97)` via `100ms ease-out`).
* **Non-Zero Scale Entrances:** When the diagnostic verdict arrives, the card animates in from `scale(0.96)` and `opacity: 0` to `scale(1.0)` and `opacity: 1` over `200ms ease-out`. It never pops into view from `scale(0)`.
* **Direct Touch Response:** All interactive triggers respond immediately on `pointerdown` rather than waiting for touch-up.

---

## 5. Component State Matrix

The AI Leaf Diagnostics interface accounts for all edge cases across eight operational states:

| State Key | Viewport Presentation | Interactive Controls | Feedback Messaging & User Guidance |
| :--- | :--- | :--- | :--- |
| **1. Default / Empty State** | Clean dropzone with dashed border and foliar icon; right panel displays empty state illustration and sampling tips card. | *"Upload Leaf Photo"* active; mobile camera trigger ready. | *"Select or photograph a single plant leaf to run deep learning foliar diagnostics."* |
| **2. Drag-and-Drop Active Hover** | Dropzone border shifts to solid `#0F766E`; surface glows `#F0FDFA`; leaf icon lifts by 4px. | Pointer capture active; drag events trapped. | *"Release image file to start diagnostic scan."* |
| **3. Client Pre-flight Validation** | Dropzone displays thumbnail preview with a subtle corner spinner. | Actions locked; file format and resolution verified in-memory. | *"Checking image resolution and validating MIME format..."* |
| **4. ML Inference In-Flight** | Telemetry laser scan beam moves vertically across leaf preview; right panel displays shimmering skeleton loaders. | Form controls locked; abort button enabled; timer ticks in `Geist Mono`. | *"Executing CNN inference on ONNX Runtime..."* |
| **5. Diagnosis Success (High Confidence)** | Full verdict card rendered; confidence score displayed; top-3 probability bars populated; agronomic advisory visible. | *"Upload Another Photo"* and *"Retake Photo"* CTAs active; copy/export buttons ready. | *"Diagnosis confirmed: Tomato Late Blight (96.4% confidence)."* |
| **6. Low-Confidence Warning ($< 70\%$)** | Verdict card displays Amber warning badge; top-3 probabilities render with close percentages. | Amber disclaimer advises against immediate chemical application; *"Retake Photo"* highlighted. | *"Low confidence diagnosis (58.2%). Poor lighting or obscured foliage detected. Re-sampling recommended."* |
| **7. Out-of-Domain / Non-Leaf Reject** | Dropzone border turns red `#FCA5A5`; leaf preview displays error overlay badge. | Diagnosis blocked; clear rejection explanation; *"Try Again"* button active. | *"Unidentifiable or non-leaf image. Please photograph a single leaf from Tomato, Potato, Corn, or Apple."* |
| **8. Network / Server Offline** | Status pill shifts to Amber; retry banner appears over the dropzone. | *"Retry Upload"* button active; cached client queue stores the photo. | *"Diagnostic service currently unreachable. Check network connectivity and retry."* |

---

## 6. Implementation Reference Contract (React Component)

For engineering teams implementing this focused specification in React and Tailwind CSS:

```tsx
import React, { useState } from 'react';

export interface DiagnosticPrediction {
  inferenceId: string;
  crop: 'Tomato' | 'Potato' | 'Corn' | 'Apple';
  condition: string;
  scientificName: string;
  confidenceScore: number;
  severityIndex: 'Healthy' | 'Low' | 'Moderate' | 'Critical';
  topProbabilities: Array<{ label: string; probability: number }>;
  agronomicAdvisory: {
    immediateAction: string;
    fungicideTreatments: string[];
    environmentalRiskFactors: string;
  };
  executionTimeMs: number;
}

export function AILeafDiagnostics() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isInferencing, setIsInferencing] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<DiagnosticPrediction | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      // Initiate inference pipeline...
    }
  };

  return (
    <div className="min-h-screen bg-ag-canvas p-4 md:p-8 font-sans">
      {/* Page Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <nav className="text-xs text-ag-ink-secondary mb-1">
          Operations / Agronomy Intelligence / <span className="text-ag-ink font-medium">AI Leaf Diagnostics</span>
        </nav>
        <h1 className="text-2xl font-bold text-ag-ink tracking-tight">AI Foliar Pathology Diagnostics</h1>
      </div>

      {/* Focused 2-Column Responsive Workbench */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Ingestion & Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-ag-surface border border-ag-border rounded-lg p-6 shadow-xs relative overflow-hidden">
            {!selectedImage ? (
              <label 
                htmlFor="leaf-upload" 
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-ag-brand hover:bg-ag-brand-subtle/50 transition-colors"
              >
                <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-semibold text-ag-ink">Upload or Drop Leaf Photo</span>
                <span className="text-xs text-ag-ink-secondary mt-1">Supports JPEG, PNG up to 10MB</span>
                <input 
                  id="leaf-upload" 
                  type="file" 
                  accept="image/jpeg,image/png" 
                  capture="environment" 
                  className="sr-only" 
                  onChange={handleFileUpload} 
                />
              </label>
            ) : (
              <div className="relative aspect-square rounded-lg overflow-hidden border border-ag-border bg-slate-950">
                <img src={selectedImage} alt="Leaf Specimen" className="w-full h-full object-cover" />
                {isInferencing && <div className="ag-telemetry-scan-beam" />}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Diagnostic Verdict & Advisory (7 Cols) */}
        <div className="lg:col-span-7">
          {verdict ? (
            <div className="bg-ag-surface border border-ag-border rounded-lg p-6 shadow-xs space-y-6">
              {/* Verdict Header */}
              <div className="flex items-start justify-between border-b border-ag-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-ag-ink">{verdict.crop} — {verdict.condition}</h2>
                  <p className="text-sm italic text-ag-ink-secondary">{verdict.scientificName}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-ag-ink">
                    {(verdict.confidenceScore * 100).toFixed(1)}%
                  </span>
                  <p className="text-xs font-mono text-ag-ink-secondary">{verdict.executionTimeMs} ms</p>
                </div>
              </div>

              {/* Top Probabilities */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-ag-ink-secondary uppercase tracking-wider">Top Classifications</h3>
                {verdict.topProbabilities.map((prob) => (
                  <div key={prob.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-ag-ink">{prob.label}</span>
                      <span className="text-ag-ink-secondary">{(prob.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-ag-brand rounded-full transition-all duration-500" 
                        style={{ width: `${prob.probability * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Agronomic Advisory */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs space-y-2">
                <p className="font-semibold text-amber-900">Immediate Agronomic Action:</p>
                <p className="text-amber-800 leading-relaxed">{verdict.agronomicAdvisory.immediateAction}</p>
              </div>
            </div>
          ) : (
            <div className="bg-ag-surface border border-ag-border rounded-lg p-8 shadow-xs text-center text-ag-ink-secondary">
              <p className="text-sm">No leaf image loaded. Upload or capture a leaf to view machine learning diagnosis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```
