# Design Foundations & Token Specification
**System Designation:** "Precision Ag-Intelligence"  
**Scope:** Core Design Tokens, Color Chemistry, Typography, Elevation, and Spacing Scale  
**Document Code:** `SPEC-DES-002`  

---

## 1. Color Palette & Semantic Token Architecture

All colors in the system are defined with strict semantic names and calibrated for **default light mode**. Every token is engineered to survive high ambient glare outdoor conditions while remaining comfortable during 8-hour desktop monitoring shifts.

### 1.1 Complete Color Token Matrix

```
[ Canvas: #F8FAFC ] [ Surface: #FFFFFF ] [ Muted: #F1F5F9 ] [ Border: #E2E8F0 ]
[ Ink 900: #0F172A ] [ Ink 600: #475569 ] [ Brand: #0F766E ] [ Brand Hover: #115E59 ]
[ Moisture: #0891B2 ] [ Valve On: #10B981 ] [ Valve Off: #64748B ] [ Alert Critical: #DC2626 ]
```

| Semantic Token Name | Hex Code | HSL Value | WCAG Contrast (vs White) | Purpose & Usage Contract |
| :--- | :--- | :--- | :--- | :--- |
| `--ag-canvas` | `#F8FAFC` | `hsl(210, 40%, 98%)` | $1.05:1$ | Background root canvas. Cool Slate 50 tone prevents eye fatigue. |
| `--ag-surface` | `#FFFFFF` | `hsl(0, 0%, 100%)` | $1.00:1$ | Standard container background for cards, modals, and drawers. |
| `--ag-surface-muted`| `#F1F5F9` | `hsl(210, 40%, 96%)` | $1.15:1$ | Table header rows, inactive tab tracks, disabled inputs. |
| `--ag-border` | `#E2E8F0` | `hsl(214, 32%, 91%)` | $1.35:1$ | Standard desktop hairline borders (1px) for UI cards and tables. |
| `--ag-border-field` | `#9CA3AF` | `hsl(218, 11%, 65%)` | $2.85:1$ | High-contrast 1.5px border for mobile PWA controls and outdoor modals. |
| `--ag-border-active`| `#0F766E` | `hsl(175, 77%, 26%)` | $5.70:1$ | Focus rings, selected parcel outlines, active input borders. |
| `--ag-ink` | `#0F172A` | `hsl(222, 47%, 11%)` | $15.8:1$ (AAA) | Primary headings, numeric telemetry readings, critical labels. |
| `--ag-ink-secondary`| `#475569` | `hsl(215, 19%, 35%)` | $6.80:1$ (AAA) | Field units, secondary metadata, table column headers. |
| `--ag-ink-tertiary` | `#64748B` | `hsl(215, 16%, 47%)` | $4.80:1$ (AA) | Helper text, disabled controls, inactive icons. Never use for data. |
| `--ag-brand` | `#0F766E` | `hsl(175, 77%, 26%)` | $5.70:1$ (AAA) | Primary CTA buttons, active state badges, parcel centroid pins. |
| `--ag-brand-hover` | `#115E59` | `hsl(174, 69%, 22%)` | $7.10:1$ (AAA) | Primary button hover and active press state. |
| `--ag-brand-subtle`| `#F0FDFA` | `hsl(166, 76%, 97%)` | $1.08:1$ | Selected row highlight, active navigation pill background. |
| `--ag-telemetry-vwc`| `#0891B2` | `hsl(189, 94%, 37%)` | $4.60:1$ (AA) | Volumetric Water Content (VWC%) metrics and moisture chart lines. |
| `--ag-valve-active` | `#10B981` | `hsl(160, 84%, 39%)` | $3.20:1$ (L/B) | Active solenoid valve actuator, live hydration pulses. |
| `--ag-valve-idle` | `#64748B` | `hsl(215, 16%, 47%)` | $4.80:1$ (AA) | Dormant / closed valve status. |

---

### 1.2 Agronomic Risk & Severity Token Ramp

