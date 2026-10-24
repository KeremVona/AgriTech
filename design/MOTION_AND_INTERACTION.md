# Motion Engineering & Fluid Interaction Guidelines
**System Designation:** "Precision Ag-Intelligence"  
**Scope:** Animation Decision Framework, Spring Physics, Touch Feedback, and Performance Engineering  
**Document Code:** `SPEC-DES-004`  

---

## 1. The Core Motion Philosophy

In a high-stakes agricultural operations system, motion is never purely decorative. Motion serves three concrete human engineering needs:
1. **Safety & Direct Manipulation:** Proving to the operator that the system heard their input instantaneously (zero-latency pointer feedback).
2. **Spatial Continuity:** Preventing jarring perceptual cuts when navigating from multi-hectare farm GIS maps into individual leaf diagnostic scans.
3. **Cognitive Ergonomics:** Directing attention to critical biological anomalies (e.g., active DBSCAN pathogen clusters, soil water depletion below MAD) without inducing visual fatigue.

---

## 2. The Animation Decision Framework

Before implementing any animation, developers and agents must apply this decision hierarchy:

```
[ How often will users encounter this interaction? ]
       │
       ├── > 100 times/day (Table data ticks, keyboard shortcuts, quick filters)
       │    └── DECISION: ZERO ANIMATION. EVER. Hard-cut values instantly.
       │
       ├── Tens of times/day (Tab switching, map layer toggles, row selections)
       │    └── DECISION: Ultra-fast CSS transitions (100ms - 150ms).
       │
       ├── Occasional (Modal opens, slide-out diagnostic sheets, toast notifications)
       │    └── DECISION: Standard physics-based spring or cubic-bezier transition.
       │
       └── Rare / Presentation (First-time onboarding, demo trigger scenarios)
            └── DECISION: Expressive sequence (300ms - 400ms).
```

### Inviolable Motion Rules

* **Rule 1: Never animate high-frequency telemetry ticks.** When simulated MQTT sensors or live SignalR events update soil moisture percentages (`18.2%` $\to$ `18.5%`), do NOT fade or slide the numbers. Update them immediately with `font-variant-numeric: tabular-nums`.
* **Rule 2: Never animate keyboard-initiated actions.** Enter, Escape, Arrow keys, and Command shortcuts must resolve instantly without transition delays.
* **Rule 3: Never animate from `scale(0)`.** Real physical objects do not appear from a single microscopic point. Dialogs, tooltips, and badges must enter from `scale(0.95)` with opacity `0` to feel natural and grounded.
* **Rule 4: Respond on `pointerdown`, not `click`.** Highlight press states the instant the finger or stylus touches the glass. Waiting for touch release feels laggy and disconnected.

---

## 3. Spring Physics & Standard Easing Curves

Following Apple WWDC fluid interface design principles, gesture-driven components (bottom sheets, slider handles, 3D orbit controls) use **spring physics** rather than fixed-duration cubic-bezier curves. Springs adapt dynamically to user velocity, allowing interruptions at any point in time.

### 3.1 Physics Spring Parameters

| Interaction Type | Damping Ratio ($\zeta$) | Response Time ($T$) | Behavior & Characteristics |
| :--- | :--- | :--- | :--- |
| **Drawer / Bottom Sheet** | `0.85` | `0.32s` | Snappy, graceful settle; minimal overshoot on momentum release. |
| **Modal Lightbox Entrance** | `1.00` (Critically Damped)| `0.28s` | Zero bounce; perfectly smooth deceleration into viewport center. |
| **Progression Slider Scrubber**| `1.00` | `0.10s` | Direct 1:1 tracking with zero perceptible lag behind pointer. |
| **3D Hotspot Pin Hover** | `0.75` | `0.22s` | Subtle tactile bounce signaling interactive mesh surface. |

### 3.2 Fixed CSS Bezier Curves (Non-Gesture Dynamic UI)

For state-driven UI where springs are not supported (pure CSS), use these standardized curves:

