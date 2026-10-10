# Multi-Dataset Taxonomy Alignment & Balancing Strategy

**Branch:** `feat/ml-exp-multidataset-retrain`  
**Phase:** Phase 1 — Dataset Review & Taxonomy Alignment  
**Date:** 2026-10-10  

---

## 1. Canonical Target Taxonomy (12 Classes)

The production ML inference service operates on a canonical 12-class agricultural taxonomy covering 4 crops and 8 pathology conditions:

| Index | Canonical Class Label | Crop Species | Condition / Pathology | Pathogen Type |
| :---: | :--- | :--- | :--- | :--- |
| **0** | `Apple___Cedar_apple_rust` | Apple | Cedar Apple Rust | Fungal |
| **1** | `Apple___healthy` | Apple | Healthy | None |
| **2** | `Corn_(maize)___Common_rust_` | Corn | Common Rust | Fungal |
| **3** | `Corn_(maize)___Northern_Leaf_Blight` | Corn | Northern Leaf Blight | Fungal |
| **4** | `Corn_(maize)___healthy` | Corn | Healthy | None |
| **5** | `Potato___Early_blight` | Potato | Early Blight | Fungal |
| **6** | `Potato___Late_blight` | Potato | Late Blight | Fungal (Oomycete) |
| **7** | `Potato___healthy` | Potato | Healthy | None |
| **8** | `Tomato___Bacterial_spot` | Tomato | Bacterial Spot | Bacterial |
| **9** | `Tomato___Early_blight` | Tomato | Early Blight | Fungal |
| **10** | `Tomato___Late_blight` | Tomato | Late Blight | Fungal (Oomycete) |
| **11** | `Tomato___healthy` | Tomato | Healthy | None |

---

## 2. Multi-Task Dual-Head Encoding Map

To prevent cross-crop pathogen confusion (e.g. Potato Late Blight vs. Tomato Late Blight), the `MobileNetV3-Large` backbone splits into two independent prediction heads:

### Head 1: Crop Species (Macro-Morphology, 4 Classes)
- `0`: Apple
- `1`: Corn
- `2`: Potato
- `3`: Tomato

### Head 2: Disease Pathology (Micro-Lesions, 8 Classes)
- `0`: Healthy
- `1`: Early Blight
- `2`: Late Blight
- `3`: Bacterial Spot
- `4`: Common Rust
- `5`: Northern Leaf Blight
- `6`: Cedar Apple Rust
- `7`: Apple Scab *(reserved)*

---

## 3. Dataset Ingestion & Class Mapping Specifications

### A. Corn Leaf Disease Dataset (Mendeley `hmkd6nbngr/1`)
- **Total Dataset Size:** ~17,000 images  
- **Environment:** Authentic agricultural field conditions  
- **Class Mappings:**
  - `Common Rust` $\rightarrow$ `Corn_(maize)___Common_rust_` `(crop=1, disease=4)`
  - `Corn Leaf Blight` $\rightarrow$ `Corn_(maize)___Northern_Leaf_Blight` `(crop=1, disease=5)`
  - `Healthy` $\rightarrow$ `Corn_(maize)___healthy` `(crop=1, disease=0)`
- **Excluded Out-of-Scope Folders:**
  - `Gray Leaf Spot` *(filtered out)*
  - `Insect Damage` *(filtered out)*

### B. Novel Potato Leaf Dataset (Mendeley `mwbwbdzz7z/1`)
- **Total Dataset Size:** 12,000 images ($2500 \times 2500$ resolution)  
- **Environment:** In-field farmlands (Paikarapur, West Bengal, India)  
- **Class Mappings:**
  - `HEALTHY` $\rightarrow$ `Potato___healthy` `(crop=2, disease=0)`
  - `EARLY LEAF SPOT` $\rightarrow$ `Potato___Early_blight` `(crop=2, disease=1)`
  - `LATE LEAF SPOT` $\rightarrow$ `Potato___Late_blight` `(crop=2, disease=2)`

### C. Tomato Leaf Disease Dataset (Mendeley `zfv4jj7855/1`)
- **Total Dataset Size:** Multi-folder collection  
- **Environment:** Mixed greenhouse and field conditions  
- **Class Mappings:**
  - `Tomato_healthy` $\rightarrow$ `Tomato___healthy` `(crop=3, disease=0)`
  - `Bacterial_spot` $\rightarrow$ `Tomato___Bacterial_spot` `(crop=3, disease=3)`
  - `Early_blight` $\rightarrow$ `Tomato___Early_blight` `(crop=3, disease=1)`
  - `Late_blight` $\rightarrow$ `Tomato___Late_blight` `(crop=3, disease=2)`
- **Excluded Out-of-Scope Folders:**
  - `Leaf_Mold`, `Septoria_leaf_spot`, `Spider_mites`, `Tomato_mosaic_virus`, `Target_Spot`, `Tomato_Yellow_Leaf_Curl_Virus` *(filtered out)*

### D. Apple Classes (PlantVillage + PlantDoc)
- **Environment:** High-volume clean lab baseline (PlantVillage) + Authentic in-the-wild orchard photos (PlantDoc)  
- **Class Mappings:**
  - `Apple___healthy` `(crop=0, disease=0)`
  - `Apple___Cedar_apple_rust` `(crop=0, disease=6)`
- *(Note: Mendeley Apple dataset `gm6mfz8fz6/1` is excluded because it lacks Cedar Apple Rust and Healthy leaves).*

---

## 4. Class Balancing & Stratification Rules

To prevent datasets with 10,000+ images from drowning out smaller datasets and causing severe class bias:

1. **Per-Class Sample Cap:**
   - Maximum **$700$ images per class** in the combined training set.
   - For classes with high abundance (e.g. Corn, Potato), images will be downsampled randomly via a fixed deterministic seed (`seed=42`).
2. **Domain Mixture Ratio:**
   - Target mixture: **$\sim 50\%$ Clean Lab** (PlantVillage) + **$\sim 50\%$ Authentic In-Field** (Mendeley + PlantDoc).
   - This ensures the model retains $99\%+$ accuracy on clean close-ups while acquiring robust invariance to soil backgrounds, shadows, and natural field lighting.
3. **Stratified Partitioning:**
   - **$70\%$ Training Set**
   - **$15\%$ Validation Set**
   - **$15\%$ Test Set**
4. **Data Leakage Guarantee:**
   - Every image is identified by its SHA-256 content checksum.
   - Duplicate images across datasets or partitions are purged before training.