The platform handles critical biological conditions (e.g., *Late Blight / Phytophthora infestans*, severe soil water depletion below MAD, regional frost risk). These severities follow a strict 4-tier ramp:

```
[ Tier 0: Healthy #059669 ] -> [ Tier 1: Low #D97706 ] -> [ Tier 2: Moderate #EA580C ] -> [ Tier 3: Critical #DC2626 ]
```

| Tier Level | State Label | Text Token | Background Token | Border Token | Agronomic Trigger Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 0** | **HEALTHY / NORMAL** | `#059669` (Emerald 700) | `#ECFDF5` (Emerald 50) | `#A7F3D0` | Foliage asymptomatic ($>90\%$ confidence); Soil VWC within Readily Available Water (RAW). |
| **Tier 1** | **LOW / WATCH** | `#D97706` (Amber 600) | `#FFFBEB` (Amber 50) | `#FDE68A` | Early leaf chlorosis or discrete lesion spotting; soil moisture nearing Management Allowed Depletion (MAD). |
| **Tier 2** | **MODERATE / ALERT** | `#EA580C` (Orange 600) | `#FFF7ED` (Orange 50) | `#FDBA74` | Confirmed foliar infection (e.g., *Alternaria solani*); soil water deficit requires immediate scheduled irrigation. |
| **Tier 3** | **CRITICAL / OUTBREAK**| `#DC2626` (Red 600) | `#FEF2F2` (Red 50) | `#FCA5A5` | Confluent necrosis; active PostGIS DBSCAN pathogen cluster; emergency frost warning ($T_{\min} \le -3^\circ\text{C}$). |

> [!IMPORTANT]
> **Dual Coding Accessibility Mandate:** A color token must NEVER be used in isolation to communicate disease severity or valve status. Every visual status indicator MUST combine:
> 1. The semantic color fill/stroke.
> 2. A distinct icon glyph (e.g., Checkmark for Healthy, Triangle Warning for Tier 1–2, Hexagonal Octagon for Tier 3).
> 3. An explicit text label (e.g., `HEALTHY`, `CRITICAL (DBSCAN CLUSTER)`).

---

## 2. Typography System & Tabular Numerals

The typography system uses **`Geist Sans`** (or `Inter`) for structural interface prose and **`Geist Mono`** (or `JetBrains Mono`) for all IoT telemetry, GPS coordinates, and mathematical formulas.

### 2.1 Type Scale Hierarchy

| Level | Size (px / rem) | Weight | Line Height | Tracking | Recommended Font | Primary Application |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display XL** | `32px / 2.0rem` | Bold (700) | `1.20` | `-0.030em` | `Geist Sans` | Farm Property Overview Header, Executive Metric Summary. |
| **Heading 1** | `24px / 1.5rem` | SemiBold (600)| `1.25` | `-0.025em` | `Geist Sans` | Primary Module Title, GIS Layer Inspector Title. |
| **Heading 2** | `18px / 1.125rem`| SemiBold (600)| `1.30` | `-0.020em` | `Geist Sans` | Parcel Card Header, Telemetry Chart Title, 3D Modal Header. |
| **Heading 3** | `15px / 0.9375rem`| Medium (500) | `1.35` | `-0.010em` | `Geist Sans` | Sub-section grouping, Table Section headers. |
| **Body Regular** | `14px / 0.875rem` | Regular (400) | `1.50` | `0.000em` | `Inter / Geist` | General interface text, inspection notes, diagnostic descriptions. |
| **Body Bold** | `14px / 0.875rem` | SemiBold (600)| `1.50` | `0.000em` | `Inter / Geist` | Emphasized body text, primary button labels. |
| **Body Small** | `13px / 0.8125rem`| Regular (400) | `1.45` | `0.000em` | `Inter / Geist` | Secondary descriptions, dropdown item details, chart legends. |
| **Caption / Tag**| `11px / 0.6875rem`| SemiBold (600)| `1.30` | `+0.040em` | `Geist Sans` | Status badges, category pills, uppercase section anchors. |
| **Telemetry Mono**| `14px / 0.875rem` | Medium (500) | `1.40` | `0.000em` | `Geist Mono` | Soil VWC%, ETc values, battery %, valve duration timers. |
| **Telemetry Big** | `22px / 1.375rem` | Bold (700) | `1.20` | `-0.020em` | `Geist Mono` | Large numeric readouts on field dashboard KPI cards. |

