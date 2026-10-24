# Mobile PWA & High-Sunlight Field Ergonomics Specification
**System Designation:** "Precision Ag-Intelligence"  
**Scope:** Outdoor Sunlight Visibility, Mobile PWA Camera Workflow, Touch Ergonomics, and Geolocation UX  
**Document Code:** `SPEC-DES-005`  

---

## 1. The High-Sunlight Outdoor Challenge

Field agronomists and scouts inspect crops under extreme ambient lighting ($20{,}000\text{ to }80{,}000\text{ lux}$ direct sunlight in Mediterranean, Aegean, and Central Anatolian agricultural zones). 

```
[ AMBIENT SUNLIGHT: 50,000+ LUX ]
      │
      ├── Dark Mode Screen   --> Fails. Screen acts as a black mirror reflecting the user's face and sun glare.
      ├── Low-Contrast Text  --> Fails. Light gray (#94A3B8) text washes out into pure invisible white.
      └── Thin Pastel Badges --> Fails. Light yellow and mint borders disappear entirely.
```

**The Solution: High-Noon Light Mode Hardening.**
* Pure white card surfaces (`#FFFFFF`) to reflect maximum ambient illumination.
* Deep obsidian ink (`#0F172A`) providing a minimum **$15:1$ contrast ratio** for primary data points.
* Reinforced 1.5px structural borders (`#9CA3AF`) defining button edges and container perimeters without relying on blurry drop shadows.

---

## 2. In-Field Touch Ergonomics & Thumb Zone

Field scouts operate smartphones or ruggedized field tablets one-handed while walking through crop rows or inspecting foliage with the other hand.

```
+------------------------------------+
|  [ TOP: Status & Passive Info ]    |  <-- Hard to reach (View-only info)
|  - GPS Accuracy Badge              |
|  - Active Parcel Title             |
|                                    |
|                                    |
|  [ CENTER: Visual Viewfinder ]     |  <-- Natural focus area
|  - Camera Reticle                  |
|  - Leaf Alignment Guide            |
|                                    |
|                                    |
|  [ BOTTOM: Primary Action Arc ]    |  <-- Easiest thumb reach (48px targets)
|  - Capture Photo Button (64px)     |
|  - Confirm & Classify              |
|  - Manual Pin Fallback             |
+------------------------------------+
```

### 2.1 Ergonomic Dimension Rules

* **48px Minimum Hit Targets:** All interactive buttons, tabs, camera triggers, and input fields must measure at least $48 \times 48\text{px}$.
* **Bottom Sheet Drawers:** Inspection results, sensor summaries, and parcel filters must slide up from the bottom of the viewport (`bottom-0 w-full rounded-t-2xl`), keeping primary actions within the natural sweep of the user's thumb.
* **iOS Viewport Safe Areas:** All bottom-docked bars must account for modern mobile hardware home indicators:
```css
.ag-mobile-bottom-bar {
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}
```
* **iOS Zoom Prevention:** Text inputs must strictly specify `font-size: 16px` on mobile viewports to prevent iOS Safari from automatically triggering disruptive page zoom on focus.

---

## 3. Mobile Field Inspection Camera Pipeline (`<MobileFieldScanner />`)

The primary mobile workflow allows scouts to photograph diseased foliage, automatically resolve coordinates, and drop markers onto the farm map.

```
+-----------------------------------------------------------------------------------+
|  FIELD SCANNER: Parcel 01 (North Tomato)                    [ GPS: +/- 4m OK ] [X]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | [ CAMERA VIEWFINDER: <input type="file" capture="environment"> ]            |  |
|  |                                                                             |  |
|  |                          ┌─                       ─┐                        |  |
|  |                             ALIGN SINGLE LEAF                               |  |
|  |                             IN CENTER RETICLE                               |  |
|  |                          └─                       ─┘                        |  |
|  |                                                                             |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  [ TAKE INSPECTION PHOTO ] (Primary 54px CTA: Bio-Teal with Camera Icon)          |
|                                                                                   |
|  Location Source: [(*) Hardware GPS: 38.4237°N, 27.1428°E]  [ Tap to Re-Pin ]     |
+-----------------------------------------------------------------------------------+
```

