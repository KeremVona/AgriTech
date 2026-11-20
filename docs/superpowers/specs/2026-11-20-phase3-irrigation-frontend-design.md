# Phase 3 Frontend — Parcel Water Dashboard (TODO-307 / 308 / 309) Design

**Date:** 2026-11-20
**Branch:** `feat/phase3-irrigation-frontend` (local only, cut from `main` @ `b147b13`; do not push until told)
**Owner:** Frontend (no backend code is touched on this branch)
**Sources:** `PROJECT_DETAILS/Phase Plans/Phase 3.md` (Track C), `PROJECT_DETAILS/Design/COMPONENTS.md` §1.2, §3, `PROJECT_DETAILS/Design/FOUNDATIONS.md`, `PROJECT_DETAILS/Design/MOTION_AND_INTERACTION.md`, `PROJECT_DETAILS/Database Design/COMPLETE_DATABASE_SCHEMA.md` Modules 5–6.

Items marked **(my call)** were decided by the planner, not the user; they are open to change during review.

---

## 1. Intent

Phase 3 makes the platform water parcels automatically: weather comes in from Open-Meteo, the FAO-56 engine tracks root-zone depletion, virtual soil probes stream moisture over MQTT, and the backend opens valves when depletion reaches the Readily Available Water (RAW) limit. None of that is visible to a farm operator until the frontend shows it.

The frontend's job (Track C) is one screen per parcel that answers three operator questions at a glance:

1. **"How wet is this parcel, and where is it heading?"** — time-series chart (TODO-307).
2. **"Is it about to need water?"** — depletion gauge with hours until the automatic trigger (TODO-309).
3. **"Is the valve running, and can I override it?"** — valve status and manual control (TODO-308).

### Current state (2026-11-20)

- Phase 1 and Phase 2 are complete on `main`. The disease-advisory work lives on `feat/llm-disease-advisory` (not merged); this branch does not depend on it.
- The DB already has `sensor_telemetry`, `weather_cache`, `irrigation_events`, `soil_profiles` (with `mad_threshold_pct`) and `parcels.system_flow_rate_lpm` / `irrigation_efficiency`.
- **No Phase 3 backend services or HTTP endpoints exist yet** (TODO-301 to 306 not started). Only `POST /api/v1/parcels/{id}/irrigate-manual` is named in the phase plan.
- The frontend has no chart library. Design tokens `--color-ag-telemetry-vwc`, `--color-ag-valve-active`, `--color-ag-valve-idle` and the 4-tier severity ramp already exist in `frontend/src/index.css`.

Because the backend is not built, the frontend **defines a proposed API contract** (§6) for the backend teammate and ships a **deterministic sample-data mode** so the screen works and can be demoed before the backend lands.

## 2. Goals

- G1. `<ParcelTelemetryChart parcelId>` — dual-axis chart: soil moisture (VWC %) line on the left axis with saturation / field-capacity / MAD reference bands; stacked effective-rain and irrigation bars (mm) on the right axis; 24 h / 7 d / 30 d window toggle; hover tooltip with exact values and status flags (e.g. `Valve opened: 45 min`).
- G2. `<IrrigationControlCard parcelId>` — live valve state (`Closed`, `Opening`, `Pumping: X L/min`, `Stopping`), manual trigger dialog (15 / 30 / 45 / 60 min) calling `POST /api/v1/parcels/{id}/irrigate-manual`, emergency stop, optimistic UI, countdown to valve cutoff for any active (manual or automated) run, and "starts in" for a pending automated run.
- G3. `<DeficitGauge currentMoisture fieldCapacity wiltingPoint mad hoursUntilTrigger>` — radial gauge of root-zone depletion relative to RAW with Green / Yellow / Red zones and a readout of hours until the automatic trigger.
- G4. A page that composes the three: `/parcels/:parcelId/irrigation` ("Parcel Water Dashboard"), reachable from the Field Map parcel drawer.
- G5. Live refresh by polling; the gauge and valve card update as soon as a new sample arrives.
- G6. Works in three data modes, mirroring the Field Map: `auto` (live, read-only views fall back to sample on 404 / 5xx / network / timeout with a visible notice; valve controls are disabled while the valve status is sample data), `api` (live only, errors shown), `sample` (no network; valve controls drive a local simulator and are tagged `Simulated`).
- G7. The three components accept just `parcelId` as in the TODO text (`<ParcelTelemetryChart parcelId/>`, `<IrrigationControlCard parcelId/>`); configuration props are optional and default to the app's environment config.

