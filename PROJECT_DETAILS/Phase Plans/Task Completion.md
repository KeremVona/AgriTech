# TODO Instructions

## Purpose

This document defines the standard process for completing and reporting project TODOs.

Every assignee should follow these instructions so that completed work is easy to review, test, and integrate.

---

## 1. Before Starting a TODO

Before writing code:

1. Read the entire TODO description.
    
2. Read **all acceptance criteria** carefully.
    
3. Check related TODOs, existing code, and project structure.
    
4. Identify dependencies or blockers.
    
5. Understand what files/components are expected to be changed or made.
    
6. If a requirement is ambiguous, document the assumption before implementation.
    
7. Do not expand the scope of the TODO unless the additional work is necessary for the acceptance criteria.
    

---

## 2. During Implementation

While working on the TODO:

### Follow the existing project conventions

- Follow the project's existing folder structure.
    
- Follow existing naming conventions.
    
- Reuse existing utilities and abstractions when appropriate.
    
- Avoid introducing unnecessary dependencies.
    
- Keep changes focused on the TODO.
    

### Keep the implementation testable

Where applicable:

- Add unit tests.
    
- Add integration tests.
    
- Add validation/sanity checks.
    
- Test both expected and invalid inputs.
    
- Test important edge cases.
    

### Avoid unrelated changes

Do not modify unrelated parts of the project simply because they could be improved.

If an unrelated issue is discovered:

- Document it in the completion report.
    
- Make a separate TODO if necessary.
    

---

## 3. Handling Blockers

If you cannot complete the TODO because of a dependency, missing information, environment issue, or another problem:

Do **not** mark the TODO as `DONE`.

Instead:

```text
Status: BLOCKED
```

Report:

- What is blocking the work.
    
- What was already completed.
    
- What is required to unblock it.
    
- Whether another team member or TODO is involved.
    

---

## 4. Testing and Validation

Before marking a TODO as complete, run all relevant tests and validation commands.

Examples:

```bash
npm test
npm run lint
npm run build
```

For Python:

```bash
pytest
python scripts/prepare_dataset.py
```

For ML/data tasks, also verify:

- Dataset structure
    
- Number of samples
    
- Class distribution
    
- Missing/corrupt files
    
- Duplicate or leaked data where relevant
    
- Train/validation/test separation
    
- Reproducibility
    
- Expected input/output formats
    

Do not report a test as passing unless it was actually executed.

---

## 5. Acceptance Criteria

Every acceptance criterion must be explicitly checked before marking a TODO as `DONE`.

Example:

```markdown
### Acceptance Criteria

- [x] Dataset contains exactly 12 classes
- [x] Train/validation/test directories are generated
- [x] Dataset uses a 70/15/15 split
- [x] Split is deterministic
- [x] Corrupt images are rejected
- [x] Non-RGB images are rejected
- [x] Label leakage test passes
```

If an acceptance criterion is not satisfied:

```markdown
- [ ] Label leakage test passes

Reason:
Duplicate samples were detected between train and test.
```

In this case, the TODO should normally be `PARTIALLY DONE` or `BLOCKED`, not `DONE`.

---

# 6. TODO Status

Use one of the following statuses.

### DONE

All required implementation and acceptance criteria are complete and validated.

```text
Status: DONE
```

### PARTIALLY DONE

Some work has been completed, but one or more requirements remain.

```text
Status: PARTIALLY DONE
```

Clearly explain what remains.

### BLOCKED

Work cannot continue because of an external dependency, missing information, technical blocker, or another unresolved issue.

```text
Status: BLOCKED
```

---

# 7. Completion Report

When a TODO is finished, provide a completion report using the following format.

````markdown
# TODO-XXX Completion Report

**Status:** DONE

## Summary

Briefly describe what was implemented.

## Changes Made

### made

- `path/to/file.py` — description

### Modified

- `path/to/file.py` — description

### Removed

- `path/to/file.py` — reason

## Implementation Details

- Important implementation detail
- Important technical decision
- Important assumption

## Testing / Validation

### Commands