```css
:root {
  /* Starts fast, decelerates smoothly; ideal for entrances and feedback */
  --ag-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  
  /* Symmetrical smooth curve for toggles and tab sliders */
  --ag-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  
  /* Snappy spring-like curve for popover expansion */
  --ag-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 4. Tactile Feedback & Micro-Interactions

### 4.1 Tactile Press States (`scale(0.97)`)

All clickable and pressable elements (buttons, cards, badges, parcel pins) must implement a subtle scale-down on `:active`:

```css
/* Standard Button Press Feedback */
.ag-interactive-element {
  transition: transform 120ms var(--ag-ease-out), background-color 150ms ease;
  will-change: transform;
}

.ag-interactive-element:active {
  transform: scale(0.97);
}
```

### 4.2 Origin-Aware Popovers vs. Centered Modals

* **Popovers & Dropdowns:** Must scale out directly from the button or trigger that opened them (`transform-origin: var(--transform-origin)`). Scaling from the center looks detached and unanchored.
* **Modals & Dialogs (Exception):** Deep inspection modals (such as the 3D Anatomy Explorer) remain centered on the viewport (`transform-origin: center`).

```css
/* Popover origin styling */
.ag-popover[data-side='bottom'] {
  transform-origin: top center;
}
.ag-popover[data-side='top'] {
  transform-origin: bottom center;
}
```

### 4.3 Tooltip Optimization: Skip Delay on Subsequent Hovers

To prevent frustrating UI latency when scanning dense telemetry rows:
1. The first tooltip has a `300ms` delay before appearing to prevent accidental distraction.
2. Once any tooltip is active, moving the cursor to an adjacent item opens the next tooltip **instantly (`0ms` delay)** with zero animation.

```css
.ag-tooltip {
  transition: opacity 120ms ease-out, transform 120ms ease-out;
  transform: scale(0.96);
  opacity: 0;
}

.ag-tooltip[data-state='delayed-open'] {
  transform: scale(1);
  opacity: 1;
}

/* Instant switch on adjacent tooltip hover */
.ag-tooltip[data-instant='true'] {
  transition-duration: 0ms !important;
}
```

---

## 5. Performance & Hardware Acceleration

During heavy rendering loads (e.g., rotating a 40,000-polygon 3D plant in React Three Fiber while simultaneously ingesting MQTT telemetry), JavaScript-driven animations (Framer Motion / `requestAnimationFrame`) can drop frames.

### 5.1 CSS Transitions Beat JS Under Load
* Run predetermined UI animations (drawer slides, modal fades, active valve pulse rings) on the compositor thread using pure CSS transforms and opacity.
* Never animate properties that trigger CPU layout reflows (`width`, `height`, `top`, `left`, `margin`, `padding`). **Always use `transform` (`translate3d`) and `opacity`.**

```css
/* BAD: Triggers browser layout reflow on every frame */
.drawer-bad {
  transition: width 300ms ease;
  width: 400px;
}

/* GOOD: Hardware-accelerated on GPU compositor thread */
.drawer-good {
  transition: transform 280ms var(--ag-ease-out);
  transform: translateX(0);
  will-change: transform;
}
```

---

## 6. Accessibility & `prefers-reduced-motion`

The system must support users with vestibular sensitivities or motion sickness.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Retain gentle opacity fades for state clarity */
  .ag-modal-backdrop,
  .ag-popover,
  .ag-tooltip {
    transition: opacity 150ms ease !important;
    transform: none !important;
  }

  /* Replace active valve pulse animation with static high-contrast badge */
  .ag-valve-pulse-marker::after {
    display: none !important;
  }
}
```

### 6.1 Touch Device Hover Protection

Touchscreens fire false hover events on tap, causing elements to remain stuck in hover states after the finger lifts. All hover animations must be guarded behind:

```css
@media (hover: hover) and (pointer: fine) {
  .ag-card:hover {
    border-color: #94A3B8;
    transform: translateY(-1px);
  }
}
```