## 3. Non-goals

- Any backend, ml-service, DB, MQTT or Docker change.
- SignalR / WebSockets (the hook is written so a push source can replace polling later).
- Valve pulse ring on the Field Map (COMPONENTS §2.2), sensor probe markers on the map, the evaluator "Demo Triggers" panel (COMPONENTS §7). These are separate follow-ups.
- Authentication / per-user authorization of manual overrides (no auth exists in the app yet).
- Editing soil profile, flow rate or efficiency from this page.
- Refactoring `farmMapService.ts` or `FieldMapPage.tsx` beyond adding one link.

## 4. Anti-goals (failure even if it "works")

- Numbers that jitter while live data streams (must use tabular figures, no animation of numeric ticks — FOUNDATIONS §3, MOTION Rule 1).
- Status communicated by color alone (FOUNDATIONS dual-coding mandate: every status = color + icon/shape + text).
- Showing sample data without saying so.
- A manual trigger that can be double-submitted, or an optimistic "Pumping" state that silently stays on after the request failed.
- A poll response that overwrites an in-flight optimistic state with stale "Closed" (including a poll that was *sent* before the write but *arrives* after it).
- A "Water now" press that appears to start a pump when no real valve moved (e.g. sample fallback in `auto` mode after a transient 503).

## 5. Experience

### 5.1 Entry point

`ParcelMetadataDrawer` in **edit** mode gets an `Open water dashboard` link (`/parcels/{id}/irrigation?name=…&crop=…&soil=…`). The query parameters are display hints only (used for the header before the budget loads, and by sample mode to pick the soil row); live data always wins. Create mode has no link (the parcel does not exist yet). The Field Map menu nav does not change.

### 5.2 Page layout — `/parcels/:parcelId/irrigation` **(my call: dedicated page, not a panel inside the map)**

Reason: the map page is already 600 lines with drawing state; a separate lazy-loaded route keeps Recharts out of the map chunk, is easy to demo, and follows the 65/35 "analytical inspector" idea without restructuring the map.

