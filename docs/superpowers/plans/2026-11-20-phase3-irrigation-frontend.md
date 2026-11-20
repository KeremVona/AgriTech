# Phase 3 Frontend — Parcel Water Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver TODO-307 (telemetry chart), TODO-308 (valve control card) and TODO-309 (deficit gauge) as a per-parcel "Parcel Water Dashboard" page that works against the proposed backend contract or, until the backend exists, against deterministic sample data.

**Architecture:** All maths and state transitions live in pure TypeScript modules under `frontend/src/models/`, `frontend/src/services/` and `frontend/src/utils/`, tested with the project's existing Node `--experimental-strip-types` scripts. A thin data layer (`irrigationService.ts`) mirrors the Field Map's `auto | api | sample` behaviour, except that valve **writes never fall back**. React components under `frontend/src/components/Irrigation/` only render what the models compute. A lazy-loaded route `/parcels/:parcelId/irrigation` composes them, and the Field Map drawer links to it.

**Tech Stack:** React 19, TypeScript 6 (`erasableSyntaxOnly`), Vite 8, Tailwind 4 (`ag-*` tokens in `src/index.css`), react-router-dom 7, Recharts 3.10.1 (new), Node 24 test scripts.

**Spec:** `docs/superpowers/specs/2026-11-20-phase3-irrigation-frontend-design.md` — read it first; section numbers below (§) refer to it.

## Global Constraints

- Work only inside `frontend/`, `docs/` and `PROJECT_DETAILS/Reports/Phase 3/`. **Never edit `backend/`, `ml-service/`, `docker/`.**
- Branch `feat/phase3-irrigation-frontend`. Commit locally; **do not push**.
- New direct dependency: `recharts@3.10.1` exactly (no caret). No other new direct dependency (transitive ones from Recharts are expected). No React test library.
- Imports use explicit `.ts` / `.tsx` extensions (existing convention; required by Node strip-types tests). Pure modules must not read `import.meta.env`.
- No enums, no constructor parameter properties, no namespaces (`erasableSyntaxOnly`).
- Every telemetry / numeric readout uses `font-mono tabular-nums`; numeric values are never animated (§4).
- Every status = color + icon + text (FOUNDATIONS dual-coding).
- Moisture values are percent VWC in all frontend types. Only the soil constants FC / WP / saturation are rescaled ×100 when ≤ 1; moisture readings are never rescaled (§6.1 note).
- Manual durations are exactly `15, 30, 45, 60` minutes, default `30`.
- Gauge zones: `ratio < 0.5` comfortable (green), `0.5 ≤ ratio < 0.75` watch (yellow), `0.75 ≤ ratio < 1` irrigation-soon (yellow), `ratio ≥ 1` stress (red).
- Chart default axes: left `0–50` %, right `0–40` mm.
- Request timeout 5,000 ms. Poll: budget, valve status and the gauge's 24 h feed every `VITE_IRRIGATION_POLL_MS` (default 15,000, min 5,000); chart every 60,000 ms. Stale after 2 h.
- Valve controls work only when the status is live (`source === 'api'`) or the app is in `sample` mode; otherwise disabled with `Controls unavailable — live data unavailable` (§5.4).
- `npm run build` and `npm run lint` pass at the end of **every** task (`tsc -b` covers `src/`); all existing `npm run test:*` scripts keep passing.

## Review Focus

1. **A poll races a manual start/stop** — either arriving while the request is in flight, or *sent before* the write settled and *arriving after* it → the optimistic / confirmed state must survive. Tests: Task 3 `poll during pending start keeps optimistic state`, `poll sent before write settled is discarded`.
2. **Backend returns soil constants as fractions (`0.220`) like the DB** → gauge and chart show 22.0 %, while a genuine 0.8 % moisture reading stays 0.8 %. Tests: Task 5 `parseWaterBudget normalizes only soil constants`.
3. **Live status read falls back to sample in `auto` mode (transient 503)** → controls disabled, never a simulated pump; and a failing write in `auto` never falls back. Tests: Task 3 `controls locked when status is not live`, Task 5 `startManualIrrigation never falls back in auto mode`.
4. **Moisture readings outside [WP, FC] or missing** (above FC after rain, below WP from a glitch, `null` gap) → gauge clamps, chart shows a gap not a zero. Tests: Task 1 `clamps above FC and below WP`, Task 2 `null moisture stays null`.
5. **Client clock differs from server / run is pending without `actualStart`** → countdown uses `serverTime` offset, never negative, and a pending manual run shows `Starts in` / `Starting…`. Tests: Task 3 `countdown uses server clock offset and clamps at zero`, `pending manual run without actualStart`.

---

### Task 1: Irrigation types and water-balance model (TODO-309 maths)

**Files:**
- Create: `frontend/src/types/irrigation.ts`
- Create: `frontend/src/models/waterBalanceModel.ts`
- Create: `frontend/scripts/test_water_balance.js`
- Modify: `frontend/package.json` (add script `test:irrigation`)

**Interfaces:**
- Produces in `types/irrigation.ts` (exact shapes of spec §6, camelCase):
  - `IrrigationDataMode = 'auto' | 'api' | 'sample'`; `DataSource = 'api' | 'sample'`
  - `TelemetryWindow = '24h' | '7d' | '30d'`
  - `SoilConstants { fieldCapacityPct: number; wiltingPointPct: number; saturationPct: number; madFraction: number }`
  - `WaterBudget` — §6.1 fields; `soilProfileId`, `soilProfileName`, `fieldCapacityPct`, `wiltingPointPct`, `saturationPct`, `madFraction`, `currentMoisturePct`, `latestReadingAt`, `hoursUntilTrigger` are `T | null`
  - `TelemetryPoint { timestamp: string; soilMoisturePct: number | null; etcMm: number | null; effectiveRainMm: number; irrigationMm: number; isForecast: boolean }`
  - `IrrigationTriggerType = 'AUTOMATED_DEFICIT' | 'MANUAL_OVERRIDE' | 'SCHEDULED_RECIPE'`
  - `IrrigationEventStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED'`
  - `IrrigationEvent { id: string; triggerType; status; scheduledStart: string; actualStart: string | null; completedAt: string | null; durationMinutes: number; waterVolumeLiters: number }`
  - `TelemetryResponse { parcelId: string; window: TelemetryWindow; resolution: 'hour' | 'day'; soil: SoilConstants | null; points: TelemetryPoint[]; irrigationEvents: IrrigationEvent[] }`
  - `ValveState = 'CLOSED' | 'OPENING' | 'PUMPING' | 'STOPPING'`
  - `IrrigationStatus { valveState: ValveState; flowRateLpm: number; activeEvent: IrrigationEvent | null; nextScheduledEvent: IrrigationEvent | null; lastEvent: IrrigationEvent | null; serverTime: string }`
  - `Sourced<T> { data: T; source: DataSource; fallbackReason: string | null }`
