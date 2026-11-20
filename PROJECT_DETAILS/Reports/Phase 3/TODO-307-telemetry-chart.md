# TODO-307 Completion Report — Time-Series Environmental & Moisture Charts

**Status:** DONE (frontend). Live-data check pending backend TODO-301–306.

## Summary

Implemented `<ParcelTelemetryChart parcelId />`, a Recharts dual-axis chart on the new Parcel Water Dashboard (`/parcels/:parcelId/irrigation`). It shows:
- soil moisture (VWC %) with a dashed forecast
- crop evapotranspiration (ETc)
- stacked effective-rain and irrigation bars (mm)
- coloured Saturation / Field-capacity / MAD bands

You can switch between 24 h, 7 d and 30 d windows. The backend endpoints don't exist yet, so the chart runs on the proposed contract (spec §6.2), with a deterministic sample-data fallback.

## Changes Made

### Created
- `frontend/src/components/Irrigation/ParcelTelemetryChart.tsx`: the chart, its custom tooltip, legend, and loading, empty and error states.
- `frontend/src/components/Irrigation/TelemetryWindowToggle.tsx`: 24 h / 7 d / 30 d button group (`aria-pressed`).
- `frontend/src/models/telemetryChartModel.ts`: pure logic.
  - Row building and forecast join point.
  - Event bucketing, soil bands and axis domains.
  - UTC day labels, tooltip lines, and the ARIA label and summary.
- `frontend/src/services/irrigationService.ts`, `irrigationSampleData.ts`, `utils/irrigationConfig.ts`: data layer, shared with TODO-308 and TODO-309.
- `frontend/src/pages/ParcelIrrigationPage.tsx`: the page that composes the chart.
- `frontend/scripts/test_telemetry_chart_model.js` and the other `test_irrigation_*` scripts.

### Modified
- `frontend/package.json`: `recharts` pinned to exactly `3.10.1`, plus the `test:irrigation` script.
- `frontend/src/App.tsx`: lazy route `/parcels/:parcelId/irrigation`.

## Implementation Details

- **Left axis:** `Soil VWC (%)`, domain 0–50, which grows to `saturation + 5` when needed.
- **Right axis:** `Precipitation & Irrigation (mm)`, domain 0–40, which grows to 1.2 × the largest bar or ETc value.
- **Line colours and styles:**
  - Moisture: `#0891B2`, 2.5 px, `monotoneX`.
  - Forecast: the same line, dashed.
  - ETc: dashed `#475569`.
- **Bars:** rain `#38BDF8` and irrigation `#10B981`, maximum 14 px wide.
- **Soil bands:**
  - Drainage: field capacity → saturation.
  - Readily available: MAD → field capacity.
  - Stress: 0 → MAD.
  - A solid line marks field capacity and a dashed red line marks the MAD threshold.
- **Windows:** `24h` shows hourly points in local time. `7d` and `30d` show UTC days, plus 7 forecast days.
- **Tooltip:** monospace tabular figures. It shows exact values and flags: `Valve opened: 45 min (Automatic|Manual)`, `Below MAD threshold` and `Forecast`.
- **Refresh:** polls every 60 s. Polling pauses while the tab is hidden. While a new window loads, the previous chart stays visible at 50 % opacity.
- **Accessibility:** the chart has `role="img"` with a summary label, plus a visually hidden text summary of the latest values.
- **Bundle:** Recharts loads only in the lazy `ParcelIrrigationPage` chunk (419 kB). The main entry chunk is 515.63 kB, against a 515.01 kB baseline.

### Decisions made by the planner (spec "my call")
- A dedicated page rather than a panel inside the map.
- ETc is drawn as a line so the chart shows evapotranspiration, as the TODO text asks.
- Axis titles are rendered as HTML above the plot, because the rotated Recharts label was clipped.

## Testing / Validation

| Test | Command | Result |
| --- | --- | --- |
| Chart model unit tests | `npm --prefix frontend run test:irrigation` | PASS (9/9 chart model, 71/71 across the irrigation suites) |
| Lint | `npm --prefix frontend run lint` | PASS (0 warnings) |
| Type-check and build | `npm --prefix frontend run build` | PASS |
| Regression | `npm --prefix frontend run test:map`, `test:diagnostics`, `test:agronomy` | PASS |
| Browser, sample data | dev server, `/parcels/<sample id>/irrigation` | PASS: all 3 windows, forecast shading, bands, ETc line, tooltip flag, 375 px mobile with no horizontal scroll |

## Acceptance Criteria

- [x] Charts toggle cleanly across 24-hour, 7-day and 30-day windows.
- [x] Hovering points displays precise values and status flags (e.g. "Valve opened: 45 min").
- [x] Primary Y-axis is soil VWC % with coloured bands for Saturation, Field Capacity and the MAD threshold.
- [x] Secondary Y-axis has stacked effective-rain and irrigation bars in mm.

## Issues / Notes

- Verified against deterministic sample data only. `GET /api/v1/parcels/{id}/telemetry` doesn't exist yet.
- I couldn't observe the dimming while switching windows, because sample data loads instantly.

## Remaining Work

- Verify against the backend once TODO-301–306 implement the spec §6.2 contract.