```
┌ Header: ← Field map | Parcel name · crop · soil | data-source pill | Refresh ┐
├──────────────────────────────────────────────┬──────────────────────────────┤
│ ParcelTelemetryChart (≈65%)                  │ DeficitGauge                 │
│  [24 h | 7 d | 30 d]                          │ IrrigationControlCard        │
│                                              │ (≈35%, min 320px)            │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

- ≥1024 px: two columns as above. <1024 px: single column, order Gauge → Valve card → Chart (the "do I need to act" answers first on a phone).
- Page canvas `--color-ag-canvas`; cards `bg-ag-surface border border-ag-border` (borders, not soft shadows — README tenet "Sunlight Survivability").
- Touch targets ≥48 px on mobile; window toggle and duration options are real `<button>`s with `aria-pressed`.
- Unknown parcel id (404 in `api` mode) → "Parcel not found" state with link back to `/map`.

### 5.3 Chart (TODO-307)

- Recharts `ResponsiveContainer` + `ComposedChart` (COMPONENTS §3.1 target).
- Left axis `Soil VWC (%)`, domain `0–50` by default; expand upward to `ceil(saturation + 5)` when saturation > 50. Color `#0891B2`.
- Right axis `Precipitation & Irrigation (mm)`, domain `0–40` by default; expand to `ceil(max stacked bar × 1.2)` when exceeded. Color `#64748B`.
- Moisture line: 2.5 px, `#0891B2`, `type="monotoneX"`, no dots except active dot. Forecast part drawn dashed (`strokeDasharray="6 4"`) and its background region lightly shaded with a `Forecast` label.
- Crop evapotranspiration (ETc, mm) drawn on the right axis as a thin (1.5 px) dashed slate line `#475569`, so the chart shows moisture, ET, rain and irrigation together as TODO-307 describes. Hidden on `24h` when the hourly rows carry `etcMm: null`.
- Colored bands (TODO-307 "colored bands indicating Saturation, Field Capacity, and MAD"): FC → Saturation band `rgba(100,116,139,0.06)` labelled `Drainage`, MAD → FC band `rgba(8,145,178,0.06)` labelled `Readily available`, 0 → MAD band `rgba(220,38,38,0.08)` labelled `Stress`. Boundary lines: Saturation (dotted slate), Field Capacity (solid cyan-700, label `Field capacity θFC`), MAD threshold `FC − mad × (FC − WP)` (dashed `#DC2626`, 1.5 px, label `MAD threshold`). With no soil constants, bands and lines are omitted and the series still draw.
- Bars stacked on the right axis: effective rain `#38BDF8`, irrigation `#10B981` at 0.85 opacity, max bar size 14 px, top radius 2 px.
- Windows: `24h` → hourly points, history only. `7d` and `30d` → daily points, history plus up to 7 forecast days. **(my call)**
- Tooltip: white card, `1px solid #CBD5E1`, tabular figures. Lines: timestamp (local), `Soil moisture 24.3 %`, `ETc 4.8 mm`, `Effective rain 3.0 mm`, `Irrigation 12.0 mm`, and flags: `Valve opened: 45 min` (one per event in that bucket, with trigger type `Automatic` / `Manual`), `Below MAD threshold`, `Forecast`.
- States: loading skeleton (fixed height, no layout shift), empty (`No sensor readings yet for this window`), error with retry. Switching windows keeps the previous chart visible (dimmed) until the new data arrives.
- Labels: hourly ticks in the browser's local time; daily ticks are the UTC date (buckets are UTC days, so labels must not shift a day).
- Accessibility: chart wrapper has `role="img"` with an `aria-label` summary (e.g. "Soil moisture 7-day chart, latest 24.3 %, MAD threshold 22.0 %"), plus a visually hidden text summary of the latest values (moisture, ETc, rain, irrigation, last valve event); window toggle is a labelled button group.

### 5.4 Valve control card (TODO-308)

- Status badge per COMPONENTS §1.2: `Pumping` → `bg-emerald-100 text-emerald-900 border-emerald-400` with pulsing droplet icon; `Closed` → `bg-slate-100 text-slate-700 border-slate-300` with circle-slash icon; `Opening` / `Stopping` → amber badge with spinner icon. Pulse respects `prefers-reduced-motion` (static icon). The badge text sits in a `role="status" aria-live="polite"` region so state changes are announced; the ticking countdown is `aria-hidden` and paired with a visually hidden static `Valve closes at hh:mm`.
- Readouts (mono, tabular): flow `X L/min` (from the status response), `Time left mm:ss` for an in-progress run, `Starts in Hh Mm` for a pending run (`Starting…` once its scheduled start has passed but it has no `actualStart` yet), target volume `L`, last trigger reason (`Automatic — MAD exceeded` / `Manual override`).
- Control availability: in `auto` mode, whenever the valve status currently comes from sample data, `Water now` and `Emergency stop` are disabled and the card shows `Controls unavailable — live data unavailable` **(my call: never fake a pump)**. In `sample` mode the controls work against the local simulator and the card shows a `Simulated` tag.
- `Water now` button opens a dialog (native `<dialog>`, focus-trapped, Esc closes) with duration choices 15 / 30 / 45 / 60 min (default 30), estimated volume `duration × flowRateLpm` L, and `Start irrigation` confirm.
- Optimistic flow: confirm → card immediately shows `Opening` + countdown for the chosen duration; buttons disabled; on success replace with server event; on failure roll back to the previous state and show an inline error (`Could not start irrigation: …`) with retry.
- `Emergency stop` (red outline button) visible only while a run is pending or in progress; it targets `activeEvent ?? nextScheduledEvent`; confirm step ("Stop the valve now?"), optimistic `Stopping`, rollback on failure.
- While a manual trigger or stop request is in flight, poll results do not overwrite the valve state, and any poll whose request was **sent before** the latest write settled is discarded when it arrives.
- Double clicks send one request (synchronous guard in the hook, not only the reducer).
- Starting a manual run while a run is **in progress**, or while the user's own manual run is accepted but pending, is blocked in the UI with the message `A run is already active — stop it first.` (matches the backend's 409). A pending automated run scheduled later does not block manual watering. **(my call)**
- If valve-status polling fails after a successful load, the card keeps the last state but shows `Could not refresh valve status: … The state above may be out of date.`; once the last successful status is older than two poll intervals, the controls lock with `Controls unavailable — live data unavailable`.
- The gauge's trigger estimate only uses hourly readings from the same source as the water budget (never a sample slope on a live reading).
- Native `<dialog>`: `showModal()` only when not already open (React StrictMode double-mounts), state synced from the dialog's `close` event.

