# Water dashboard — Notion-style redesign

Date: 2026-11-26 · Route: `/parcels/:parcelId/irrigation` · Branch: `feat/ui-revamp-water`

## Intent

Fifth step of the UI revamp. Same direction as the other pages (Notion reference: white canvas, warm greys, Inter,
quiet borders, pill buttons, one teal accent), infographic and simple, with plain words instead of agronomy jargon.

## Goals

- Shared `AppHeader`, a "Field map / parcel" breadcrumb, the parcel name as the page title, data status, refresh.
- Three calm cards: soil moisture chart (left), water budget gauge and valve (right) — same layout as before.
- Plain labels: "Refill point" for the MAD threshold, "Full" for field capacity, "Too wet / Comfortable / Too dry"
  for the chart bands, "Crop water use" for ETc, "Rain" and "Watering" for the bars.
- Keep every behaviour: polling, sample fallback and source labels, 24 h / 7 d / 30 d window, gauge states
  (missing soil, no readings, stale), valve status, Water now dialog, emergency stop with confirm, errors and retry.

## Non-goals

- No change to models, services, hooks or the API contract. Tooltip text comes from the chart model and stays.

## Builder's calls

- "Updated" shows hours and minutes in the normal font (no seconds, no mono).
- Gauge readouts become three small stats (Moisture · Full at · Refill at) instead of the "FC / MAD" line.
- The sample tag reads "Sample" / "Simulated" in sentence case.
