# Satellite NDVI: Review Fixes Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (or superpowers:executing-plans if the fixes are small enough to do inline). Follow **ponytail** (full): make the smallest change that fixes each finding, and nothing else. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the five findings from the director's (Opus) review of `feature/satellite-ndvi`.

**Spec:** `docs/superpowers/specs/2026-10-28-satellite-ndvi-timeline-design.md` (still authoritative).
**Original plan:** `docs/superpowers/plans/2026-10-28-satellite-ndvi-timeline.md`. Its "Orchestration" rules still apply: work only in this worktree on `feature/satellite-ndvi`; stage explicit paths only; no push, PR or merge; nothing on the spec's "Do NOT touch" list.

**Shell:** Git Bash on Windows. `PY` = `satellite-service/.venv/Scripts/python`.

## Constraints

- No new dependencies, files or features beyond what each task names.
- Do not change the HTTP contract (spec §3.3) or any existing test's expectations.
- Each task ends with its own commit. Tasks 1, 2 and 4 are independent and may run in parallel. Run Task 3 after Task 2, because both edit `jobs.py`. Task 5 is the last one.

---

## Task 1: Retry after a failed poll (finding 1)

**Problem:** One failed `getNdviJob` poll puts the hook in the `error` phase with kind `offline`. The page then shows "Satellite service is offline." with **no Retry button**, so the user can't recover without re-selecting the parcel.

**Files:**
- Modify: `frontend/src/pages/SatellitePage.tsx` (the `jobState.phase === 'error'` block, ~lines 228-251)

- [ ] **Step 1:** In the `error` block, make the `offline` branch render the same Retry button as the `other` branch. Keep the exact copy "Satellite service is offline." from spec §4.4. The `invalid` (422) branch stays without a button, because retrying the same geometry can't succeed. Simplest shape: one block for `offline` and `other`, with the message chosen by kind.
- [ ] **Step 2:** Verify with `cd frontend && npm run build && npm run lint && npm run test:satellite`. Expected: all pass.
- [ ] **Step 3: Manual check.** Run `npm run dev` with satellite-service stopped, open `/satellite` and select a parcel. Expected: "Satellite service is offline." plus a **Retry** button. Then start the service (`PY -m uvicorn main:app --port 8100` from `satellite-service/`) and click Retry. Expected: the job starts ("Searching satellite archive…" or progress).
- [ ] **Step 4: Commit.** `git add frontend/src/pages/SatellitePage.tsx && git commit -m "fix(satellite-web): offer retry when satellite service is offline"`

---

## Task 2: Validate job_id before building a path (finding 2)

**Problem:** `JobRegistry.get()` (`satellite-service/jobs.py`, ~line 242) builds `cache_dir / job_id / "manifest.json"` from the unchecked URL segment. On Windows, `job_id = "..\\..\\x"` escapes the cache folder.

**Files:**
- Modify: `satellite-service/jobs.py` (`get`)
- Test: `satellite-service/tests/test_jobs_api.py`

- [ ] **Step 1: Write the failing test.**

```python
def test_get_job_rejects_non_hex_job_id(tmp_path):
    # put a valid-looking manifest OUTSIDE the cache dir, reachable via ".."
    cache = tmp_path / "cache"; cache.mkdir()
    outside = tmp_path / "manifest.json"
    outside.write_text(<any valid JobStatus JSON from a finished fake job>, encoding="utf-8")
    registry = JobRegistry(cache, fake_search, fake_process, workers=1)
    assert registry.get("..") is None
    assert registry.get("..\\x") is None
    assert registry.get("ABCDEF0123456789") is None   # uppercase is not allowed
    client = TestClient(create_app(registry=registry, today=lambda: date(2026, 10, 28)))
    assert client.get("/api/v1/ndvi/jobs/..%5Cx").status_code == 404
```
Reuse the file's existing fake helpers and a JobStatus produced by the existing fixtures. Don't hand-write a new fake.

- [ ] **Step 2:** Run `PY -m pytest tests/test_jobs_api.py -q -k non_hex`. Expected: FAIL (`registry.get("..")` returns a status).
- [ ] **Step 3:** Add `if not JOB_ID_RE.match(job_id): return None` as the first line of `get()`.
- [ ] **Step 4:** Run `PY -m pytest -q`. Expected: all pass (the live test is deselected).
- [ ] **Step 5: Commit.** `git add satellite-service/jobs.py satellite-service/tests/test_jobs_api.py && git commit -m "fix(satellite): validate job_id before reading manifest"`

---

## Task 3: Remove the duplicated manifest loading (finding 5; run after Task 2)

