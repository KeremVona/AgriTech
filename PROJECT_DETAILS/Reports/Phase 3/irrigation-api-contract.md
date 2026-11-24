# Irrigation API Contract (Phase 3 Frontend ↔ Backend)

The frontend water dashboard (`/parcels/:parcelId/irrigation`, TODO-307/308/309) is already on `main` and calls the five endpoints below. They don't exist yet; they belong to TODO-302 to 306. If the backend returns exactly these shapes, the page works with no frontend changes.

Until then, the page shows sample data with a "Sample data" notice.

## General rules

- **Base URL:** `http://localhost:5051` (`VITE_API_BASE_URL`). All routes start with `/api/v1/parcels/{parcelId}`, where `parcelId` is the parcel's UUID.
- **JSON format:** property names are **camelCase**. ASP.NET Core does this by default.
- **Timestamps:** ISO-8601 **UTC** strings, e.g. `"2026-11-20T10:00:00Z"`.
- **Moisture and soil values:** **percent**, e.g. `32.0` and not `0.32`.
  - `madFraction` is the exception. It stays a fraction, e.g. `0.5`.
  - If you send soil constants as fractions from `soil_profiles` (e.g. `0.22`), the frontend multiplies them by 100. Moisture readings are never rescaled.
- **Enums must be these exact UPPERCASE strings.** .NET's default `JsonStringEnumConverter` would send `"AutomatedDeficit"`, which the frontend rejects. Use `[JsonStringEnumMemberName("AUTOMATED_DEFICIT")]`, or plain strings.
- **`null` vs. missing:** for a field marked "or `null`", sending `null` or leaving it out both work. Every other field is required. A missing required field or a wrong type is treated as a malformed response, and the page shows an error.

## Shared object: `IrrigationEvent`

The same object is used in the telemetry, status, start and abort responses.

```json
{
  "id": "3f1c…-uuid",
  "triggerType": "MANUAL_OVERRIDE",
  "status": "IN_PROGRESS",
  "scheduledStart": "2026-11-20T10:00:00Z",
  "actualStart": "2026-11-20T10:00:04Z",
  "completedAt": null,
  "durationMinutes": 30,
  "waterVolumeLiters": 3000.0
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `triggerType` | `AUTOMATED_DEFICIT` \| `MANUAL_OVERRIDE` \| `SCHEDULED_RECIPE` | |
| `status` | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` \| `ABORTED` | |
| `scheduledStart` | timestamp | |
| `actualStart` | timestamp or `null` | `null` while `PENDING`. The countdown uses `actualStart + durationMinutes`. |
| `completedAt` | timestamp or `null` | Set when `COMPLETED` or `ABORTED` |
| `durationMinutes` | number | |
| `waterVolumeLiters` | number | |

---

## 1. `GET /api/v1/parcels/{parcelId}/water-budget`

Used by the gauge (TODO-309) and by the valve card's flow estimate.

```json
{
  "parcelId": "uuid",
  "parcelName": "North Block",
  "cropName": "Tomato",
  "soilProfileId": "sandy_loam",
  "soilProfileName": "Sandy Loam",
  "fieldCapacityPct": 32.0,
  "wiltingPointPct": 12.0,
  "saturationPct": 45.0,
  "madFraction": 0.5,
  "currentMoisturePct": 24.3,
  "latestReadingAt": "2026-11-20T10:00:00Z",
  "hoursUntilTrigger": 18.5,
  "systemFlowRateLpm": 100.0
}
```

- **Required:** `parcelId`, `parcelName` and `systemFlowRateLpm`.
- **Can be `null`:** every other field.
- **No soil profile:** if the parcel has none, send all four soil constants (`fieldCapacityPct`, `wiltingPointPct`, `saturationPct`, `madFraction`) as `null` together. The gauge then shows "no soil profile".
- **No sensor reading yet:** send `currentMoisturePct` and `latestReadingAt` as `null`.
- **`hoursUntilTrigger`:** the FAO-56 estimate of hours until moisture reaches the MAD trigger. Send `null` if unknown.

## 2. `GET /api/v1/parcels/{parcelId}/telemetry?window=24h|7d|30d`

Used by the chart (TODO-307).

