# Disease Progression page — how accurate is it?

Date: 2026-11-26 · Branch: `analysis/progression-accuracy` · Scope: `/disease-progression`
(frontend models `agronomicTimelineModel.ts`, `treatmentBranchingModel.ts`, `hotspotRegistry.ts`,
the shader renderer, the progression images, and the page copy).

**Short answer:** the page is a *teaching illustration*, not a forecast. The shapes are borrowed from real plant-disease
science (temperature response curves, "spray early works better"), but most numbers are hand-picked, several parts
contradict each other, and the treatment and money figures are much more certain-looking than anything behind them.
Nothing on the page uses real weather, real field data or the ML model.

All numbers below were computed by running the models themselves (tomato unless stated).

---

## 1. What is real

| Part | Verdict |
|---|---|
| Temperature curve (min / best / max per disease) | **Reasonable.** The formula is the Yan & Hunt beta curve that Magarey et al. (2005) use, and the cardinal temperatures are in the right range for each pathogen (e.g. late blight best ≈ 18 °C, early blight ≈ 25 °C). |
| "Spray early, it works better" | **Direction is right.** Efficacy falls as the disease advances (94 % at 10 % severity → 7 % at 80 %). |
| Disease and pathogen names, symptom descriptions | **Broadly correct** textbook descriptions. |
| Product categories (curative / protectant / biological) | **Real categories**, and most named products exist. |

## 2. What is made up or wrong

### 2.1 Weather → speed ("Disease speed 0.50×")
- **Humidity rule is invented.** `g(RH)` (exponent 1.8, 0.03 floor) is not from the literature. Real infection models
  (incl. Magarey 2005) use **hours of leaf wetness**, not relative humidity.
- **The page contradicts itself on load.** Each crop starts at its "critical" humidity, described in code as the
  favourable norm, but the model then calls it **"Slowed" (0.50×)** and doubles the timeline (tomato 21 → 42 days).
- **Presets give absurd results.** "Spring Field Norm" (described as the *standard* timeline) is "Critically inhibited"
  and takes **124 days**. "Hot & Arid" and "Cold & Dry" divide by the 0.01 floor and show **Day 2100 (≈ 6 years)**
  instead of simply "the disease stops".
- **Time is a straight-line stretch.** Days = (fixed days at optimum) ÷ (weather factor). Real epidemics depend on
  infection cycles, spore load and how long leaves stay wet; one constant multiplier for the whole season is a big
  simplification.
- **Same presets for every disease.** "Hot & arid arrests spore germination" is written for late blight but shown
  for powdery mildew too (squash), which actually thrives in warm, dry-leaf conditions — the model still says
  "Stalled".
- Unused: degree-day parameters and the inverse days→% function exist but are never used.

### 2.2 The slider and "% of leaf affected"
- The slider is a **position along three images** (0–30–70–100 % boundaries are fixed). It is not measured leaf area.
  The "severe" image does not show 100 % of the leaf diseased. Calling it "% of leaf affected" (added in the
  redesign) over-states it.
- The stage markers' days are the optimum-weather days, so they disagree with the live day as soon as weather changes.

### 2.3 Treatment simulation
- **One spray stops the disease forever.** After spraying at 25 %, tomato early blight "stops near 27 %" for the rest
  of the season. In reality protectant/curative sprays last ~7–14 days and early blight needs a spray programme.
- **Not treating always means 100 % destruction**, regardless of weather, crop stage or time.
- **The product you pick does not change the result.** Only the category does (protectant × 0.72, biological × 0.58,
  hand-picked). Each product's curative window (`curativeKickbackHours`), the infection rate `r` and the
  "Van der Plank" logistic model are defined but **never used**.
- **Weather does not affect treatment** at all; only the severity at spraying does.
- **Contradiction:** spraying at 80 % is labelled "Terminal — chemical intervention cannot salvage", yet the model still
  shows the disease stopping at 84 % and a **$294/ha gain**.
- Cited sources (Van der Plank, Shtienberg, James, Pataky, MacHardy) are named in comments, but the code is a simple
  logistic curve + linear damage line with hand-picked parameters, not those published functions.

### 2.4 Money ("Estimated gain $2,493/ha")
- Built from fixed US-dollar crop values and spray costs, a fixed 55 % untreated loss and the one-spray assumption
  above. Not localised (Türkiye), not dated, not sourced. It moves only with the spray moment and category.