**Problem:** `submit()` (~lines 110-131) and `get()` (~lines 242-263) have near-identical blocks that read `manifest.json`, validate it as `JobStatus`, log a warning on corruption, and rebuild a `_Job`.

**Files:**
- Modify: `satellite-service/jobs.py`

- [ ] **Step 1:** Add one private method, `_load_manifest(self, job_id: str) -> JobStatus | None`. It reads and validates `cache_dir/<job_id>/manifest.json`. It returns `None` when the file is missing, and also when it's corrupt, logging the existing warning text in that case.
- [ ] **Step 2:** Use it in both `submit()` and `get()`. Building the `_Job` from a `JobStatus` happens in one place (a small `_Job.from_status(status)` classmethod or a local helper; pick one). Behaviour stays identical:
  - `submit` overwrites `parcel_id` when one is given, caches the job in `_jobs`, and returns `(status, False)`;
  - `get` caches the job only if it isn't already in `_jobs`;
  - a corrupt manifest in `submit` still falls through to a new run.
- [ ] **Step 3:** Run `PY -m pytest -q`. Expected: all pass with **no test changes**. That's the proof the refactor kept the behaviour.
- [ ] **Step 4:** Check that `jobs.py` shrank (`git diff --stat`), and that `rg "manifest.json\"" satellite-service/jobs.py` now shows the read path in one place, plus the write in `_write_manifest`.
- [ ] **Step 5: Commit.** `git add satellite-service/jobs.py && git commit -m "refactor(satellite): load manifest in one place"`

---

## Task 4: Make the legend labels readable (finding 4)

**Problem:** In the desktop screenshot, the legend is squeezed to about 60 px wide and its labels read `-0.20.30.9`.

**Files:**
- Modify: `frontend/src/components/SatelliteTimeline/NdviLegend.tsx`

- [ ] **Step 1:** Give the legend's root element a minimum width (Tailwind `min-w-40`) and `shrink-0`, so the flex parent can't crush it. Keep the gradient and stops unchanged.
- [ ] **Step 2: Check at both widths.**
  - Run `npm run build && npm run lint`.
  - Open `/satellite` in `npm run dev` with a finished job (the cache from the earlier E2E run is fine) at 1280 px and at 375 px. Expected: "-0.2", "0.3" and "0.9" are separate and readable at both widths, and the player row doesn't overflow horizontally at 375 px.
  - Replace `PROJECT_DETAILS/Reports/Satellite NDVI/screenshots/timeline-desktop.png` and `timeline-mobile-375px.png` with new captures.
- [ ] **Step 3: Commit.** `git add frontend/src/components/SatelliteTimeline/NdviLegend.tsx "PROJECT_DETAILS/Reports/Satellite NDVI/screenshots/timeline-desktop.png" "PROJECT_DETAILS/Reports/Satellite NDVI/screenshots/timeline-mobile-375px.png" && git commit -m "fix(satellite-web): keep ndvi legend labels readable"`

---

## Task 5: Correct the report and record the fixes (finding 3; last)

**Problem:** Report §4.2 says the sample parcels are "active winter cereal cropland". The desktop screenshot shows scrub and pine planting beside an industrial yard.

**Files:**
- Modify: `PROJECT_DETAILS/Reports/Satellite NDVI/SAT-NDVI-completion.md`

- [ ] **Step 1:** Rewrite §4.2 so it states only what the evidence supports:
  - the sample parcels lie on mixed scrub or grassland with some tree planting next to an industrial yard, **not confirmed cropland**;
  - the NDVI curve shows a spring green-up (peak ~0.75) and a dry summer (~0.2);
  - for a demo with real crop phenology, draw parcels over actual fields on the Field Map.
  - Keep the measured numbers that are already there.
- [ ] **Step 2:** Add a section `## 8. Review Fixes`: a table of the five findings with their commit hashes, the test commands re-run with their pass counts, and anything still not done. Also note that the Docker build has still not been run if Docker is still unavailable.
- [ ] **Step 3: Re-run every check fresh.**
  - Service: `PY -m pytest -q`.
  - Frontend: `npm run build`, `npm run lint`, `npm run test:satellite`, `npm run test:map`.
  - Paste the pass counts into §8.
- [ ] **Step 4: Commit.** `git add "PROJECT_DETAILS/Reports/Satellite NDVI/SAT-NDVI-completion.md" && git commit -m "docs(satellite): correct sample-parcel land cover and record review fixes"`
- [ ] **Step 5: Stop.** Report back with `git log --oneline c14babc..HEAD` and the report path. Don't push, open a PR or merge.
