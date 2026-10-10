# Implementation Plan: Multi-Dataset Model Re-Training & In-Field Generalization

> **Branch:** `feat/ml-exp-multidataset-retrain` (Strictly local, no remote pushes)  
> **Workspace:** `ml-retrain-experimental/` (Completely isolated from `ml-service/`, `backend/`, and `frontend/`)  
> **Goal:** Re-train the plant disease classification model with real-world in-field datasets (PlantDoc + Mendeley field datasets) and advanced augmentations to eliminate domain-shift fumbles on complex backgrounds while maintaining zero regression on clean lab captures.

---

## 1. Problem Formulation & Architectural Strategy

### The Core Challenge
The original model, trained predominantly on clean laboratory backgrounds (PlantVillage), suffers from **shortcut learning**:
1. It relies on clean, high-contrast borders and uniform lighting.
2. In field settings (soil, weeds, harsh sunlight glare, farmer hands, leaf shadows), it can confuse backgrounds with disease necrosis or misclassify diseases (e.g. confusing Potato Late Blight with Early Blight).

### The Solution: Multi-Dataset Fusion + Multi-Task Architecture
1. **Multi-Dataset Ingestion:**
   - **PlantVillage:** Clean baseline laboratory images (high volume, clear pathology).
   - **PlantDoc:** Authentic in-the-wild field captures.
   - **Mendeley Field Datasets (User Candidate Datasets):** Real agricultural farmland photos capturing natural variations in lighting, background soil, and disease stages.
2. **Model Choice — MobileNetV3-Large Dual-Head:**
   - **Why MobileNetV3-Large?** Moving from `Small` (~1.5–2.5M params) to `Large` (~5.4M params) expands representation capacity by $2.5\times$ without breaking deployment constraints:
     - **File Size:** ~20–22 MB ONNX FP32 (easily complies with Docker $\le 450\text{ MB}$ / $\le 250\text{ MB}$ target).
     - **Latency:** ~15–25 ms on CPU (well below 50 ms SLA).
     - **Dual-Head Structure:** Crop Species Head (4 classes) learns macro-morphology (leaf margins, lobes, venation) while Pathology Head (8 classes) learns micro-lesions, preventing cross-crop pathogen confusion (e.g. Potato vs. Tomato Late Blight).
3. **Augmentation Strategy (Solution 1 Elements):**
   - Integrate `torchvision.transforms.RandomErasing` (cutout), `ColorJitter`, and `RandomResizedCrop` to ensure the CNN learns distributed pathology markers rather than edge artifacts.

---

## 2. Review of User-Supplied Candidate Datasets

