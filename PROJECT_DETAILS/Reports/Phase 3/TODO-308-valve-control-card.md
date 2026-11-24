# TODO-308 Completion Report — Interactive Valve Override & Status Control Panel

**Status:** PARTIALLY DONE. The frontend is complete and verified against the simulator. The end-to-end call to `POST /api/v1/parcels/{id}/irrigate-manual` is blocked until the backend endpoint exists (TODO-306).

## Summary

Implemented `<IrrigationControlCard parcelId />`, which has:
- a live valve badge (`Closed`, `Opening`, `Pumping: X L/min`, `Stopping`)
- a countdown to valve cutoff
- the next automatic run
- a **Water now** dialog (15 / 30 / 45 / 60 min)
- an **Emergency stop** with confirmation

Valve-state transitions live in a pure reducer, which handles optimistic updates, rollback, polling races and the server clock offset.

## Changes Made

### Created
- `frontend/src/components/Irrigation/IrrigationControlCard.tsx`: the card.
- `frontend/src/components/Irrigation/ValveStatusBadge.tsx`: the badge, using the COMPONENTS §1.2 classes and a `role="status"` live region.
- `frontend/src/components/Irrigation/ManualIrrigationDialog.tsx`: native `<dialog>` with duration buttons and an estimated volume.
- `frontend/src/models/valveControlModel.ts`: the reducer, display derivation and formatters.
- `frontend/src/hooks/useValveControl.ts`: status polling, the reducer, and a synchronous double-submit guard.
- `frontend/src/hooks/usePolledResource.ts`, `useNow.ts`: polling that pauses on hidden tabs, and the countdown clock.
- `frontend/scripts/test_valve_control_model.js`

### Modified
- `frontend/src/components/FarmMap/ParcelMetadataDrawer.tsx`: adds the **Open water dashboard** link in edit mode.
- `frontend/src/components/FarmMap/FarmMapViewport.tsx`, `farmMapPolicy.ts`: fix for an existing crash. Navigating away from `/map` called `map.stop()` on an already-removed Leaflet map and blanked the app. It was reproduced through the existing Home link and is fixed in a separate commit with a test.

## Implementation Details

- **Optimistic start:** "Start irrigation" immediately shows `Opening` with a countdown. On success the server event replaces the optimistic state. On failure the card rolls back to the previous state and shows an inline error.
- **Polling races:** a poll that arrives while a write is in flight is ignored. A poll that was sent before the write settled is discarded when it arrives.
- **Double submit:** a synchronous ref guard in the hook means a double click sends one request. This was verified in the browser.
- **Countdowns:** computed from server timestamps plus the clock offset reported in `serverTime`, and never negative.
- **Scheduled runs:** a pending automated run shows `Starts in …`.
- **Manual block:** manual watering is blocked only while a run is `IN_PROGRESS` ("A run is already active — stop it first."), matching the backend's 409.
- **Safety:** in `auto` mode, if the valve status falls back to sample data, both controls are disabled with "Controls unavailable — live data unavailable". Writes never fall back to the simulator. In `sample` mode the card is tagged `Simulated`.
- **Dialog:** focus goes to the selected duration. Esc, the backdrop, Cancel and Start all close it through explicit handlers. The native `close` event never fired in the embedded test browser (Chrome 156), so it is only a fallback.
- **Accessibility:** the badge announces state changes. The ticking countdown is `aria-hidden`, with a visually hidden "Valve closes at hh:mm". Touch targets are at least 48 px on mobile. Buttons press-scale to 0.97, and the droplet pulse respects `prefers-reduced-motion`.

### Decisions made by the planner (spec "my call")
- Never simulate a pump after a fallback in `auto` mode.
- A pending automated run does not block manual watering.
- A generic "Could not reach the irrigation service." message is shown for network or 5xx write failures.

## Testing / Validation

| Test | Command | Result |
| --- | --- | --- |
| Valve reducer tests (16): optimistic start, polling races, rollback, double submit, clock offset, pending runs, stop | `npm --prefix frontend run test:irrigation` | PASS |
| Service tests (23): POST body and URL, 409 shown as a user error, writes never fall back in `auto` | same | PASS |
| Lint / build / regression suites | `lint`, `build`, `test:map`, `test:diagnostics`, `test:agronomy` | PASS |
| Browser, `sample` mode | Water now 15 min → Opening 15:00 → Pumping: 100 L/min → Emergency stop → Closed ("Manual override · stopped early"); double click gives one run; keyboard Enter / Tab / Esc | PASS |
| Browser, `auto` mode, no backend | controls disabled with notice | PASS |
| Browser, `api` mode, no backend | per-widget errors with Retry, no crash | PASS |

## Acceptance Criteria

- [x] Manual actuation gives immediate feedback with optimistic UI state updates (simulator and reducer tests).
- [x] Active automated schedules clearly show the time remaining until valve cutoff. This is covered by reducer tests on an automated `IN_PROGRESS` event. The browser showed it for manual runs, because the simulator only creates manual runs.
- [ ] The manual trigger calls `POST /api/v1/parcels/{id}/irrigate-manual` against the real backend.

Reason: the endpoint is not implemented yet (TODO-306). The request shape is verified by unit tests against a fake `fetch`.

## Issues / Notes

- After a successful start, `Opening` stays visible until the next status poll (up to 15 s), because that's how fast the simulator reports `PUMPING`. A real backend may report it sooner.
- In the UI, a failed POST and its rollback were only verified by reducer tests. A failing backend is needed to see it in the browser.

## Remaining Work

- End-to-end test of start and stop once TODO-306 lands, using the spec §6.3–6.5 contract.
