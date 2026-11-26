# AI Leaf Diagnostics — Notion-style redesign

Date: 2026-11-26 · Route: `/diagnostics` (alias `/leaf-scanner`) · Branch: `feat/ui-revamp-diagnostics`

## Intent

Second step of the UI revamp after `/`. The page must feel like the same product as the new landing page
(Notion reference: white canvas, warm grey panels, Inter, quiet borders, one accent). The user asked for a page that is
**infographic but very simple to use and not drowning in text**. Audience: farmers trying the tool and the graduation jury.

## Goals

- One obvious action: drop or take a photo of one leaf.
- A visible "try a sample" path so the page works without the ML service (jury demo).
- A result that reads at a glance: what it is, how sure, how bad, what to do today.
- Keep every existing behaviour: validation, inference, abort, retry, low-confidence rescan, sample presets, copy summary.

## Non-goals

- No change to services, types, validation or the ML contract (`diagnosticsService.ts`, `imageValidation.ts`).
- No new data (no history, no saving scans).
- Other pages keep their current look for now.

## Anti-goals

- Jargon walls ("cellular pathology", "neural feature extraction", "WCAG AAA hardened", fake version strings).
- Emoji as UI icons, HUD/sci-fi scanning visuals, more than one primary button on screen.

## Layout

1. **Top bar** (new shared `AppHeader`): leaf logo → `/`, links Field map · Leaf diagnostics (current) · Disease progression.
2. **Title**: "Scan a leaf" + one line: "Upload a photo of one leaf. See the disease and what to do today."
3. **Three-step strip** (infographic, icons + 2–3 words each): Photo → Diagnosis → Action today.
4. **Workbench** (two columns from `lg`, stacked below):
   - Left: dropzone on a warm panel (dashed border, leaf icon, "Take photo" primary + "Choose file"),
     then four photo tips as icon tiles (one short line each). With a photo: the image, a calm scanning overlay
     (spinner, "Reading the leaf…", Cancel), file chip, "Use another photo".
   - Right: idle → **sample tiles** with the real leaf images (tomato, potato, corn, apple);
     scanning → skeleton of the result; result → result card.
5. **Result card**: crop + condition (+ scientific name), severity pill (colour + icon + plain word:
   Healthy / Watch / Act soon / Urgent), confidence ring, top-3 match bars, "Do today" highlight,
   treatments and risk factors side by side, advice source, actions (Scan another · Copy summary).
   Low confidence → amber "Retake the photo" block with the rescan tips instead of "Do today".
6. Errors: soft red notice under the photo with Retry for service errors.

## Calls made by the builder (user was away)

- Severity words replace "Tier N" labels in the UI; the tier stays in the copied summary.
- Latency, inference ID and file dimensions are dropped from the visible UI (noise for farmers); file name + size stay.
- The sampling-tips card becomes four icon tiles; the 224 px minimum is still enforced and shown in the error message.
- The scan beam/HUD is replaced with a calm overlay; elapsed timer removed.
- Reuses `ag-risk-*` colour tokens for severity, `ui-*` tokens for everything else.