| Dataset | URL / Source | Claimed Volume & Resolution | Environment | Project Taxonomy Alignment | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Corn Leaf Disease** | [hmkd6nbngr/1](https://data.mendeley.com/datasets/hmkd6nbngr/1) | ~17,000 images, JPG | **Authentic Field** | - `Common Rust` → `Corn___Common_rust_`<br>- `Corn Leaf Blight` → `Corn___Northern_Leaf_Blight`<br>- `Healthy` → `Corn___healthy`<br>- *Gray Leaf Spot / Insect Damage (Out of scope)* | **Strong Ingest Candidate** (Sample ~500–800 field images per target class). |
| **Novel Potato Leaf** | [mwbwbdzz7z/1](https://data.mendeley.com/datasets/mwbwbdzz7z/1) | 12,000 images, $2500 \times 2500$ JPG | **Authentic Field** (Paikarapur, West Bengal) | - `HEALTHY` → `Potato___healthy`<br>- `EARLY LEAF SPOT` → `Potato___Early_blight`<br>- `LATE LEAF SPOT` → `Potato___Late_blight` | **Strong Ingest Candidate** (Solves the potato field background fumble directly). |
| **Tomato Leaf Disease** | [zfv4jj7855/1](https://data.mendeley.com/datasets/zfv4jj7855/1) | Multi-folder JPG | Diverse Field & Lab | - `Tomato_healthy` → `Tomato___healthy`<br>- `Bacterial_spot` → `Tomato___Bacterial_spot`<br>- `Early_blight` → `Tomato___Early_blight`<br>- `Late_blight` → `Tomato___Late_blight` | **Strong Ingest Candidate** (Directly covers all 4 tomato classes). |
| **Apple Leaf Diseases** | [gm6mfz8fz6/1](https://data.mendeley.com/datasets/gm6mfz8fz6/1) | High-res JPG | Field (ICAR-CITH, Srinagar) | - *Alternaria leaf blotch* (Out of scope)<br>- *Apple scab* (Out of scope / optional)<br>- *Powdery mildew / Mosaic* (Out of scope)<br>- **Does NOT include Cedar Apple Rust or Healthy Apple** | **Review with User** (Keep Apple from PlantVillage & PlantDoc; or optionally add Apple Scab if expanding taxonomy). |

---

## 3. Phased Implementation Plan

### Phase 1: Dataset Review & Taxonomy Alignment (Joint Review)
- **Goal:** Align with user on exact dataset choices, sample quotas, and class mappings.
- **Tasks:**
  - Finalize class mapping dictionary for the selected Mendeley datasets.
  - Establish per-class sample balancing caps (e.g. max 500–800 images per class) to avoid class imbalance.
  - Decide whether to include out-of-scope classes or filter them out strictly.
- **Checkpoint:** User approves dataset selection and sample quotas.

### Phase 2: Isolated Experimental Directory & Ingestion Pipeline
- **Goal:** Set up isolated workspace `ml-retrain-experimental/` and build data ingestion scripts.
- **Tasks:**
  - Create directory structure: `ml-retrain-experimental/{data, pipeline, models, training, evaluation, notebooks}`.
  - Implement ingestion and validation script (`ingest_multidataset.py`):
    - Validates image decodability with Pillow.
    - Computes SHA-256 hashes to guarantee zero sample duplication / data leakage.
    - Generates stratified 70% Train / 15% Val / 15% Test split.
  - Implement PyTorch Dataset & DataLoader with augmentations (`RandomResizedCrop`, `ColorJitter`, `RandomErasing`).
- **Commit:** `feat(ml-retrain-exp): implement multi-dataset ingestion and augmentation pipeline`.
- **Checkpoint:** Test dataset verification and class balance report approved.

### Phase 3: Model Architecture Configuration (`MobileNetV3-Large` Multi-Task)
- **Goal:** Implement and test the modular `MobileNetV3-Large` dual-head network.
- **Tasks:**
  - Implement `MultiTaskPlantClassifier` with `MobileNetV3-Large` backbone:
    - Shared convolutional body ($960$-dim feature representation).
    - Crop Species Head (4 outputs: Apple, Corn, Potato, Tomato).
    - Disease Pathology Head (8 outputs).
  - Implement weighted Multi-Task Loss: $\mathcal{L} = 0.4 \cdot \mathcal{L}_{\text{crop}} + 0.6 \cdot \mathcal{L}_{\text{disease}}$ with label smoothing ($0.05$).
  - Write unit tests verifying forward pass, output shapes, and gradient backward propagation.
- **Commit:** `feat(ml-retrain-exp): implement MobileNetV3-Large dual-head multi-task architecture`.
- **Checkpoint:** Unit tests pass with clean gradient updates.

### Phase 4: Training & Validation Pipeline (Google Colab / Local GPU)
- **Goal:** Build the complete training execution harness with metrics tracking.
- **Tasks:**
  - Implement `train_multidataset.py` with:
    - AdamW optimizer with Cosine Annealing learning rate schedule.
    - Validation tracking: Top-1 Accuracy, Macro F1, Per-Class Precision & Recall for both heads.
    - Early stopping (patience = 5 epochs) and best checkpoint saving.
  - Create standalone Google Colab GPU training notebook (`notebooks/MultiDataset_Training.ipynb`) so training can run rapidly on free T4/V100 GPU without tying up local machine.
- **Commit:** `feat(ml-retrain-exp): add training loop, metrics tracker and Colab GPU notebook`.
- **Checkpoint:** User reviews training script and chooses execution environment (local or Colab).

### Phase 5: Training Run & Evaluation Against In-Field Benchmark
- **Goal:** Execute training, evaluate the resulting weights, and benchmark against the in-field test set.
- **Tasks:**
  - Train model for 15–20 epochs until convergence.
  - Evaluate checkpoint on the 11 PlantDoc in-field test samples and 8 PlantVillage lab control samples.
  - Verify that the Potato Late Blight fumble is eliminated and field confidence $\ge 90\%$.
- **Commit:** `feat(ml-retrain-exp): record multi-dataset training run metrics and evaluation`.
- **Checkpoint:** User reviews accuracy and fumble recovery results.

### Phase 6: ONNX Export, Quantization & Serving Verification
- **Goal:** Export the retrained model to ONNX, verify runtime latency, and compare against Solution 2.
- **Tasks:**
  - Export dual-head ONNX model with dynamic batching (`export_multitask_onnx.py`).
  - Run CPU benchmark: verify file size $\le 25\text{ MB}$ and latency $\le 30\text{ ms}$.
  - Compile final report comparing Solution 1 (Retraining with field datasets) vs Solution 2 (Serving-time leaf segmentation).
- **Commit:** `docs(ml-retrain-exp): compile multi-dataset retraining experiment report`.

---

## 4. Execution Guardrails

1. **Strict Branch Isolation:** Work proceeds entirely on local branch `feat/ml-exp-multidataset-retrain`. No pushes to remote.
2. **Zero Production Modification:** No changes to `ml-service/`, `backend/`, or `frontend/` during the experiment.
3. **Step-by-Step Approval:** Pause after every step/task for user approval before moving to the next.
4. **No Premature Execution:** No code written or training started until the user approves this Implementation Plan.
