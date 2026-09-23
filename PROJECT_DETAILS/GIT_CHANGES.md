# AgriTech Git & GitHub Collaboration Guide (`GIT_CHANGES.md`)

> **Target Audience:** All AgriTech Team Members (Team Lead, Backend/GIS Lead, Frontend Lead, ML Engineer)  
> **Repository:** `agritech`  
> **Main Protected Branch:** `main`

---

## 1. Team Lead Setup: GitHub Branch Protection Rules

To prevent accidental overwrites and ensure all code is reviewed before it enters production, the `main` branch must be protected.

---

## 2. Branch Naming Conventions

Every developer works in their own branch. **Never commit directly to `main`.**

### Standard Format

```text
feat/<track>-<todo-number>-<short-description>
fix/<short-description>
docs/<short-description>
```

### Track Mapping

- **`ml`** $\to$ Track A (Machine Learning, PlantVillage Dataset, FastAPI, Ingestion)
- **`api`** or **`backend`** $\to$ Track B (ASP.NET Core, NetTopologySuite, PostGIS, Irrigation Engine)
- **`web`** or **`frontend`** $\to$ Track C (React, Vite, Pure Tailwind, Leaflet GIS, Three.js 3D Viewer)

### Concrete Examples

| Category                   | Example Branch Name                 | Purpose                                                              |
| :------------------------- | :---------------------------------- | :------------------------------------------------------------------- |
| **New Feature (ML)**       | `feat/ml-todo101-dataset-split`     | Ingest and split PlantVillage dataset into 12 classes                |
| **New Feature (Backend)**  | `feat/api-todo104-fastapi-service`  | Ingest leaf image and connect to ONNX inference                      |
| **New Feature (Frontend)** | `feat/web-todo108-slider-canvas`    | Implement WebGL/Canvas disease progression slider                    |
| **New Feature (GIS)**      | `feat/api-todo205-parcel-endpoints` | Make Make, Read, Update, Delete routes for farm parcels with GeoJSON |
| **Bug Fix**                | `fix/cors-preflight-origin`         | Fix CORS preflight error between port 5173 and 5000                  |
| **Bug Fix**                | `fix/leaflet-tile-flicker`          | Fix satellite layer flickering during parcel redraw                  |
| **Documentation**          | `docs/update-api-contracts`         | Document new Swagger and classification payloads                     |

---

## 3. Step-by-Step Developer Tutorial: From Zero to Merged PR

### Step 1: Clone the Repository (One-Time Setup)

```powershell
git clone https://github.com/KeremVona/agritech.git
cd agritech
```

---

### Step 2: Ensure Local `main` is Up-to-Date

Before starting any new task, always sync with the latest code:

```powershell
# 1. Switch to main
git checkout main

# 2. Pull latest changes from GitHub
git pull origin main
```

---

### Step 3: Make and Switch to Your Feature Branch

Never write code on `main`. Make a new branch named according to your TODO:

```powershell
# Makes and switches to the branch in one command:
git checkout -b feat/ml-todo101-dataset-split
```

To verify which branch you are on:

```powershell
git branch
# The current branch will have an asterisk (*) next to it
```

---

### Step 4: Write Your Code & Test Locally

Work on your assigned task. While coding, always follow `PROJECT_DETAILS/Phase Plans/Task Completion.md`:

- Run relevant test commands (`pytest`, `dotnet build`, `npm run build`).
- Verify acceptance criteria.

---

### Step 5: Check Status & Stage Your Changes

Check which files have been changed or made:

```powershell
git status
```

To stage specific files you want to commit:

```powershell
# Stage a specific file:
git add ml-service/scripts/prepare_dataset.py

# Or stage all modified/new files in your service folder:
git add ml-service/
```

> ⚠️ **Warning:** Always run `git status` before committing. Never stage `.env` files, temporary folders (`node_modules/`, `bin/`, `obj/`, `venv/`), or large raw datasets.

---

### Step 6: Commit Your Changes

Write a clear, concise commit message following Conventional Commits format:

```powershell
git commit -m "feat(ml): implement PlantVillage dataset ingestion and 70/15/15 split"
```

#### Commit Message Format:

- `feat(<scope>): <description>` — New feature
- `fix(<scope>): <description>` — Bug fix
- `docs(<scope>): <description>` — Documentation changes
- `refactor(<scope>): <description>` — Code refactoring without behavior changes
- `test(<scope>): <description>` — Adding or updating tests

---

### Step 7: Push Your Branch to GitHub

The first time you push your branch, use the `-u` (upstream) flag:

```powershell
git push -u origin feat/ml-todo101-dataset-split
```

For subsequent commits on the same branch:

```powershell
git push
```

---

### Step 8: Open a Pull Request (PR) on GitHub