- Produces in `models/waterBalanceModel.ts`:
  - `normalizeSoilPercent(value: number): number` — `value <= 1 ? value * 100 : value`
  - `budgetSoil(budget: WaterBudget): SoilConstants | null` — `null` if any of the four constants is `null`
  - `type DeficitZone = 'comfortable' | 'watch' | 'irrigation-soon' | 'stress'`
  - `computeDeficit(input: SoilConstants & { currentMoisturePct: number }): { tawPct: number; rawPct: number; madThresholdPct: number; depletionPct: number; ratio: number; zone: DeficitZone }` (`saturationPct` unused here but accepted)
  - `zoneTone(zone: DeficitZone): 'green' | 'yellow' | 'red'`
  - `type TriggerEstimate = { kind: 'hours'; hours: number } | { kind: 'reached' } | { kind: 'not-drying' } | { kind: 'unknown' }`
  - `estimateTrigger(input: { samples: { timestamp: string; soilMoisturePct: number | null }[]; currentMoisturePct: number; madThresholdPct: number; apiHours: number | null }): TriggerEstimate`
  - `isStale(latestReadingAt: string | null, nowMs: number, maxAgeHours?: number): boolean` (default 2)
  - `gaugeAngleDeg(ratio: number): number` — `-120 + clamp(ratio / 1.5, 0, 1) * 240`
  - `gaugeAriaValueNow(ratio: number): number` — `Math.round(clamp(ratio, 0, 1.5) * 100)`

`estimateTrigger` rules, in order (§5.5): `currentMoisturePct <= madThresholdPct` → reached; `apiHours !== null` → hours; take non-null samples within 24 h of the latest sample — if they span < 12 h → unknown; least-squares slope (%/h) ≥ −0.01 → not-drying; else `(currentMoisturePct − madThresholdPct) / −slope`.

- [ ] **Step 1: Write the failing tests** in `scripts/test_water_balance.js` (same `test(name, fn)` harness as `scripts/test_parcel_drawer.js`; `process.exitCode = 1` on any failure):

```js
const base = { fieldCapacityPct: 32, wiltingPointPct: 12, saturationPct: 45, madFraction: 0.5 };
const hourly = (values, startHour = 0) => values.map((v, i) =>
  ({ timestamp: new Date(Date.UTC(2026, 10, 19, startHour + i)).toISOString(), soilMoisturePct: v }));
test('computeDeficit core values', () => {
  const r = computeDeficit({ ...base, currentMoisturePct: 24.3 });
  assert.equal(r.tawPct, 20); assert.equal(r.rawPct, 10); assert.equal(r.madThresholdPct, 22);
  assert.ok(Math.abs(r.depletionPct - 7.7) < 1e-9); assert.ok(Math.abs(r.ratio - 0.77) < 1e-9);
  assert.equal(r.zone, 'irrigation-soon');
});
test('zone boundaries', () => {
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 27.1 }).zone, 'comfortable'); // 0.49
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 27 }).zone, 'watch');          // 0.50
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 24.5 }).zone, 'irrigation-soon'); // 0.75
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 22 }).zone, 'stress');         // 1.00
  assert.equal(zoneTone('watch'), 'yellow'); assert.equal(zoneTone('irrigation-soon'), 'yellow');
  assert.equal(zoneTone('stress'), 'red'); assert.equal(zoneTone('comfortable'), 'green');
});
test('clamps above FC and below WP', () => {
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 35 }).ratio, 0);
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 5 }).depletionPct, 20);
  assert.equal(computeDeficit({ ...base, currentMoisturePct: 5 }).ratio, 2);
});
test('normalizeSoilPercent and budgetSoil', () => {
  assert.equal(normalizeSoilPercent(0.22), 22); assert.equal(normalizeSoilPercent(22), 22);
  assert.equal(budgetSoil({ ...budgetFixture, fieldCapacityPct: null }), null);
  assert.deepEqual(budgetSoil(budgetFixture), base);
});
test('estimateTrigger over a 24 h drying window', () => {
  // 24 hourly samples falling 0.1 %/h, current 24.3 → (24.3 − 22) / 0.1 = 23 h
  const s = hourly(Array.from({ length: 24 }, (_, i) => 26.6 - 0.1 * i));
  const e = estimateTrigger({ samples: s, currentMoisturePct: 24.3, madThresholdPct: 22, apiHours: null });
  assert.equal(e.kind, 'hours'); assert.ok(Math.abs(e.hours - 23) < 1e-6);
});
test('night-time flat hours alone do not read as not-drying', () => {
  // 12 daylight hours dropping 0.4 %/h then 12 flat night hours → still drying overall
  const day = Array.from({ length: 12 }, (_, i) => 30 - 0.4 * i);
  const s = hourly([...day, ...Array(12).fill(day[11])]);
  assert.equal(estimateTrigger({ samples: s, currentMoisturePct: day[11], madThresholdPct: 22, apiHours: null }).kind, 'hours');
});
test('estimateTrigger order: reached, api, not-drying, unknown', () => {
  assert.deepEqual(estimateTrigger({ samples: [], currentMoisturePct: 21, madThresholdPct: 22, apiHours: 18.5 }), { kind: 'reached' });
  assert.deepEqual(estimateTrigger({ samples: [], currentMoisturePct: 25, madThresholdPct: 22, apiHours: 18.5 }), { kind: 'hours', hours: 18.5 });
  assert.deepEqual(estimateTrigger({ samples: hourly(Array(24).fill(25)), currentMoisturePct: 25, madThresholdPct: 22, apiHours: null }), { kind: 'not-drying' });
  assert.deepEqual(estimateTrigger({ samples: hourly([25, 24.9, 24.8]), currentMoisturePct: 24.8, madThresholdPct: 22, apiHours: null }), { kind: 'unknown' });
});
test('isStale', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  assert.equal(isStale('2026-11-20T10:30:00Z', now), false);
  assert.equal(isStale('2026-11-20T09:59:00Z', now), true);
  assert.equal(isStale(null, now), true);
});
test('gauge angle and aria clamp', () => {
  assert.equal(gaugeAngleDeg(0), -120); assert.equal(gaugeAngleDeg(0.75), 0);
  assert.equal(gaugeAngleDeg(1.5), 120); assert.equal(gaugeAngleDeg(3), 120); assert.equal(gaugeAngleDeg(-1), -120);
  assert.equal(gaugeAriaValueNow(0.77), 77); assert.equal(gaugeAriaValueNow(2), 150);
});
```
(`budgetFixture` is a full `WaterBudget` literal with the `base` constants, defined at the top of the file.)

- [ ] **Step 2: Add the npm script and run it to see it fail**

`package.json`: `"test:irrigation": "node --experimental-strip-types scripts/test_water_balance.js"` (later tasks append `&& node --experimental-strip-types scripts/test_<x>.js`).
Run: `npm --prefix frontend run test:irrigation` → FAIL (module not found).

- [ ] **Step 3: Implement `types/irrigation.ts` and `models/waterBalanceModel.ts`** with the signatures and rules above.
- [ ] **Step 4: Run** `npm --prefix frontend run test:irrigation` → all PASS; `npm --prefix frontend run lint` and `npm --prefix frontend run build` → pass.
- [ ] **Step 5: Commit** `feat(irrigation): add water-balance model and irrigation types`

---

### Task 2: Telemetry chart model (TODO-307 logic)

**Files:**
- Create: `frontend/src/models/telemetryChartModel.ts`
- Create: `frontend/scripts/test_telemetry_chart_model.js`
- Modify: `frontend/package.json` (append to `test:irrigation`)

