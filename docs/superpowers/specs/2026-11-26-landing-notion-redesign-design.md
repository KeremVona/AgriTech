# Landing Page Redesign (Notion-style) — Design

**Branch:** `feat/ui-revamp-notion` · **Scope:** `/` only · **Date:** 2026-11-26

## Intent

The landing page is read by two audiences: potential users (what does AgriTech do for me?) and the graduation jury (how much does the project cover, and how well is it built?). Both must *understand the project* by the time they reach the bottom.

The page takes notion.com's visual language (calm white page, warm-gray cards, black pill buttons, medium-weight headings, one visual per section followed by three short text columns) and fills it with AgriTech's real features. Notion is the reference for the whole UI revamp; this is step one.

## Goals

- Explain the four product areas in one scroll: field map, leaf diagnostics, disease progression, water dashboard.
- Show the jury *how it works* with two simple diagrams: photo → treatment plan, and weather/sensors/crop → water balance → valve.
- Reserve a hero frame for the future product introduction video (placeholder for now).
- Establish shared `ui-*` design tokens that later page redesigns reuse.

## Non-goals

- Redesigning any other route (they keep their current look until their turn).
- Producing the product video.
- Changing backend, ML or routing behaviour.

## Anti-goals (failure even if it "works")

- Claims the project can't back up: invented metrics, partner logos, fake runtime numbers, customer quotes.
- A dark/neon "AI startup" look — the direction is calm and readable.
- Heavy motion or a 15 MB video download on first visit.

## Decisions (agreed in chat)

| Section | Content | Replaces (Notion) |
|---|---|---|
| Nav | Leaf logo · Features / How it works / Crops anchors · "Open app" pill → `/map` | Notion nav |
| 1. Hero | Headline "Know what your field needs, before it shows.", one-line pitch, CTAs "Open the field map" (black) + "Scan a leaf" (warm gray), 16:9 video placeholder | Hero + product video |
| 2. Features | "One workspace for the whole field." 2×2 warm cards, each with a stylised in-code preview and a link | "Notion knows what your agents don't" |
| 3. Diagnosis flow | "From one photo to a treatment plan." Leaf photo → Plant ML model → AI advice (Gemini, cached) → Action today; 3 text columns | "All your context" diagram |
| 4. Irrigation flow | "Water only when the soil asks." Weather (Open-Meteo) + soil sensors (simulated) + crop stage (FAO-56 Kc) → water balance engine → valve; 3 text columns | second diagram |
| 5. Crops | "Seven crops, one photo away." Horizontal strip of 7 crop cards with real disease names from `ml-service` | customer carousel |
| 6. Closing CTA | "Start with your first field." + same two CTAs | closing CTA |
| Footer | Logo + one-line project note · Product / How it works / Project columns | Notion footer |

**Removed:** dark background video (`public/background_video.mp4`, 14.8 MB) and its policy/test, Codex-style navbar, partner logos, emoji icons, the old footer's "System Runtime" numbers and dead `#` links.

## Builder's calls (made without the user — check these)

- **Tokens:** new `ui-*` colours in `index.css` `@theme` — `ui-bg #FFFFFF`, `ui-warm #F6F5F4`, `ui-warm-strong #EDEBE8`, `ui-line`, `ui-ink #191918`, `ui-ink-2 #5F5E5B`, `ui-ink-3 #6F6E69`, accent = existing brand teal `#0F766E` (`ui-accent`, `ui-accent-soft`). Font `--font-ui` = Inter (already loaded; Geist isn't actually loaded by `index.html`). Existing `ag-*` tokens untouched.
- **Previews are illustrations, not screenshots**, because the pages they show are about to be redesigned. They carry no numbers that could read as measured results; they're `aria-hidden`.
- **Crop images:** the healthy-leaf `.webp` from `public/progression-experimental/` for apple, corn, grape, potato, tomato (hover crossfades to the severe stage). Rice and cassava have no photo → a drawn SVG leaf.
- **Water dashboard link** goes to the demo parcel `20700000-0000-4000-8000-000000000001`, which works in sample mode and falls back gracefully in auto mode.
- **Motion:** sections fade/slide in once on scroll (IntersectionObserver); disabled under `prefers-reduced-motion`, and content is visible if the observer is unavailable.
- **Logo:** small SVG leaf mark in a rounded square, also used as the new favicon (replacing Vite's default purple bolt).
- **Honest copy:** soil sensors are labelled "simulated"; diagnosis copy mentions rescans for low-confidence photos (true: `requiresRescan`).

## Constraints

React 19 + TS 6 (`erasableSyntaxOnly`), Tailwind 4, react-router 7, no new dependencies. Must pass `npm run lint`, `npm run build`, `npm test`. Works at 375 px with no horizontal page scroll. AA contrast for text.

## Implementation outline

1. Tokens + `.ui-page` heading font + reveal CSS in `src/index.css`.
2. `src/components/Landing/`: `landingContent.ts` (all copy, links, crops — pure data), `LandingNav`, `LandingHero` (+ `VideoPlaceholder`), `FeatureGrid` + `FeaturePreviews`, `FlowDiagram` (shared by sections 3 and 4), `CropStrip`, `ClosingCta`, `LandingFooter`, `Reveal`, `LeafMark`.
3. Rewrite `src/pages/LandingPage.tsx` to compose them.
4. Delete `components/LandingHero/*`, `utils/backgroundVideoPolicy.ts`, `scripts/test_landing_video.js`, `public/background_video.mp4`; replace favicon.
5. `scripts/test_landing_content.js` (wired to `test:landing`): every internal link resolves to a real route, every referenced image exists, 7 crops, no `#`-only links.
6. Verify in the browser at desktop and 375 px.
