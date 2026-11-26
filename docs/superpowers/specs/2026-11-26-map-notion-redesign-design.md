# Field map — Notion-style redesign

Date: 2026-11-26 · Routes: `/map`, `/fields/:fieldId/parcels` · Branch: `feat/ui-revamp-map`

## Intent

Fourth step of the UI revamp (after `/`, `/diagnostics`, `/disease-progression`). The map is a full-screen tool, so the
redesign is a reskin of the chrome around the map rather than a new layout: same Notion direction (white bar, warm
greys, Inter, quiet borders, dark active states, one teal accent), simple and with little text.

## Goals

- Top bar that matches the other pages: logo, "Field map", field picker, data status, page links (menu on small screens).
- Floating map controls (basemap, zoom, drawing tools, scale/coordinates) as calm white cards.
- Parcel labels that read cleanly: name (+ crop when set), area (+ soil when set).
- Parcel drawer in plain words: one big area number, crop and soil as simple tiles, pill buttons.
- Keep every behaviour: data modes and fallback notices, field routing, drawing/editing/deleting with Geoman,
  kink markers, live area badge, drawer save/discard/delete, water dashboard link, keyboard and focus handling.

## Non-goals

- No change to data loading, GIS utilities, parcel policies or the API contract.

## Builder's calls

- Parcel labels compute the area from the outline when the record has no stored area (the sample data has none,
  which showed "0.00 ha"). "Unassigned" crop and "Unspecified" soil are left out of labels instead of shown.
- The drawer's back arrow is removed; the close button does the same thing.
- Notice titles are sentence case ("Parcel saved", "Parcel removed").
- Page links show in the bar from 1280 px; below that they stay in the ⋯ menu.