### 5.5 Deficit gauge (TODO-309)

All maths in % VWC, so it needs no rooting depth:

- `TAW% = FC − WP`, `RAW% = mad × TAW%`, `depletion% = clamp(FC − current, 0, TAW%)`, `ratio = depletion% / RAW%`.
- Zones **(my call to close the spec's 50–75 % gap)**: Green `ratio < 0.50` ("Comfortable"), Yellow `0.50 ≤ ratio < 1.00` ("Watch"; label changes to "Irrigation soon" at `ratio ≥ 0.75`), Red `ratio ≥ 1.00` ("Water stress"). Colors use the severity tokens `ag-risk-healthy`, `ag-risk-low`, `ag-risk-critical`; each zone also has an icon and text.
- Hand-written SVG 240° arc **(my call: no gauge library)**: background track with the three zone segments, a needle/indicator at `min(ratio, 1.5)` of scale (scale runs 0 → 150 % of RAW so the stress zone is visible), centre readout `NN % of RAW` (mono, 22 px bold "Telemetry Big"; shows the real value even above 150), sub-readout `Moisture 24.3 % · FC 32.0 % · MAD 22.0 %`. `role="meter"`, `aria-valuenow` clamped to 0–150, real value in `aria-valuetext`.
- Trigger readout, checked in this order: `Trigger threshold reached` when ratio ≥ 1; `Automatic irrigation in ~N h` from the API's `hoursUntilTrigger`; otherwise the frontend estimates it from a least-squares drying rate over the **last 24 h** of hourly readings (a full diurnal cycle, so night-time flatness does not read as "not drying"), applied to the budget's `currentMoisturePct`; flat or rising → `Not drying — no trigger expected`; fewer than 12 h of readings → `Not enough data to estimate`.
- The gauge's hourly readings come from one page-level `24h` telemetry poll at the budget poll rate, independent of the chart's selected window.
- Indicator moves with a 300 ms ease-out transform; the numbers update instantly.
- Stale data: if the latest reading is older than 2 h, show a `Stale · last reading 3 h ago` warning badge.
- Missing soil profile (budget soil constants `null`) → gauge replaced by `Soil profile not set — assign one on the field map` with link. Sample mode never produces this (it defaults to Sandy Loam, labelled `Sandy Loam (sample default)`), so this state is verified by parser/helper tests rather than in the browser until the backend exists.

### 5.6 Data freshness

- Poll water budget + valve status every 15 s, chart every 60 s **(my call)**; both configurable. Polling pauses while the tab is hidden (`document.visibilityState`) and runs immediately when it becomes visible again.
- Countdown timers tick every 1 s locally from the server timestamps (no request per second).
- Each request falls back independently, so the header shows a **combined** source: all live → `Live data`; all sample in `auto` → `Sample data — live data unavailable`; `sample` mode → `Sample data`; a mix → `Partly sample data — some live data unavailable`. Each widget whose own data is sample shows a small `Sample` tag. Header also shows `Updated hh:mm:ss`.

## 6. Proposed API contract (for the backend teammate — frontend does not implement it)

All under `{VITE_API_BASE_URL}`. JSON, camelCase, timestamps ISO-8601 UTC, moisture values in **percent** (e.g. `32.0`, not `0.320`).

### 6.1 `GET /api/v1/parcels/{id}/water-budget`

```json
{
  "parcelId": "uuid", "parcelName": "North Block", "cropName": "Tomato",
  "soilProfileId": "sandy_loam", "soilProfileName": "Sandy Loam",
  "fieldCapacityPct": 32.0, "wiltingPointPct": 12.0, "saturationPct": 45.0,
  "madFraction": 0.5,
  "currentMoisturePct": 24.3, "latestReadingAt": "2026-11-20T10:00:00Z",
  "hoursUntilTrigger": 18.5,
  "systemFlowRateLpm": 100.0
}
```
`soilProfileId`, `soilProfileName`, `fieldCapacityPct`, `wiltingPointPct`, `saturationPct`, `madFraction`, `currentMoisturePct`, `latestReadingAt`, `hoursUntilTrigger` may be `null` (soil constants are `null` together when the parcel has no soil profile).

Note: `soil_profiles` stores fractions (`0.220`). The contract asks for percent, but the frontend parser defensively treats **only the soil constants** `fieldCapacityPct`, `wiltingPointPct`, `saturationPct` ≤ 1 as fractions and multiplies them by 100 (no real soil has FC ≤ 1 % VWC). Moisture readings are never rescaled — a real 0.8 % reading stays 0.8 %.

### 6.2 `GET /api/v1/parcels/{id}/telemetry?window=24h|7d|30d`

```json
{
  "parcelId": "uuid", "window": "7d", "resolution": "day",
  "soil": { "fieldCapacityPct": 32.0, "wiltingPointPct": 12.0, "saturationPct": 45.0, "madFraction": 0.5 },
  "points": [
    { "timestamp": "2026-11-14T00:00:00Z", "soilMoisturePct": 27.1, "etcMm": 4.2,
      "effectiveRainMm": 0.0, "irrigationMm": 12.0, "isForecast": false }
  ],
  "irrigationEvents": [
    { "id": "uuid", "triggerType": "AUTOMATED_DEFICIT", "status": "COMPLETED",
      "scheduledStart": "…", "actualStart": "…", "completedAt": "…",
      "durationMinutes": 45, "waterVolumeLiters": 14200.0 }
  ]
}
```
`resolution` is `hour` for `24h`, `day` otherwise; day buckets are UTC days. `soil` is the same constants as the water budget (or `null`) so the chart is self-contained with only a `parcelId`. Forecast points have `soilMoisturePct` projected by the FAO-56 engine (may be `null`) and `isForecast: true`. Hourly rows: `etcMm` may be `null` (weather is daily in `weather_cache`); `effectiveRainMm` and `irrigationMm` are the amounts within that hour (0 if none). Daily rows: `soilMoisturePct` is the last reading of that UTC day.

### 6.3 `GET /api/v1/parcels/{id}/irrigation/status`

```json
{
  "valveState": "CLOSED | OPENING | PUMPING | STOPPING",
  "flowRateLpm": 100.0,
  "activeEvent": { /* irrigation event as above, or null */ },
  "nextScheduledEvent": { /* PENDING event or null */ },
  "lastEvent": { /* most recent COMPLETED/ABORTED event or null */ },
  "serverTime": "2026-11-20T10:00:05Z"
}
```

Slot rules the frontend relies on: a run that is `IN_PROGRESS`, **or a manual run that is accepted but still `PENDING`**, is returned in `activeEvent`; `nextScheduledEvent` is reserved for upcoming automated / scheduled runs. Labels come from `triggerType`, not the slot.

### 6.4 `POST /api/v1/parcels/{id}/irrigate-manual`

Body `{ "durationMinutes": 15 | 30 | 45 | 60 }` → `202 Accepted` with the created event (`triggerType: "MANUAL_OVERRIDE"`, `status: "PENDING"` or `"IN_PROGRESS"`). `409` if a run is already active; `400` for other durations.

### 6.5 `POST /api/v1/parcels/{id}/irrigation/{eventId}/abort`

→ `200` with the event (`status: "ABORTED"`). `409` if already finished.

### 6.6 Error handling expected by the frontend

`404` (unknown parcel or endpoint not deployed) and `5xx` / network / 5 s timeout → in `auto` mode fall back to sample data with notice; `400` / `409` / `422` → shown inline as user errors, never fall back. Malformed JSON → hard error.

## 7. Configuration

New `frontend/.env.example` keys (documented, defaults in code):

- `VITE_IRRIGATION_DATA_MODE=auto` (`auto | api | sample`)
- `VITE_IRRIGATION_POLL_MS=15000` (minimum 5000)
- Base URL reuses `VITE_API_BASE_URL` (default `http://localhost:5051`).

## 8. Sample mode

A pure, deterministic generator produces a believable parcel. One hourly series per parcel is simulated and **every** sample output (24 h points, daily points, water budget) is read from that same series, so they always agree. Randomness is seeded by `(parcelId, UTC day index)` and the simulation is anchored at a UTC-day boundary, so the history does not shift from one hour to the next. Shape: diurnal drying curve (moisture drops during daylight, flat at night, per Phase 3 TODO-305), occasional rain, an automated irrigation event whenever depletion crosses RAW, and a 7-day forecast. Soil constants mirror the DB seed (`backend/Data/Migrations/20261112212907_SeedReferenceData.cs`), converted to percent, MAD 0.5 for all: Sand FC 12 / WP 5 / Sat 38, Sandy Loam 22 / 10 / 43, Silt 31 / 14 / 48, Clay 38 / 22 / 50. The soil id from the dashboard link's `soil` query hint selects the row; unknown or missing soil uses Sandy Loam and is labelled `(sample default)`. Parcel name and crop also come from the hints, else from `sampleFarmMap` by id, else `Sample parcel`. (The frontend `SOILS` catalogue only carries FC, so it is not enough on its own.) In `sample` mode only, manual triggers and stops run against a local in-memory valve simulator (Opening 3 s → Pumping → Closed when duration ends) so the whole flow is demonstrable offline; in `auto` mode a sample fallback never drives the simulator (§5.4).

## 9. Constraints

- React 19, TypeScript 6, Vite 8, Tailwind 4 tokens already in `index.css`. Follow the existing folder structure (`components/<Feature>/`, `services/`, `hooks/`, `models/`, `utils/`, `types/`) and `.ts` extension imports.
- New dependency: `recharts@3.10.1` exactly (3.11.0 is 3 days old; 3.10.1 is from July 2026). No other new **direct** dependency (Recharts' own transitive packages are expected).
- No React component/hook test library is added; hooks stay thin and their logic lives in tested pure modules. Hook behaviour (polling pause on hidden tab, abort) is verified in the browser. **(my call)**
- Tests follow the existing pattern: Node `--experimental-strip-types` scripts in `frontend/scripts/test_*.js` for pure logic. `tsconfig` has `erasableSyntaxOnly` → no enums, no parameter properties.
- `npm run build` and `npm run lint` must pass. No new lint warnings.
- All telemetry numbers use `font-mono tabular-nums`.
- New page is lazy-loaded so Recharts stays out of the landing / map chunks.
- No backend files touched. No push to remote.

## 10. Left to the builder

Exact Tailwind class composition, icon SVG paths, skeleton visuals, copy wording outside the strings fixed above, and internal component splits.

## 11. Deliverables beyond code

- `frontend/README.md` section "Parcel Water Dashboard".
- Completion reports `PROJECT_DETAILS/Reports/Phase 3/TODO-307-…md`, `TODO-308-…md`, `TODO-309-…md` in the format of `PROJECT_DETAILS/Phase Plans/Task Completion.md`. Acceptance criteria that need the real backend (e.g. "updates immediately when new telemetry streams") are reported against sample mode and marked as pending backend verification where honest.