1. Go to your repository on **GitHub**.
2. You will see a yellow banner: **`feat/ml-todo101-dataset-split had recent pushes`**. Click the green **Compare & pull request** button.
3. Fill out the PR form:
   - **Title:** `feat(ml): Ingest and split PlantVillage dataset (TODO-101)`
   - **Description:** Paste the **Completion Report** format from `Task Completion.md`:

```markdown
## Summary

Implemented the PlantVillage dataset ingestion pipeline for the 12 targeted crop-disease classes.

## Changes Made

- `ml-service/scripts/prepare_dataset.py` — Download & split script
- `ml-service/tests/test_dataset.py` — Sanity test for zero label leakage

## Testing / Validation

- Ran `pytest ml-service/tests/` -> PASS (0 label leakage)
- Verified directory counts: 70% train, 15% val, 15% test

## Acceptance Criteria

- [x] Clean directory structure with exactly 12 class subdirectories
- [x] Train/validation/test directories generated (70/15/15)
- [x] Deterministic split using seed 42
- [x] Corrupt JPEG headers rejected
- [x] Sanity test confirms zero label leakage
```

4. On the right sidebar, assign **Reviewers** (select your 2 teammates).
5. Click **Make pull request**.

---

### Step 9: Reviewing & Merging a PR (For Teammates)

When you are requested to review a teammate's PR:

1. Open the PR on GitHub and click the **Files changed** tab.
2. Review the code:
   - Does it meet the acceptance criteria?
   - Are there any accidental files or hardcoded secrets?
   - Did the teammate provide test results?
3. If everything looks good:
   - Click the green **Review changes** button (top right).
   - Select **Approve** and submit your review.
4. Once approved, click **Squash and merge** (or **Merge pull request**) and confirm.

---

### Step 10: Clean Up & Sync Locally After Merge

Once your PR is merged into `main` on GitHub:

```powershell
# 1. Switch back to main
git checkout main

# 2. Pull the latest merged changes
git pull origin main

# 3. Delete your local feature branch (it's already merged into main!)
git branch -d feat/ml-todo101-dataset-split
```

---

## 4. How to Handle Merge Conflicts (When Teammates Touch the Same Code)

If GitHub indicates that your branch has conflicts with `main`:

```powershell
# 1. Ensure you are on your feature branch
git checkout feat/your-feature-branch

# 2. Fetch the latest main
git fetch origin

# 3. Merge main into your feature branch
git merge origin/main
```

1. Open **VS Code** (or your IDE). Conflicted files will be marked in red.
2. VS Code shows buttons: **Accept Current Change**, **Accept Incoming Change**, or **Accept Both Changes**.
3. Choose the correct code, save the file.
4. Commit the resolved conflict:
   ```powershell
   git add .
   git commit -m "fix: resolve merge conflicts with main"
   git push origin feat/your-feature-branch
   ```
5. The Pull Request on GitHub will automatically update and become mergeable.

---

## 5. Daily Git Command Cheat Sheet

| Action                      | Command                         | Explanation                                   |
| :-------------------------- | :------------------------------ | :-------------------------------------------- |
| **Check Current Status**    | `git status`                    | Shows modified, untracked, and staged files   |
| **View Current Branch**     | `git branch`                    | Lists all local branches (\* = active branch) |
| **Sync `main` with Remote** | `git checkout main && git pull` | Brings local main up to date                  |
| **Make New Branch**         | `git checkout -b <branch-name>` | Makes and switches to a new branch            |
| **Switch Branches**         | `git checkout <branch-name>`    | Switches to an existing branch                |
| **Stage Changes**           | `git add <file>` or `git add .` | Stages files for the next commit              |
| **Commit Changes**          | `git commit -m "message"`       | Saves staged changes with a descriptive note  |
| **Push Branch**             | `git push -u origin <branch>`   | Uploads branch to GitHub                      |
| **View Commit History**     | `git log --oneline -5`          | Shows the last 5 commits compactly            |
| **Discard Unsaved Changes** | `git restore <file>`            | Reverts changes in a file back to last commit |
| **Delete Local Branch**     | `git branch -d <branch-name>`   | Deletes branch after it has been merged       |

---

## 6. Golden Rules for the Team

1. 🚫 **NEVER commit directly to `main`**: Always use feature branches and PRs.
2. 🚫 **NEVER commit secrets or `.env`**: Always use placeholders in `.env.example`.
3. 🚫 **NEVER commit large binary datasets or weights**: Store raw data locally or use cloud links (checked by `.gitignore`).
4. ✅ **Run builds before opening a PR**: Make sure `npm run build` or `dotnet build` succeeds before asking teammates to review.
5. ✅ **Always pull before branching**: Always ensure `main` is fresh before making a new branch.