### 3.1 Geolocation Resolution Hierarchy

The scanner handles hardware GPS realities via a 3-tier fallback sequence:

```
[ 1. Embedded EXIF GPS ] ──(If Available)──> Extract Lat/Lng directly via exifr
       │ (Not present / stripped)
       ▼
[ 2. Browser Geolocation ] ──(High Accuracy)─> navigator.geolocation.getCurrentPosition
       │ (Accuracy > +/- 25m or Denied)
       ▼
[ 3. Tap-to-Pin Map Modal ] ──(Fallback)────> Prompt user to tap exact spot on Parcel Map
```

### 3.2 GPS Accuracy Status Indicators

| Accuracy Radius | Indicator Badge Styling | User Guidance Text |
| :--- | :--- | :--- |
| **$< 10\text{ m}$** | `bg-emerald-50 text-emerald-800 border-emerald-300` | `GPS Locked (+/- 4m)` (Green dot) |
| **$10\text{m} - 25\text{m}$** | `bg-amber-50 text-amber-900 border-amber-300` | `GPS Moderate (+/- 18m)` (Amber dot) |
| **$> 25\text{ m}$ / Denied** | `bg-red-50 text-red-900 border-red-300` | `GPS Degraded - Tap Map to Pin` (Red dot) |

---

## 4. In-Field Diagnostic Result Card

Immediately upon submission to `/api/v1/classify-leaf`, the mobile UI presents a high-clarity diagnosis card before streaming the result to the desktop map.

```
+-----------------------------------------------------------------------------------+
|  [!] DIAGNOSIS: TOMATO LATE BLIGHT                                   [ CONF: 96% ]|
|  Scientific: Phytophthora infestans | Severity: Critical Alert                   |
+-----------------------------------------------------------------------------------+
|  [ IMMEDIATE AGRONOMIC ACTION ]                                                   |
|  "Isolate affected perimeter; restrict overhead irrigation to reduce foliage      |
|   leaf wetness duration. Prepare copper-based preventative fungicide."           |
+-----------------------------------------------------------------------------------+
|  Top Probabilities:                                                               |
|  - Tomato Late Blight:     [========================================] 96.4%       |
|  - Tomato Early Blight:    [=                                       ]  2.8%       |
|  - Tomato Healthy:         [                                        ]  0.8%       |
+-----------------------------------------------------------------------------------+
|  Linked Parcel: Parcel 01 (Contains Coordinates via ST_Contains)                  |
|  [ DISMISS & CONTINUE SCANNING ]               [ VIEW ON INTERACTIVE MAP ]        |
+-----------------------------------------------------------------------------------+
```

### 4.1 Card Specification

* **Header Color Banner:** Colored according to the 4-tier severity ramp (`#DC2626` for Late Blight).
* **Confidence Bar:** 6px rounded progress track (`bg-slate-200`) with solid fill (`bg-teal-700`).
* **Immediate Action Callout Box:** Solid light yellow ground (`bg-amber-50 border border-amber-300 p-3 rounded-lg text-amber-950 font-medium text-xs leading-relaxed`).
* **Spatial Containment Pill:** Confirms to the field scout that PostGIS automatically mapped their photo to the correct parcel without manual entry.

---

## 5. Offline Resilience & Connection Status Indicator

Field connectivity can drop intermittently between crop rows. The mobile PWA surfaces connection health via a subtle, persistent status pill in the top header:

```
[ (o) LIVE: SignalR Connected ]  |  [ (o) RECONNECTING (Queue: 2 Scans) ]  |  [ (!) OFFLINE ]
```

* **Live Status:** Emerald dot with `Live Telemetry` label (`#059669`).
* **Reconnecting / Queue:** Amber dot with number of pending inspection scans stored in client `IndexedDB` (`#D97706`).
* **Offline:** Solid slate dot indicating changes will sync automatically once network service resumes (`#64748B`).
