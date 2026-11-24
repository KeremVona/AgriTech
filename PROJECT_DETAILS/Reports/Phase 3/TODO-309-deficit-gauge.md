# TODO-309 Completion Report — Water Budget & Depletion Gauge Widget

**Status:** DONE (frontend). Live-telemetry check pending backend TODO-301–306.

## Summary

Implemented `<DeficitGauge currentMoisture fieldCapacity wiltingPoint mad … />`, a 240° SVG gauge of root-zone depletion as a percentage of Readily Available Water (RAW). It has green, yellow and red zones and a readout of the hours left until the automatic irrigation trigger. It sits on the Parcel Water Dashboard and refreshes with the water-budget poll.

## Changes Made

### Created
- `frontend/src/components/Irrigation/DeficitGauge.tsx`: the gauge, plus states for missing soil profile, no readings, and stale data.
- `frontend/src/components/Irrigation/irrigation.css`: the indicator transition and its `prefers-reduced-motion` override.
- `frontend/src/models/waterBalanceModel.ts`: FAO-56 maths in VWC %.
  - TAW, RAW, depletion and zone.
  - Trigger estimate, staleness, and gauge angle and ARIA value.
- `frontend/src/types/irrigation.ts`: the contract types.
- `frontend/scripts/test_water_balance.js`

## Implementation Details

- **Maths:**
  - `TAW% = FC − WP`
  - `RAW% = MAD × TAW%`
  - `depletion = clamp(FC − current, 0, TAW%)`
  - `ratio = depletion / RAW%`

  Working in % means no rooting depth is needed.
- **Zones:** green `< 0.5`, yellow `0.5–1.0` (labelled *Irrigation soon* from 0.75), red `≥ 1.0`. The phase plan leaves 50–75 % undefined, so treating it as yellow is the planner's call. Each zone has a colour, an icon and a text label.
- **Scale:** the gauge runs from 0 to 150 % of RAW so the stress zone is visible. The centre number shows the real value, even above 150.
- **Trigger readout, checked in this order:**
  1. Threshold reached.
  2. The API's `hoursUntilTrigger`.
  3. A least-squares drying rate over the last 24 h of hourly readings. A full day cycle is used so flat night-time readings don't read as "not drying".
  4. "Not drying — no trigger expected".
  5. "Not enough data to estimate", when there is less than 12 h of data.
- **Data source:** the hourly readings come from a page-level 24 h feed polled at the budget rate (15 s by default), independent of the chart's selected window.
- **Soil constants:** if they arrive as fractions (as `soil_profiles` stores them), they are converted to percent. Moisture readings are never rescaled.
- **Accessibility:** `role="meter"`, `aria-valuenow` clamped to 0–150, and `aria-valuetext` such as "40 % of readily available water used — comfortable". Numbers update instantly. Only the needle animates, over 300 ms, and not at all under reduced motion.

## Testing / Validation

| Test | Command | Result |
| --- | --- | --- |
| Water-balance unit tests (10): core values, zone boundaries 27.1 / 27 / 24.5 / 22, clamping, trigger order and the 24 h window, staleness, gauge angles | `npm --prefix frontend run test:irrigation` | PASS |
| Service tests: soil fractions normalised, moisture not rescaled | same | PASS |
| Lint / build / regression suites | `lint`, `build`, `test:map`, `test:diagnostics`, `test:agronomy` | PASS |
| Browser, sample data | `/parcels/<sample id>/irrigation` | PASS: 40 % = (22 − 19.6) / 6, Comfortable, needle in the green zone; 375 px mobile with no horizontal scroll, gauge first |

## Acceptance Criteria

- [x] The gauge updates immediately when new telemetry arrives on the polling interval. The budget and 24 h feeds poll every 15 s, pause on hidden tabs and refresh on return; this was verified in the browser. WebSocket push is out of scope, and the hook is written so it can be swapped in later.
- [x] It clearly highlights critical water-stress boundaries based on the parcel's soil profile (field capacity, wilting point and MAD from the budget).
- [x] The summary readout shows the estimated hours left before the automatic trigger.

## Issues / Notes

- The "Soil profile not set" state can't occur in sample mode, which defaults to Sandy Loam. It is covered by `budgetSoil` and parser tests (null constants).
- Not yet verified against live MQTT-driven telemetry.

## Remaining Work

- Verify with the backend once `GET /api/v1/parcels/{id}/water-budget` (spec §6.1) exists.
