# Disease Progression — Notion-style redesign

Date: 2026-11-26 · Route: `/disease-progression` · Branch: `feat/ui-revamp-progression`

## Intent

Third step of the UI revamp, after `/` and `/diagnostics`. Same direction: Notion reference, infographic, simple to use,
little text. The page shows how a leaf disease develops over days and how weather and treatment change that.

## Goals

- One clear interaction: pick a crop, drag (or play) the timeline, watch the leaf change.
- The state at a glance: stage, day, severity — as numbers and a stage bar, not paragraphs.
- Advanced tools (weather, treatment what-if, model view modes, exports) stay, but sit behind tabs and quiet controls.
- Keep all behaviour: WebGL renderer + 2D fallback, compare-with-healthy, split curtain, view modes, hotspots,
  treatment branching, timelapse/PNG/PDF exports, keyboard tab navigation.

## Non-goals

- No change to models, hooks, shader renderer, export utilities or data.
- The printable PDF report modal keeps its own document styling.

## Anti-goals

- Spec IDs, "60 FPS WebGL", "Zero GPU context leaks", citations and formula paragraphs in the UI.
- Emoji as icons, mono badges, ALL-CAPS labels.

## Layout

1. Shared `AppHeader` (from the diagnostics redesign).
2. Title "Watch a disease grow" + one line.
3. Crop picker: pills with the healthy-leaf thumbnail, crop name and disease (keeps the tablist keyboard behaviour).
4. Studio (two columns from `lg`):
   - Left: leaf on a warm panel with Day / severity chip; quiet segmented control (Photo · Heatmap · Changes),
     compare and split toggles; timeline with play button, slider and three stage markers.
   - Right: "Right now" summary (stage, day, severity), then tabs: Weather · Treatment · Export · Model.
5. "How it works" — three short columns.

## Builder's calls

- The duplicated quick-action dock under the leaf is removed; exports live in the Export tab.
- Default tab is Weather (most useful to a farmer); the model/attention inspector moves to the last tab.
- `test_production_assembly.js` light-canvas check also accepts the `ui-page` wrapper.