**Interfaces:**
- Consumes: types from Task 1.
- Produces:
  - `ChartRow { timestamp: string; moisture: number | null; moistureForecast: number | null; etcMm: number | null; effectiveRainMm: number; irrigationMm: number; isForecast: boolean; events: { durationMinutes: number; triggerType: IrrigationTriggerType }[] }`
  - `buildChartRows(response: TelemetryResponse): ChartRow[]` — history points fill `moisture`; forecast points fill `moistureForecast`; the **last history row also copies its value into `moistureForecast`** so the dashed line joins the solid one. An event belongs to the row whose bucket `[timestamp, timestamp + 1 h | 1 UTC day)` contains `actualStart ?? scheduledStart`.
  - `soilBands(soil: SoilConstants | null): { saturationPct: number; fieldCapacityPct: number; madThresholdPct: number } | null` (MAD threshold = `FC − mad × (FC − WP)`)
  - `computeAxisDomains(rows: ChartRow[], saturationPct: number | null): { left: [0, number]; right: [0, number] }` — left max `Math.max(50, Math.ceil(saturationPct + 5))` (50 when null); right max `Math.max(40, Math.ceil(maxRight * 1.2))` where `maxRight = max(effectiveRainMm + irrigationMm, etcMm ?? 0)`.
  - `formatBucketLabel(timestamp: string, resolution: 'hour' | 'day', timeZone?: string): string` — hour → `HH:mm` in `timeZone` (default browser), day → `MMM d` in **UTC** (`en-US`).
  - `tooltipLines(row: ChartRow, madThresholdPct: number | null): string[]`
  - `chartAriaLabel(rows: ChartRow[], window: TelemetryWindow, madThresholdPct: number | null): string`
  - `latestValuesSummary(rows: ChartRow[]): string` — for the visually hidden summary, e.g. `Latest reading: soil moisture 23.4 %, ETc 4.1 mm, effective rain 0.0 mm, irrigation 0.0 mm.`

- [ ] **Step 1: Write the failing tests**

```js
test('history/forecast split and join point', () => {
  const rows = buildChartRows(fixture7d); // 3 history days (27.1, 25.0, 23.4) + 2 forecast (22.0, null)
  assert.deepEqual(rows.map((r) => r.moisture), [27.1, 25.0, 23.4, null, null]);
  assert.deepEqual(rows.map((r) => r.moistureForecast), [null, null, 23.4, 22.0, null]);
});
test('null moisture stays null', () => { assert.equal(buildChartRows(fixtureWithGap)[1].moisture, null); });
test('events attach to the bucket containing actualStart', () => {
  const rows = buildChartRows(fixture7d); // event actualStart 2026-11-15T06:10Z, 45 min, AUTOMATED_DEFICIT
  assert.deepEqual(rows[1].events, [{ durationMinutes: 45, triggerType: 'AUTOMATED_DEFICIT' }]);
  assert.deepEqual(rows[0].events, []);
});
test('soil bands', () => {
  assert.deepEqual(soilBands({ fieldCapacityPct: 32, wiltingPointPct: 12, saturationPct: 45, madFraction: 0.5 }),
    { saturationPct: 45, fieldCapacityPct: 32, madThresholdPct: 22 });
  assert.equal(soilBands(null), null);
});
test('axis domains default and expand', () => {
  assert.deepEqual(computeAxisDomains(buildChartRows(fixture7d), 43), { left: [0, 50], right: [0, 40] });
  assert.deepEqual(computeAxisDomains([{ ...row, effectiveRainMm: 30, irrigationMm: 20 }], 52), { left: [0, 57], right: [0, 60] });
  assert.deepEqual(computeAxisDomains([row], null), { left: [0, 50], right: [0, 40] });
});
test('day labels are UTC dates', () => {
  assert.equal(formatBucketLabel('2026-11-15T00:00:00Z', 'day'), 'Nov 15');
  assert.equal(formatBucketLabel('2026-11-15T14:00:00Z', 'hour', 'UTC'), '14:00');
});
test('tooltip lines', () => {
  const lines = tooltipLines({ ...row, moisture: 21.5, etcMm: 4.8, effectiveRainMm: 3, irrigationMm: 12,
    events: [{ durationMinutes: 45, triggerType: 'AUTOMATED_DEFICIT' }] }, 22);
  for (const expected of ['Soil moisture 21.5 %', 'ETc 4.8 mm', 'Effective rain 3.0 mm', 'Irrigation 12.0 mm',
    'Valve opened: 45 min (Automatic)', 'Below MAD threshold']) assert.ok(lines.includes(expected), expected);
  assert.ok(tooltipLines({ ...row, isForecast: true, moistureForecast: 22.0 }, 22).includes('Forecast'));
  assert.ok(tooltipLines({ ...row, events: [{ durationMinutes: 30, triggerType: 'MANUAL_OVERRIDE' }] }, 22)
    .includes('Valve opened: 30 min (Manual)'));
  assert.ok(!tooltipLines({ ...row, etcMm: null }, 22).some((l) => l.startsWith('ETc')));
});
test('aria label and hidden summary', () => {
  assert.equal(chartAriaLabel(buildChartRows(fixture7d), '7d', 22),
    'Soil moisture 7-day chart, latest 23.4 %, MAD threshold 22.0 %');
  assert.ok(latestValuesSummary(buildChartRows(fixture7d)).startsWith('Latest reading: soil moisture 23.4 %'));
});
```

(`fixture7d`, `fixtureWithGap`, `row` are small literals defined at the top of the test file.)

- [ ] **Step 2: Run** `npm --prefix frontend run test:irrigation` → new tests FAIL.
- [ ] **Step 3: Implement** `models/telemetryChartModel.ts`. Numbers format with one decimal (`toFixed(1)`); window names in the aria label: `24-hour`, `7-day`, `30-day`; "latest" is the last non-null history moisture (`no readings` if none); MAD part omitted from the label when `madThresholdPct` is null.
- [ ] **Step 4: Run** → all PASS; lint + build pass.
- [ ] **Step 5: Commit** `feat(irrigation): add telemetry chart model`

---

### Task 3: Valve control state model (TODO-308 logic)

**Files:**
- Create: `frontend/src/models/valveControlModel.ts`
- Create: `frontend/scripts/test_valve_control_model.js`
- Modify: `frontend/package.json` (append)

**Interfaces:**
- Consumes: `IrrigationStatus`, `IrrigationEvent` from Task 1.
- Produces:
  - `MANUAL_DURATIONS = [15, 30, 45, 60] as const`; `DEFAULT_MANUAL_DURATION = 30`
  - `ACTIVE_RUN_MESSAGE = 'A run is already active — stop it first.'`; `CONTROLS_UNAVAILABLE_MESSAGE = 'Controls unavailable — live data unavailable'`
  - `ValveControlState { server: IrrigationStatus | null; clockOffsetMs: number; pending: { kind: 'start'; durationMinutes: number; requestedAtMs: number } | { kind: 'stop'; eventId: string } | null; lastWriteSettledAtMs: number | null; error: string | null }`
  - `initialValveControlState: ValveControlState`
  - `type ValveAction =`
    `{ type: 'poll-received'; status: IrrigationStatus; requestStartedAtMs: number; receivedAtMs: number }`
    `| { type: 'start-requested'; durationMinutes: number; nowMs: number }`
    `| { type: 'start-succeeded'; event: IrrigationEvent; nowMs: number }`
    `| { type: 'start-failed'; message: string; nowMs: number }`
    `| { type: 'stop-requested'; eventId: string }`
    `| { type: 'stop-succeeded'; event: IrrigationEvent; nowMs: number }`
    `| { type: 'stop-failed'; message: string; nowMs: number }`
    `| { type: 'dismiss-error' }`
  - `valveControlReducer(state: ValveControlState, action: ValveAction): ValveControlState`
  - `stoppableEventId(state: ValveControlState): string | null` — `server.activeEvent?.id ?? server.nextScheduledEvent?.id ?? null`
  - `ValveDisplay { label: 'Closed' | 'Opening' | 'Pumping' | 'Stopping'; tone: 'idle' | 'transition' | 'active'; flowRateLpm: number | null; secondsLeft: number | null; startsInSeconds: number | null; isStarting: boolean; closesAtMs: number | null; canStart: boolean; canStop: boolean; startBlockedReason: string | null }`
  - `deriveValveDisplay(state: ValveControlState, nowMs: number, controlsEnabled: boolean): ValveDisplay`
  - `formatCountdown(seconds: number): string` — `mm:ss` under one hour, else `h:mm:ss`
  - `formatStartsIn(seconds: number): string` — `"2 h 05 min"`, `"5 min"`, `"<1 min"`
  - `estimateVolumeLiters(durationMinutes: number, flowRateLpm: number): number`