### 2.2 The Rigid Tabular Numbers Rule

```css
/* MANDATORY CSS CLASS FOR ALL TELEMETRY, GPS, AND NUMERIC READOUTS */
.ag-tabular-numeric {
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1, 'cv01' 1, 'zero' 1;
}
```

**Why this rule is inviolable:** When simulated MQTT sensors or live SignalR events broadcast hourly or real-time moisture ticks (e.g., `18.2%` $\to$ `18.9%` $\to$ `19.0%`), proportional fonts cause glyph widths to expand and contract. This causes layout jitter, shifting neighboring badges and buttons by 1–3 pixels hundreds of times per hour. The tabular numbers rule enforces rigid columnar alignment.

---

## 3. Elevation, Materials & Border Hierarchy

In outdoor field environments, multi-layered blurred drop shadows become muddy and invisible. The "Precision Ag-Intelligence" system enforces a **Borders-Over-Shadows** design rule.

### 3.1 Surface Elevation Tokens

```css
/* Level 0: Root Canvas */
--ag-elevation-base: #F8FAFC;

/* Level 1: Standard Dashboard Cards & Containers */
--ag-card-style: {
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
  border-radius: 8px;
}

/* Level 2: Floating GIS HUD & Map Overlays */
--ag-hud-floating-style: {
  background-color: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
  border-radius: 8px;
}

/* Level 3: Deep Inspection Modals (3D Anatomy / Progression Slider) */
--ag-modal-style: {
  background-color: #FFFFFF;
  border: 1px solid #CBD5E1;
  box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.16), 0 1px 3px 0 rgba(15, 23, 42, 0.05);
  border-radius: 12px;
}
```

### 3.2 High-Sunlight Mobile Fallback Rule
When the viewport is detected on mobile (`@media (max-width: 768px)` or field mode toggle active):
1. **Disable `backdrop-filter: blur()`**: Sunlight glare creates visual muddiness behind blurred glass. Swap to `background-color: #FFFFFF` solid.
2. **Double Border Contrast**: Replace `#E2E8F0` with `#9CA3AF` (1.5px solid) around all interactive controls.

---

## 4. Spacing Scale & Layout Grid

The system adheres strictly to an **8-point spatial baseline grid**, with a 4-point sub-grid for dense micro-components.

| Spacing Token | Pixels | Rem Equivalent | Common Layout Application |
| :--- | :--- | :--- | :--- |
| `space-1` | `4px` | `0.25rem` | Micro-gap between status dot and text label; compact badge padding. |
| `space-2` | `8px` | `0.50rem` | Gap between icon and button text; vertical gap in compact list items. |
| `space-3` | `12px` | `0.75rem` | Standard padding inside table cells; compact card padding on mobile. |
| `space-4` | `16px` | `1.00rem` | Standard card interior padding; gap between dashboard widget columns. |
| `space-5` | `20px` | `1.25rem` | Modal header padding; drawer panel padding. |
| `space-6` | `24px` | `1.50rem` | Spacing between major layout sections; page container side margins. |
| `space-8` | `32px` | `2.00rem` | Desktop page header bottom margin; gap between primary layout splits. |
| `space-12`| `48px` | `3.00rem` | Minimum touch-target height for mobile field inspection controls. |

### 4.1 Desktop Spatial Split Canvas (65 / 35 Rule)
For desktop operations monitoring:
* **Primary GIS Canvas (65% width):** Full interactive satellite layer containing GeoJSON parcel boundaries, sensor node centroids, live valve pulse markers, and DBSCAN pathogen heatmaps.
* **Collapsible Analytical Inspector (35% width, min-width `420px`):** Docked right-hand panel containing the active parcel's 14-day soil moisture deficit time-series, FAO-56 Penman-Monteith calculated water balance, and recent disease inspection photos.