### 2.5 Product facts
- Mostly **US trade names and US label numbers** (pre-harvest intervals, rainfastness). Registrations differ in
  Türkiye/EU.
- **Antibiotics** are offered as treatments (oxytetracycline on peach, kasugamycin on pepper). Their use on crops is
  restricted or not authorised in the EU; registration in Türkiye must be checked before showing them.
- Factual slips: tomato "Inspire Super (Difenoconazole 25 % EC)" — Inspire Super is difenoconazole **+ cyprodinil**;
  the grape entry names Inspire Super but lists only difenoconazole / FRAC 3 (should be FRAC 3 + 9).

### 2.6 Images, "Heatmap" and "Model" tab
- The leaf images are **generated plates** (Stable Diffusion + Prompt-to-Prompt pipeline in
  `ml-service/scripts/p2p/`, then "photorealistic remake" commits), not field photographs. The redesign's
  "Real leaf photos" line is therefore wrong.
- The **"Heatmap" is not model attention.** It is the pixel difference between two stage images, recoloured
  (`compute_difference_mask` + shader colormap). The redesign's tooltip "Where the model focuses" is wrong.
- The "Model" tab's numbers (τ values, token diff) are fixed values describing how the images were generated; they
  do not change with anything on the page.
- Hotspot pins are hand-placed per crop and appear at fixed slider thresholds — illustrative.

### 2.7 Mismatch with the diagnosis model
| Progression page | ML diagnosis model (`SUPPORTED_CLASSES`) |
|---|---|
| Grape → **Black rot** | Grape → downy mildew, esca (no black rot) |
| Pepper, Peach, Squash | **not detectable** by the diagnosis model |
| — | Rice, Cassava are detectable but have **no progression** |

Tomato early blight, potato late blight, corn common rust and apple scab match.

---

## 3. Recommendations (ordered)

1. **Say what it is.** Label the page "Illustrative simulation", mark images as generated illustrations, and fix the
   redesign copy ("Real leaf photos", "Where the model focuses", "% of leaf affected").
2. **Fix the self-contradictions** (cheap, high value): start each crop at favourable weather; show "No progress under
   these conditions" instead of 2,100-day timelines; make preset texts crop-specific or neutral; derive stage-marker days
   from the current weather; don't show a gain or "stops at" in the terminal window.
3. **Make treatment honest:** model protection that wears off after N days (use each product's real window), or show
   ranges and "one spray" explicitly; make the product choice matter or hide per-product details.
4. **Money:** remove it, or show it as an assumption-driven example with editable price and cost (in TRY).
5. **Products:** keep categories and active ingredients; drop trade names and US label numbers, or replace with
   Türkiye-registered products and a "check the label" note. Remove antibiotics.
6. **Align crops with the diagnosis model** (grape downy mildew instead of black rot; decide on pepper/peach/squash vs
   rice/cassava) so a diagnosis can open the matching progression.
7. **Longer term:** drive the speed with leaf-wetness hours from Open-Meteo (already used for irrigation) instead of a
   single RH slider.

---

## 4. Status (same branch)

- **Done — recommendations 1–2:** honest labels and self-contradictions (`d0fd166`).
- **Done — recommendation 3:** treatment now has protection that wears off. Each product has a typical re-spray
  interval (`protectionDays`); while protected the disease runs at (1 − effect) of its normal speed, the effect is
  re-evaluated at every re-spray, and "Keep spraying" can be turned off. Season outcome and money count every spray.
  The product you pick now changes the result. The spray-effect curve and damage line are still hand-tuned.
- **Done — part of recommendation 5:** crop antibiotics removed (pepper, peach — these now show "no curative spray"),
  Inspire Super / difenoconazole slips fixed, "example products — follow the local label" note added.
- **Done — recommendation 6 (linking part):** tomato early blight, potato late blight, corn common rust and apple scab
  are marked as also detected by leaf diagnostics; a matching diagnosis shows "See how it develops" and opens
  `/disease-progression?crop=…`. Grape (black rot), pepper, peach and squash are labelled simulation only.
  `scripts/test_progression_links.js` checks the keys against ml-service. New disease images (e.g. grape downy mildew,
  rice, cassava) would need the image pipeline and are not done.
- **Open:** money in TRY / editable assumptions (4), Türkiye-registered product list (5), new progression images for the
  remaining diagnosis classes (6), leaf-wetness hours from Open-Meteo (7).