Reducer behaviour:
- `poll-received`: if `pending !== null` → store nothing but the clock offset (state otherwise unchanged); if `lastWriteSettledAtMs !== null && requestStartedAtMs < lastWriteSettledAtMs` → discard (return same state); else set `server` and `clockOffsetMs = Date.parse(status.serverTime) − receivedAtMs`.
- `start-requested`: returned unchanged (same reference) when `server === null`, `pending !== null`, `server.activeEvent?.status === 'IN_PROGRESS'`, or the duration is not in `MANUAL_DURATIONS`.
- `start-succeeded`: clears `pending`, sets `lastWriteSettledAtMs = nowMs`; event `IN_PROGRESS` → `activeEvent = event`, `valveState = 'OPENING'`; event `PENDING` → `nextScheduledEvent = event` (valve state unchanged).
- `stop-requested`: ignored unless `pending === null` and `eventId === stoppableEventId(state)`.
- `stop-succeeded`: clears `pending`, sets `lastWriteSettledAtMs`; `lastEvent = event`, removes it from `activeEvent` / `nextScheduledEvent`, `valveState = 'CLOSED'` if it was the active one.
- `*-failed`: clears `pending`, sets `lastWriteSettledAtMs` and `error` (server state untouched = rollback).

`deriveValveDisplay`: server time = `nowMs + clockOffsetMs`. Precedence: pending start → `Opening` with `secondsLeft` counting down from `durationMinutes` starting at `requestedAtMs`; pending stop → `Stopping`; else from `server.valveState`. For an active event with `actualStart`: `secondsLeft = max(0, actualStart + duration − serverNow)`, `closesAtMs` in client time. For a pending event (active or next) without `actualStart`: `startsInSeconds = max(0, scheduledStart − serverNow)`, `isStarting = startsInSeconds === 0`. `canStart = controlsEnabled && pending === null && server !== null && no IN_PROGRESS active event`; `canStop = controlsEnabled && pending === null && stoppableEventId !== null`. `startBlockedReason`: `CONTROLS_UNAVAILABLE_MESSAGE` when `!controlsEnabled`, else `ACTIVE_RUN_MESSAGE` when an IN_PROGRESS run exists, else `null`. `flowRateLpm = server?.flowRateLpm ?? null`.

- [ ] **Step 1: Write the failing tests** — at least:

```js
test('optimistic start shows Opening with countdown', () => {
  const s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  const d = deriveValveDisplay(s, T0 + 60_000, true);
  assert.equal(d.label, 'Opening'); assert.equal(d.secondsLeft, 29 * 60); assert.equal(d.canStart, false);
});
test('poll during pending start keeps optimistic state', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'poll-received', status: closedStatus, requestStartedAtMs: T0 + 500, receivedAtMs: T0 + 1000 });
  assert.equal(deriveValveDisplay(s, T0 + 1000, true).label, 'Opening');
});
test('start success shows Opening immediately', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: inProgressManual(T0, 30), nowMs: T0 + 300 });
  const d = deriveValveDisplay(s, T0 + 300, true);
  assert.equal(d.label, 'Opening'); assert.ok(d.secondsLeft > 0);
});
test('poll sent before write settled is discarded', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-succeeded', event: inProgressManual(T0, 30), nowMs: T0 + 300 });
  const after = valveControlReducer(s, { type: 'poll-received', status: closedStatus, requestStartedAtMs: T0 - 100, receivedAtMs: T0 + 400 });
  assert.equal(after, s);
});
test('double submit, missing server and invalid duration are ignored', () => {
  const s1 = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  assert.equal(valveControlReducer(s1, { type: 'start-requested', durationMinutes: 60, nowMs: T0 }), s1);
  assert.equal(valveControlReducer(initialValveControlState, { type: 'start-requested', durationMinutes: 30, nowMs: T0 }), initialValveControlState);
  const s = withServer(closedStatus);
  assert.equal(valveControlReducer(s, { type: 'start-requested', durationMinutes: 20, nowMs: T0 }), s);
});
test('start failure rolls back and reports', () => {
  let s = valveControlReducer(withServer(closedStatus), { type: 'start-requested', durationMinutes: 30, nowMs: T0 });
  s = valveControlReducer(s, { type: 'start-failed', message: 'HTTP 503', nowMs: T0 + 200 });
  assert.equal(deriveValveDisplay(s, T0, true).label, 'Closed'); assert.equal(s.error, 'HTTP 503');
});
test('in-progress run blocks start and allows stop; pending automated run does not block', () => {
  const d = deriveValveDisplay(withServer(pumpingStatus), T0, true);
  assert.equal(d.label, 'Pumping'); assert.equal(d.canStart, false); assert.equal(d.canStop, true);
  assert.equal(d.startBlockedReason, ACTIVE_RUN_MESSAGE);
  const p = deriveValveDisplay(withServer(closedWithNextAutomatedIn2h), T0, true);
  assert.equal(p.canStart, true); assert.equal(p.startsInSeconds, 7200);
});
test('controls locked when status is not live', () => {
  const d = deriveValveDisplay(withServer(pumpingStatus), T0, false);
  assert.equal(d.canStart, false); assert.equal(d.canStop, false);
  assert.equal(d.startBlockedReason, CONTROLS_UNAVAILABLE_MESSAGE);
});
test('pending manual run without actualStart', () => {
  const d = deriveValveDisplay(withServer(activePendingManual({ scheduledStartMs: T0 + 90_000 })), T0, true);
  assert.equal(d.secondsLeft, null); assert.equal(d.startsInSeconds, 90); assert.equal(d.isStarting, false);
  assert.equal(deriveValveDisplay(withServer(activePendingManual({ scheduledStartMs: T0 - 5_000 })), T0, true).isStarting, true);
});
test('countdown uses server clock offset and clamps at zero', () => {
  // server is 120 s ahead of client; run started 44 min ago by server clock, 45 min duration → 60 s left
  const s = valveControlReducer(initialValveControlState, { type: 'poll-received',
    status: pumpingStartedAt(SERVER_NOW - 44 * 60_000), requestStartedAtMs: SERVER_NOW - 120_100, receivedAtMs: SERVER_NOW - 120_000 });
  assert.equal(deriveValveDisplay(s, SERVER_NOW - 120_000, true).secondsLeft, 60);
  assert.equal(deriveValveDisplay(s, SERVER_NOW + 3_600_000, true).secondsLeft, 0);
});
test('stop targets active event and closes valve on success', () => {
  let s = withServer(pumpingStatus);
  assert.equal(stoppableEventId(s), pumpingStatus.activeEvent.id);
  assert.equal(valveControlReducer(s, { type: 'stop-requested', eventId: 'other' }), s);
  s = valveControlReducer(s, { type: 'stop-requested', eventId: pumpingStatus.activeEvent.id });
  assert.equal(deriveValveDisplay(s, T0, true).label, 'Stopping');
  s = valveControlReducer(s, { type: 'stop-succeeded', event: { ...pumpingStatus.activeEvent, status: 'ABORTED' }, nowMs: T0 + 100 });
  assert.equal(deriveValveDisplay(s, T0 + 100, true).label, 'Closed'); assert.equal(s.server.lastEvent.status, 'ABORTED');
});
test('formatters', () => {
  assert.equal(formatCountdown(59), '00:59'); assert.equal(formatCountdown(3725), '1:02:05');
  assert.equal(formatStartsIn(7500), '2 h 05 min'); assert.equal(formatStartsIn(300), '5 min'); assert.equal(formatStartsIn(20), '<1 min');
  assert.equal(estimateVolumeLiters(30, 100), 3000);
});
```
(`withServer`, `closedStatus`, `pumpingStatus`, `closedWithNextAutomatedIn2h`, `activePendingManual`, `inProgressManual`, `pumpingStartedAt`, `T0`, `SERVER_NOW` are fixture helpers at the top of the file; `withServer` sets `clockOffsetMs: 0` and `serverTime` = `T0`.)

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; lint + build pass.
- [ ] **Step 5: Commit** `feat(irrigation): add valve control state model`