```json
{
  "parcelId": "uuid",
  "window": "7d",
  "resolution": "day",
  "soil": { "fieldCapacityPct": 32.0, "wiltingPointPct": 12.0, "saturationPct": 45.0, "madFraction": 0.5 },
  "points": [
    { "timestamp": "2026-11-14T00:00:00Z", "soilMoisturePct": 27.1, "etcMm": 4.2,
      "effectiveRainMm": 0.0, "irrigationMm": 12.0, "isForecast": false },
    { "timestamp": "2026-11-21T00:00:00Z", "soilMoisturePct": 22.4, "etcMm": 4.8,
      "effectiveRainMm": 0.0, "irrigationMm": 0.0, "isForecast": true }
  ],
  "irrigationEvents": [ /* IrrigationEvent[] in this window */ ]
}
```

- **`window`:** echo back the requested window.
- **`resolution`:** `"hour"` for `24h`, `"day"` for `7d` and `30d`. Day buckets are UTC days.
- **`soil`:** the same 4 constants as the water budget, or `null`.
- **`points`:** sorted oldest to newest.
  - `soilMoisturePct`: number or `null`. For daily rows, use the last reading of that UTC day.
  - `etcMm`: number or `null`. It may be `null` on hourly rows, since weather is daily.
  - `effectiveRainMm` and `irrigationMm`: numbers, required. Send the amount within that bucket, or `0` if there was none.
  - `isForecast`: boolean, required. Forecast points come after the real ones. They hold the FAO-56 projection and are drawn dashed.
- **`irrigationEvents`:** runs that overlap the window. Send `[]` if there are none, never `null`.

## 3. `GET /api/v1/parcels/{parcelId}/irrigation/status`

Used by the valve card (TODO-308). The page polls this about every 15 s.

```json
{
  "valveState": "PUMPING",
  "flowRateLpm": 100.0,
  "activeEvent": { /* IrrigationEvent or null */ },
  "nextScheduledEvent": { /* IrrigationEvent or null */ },
  "lastEvent": { /* IrrigationEvent or null */ },
  "serverTime": "2026-11-20T10:00:05Z"
}
```

- **`valveState`:** `CLOSED` | `OPENING` | `PUMPING` | `STOPPING`.
- **`activeEvent`:** a run that is `IN_PROGRESS`, **or a manual run that was accepted but is still `PENDING`**. Otherwise `null`.
- **`nextScheduledEvent`:** the next upcoming automated or scheduled run (`PENDING`), or `null`. Don't put an accepted manual run here; it goes in `activeEvent`.
- **`lastEvent`:** the most recent `COMPLETED` or `ABORTED` run, or `null`.
- **`serverTime`:** the server's current UTC time. The frontend uses it to correct clock drift in the countdown.

## 4. `POST /api/v1/parcels/{parcelId}/irrigate-manual`

Starts a manual run from the "Water now" dialog.

Request body:
```json
{ "durationMinutes": 30 }
```

- **Allowed durations:** `15`, `30`, `45` or `60`.
- **Success:** `202 Accepted`, with the created `IrrigationEvent` as the body. It has `triggerType: "MANUAL_OVERRIDE"` and `status` `"PENDING"` or `"IN_PROGRESS"`.
- **Errors:**
  - `409 Conflict` if a run is already active on this parcel.
  - `400 Bad Request` for any other duration.

## 5. `POST /api/v1/parcels/{parcelId}/irrigation/{eventId}/abort`

Stops a running or pending run. There is no request body.

- **Success:** `200 OK`, with the updated `IrrigationEvent` (`status: "ABORTED"`, `completedAt` set).
- **Errors:**
  - `409 Conflict` if the run has already finished.
  - `404` if the parcel or event is unknown.

---

## Errors: what the frontend does with each status

| Status | Frontend behaviour |
|---|---|
| `400`, `409`, `422` | Shown to the user as an inline message. Use a message the user can read. |
| `404`, `5xx`, network failure, or no answer within **5 s** | In `auto` mode, read endpoints switch to sample data with a notice. Start and abort **never** fall back; they show an error. |
| `200`/`202` with the wrong shape | Hard error ("Malformed … response"). |

**Error message text:** the frontend reads the message from the JSON body: `detail`, then `title`, then `message`. ASP.NET's `Problem(detail: "A run is already active.", statusCode: 409)` works out of the box.

## How to test against the frontend

In `frontend/.env.local`:
```
VITE_API_BASE_URL=http://localhost:5051
VITE_IRRIGATION_DATA_MODE=api
```
`api` mode never falls back to sample data, so any contract mismatch shows up as an error on the page.

Then open `http://localhost:5173/parcels/<parcel-uuid>/irrigation`. You can also click "Open water dashboard" in a parcel's drawer on `/map`.

The full design spec, with the reasoning behind these shapes, is in `docs/superpowers/specs/2026-11-20-phase3-irrigation-frontend-design.md`, §6.