```bash
command used for testing
````

### Results

- Test 1 — PASS
    
- Test 2 — PASS
    
- Test 3 — PASS
    

## Results / Metrics

Report relevant numbers or measurements.

Example:

- Total samples: 54,321
    
- Training samples: 38,025
    
- Validation samples: 8,148
    
- Test samples: 8,148
    
- Classes: 12
    
- Rejected samples: 449
    

## Acceptance Criteria

-  Criterion 1
    
-  Criterion 2
    
-  Criterion 3
    

## Issues / Notes

- No known issues.
    

## Remaining Work

- None.
    

````

---

# 8. Implementation Details

The completion report should contain enough information for another developer to understand what was done without reading the entire implementation.

Include important decisions such as:

- Architecture decisions
- Algorithms used
- Libraries/dependencies added
- Database changes
- API changes
- Data processing decisions
- Validation rules
- Configuration changes
- Security considerations
- Performance considerations

Do not copy large amounts of source code into the report.

---

# 9. Testing Report Requirements

For every test, report:

1. What was tested.
2. How it was tested.
3. The result.

Example:

```markdown
## Testing

| Test | Command | Result |
|------|---------|--------|
| Unit tests | `pytest tests/` | PASS |
| Dataset validation | `python scripts/validate.py` | PASS |
| Leakage check | `pytest tests/test_leakage.py` | PASS |
````

If a test fails, report the failure instead of hiding it.

```text
Dataset validation — FAIL

Reason:
23 images contain unsupported color channels.
```

---

# 10. Data / ML TODO Requirements

For TODOs involving datasets, machine learning, preprocessing, training, or evaluation, include additional information.

### Dataset Statistics

Report:

- Total samples
    
- Samples per class
    
- Train/validation/test counts
    
- Rejected samples
    
- Missing samples
    
- Duplicate samples if checked
    

Example:

```text
Dataset:
  Classes: 12
  Total images: 54,321

Split:
  Train: 38,025 (70%)
  Validation: 8,148 (15%)
  Test: 8,148 (15%)

Validation:
  Valid images: 53,872
  Rejected images: 449
  Corrupt images: 120
  Invalid channels: 201
  Resolution too low: 128
```

### Reproducibility

For deterministic processes, report:

- Random seed
    
- Dataset version
    
- Relevant configuration
    
- Software/library versions when important
    

Example:

```text
Random seed: 42
Dataset version: PlantVillage-v1
Python: 3.12
```

---

# 11. API / Backend TODO Requirements

For backend/API work, report:

- New endpoints
    
- Modified endpoints
    
- Request format
    
- Response format
    
- Authentication/authorization changes
    
- Database changes
    
- Error handling
    
- Tests
    

Example:

```text
Added:

POST /api/todos
GET /api/todos/:id
PATCH /api/todos/:id/status

Authentication:
- Requires authenticated user
- Admin role required for status updates
```

---

# 12. Frontend TODO Requirements

For frontend work, report:

- Pages/components made
    
- Components modified
    
- State management changes
    
- API integrations
    
- UI behavior
    
- Responsive behavior
    
- Loading/error/empty states
    
- Tests
    

Example:

```text
made:
- List
- Details
- StatusBadge

Added:
- Loading state
- Empty state
- API error handling
- Mobile responsive layout
```

---

# 13. Database TODO Requirements

For database-related work, report:

- Tables made/modified
    
- Columns added/removed
    
- Relationships
    
- Indexes
    
- Constraints
    
- Migrations
    
- Seed data
    
- Migration/test results
    

Example:

```text
Database changes:

made:
- todos

Added:
- todos.assignee_id
- todos.status
- todos.made_at

Indexes:
- todos.assignee_id
- todos.status

Migration:
PASS
```

---

# 14. Security Requirements

If the TODO involves authentication, authorization, user data, file uploads, APIs, or external services, explicitly consider security.

Report relevant measures such as:

- Authentication
    
- Authorization
    
- Input validation
    
- File validation
    
- Rate limiting
    
- Secrets handling
    