---

### Task 4: Deterministic sample data and valve simulator

**Files:**
- Create: `frontend/src/services/irrigationSampleData.ts`
- Create: `frontend/scripts/test_irrigation_sample_data.js`
- Modify: `frontend/package.json` (append)

**Interfaces:**
- Consumes: Task 1 types and `computeDeficit`; `sampleFarmMap` from `src/data/sampleFarmMap.ts` (fallback parcel names).
- Produces:
  - `SampleHints { parcelName?: string | null; cropName?: string | null; soilProfileId?: string | null }`
  - `SAMPLE_SOILS: Record<'sand' | 'sandy_loam' | 'silt' | 'clay', { name: string } & SoilConstants>` — values exactly as spec §8.
  - `createSampleTelemetry(parcelId: string, window: TelemetryWindow, nowMs: number, hints?: SampleHints): TelemetryResponse`
  - `createSampleWaterBudget(parcelId: string, nowMs: number, hints?: SampleHints): WaterBudget`
  - `createSampleValveSimulator(): { getStatus(parcelId: string, nowMs: number): IrrigationStatus; startManual(parcelId: string, durationMinutes: number, nowMs: number): IrrigationEvent; abort(parcelId: string, eventId: string, nowMs: number): IrrigationEvent }`

Generation rules (§8): one private `simulateHourlySeries(parcelId, soil, nowMs)` used by all outputs. Anchor = start of the UTC day 31 days before `nowMs`; simulate hour by hour to the end of the UTC day 7 days after `nowMs` (history ≤ `nowMs`, forecast after). Randomness: a small seeded PRNG (e.g. mulberry32) seeded by a string hash (e.g. FNV-1a) of `${parcelId}:${utcDayIndex}`, re-seeded each day — **no `Math.random`**. Daily ETc 3–6 mm spread over 06:00–18:00 UTC on a sine curve; % change = `mm / 4` (0.4 m root zone); flat at night; ~15 % of days rain 6–20 mm at a seeded hour, adding `effectiveRain / 4` % (`P_eff = max(0, (P − 5) × 0.75)`); whenever moisture ≤ MAD threshold in history, an `AUTOMATED_DEFICIT` `COMPLETED` 45 min event refills to FC (`irrigationMm = (FC − moisture) × 4`). Clamp to `[WP, saturation]`. `24h` → the last 24 hourly history points (`resolution: 'hour'`, `etcMm` = that hour's ETc). `7d` / `30d` → daily rows (last value ≤ `nowMs` within each UTC day, daily sums), then 7 forecast days (`isForecast: true`, no events). Budget `currentMoisturePct` = last history value; `hoursUntilTrigger: null`; `systemFlowRateLpm: 100`; name/crop/soil from hints → `sampleFarmMap` by id → `Sample parcel`; unknown soil → Sandy Loam with `soilProfileName: 'Sandy Loam (sample default)'`. Simulator per spec §8; `startManual` throws `Error(ACTIVE_RUN_MESSAGE)` while a run is IN_PROGRESS (import the constant from Task 3).

- [ ] **Step 1: Write the failing tests**: same inputs → `deepEqual` outputs; different parcel ids → different series; two calls on the **same UTC day, 3 hours apart** → identical values for the shared history hours; every history moisture within `[WP, saturation]`; `24h` has 24 points, `resolution: 'hour'`, no forecast; `7d` has 7 history + 7 forecast; `30d` has 30 + 7 and ≥ 1 `AUTOMATED_DEFICIT` event; night hours (00–05 UTC) change by < 0.05 % between consecutive points when that hour has no rain or event; budget `currentMoisturePct` === last `24h` point === last `7d` history point; hint `soilProfileId: 'clay'` → FC 38; no hint, unknown id → FC 22 and name `Sample parcel`; sample parcel id `20700000-0000-4000-8000-000000000001` → `Demo west parcel`; simulator Opening (< 3 s) → Pumping → Closed (after duration) with `lastEvent` COMPLETED; second `startManual` during a run throws `ACTIVE_RUN_MESSAGE`; abort returns `ABORTED` and status becomes `CLOSED`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; lint + build pass.
- [ ] **Step 5: Commit** `feat(irrigation): add deterministic sample telemetry and valve simulator`

---

### Task 5: Irrigation service and configuration

**Files:**
- Create: `frontend/src/utils/irrigationConfig.ts`
- Create: `frontend/src/services/irrigationService.ts`
- Create: `frontend/scripts/test_irrigation_service.js`
- Modify: `frontend/package.json` (append)
- Modify: `frontend/.env.example` (add the two keys of spec §7 with comments in the file's existing style)

**Interfaces:**
- Consumes: Tasks 1, 3 and 4.
- Produces in `utils/irrigationConfig.ts`:
  - `IrrigationConfig { apiBaseUrl: string; mode: IrrigationDataMode; pollMs: number }`
  - `resolveIrrigationConfig(env: Partial<Record<'VITE_API_BASE_URL' | 'VITE_IRRIGATION_DATA_MODE' | 'VITE_IRRIGATION_POLL_MS', string>>): { config: IrrigationConfig; error: null } | { config: null; error: string }` — defaults `http://localhost:5051`, `auto`, `15000`; poll below 5000 or non-numeric → 5000 / 15000 respectively; invalid mode or URL → error string (same URL rules as `resolveFarmMapConfig`).
  - `combineSources(sources: (Sourced<unknown> | null)[], mode: IrrigationDataMode): { label: 'Live data' | 'Sample data' | 'Sample data — live data unavailable' | 'Partly sample data — some live data unavailable' | 'Loading…'; anySample: boolean }` — nulls ignored; all null → `Loading…`.
  - `controlsEnabled(statusSource: DataSource | null, mode: IrrigationDataMode): boolean` — `mode === 'sample' || statusSource === 'api'`.
- Produces in `services/irrigationService.ts`:
  - `class IrrigationRequestError extends Error` with a declared `status: number` field (assigned in the constructor — no parameter properties) — thrown for 400 / 409 / 422; message from body `detail ?? title ?? message`, else `Request failed (HTTP <status>).`
  - `parseWaterBudget(json: unknown): WaterBudget`, `parseTelemetry(json: unknown): TelemetryResponse`, `parseIrrigationStatus(json: unknown): IrrigationStatus`, `parseIrrigationEvent(json: unknown): IrrigationEvent` — throw `Error('Malformed water budget response.')` / `'Malformed telemetry response.'` / `'Malformed irrigation status response.'` / `'Malformed irrigation event response.'` on missing or wrong-typed required fields; apply `normalizeSoilPercent` to FC / WP / saturation only (budget and `telemetry.soil`).
  - `RequestOptions { config: IrrigationConfig; parcelId: string; signal?: AbortSignal; fetchImpl?: typeof fetch; nowMs?: number; timeoutMs?: number; hints?: SampleHints }`
  - Reads → `Sourced<T>`; `auto` falls back to sample on 404 / 5xx / network / timeout with `fallbackReason`; `api` throws; `sample` makes no request: `fetchWaterBudget(o)`, `fetchTelemetry(o & { window: TelemetryWindow })`, `fetchIrrigationStatus(o)` (sample status comes from `sampleValveSimulator.getStatus`).
  - Writes → `IrrigationEvent`; **never fall back**: in `sample` mode they call `sampleValveSimulator`; in `auto` and `api` they call the API and throw on any failure: `startManualIrrigation(o & { durationMinutes: number })`, `abortIrrigation(o & { eventId: string })`.
  - `sampleValveSimulator` — module-level `createSampleValveSimulator()` instance shared by reads and writes.
  - URLs: `${base}/api/v1/parcels/${encodeURIComponent(parcelId)}/water-budget`, `/telemetry?window=<w>`, `/irrigation/status`, `POST /irrigate-manual` body `{"durationMinutes":N}`, `POST /irrigation/${encodeURIComponent(eventId)}/abort`.

Request mechanics copy the pattern in `services/farmMapService.ts` `loadParcelMapData` (own `AbortController`, caller-signal forwarding, `Promise.race` with a cancellation promise, 5,000 ms default timeout, caller abort → `DOMException('…', 'AbortError')`), written once as a private `requestJson` helper in `irrigationService.ts`. Do not modify `farmMapService.ts`.

- [ ] **Step 1: Write the failing tests** with a fake `fetchImpl`:
  - config: defaults; `VITE_IRRIGATION_POLL_MS=1000` → 5000; `=abc` → 15000; `mode=bogus` → error; `ftp://x` → error.
  - `combineSources`: all api → `Live data`; all sample in `auto` → `Sample data — live data unavailable`; mode `sample` → `Sample data`; mixed → `Partly sample data — some live data unavailable` with `anySample: true`; all null → `Loading…`.
  - `controlsEnabled('sample', 'auto') === false`; `('api', 'auto') === true`; `('sample', 'sample') === true`; `(null, 'api') === false`.
  - `auto` + 404 → `source: 'sample'`, `fallbackReason` contains `HTTP 404`; `auto` + network throw → sample; `auto` + never-resolving fetch with `timeoutMs: 20` → sample.
  - `api` + 404 → rejects; `api` + 500 → rejects.
  - `auto` + 409 → rejects with `IrrigationRequestError`, `status === 409`, **no fallback**.
  - `{}` body → rejects with `Malformed water budget response.`
  - `parseWaterBudget normalizes only soil constants`: `fieldCapacityPct: 0.22` → `22`, `currentMoisturePct: 0.8` → `0.8`; null soil constants stay null.
  - `parseTelemetry` normalizes `soil.fieldCapacityPct: 0.32` → `32` and accepts `soil: null`.
  - `sample` mode → `fetchImpl` never called.
  - `startManualIrrigation never falls back in auto mode`: 503 → rejects; `sampleValveSimulator.getStatus(id, now).valveState` is still `CLOSED`.
  - POST body is exactly `{"durationMinutes":30}` with `Content-Type: application/json`; parcel id `a/b` is encoded as `a%2Fb`; telemetry URL ends with `/telemetry?window=7d`.
  - caller abort → rejects with `name === 'AbortError'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; lint + build pass.
- [ ] **Step 5: Commit** `feat(irrigation): add irrigation service with auto/api/sample modes`

---

### Task 6: Page shell, data hooks, route and drawer link

**Files:**
- Create: `frontend/src/utils/irrigationRoutes.ts` (+ tests appended to `frontend/scripts/test_irrigation_service.js`)
- Create: `frontend/src/hooks/usePolledResource.ts`
- Create: `frontend/src/hooks/useValveControl.ts`
- Create: `frontend/src/hooks/useNow.ts`
- Create: `frontend/src/components/Irrigation/defaultIrrigationConfig.ts`
- Create: `frontend/src/pages/ParcelIrrigationPage.tsx`
- Modify: `frontend/src/App.tsx` (lazy route)
- Modify: `frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx` (edit-mode link)

**Interfaces:**
- Consumes: Tasks 1, 3, 5.
- Produces:
  - `waterDashboardPath(parcelId: string, hints?: SampleHints): string` → `/parcels/${encodeURIComponent(parcelId)}/irrigation` plus `?name=&crop=&soil=` for non-empty hints (via `URLSearchParams`).
  - `readDashboardHints(search: string): SampleHints` — inverse; always returns all three keys, missing/empty ones set to `undefined`.
  - `defaultIrrigationConfig.ts` exports `DEFAULT_IRRIGATION_CONFIG = resolveIrrigationConfig({ VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL, VITE_IRRIGATION_DATA_MODE: import.meta.env.VITE_IRRIGATION_DATA_MODE, VITE_IRRIGATION_POLL_MS: import.meta.env.VITE_IRRIGATION_POLL_MS })` (the resolve result object). Components and the page default to it.
  - `usePolledResource<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number, key: string): { data: T | null; dataRequestedAt: number | null; error: string | null; loading: boolean; updatedAt: number | null; refresh: () => void }` — keeps the latest `load` in a ref; (re)starts on mount and whenever `key` changes; keeps the last `data` through errors; aborts the in-flight request on unmount/key change and ignores results of superseded requests; skips ticks while `document.visibilityState === 'hidden'` and refreshes immediately when the tab becomes visible; `dataRequestedAt` is the `Date.now()` at which the request that produced `data` was sent.
  - `useNow(intervalMs: number, enabled: boolean): number` — `Date.now()` ticking only while enabled.
  - `useValveControl(parcelId: string, config: IrrigationConfig): { display: ValveDisplay; state: ValveControlState; source: DataSource | null; controlsEnabled: boolean; start(durationMinutes: number): Promise<void>; stop(): Promise<void>; dismissError(): void; refresh(): void }` — `useReducer(valveControlReducer)`; polls `fetchIrrigationStatus` via `usePolledResource` at `config.pollMs` and dispatches `poll-received` with `requestStartedAtMs = dataRequestedAt` whenever new data arrives; `controlsEnabled = controlsEnabled(source, config.mode)`; `start`/`stop` return immediately if a synchronous `inFlightRef.current` is set or the derived display says they're not allowed, otherwise set the ref, dispatch `*-requested`, call `startManualIrrigation` / `abortIrrigation` with the **configured** mode, dispatch success/failure (`IrrigationRequestError` message or `Could not reach the irrigation service.`), clear the ref, then `refresh()`; `stop` uses `stoppableEventId(state)`. Uses `useNow(1000, <pending or active/pending event>)`.
  - `ParcelIrrigationPage` (named export) — reads `:parcelId` and `readDashboardHints(location.search)`; shows a configuration-error state when `DEFAULT_IRRIGATION_CONFIG.config` is null; polls the water budget and a `24h` telemetry feed (for the gauge) at `config.pollMs`; renders the header of spec §5.2 (back link `← Field map` to `/map`, parcel name · crop · soil from the budget or hints, combined source label via `combineSources`, `Updated hh:mm:ss`, Refresh button that refreshes every resource) and the responsive grid (§5.2 order on mobile) with three placeholder `<section>`s titled `Water budget`, `Valve control`, `Soil moisture & water inputs` that Tasks 7–9 replace. A budget `404` in `api` mode → "Parcel not found" state with a link to `/map`.
  - Route in `App.tsx`: `<Route path="/parcels/:parcelId/irrigation" element={…} />` using the same `lazy` + `Suspense` pattern as `FieldMapPage` (fallback text `Loading water dashboard…`).
  - Drawer: in edit mode with a known id, render `<Link to={waterDashboardPath(id, { parcelName: name, cropName, soilProfileId })}>Open water dashboard</Link>` styled like the drawer's secondary buttons; nothing in create mode.

- [ ] **Step 1: Add tests** — `waterDashboardPath('a b')` → `/parcels/a%20b/irrigation`; with hints `{ parcelName: 'North & South', soilProfileId: 'clay' }` → `/parcels/x/irrigation?name=North+%26+South&soil=clay`; `readDashboardHints('?name=North+%26+South&soil=clay')` → `{ parcelName: 'North & South', cropName: undefined, soilProfileId: 'clay' }`. Run `npm --prefix frontend run test:irrigation` → FAIL.
- [ ] **Step 2: Implement** the util, config module, hooks, page shell, route and drawer link.
- [ ] **Step 3: Verify** `test:irrigation` PASS; `npm --prefix frontend run test:map` still PASS; lint passes with no new warnings; build succeeds with a separate chunk for `ParcelIrrigationPage`.
- [ ] **Step 4: Browser check** — start the `frontend` preview (`.claude/launch.json`); with no backend running open `/parcels/20700000-0000-4000-8000-000000000001/irrigation`: header shows `Sample data — live data unavailable` and `Demo west parcel`; from `/map` click a parcel → drawer shows `Open water dashboard` → navigates with hints; switch to another tab and back → network panel shows polling paused while hidden and an immediate refresh on return. No console errors.
- [ ] **Step 5: Commit** `feat(irrigation): add parcel water dashboard page shell and route`

---

### Task 7: `<DeficitGauge>` (TODO-309)

**Files:**
- Create: `frontend/src/components/Irrigation/DeficitGauge.tsx`
- Create: `frontend/src/components/Irrigation/irrigation.css` (keyframes and `prefers-reduced-motion` rules only)
- Create: `frontend/src/components/Irrigation/index.ts` (barrel, like other component folders)
- Modify: `frontend/src/pages/ParcelIrrigationPage.tsx` (replace `Water budget` placeholder)

**Interfaces:**
- Consumes: `computeDeficit`, `zoneTone`, `estimateTrigger`, `isStale`, `gaugeAngleDeg`, `gaugeAriaValueNow` (Task 1).
- Produces: `DeficitGauge(props: { currentMoisture: number | null; fieldCapacity: number | null; wiltingPoint: number | null; mad: number | null; hoursUntilTrigger?: number | null; recentSamples?: { timestamp: string; soilMoisturePct: number | null }[]; latestReadingAt?: string | null; nowMs?: number })` — the TODO's three props are the core; the rest are optional (defaults `null`, `[]`, `null`, `Date.now()`). The page passes budget values and the page-level `24h` points.

Render per spec §5.5: SVG 240° arc with three zone segments at ratios 0–0.5, 0.5–1.0, 1.0–1.5 of RAW; indicator at `gaugeAngleDeg(ratio)` animated by `transform` 300 ms ease-out (removed under `prefers-reduced-motion` in `irrigation.css`); centre `NN % of RAW` (real value, may exceed 150); zone label + icon (check / alert-triangle / octagon-alert) with tone colors `ag-risk-healthy` / `ag-risk-low` / `ag-risk-critical`; sub-readout `Moisture X % · FC Y % · MAD Z %`; trigger readout per `TriggerEstimate` (`Automatic irrigation in ~N h` — one decimal under 10 h else integer; `Trigger threshold reached`; `Not drying — no trigger expected`; `Not enough data to estimate`); `Stale · last reading N h ago` badge when `isStale`; no current moisture → `No soil moisture readings yet`; soil constants null → `Soil profile not set — assign one on the field map` with link to `/map`. `role="meter"`, `aria-valuemin={0}`, `aria-valuemax={150}`, `aria-valuenow={gaugeAriaValueNow(ratio)}`, `aria-valuetext` like `77 % of readily available water used — irrigation soon`.

- [ ] **Step 1: Implement and wire into the page.**
- [ ] **Step 2: Verify** lint + build pass; `test:irrigation` PASS.
- [ ] **Step 3: Browser check** in sample mode: gauge renders; zone color, icon and label match the numbers; indicator sits in the matching zone; `irrigation.css` contains the reduced-motion rule; mobile preset (375 px) has no horizontal scroll; reset viewport afterwards.
- [ ] **Step 4: Commit** `feat(irrigation): add deficit gauge (TODO-309)`

---

### Task 8: `<ParcelTelemetryChart>` (TODO-307)

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json` (`npm --prefix frontend install recharts@3.10.1 --save-exact`)
- Create: `frontend/src/components/Irrigation/ParcelTelemetryChart.tsx`
- Create: `frontend/src/components/Irrigation/TelemetryWindowToggle.tsx`
- Modify: `frontend/src/components/Irrigation/index.ts`, `frontend/src/pages/ParcelIrrigationPage.tsx`

**Interfaces:**
- Consumes: Task 2 model, `fetchTelemetry` (Task 5), `usePolledResource`, `DEFAULT_IRRIGATION_CONFIG`, `readDashboardHints` (Task 6).
- Produces:
  - `ParcelTelemetryChart(props: { parcelId: string; config?: IrrigationConfig; hints?: SampleHints; onSourceChange?: (source: Sourced<unknown> | null) => void })` — owns its window state (default `'7d'`) and polling (60,000 ms, key `${parcelId}|${window}`); soil bands come from the telemetry response's `soil`; reports its `Sourced` to the page for the combined header label; shows a `Sample` tag when its own data is sample.
  - `TelemetryWindowToggle(props: { value: TelemetryWindow; onChange(w: TelemetryWindow): void; disabled?: boolean })` — three `<button aria-pressed>` labelled `24 h`, `7 d`, `30 d` inside `role="group" aria-label="Chart time window"`.

Render per spec §5.3: `ResponsiveContainer` (height 320 px ≥ 640 px wide, 260 px below), `ComposedChart` over `buildChartRows(...)`, X axis ticks via `formatBucketLabel`; left `YAxis` (`Soil VWC (%)`, `#0891B2`) and right `YAxis` (`Precipitation & Irrigation (mm)`, `#64748B`) with `computeAxisDomains`; `ReferenceArea`s for the three soil bands from `soilBands` and for the forecast span; `ReferenceLine`s for saturation / FC / MAD; solid moisture `Line` (`connectNulls={false}`), dashed forecast `Line`, dashed ETc `Line` on the right axis (omitted when every row's `etcMm` is null); stacked `Bar`s (`stackId="water"`, `maxBarSize={14}`, top radius 2) for effective rain `#38BDF8` and irrigation `#10B981` @ 0.85; custom tooltip rendering `tooltipLines(row, mad)` with `font-mono tabular-nums`. Wrapper `role="img"` + `aria-label={chartAriaLabel(...)}` and a sibling visually hidden `<p>` with `latestValuesSummary(rows)`. Loading skeleton of the same height; empty state `No sensor readings yet for this window`; error state with Retry; while a new window loads, keep the previous chart at 50 % opacity with the toggle disabled.

- [ ] **Step 1: Install recharts 3.10.1 exactly**; confirm `package.json` shows `"recharts": "3.10.1"`.
- [ ] **Step 2: Implement** the toggle, chart and page wiring.
- [ ] **Step 3: Verify** lint + build pass; build output shows Recharts in the `ParcelIrrigationPage` chunk and the main entry chunk size unchanged within ±5 % of the pre-task build (record both numbers).
- [ ] **Step 4: Browser check** in sample mode: all three windows render; 7 d / 30 d show the dashed forecast section with its shading; the three soil bands and MAD line are visible; ETc line visible on 7 d / 30 d; hovering a bar with an irrigation event shows `Valve opened: 45 min (Automatic)`; switching windows keeps the old chart dimmed until the new data arrives; mobile preset has no horizontal scroll; reset viewport afterwards.
- [ ] **Step 5: Commit** `feat(irrigation): add parcel telemetry chart (TODO-307)`

---

### Task 9: `<IrrigationControlCard>` (TODO-308)

**Files:**
- Create: `frontend/src/components/Irrigation/IrrigationControlCard.tsx`
- Create: `frontend/src/components/Irrigation/ValveStatusBadge.tsx`
- Create: `frontend/src/components/Irrigation/ManualIrrigationDialog.tsx`
- Modify: `frontend/src/components/Irrigation/irrigation.css` (droplet pulse keyframes + reduced-motion), `index.ts`, `frontend/src/pages/ParcelIrrigationPage.tsx`

**Interfaces:**
- Consumes: `useValveControl`, `DEFAULT_IRRIGATION_CONFIG` (Task 6); `MANUAL_DURATIONS`, `DEFAULT_MANUAL_DURATION`, `formatCountdown`, `formatStartsIn`, `estimateVolumeLiters` (Task 3).
- Produces:
  - `IrrigationControlCard(props: { parcelId: string; config?: IrrigationConfig; onSourceChange?: (source: Sourced<unknown> | null) => void })`
  - `ValveStatusBadge(props: { label: ValveDisplay['label']; tone: ValveDisplay['tone'] })` — classes from spec §5.4 / COMPONENTS §1.2; wrapper `role="status" aria-live="polite"` containing only the label text.
  - `ManualIrrigationDialog(props: { open: boolean; flowRateLpm: number; onConfirm(durationMinutes: number): void; onClose(): void })` — native `<dialog>`; an effect calls `showModal()` only when `open && !dialog.open` and `close()` when `!open && dialog.open`; `onClose` is driven by the dialog's `close` event (covers Esc); backdrop click closes; initial focus on the selected duration; durations as `aria-pressed` buttons; estimated volume `≈ 3,000 L` (`en-US` grouping, mono).

Card content per spec §5.4: badge; `Simulated` tag when `config.mode === 'sample'`; `Sample` tag + `Controls unavailable — live data unavailable` notice when `!controlsEnabled`; flow `X L/min`; `Time left mm:ss` (`aria-hidden`) + visually hidden `Valve closes at hh:mm` while a run with `actualStart` is active; `Starts in …` / `Starting…` for pending runs; target volume line; last trigger reason (`Automatic — MAD exceeded` / `Manual override`); `Water now` (disabled with `startBlockedReason` as helper text when `!canStart`); `Emergency stop` only when `canStop`, with an inline confirm row (`Stop the valve now?` [Stop valve] [Cancel]); inline error alert (`role="alert"`) from `state.error` prefixed `Could not start irrigation: ` / `Could not stop irrigation: `, with dismiss. Buttons press-scale `0.97` (MOTION spec), visible focus rings, ≥ 48 px tall on mobile. The countdown text updates every second with no transition.

- [ ] **Step 1: Implement** the three components and page wiring.
- [ ] **Step 2: Verify** lint + build pass; `test:irrigation` PASS.
- [ ] **Step 3: Browser check**:
  - `VITE_IRRIGATION_DATA_MODE=sample`: `Water now` → 15 min → card immediately shows `Opening`, `Time left 15:00` counting down, then `Pumping` with `100 L/min`; `Water now` disabled with `A run is already active — stop it first.`; double-clicking `Start irrigation` creates one run only; `Emergency stop` → confirm → `Stopping` → `Closed`, last trigger `Manual override`; keyboard-only run through the dialog (Tab / Enter / Esc) works and Esc leaves the page state consistent; `Simulated` tag visible.
  - `auto` with no backend: controls disabled with `Controls unavailable — live data unavailable`; no simulated run can be started.
  - `api` with no backend: errors shown per widget; no crash.
  - Restore `frontend/.env.local` to its original content afterwards (do not commit it — it is git-ignored).
- [ ] **Step 4: Commit** `feat(irrigation): add irrigation control card (TODO-308)`

---

### Task 10: Documentation, completion reports and final verification

**Files:**
- Modify: `frontend/README.md` (new section "Parcel Water Dashboard (`/parcels/:parcelId/irrigation`)" — route, data modes incl. the controls rule, env keys, proposed endpoints table pointing to spec §6, sample-mode behaviour, test command)
- Create: `PROJECT_DETAILS/Reports/Phase 3/TODO-307-telemetry-chart.md`, `TODO-308-valve-control-card.md`, `TODO-309-deficit-gauge.md` — format of `PROJECT_DETAILS/Phase Plans/Task Completion.md` §7 + §12 (frontend section). Acceptance criteria that depend on the not-yet-built backend (live telemetry stream, real `irrigate-manual` endpoint) are checked against sample mode and listed under "Remaining Work: verify against backend once TODO-301–306 land"; use `PARTIALLY DONE` for any criterion that genuinely cannot be verified, never `DONE` by assumption. Each report lists the "(my call)" decisions from the spec that affect it.

- [ ] **Step 1: Write README section and the three reports.**
- [ ] **Step 2: Full verification** — run and record actual output in the reports:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run test:irrigation`
  - `npm --prefix frontend run test:map`, `test:diagnostics`, `test:agronomy` (regression)
  - `git diff --stat main...HEAD -- backend ml-service docker` → **empty**
- [ ] **Step 3: Commit** `docs(irrigation): add Phase 3 frontend README section and completion reports`
- [ ] **Step 4: Do not push.** Report branch name and commit list to the user.