- SQL injection prevention
    
- XSS prevention
    
- CSRF protection
    
- Access control
    
- Sensitive data handling
    

Do not include actual secrets, API keys, passwords, tokens, or credentials in the report.

---

# 15. Dependencies

If you add a dependency, report:

```text
Added dependencies:
- package-name — reason
```

Also mention significant version changes.

Avoid adding a dependency when the functionality can reasonably be implemented using the existing project stack.

---

# 16. Git / Changes

Before submitting the TODO for review:

- Review your changed files.
    
- Remove temporary/debug files.
    
- Remove unnecessary logs.
    
- Remove unused imports.
    
- Check formatting/linting.
    
- Ensure secrets are not committed.
    
- Review the final diff.
    

Recommended:

```bash
git status
git diff
```

Do not include unrelated changes in the TODO's implementation.

---

# 17. Definition of Done

A TODO can be marked `DONE` only when:

-  Implementation is complete.
    
-  Acceptance criteria are satisfied.
    
-  Relevant tests have been executed.
    
-  Tests pass.
    
-  Validation has been completed.
    
-  No known blocking issues remain.
    
-  Changes have been reviewed locally.
    
-  Completion report has been written.
    
-  Any remaining/non-scope issues are documented.
    

If one of these is not satisfied, explain why before changing the status to `DONE`.

---

# 18. Example: Completed TODO

````markdown
# TODO-101 Completion Report

**Status:** DONE

## Summary

Implemented the PlantVillage dataset ingestion pipeline for the
12 targeted crop-disease classes.

The pipeline downloads the dataset, validates images, filters the
target classes, and makes deterministic stratified train/validation/test
splits.

## Changes Made

### made

- `scripts/prepare_dataset.py`
- `tests/test_dataset.py`

### Generated

- `data/processed/train/`
- `data/processed/val/`
- `data/processed/test/`

## Implementation Details

- Filtered the dataset to exactly 12 target classes.
- Implemented a deterministic split using seed `42`.
- Used a 70/15/15 stratified split.
- Validated JPEG file headers.
- Rejected non-RGB images.
- Rejected images below the configured minimum resolution.
- Used the same class directory structure for train, validation, and test.

## Testing / Validation

```bash
python scripts/prepare_dataset.py
pytest tests/test_dataset.py
````

Results:

- Dataset validation — PASS
    
- Class count validation — PASS
    
- Stratified split validation — PASS
    
- Deterministic split validation — PASS
    
- Label leakage test — PASS
    

## Results / Metrics

- Target classes: 12
    
- Total valid images: 53,872
    
- Rejected images: 449
    
- Train: 37,710
    
- Validation: 8,081
    
- Test: 8,081
    
- Label leakage: 0
    

## Acceptance Criteria

-  Clean directory structure with exactly 12 class subdirectories
    
-  Train/validation/test directories generated
    
-  Stratified 70/15/15 split
    
-  Deterministic split
    
-  Corrupt JPEG headers rejected
    
-  Non-RGB images rejected
    
-  Low-resolution images rejected
    
-  Automated sanity test confirms zero label leakage
    

## Issues / Notes

- 449 images were rejected during validation.
    
- No known issues remain.
    

## Remaining Work

- None.
    

````

---

# 19. Short Report for Small TODOs

For very small TODOs, the full report is not required if the work is straightforward.

Use:

```markdown
# TODO-XXX Completion Report

**Status:** DONE

## Summary

Implemented the requested change.

## Changes

- `path/to/file` — description

## Testing

- `npm test` — PASS
- `npm run lint` — PASS

## Acceptance Criteria

- [x] Criterion 1
- [x] Criterion 2

## Notes

No known issues.
````

The report should be proportional to the complexity of the TODO.

---

# 20. Important Rule

**Do not say "DONE" simply because the code was written.**

A TODO is done when the implementation satisfies its acceptance criteria and the result has been validated.

The completion report should allow another developer or reviewer to answer three questions quickly:

1. **What did you change?**
    
2. **How do we know it works?**
    
3. **Is anything still missing?**