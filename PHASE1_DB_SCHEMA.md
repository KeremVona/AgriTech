### Phase 1: Machine Learning & Disease Progression Slider Engine

Phase 1 establishes the biological taxonomy, treatment advisories, model inference auditing, and asset mapping required for the interactive leaf disease progression slider.

### Logical Entity-Relationship Overview

```
[ crops ] ──(1:N)──> [ diseases ] ──(1:N)──> [ treatments ]
                           │
                           ├──(1:N)──> [ disease_progression_stages ]
                           │                     │
                           │                     └──(1:N)──> [ progression_visual_assets ]
                           │
                           └──(1:N)──> [ model_inferences ]
```

### Entity Specifications

#### 1. `crops`

Stores the baseline crop varieties supported by the vision classifier.

| **Attribute**     | **Data Type / Representation** | **Constraints**  | **Description**                   |
| ----------------- | ------------------------------ | ---------------- | --------------------------------- |
| `id`              | UUID / Auto-increment Integer  | Primary Key      | Unique identifier for the crop    |
| `common_name`     | Text                           | Unique, Not Null | e.g., Tomato, Potato, Corn, Apple |
| `scientific_name` | Text                           | Nullable         | e.g., _Solanum lycopersicum_      |
| `family`          | Text                           | Nullable         | e.g., Solanaceae                  |
| `made_at`         | Timestamp with Timezone        | Not Null         | Record produced timestamp         |

#### 2. `diseases`

Maintains the catalog of identifiable conditions, pathologies, and healthy baselines per crop.

| **Attribute**         | **Data Type / Representation** | **Constraints** | **Description**                                            |
| --------------------- | ------------------------------ | --------------- | ---------------------------------------------------------- |
| `id`                  | UUID / Auto-increment Integer  | Primary Key     | Unique identifier for the disease                          |
| `crop_id`             | Foreign Key (`crops.id`)       | Not Null        | Identifies which crop this disease affects                 |
| `common_name`         | Text                           | Not Null        | e.g., Early Blight, Late Blight, Healthy                   |
| `scientific_name`     | Text                           | Nullable        | e.g., _Alternaria solani_                                  |
| `pathogen_type`       | Enumeration / String           | Not Null        | `Fungal`, `Bacterial`, `Viral`, `Physiological`, `Healthy` |
| `risk_level`          | Enumeration / String           | Not Null        | `Low`, `Medium`, `High`, `Critical`                        |
| `general_description` | Text                           | Not Null        | Summary of symptoms and tissue impact                      |

#### 3. `treatments`

Actionable agronomic recommendations and biological/chemical mitigations linked to specific diseases.

| **Attribute**          | **Data Type / Representation** | **Constraints**           | **Description**                                      |
| ---------------------- | ------------------------------ | ------------------------- | ---------------------------------------------------- |
| `id`                   | UUID / Auto-increment Integer  | Primary Key               | Unique identifier for the treatment                  |
| `disease_id`           | Foreign Key (`diseases.id`)    | Not Null                  | The disease addressed by this protocol               |
| `treatment_type`       | Enumeration / String           | Not Null                  | `Cultural`, `Biological`, `Chemical`, `Preventative` |
| `title`                | Text                           | Not Null                  | e.g., "Copper Hydroxide Spray Protocol"              |
| `action_steps`         | Text                           | Not Null                  | Detailed application guide, dosage, and frequency    |
| `is_organic_certified` | Boolean                        | Not Null, Default `false` | Distinguishes organic-safe treatments                |

#### 4. `disease_progression_stages`

Defines discrete biological stages along the 0% to 100% infection scale for the interactive progression slider.

| **Attribute**      | **Data Type / Representation** | **Constraints** | **Description**                                                    |
| ------------------ | ------------------------------ | --------------- | ------------------------------------------------------------------ |
| `id`               | UUID / Auto-increment Integer  | Primary Key     | Unique identifier for the stage                                    |
| `disease_id`       | Foreign Key (`diseases.id`)    | Not Null        | Associated disease profile                                         |
| `stage_order`      | Integer                        | Not Null        | Sequential index (`0`, `1`, `2`, `3`)                              |
| `stage_label`      | Text                           | Not Null        | e.g., `Healthy Baseline`, `Early Lesioning`, `Severe Necrosis`     |
| `min_slider_pct`   | Decimal (3, 2)                 | Not Null        | Lower bounds on UI slider (e.g., `0.00`, `35.00`)                  |
| `max_slider_pct`   | Decimal (3, 2)                 | Not Null        | Upper bounds on UI slider (e.g., `34.99`, `70.00`)                 |
| `symptom_markers`  | Text                           | Not Null        | Tooltip text explaining cellular/foliar symptoms at this threshold |
| `agronomic_advice` | Text                           | Nullable        | Short-form intervention recommendation relevant to this stage      |

#### 5. `progression_visual_assets`

Stores asset metadata and localized masks consumed by the Canvas/WebGL cross-dissolve blend engine.

| **Attribute**       | **Data Type / Representation**                | **Constraints** | **Description**                                                          |
| ------------------- | --------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `id`                | UUID / Auto-increment Integer                 | Primary Key     | Unique identifier for the asset                                          |
| `stage_id`          | Foreign Key (`disease_progression_stages.id`) | Not Null        | Target stage for this asset                                              |
| `base_image_url`    | Text / URI                                    | Not Null        | URL/path to the high-res aligned leaf plate                              |
| `mask_image_url`    | Text / URI                                    | Nullable        | Alpha mask isolating chlorosis or necrotic zones for shader blending     |
| `color_palette_hex` | Array / Delimited String                      | Nullable        | Dominant symptom colors (e.g., halo yellow, lesion brown) for UI accents |

#### 6. `model_inferences`

Audit and operational log recording every leaf scan processed by the vision service.

| **Attribute**          | **Data Type / Representation** | **Constraints** | **Description**                                              |
| ---------------------- | ------------------------------ | --------------- | ------------------------------------------------------------ |
| `id`                   | UUID / Auto-increment Integer  | Primary Key     | Unique identifier for the inference run                      |
| `predicted_disease_id` | Foreign Key (`diseases.id`)    | Not Null        | Top predicted disease class                                  |
| `uploaded_image_url`   | Text / URI                     | Not Null        | Storage bucket path of the evaluated photo                   |
| `confidence_score`     | Decimal (5, 4)                 | Not Null        | Classifier confidence (e.g., `0.9654`)                       |
| `class_probabilities`  | Key-Value / JSON Document      | Not Null        | Full softmax distribution across all evaluated model classes |
| `model_version`        | String                         | Not Null        | e.g., `mobilenetv3_large_v1.0.0`                             |
| `inference_time_ms`    | Integer                        | Not Null        | Execution latency in milliseconds                            |
| `made_at`              | Timestamp with Timezone        | Not Null        | Scan submission timestamp                                    |

### Data Flow for Phase 1 Features

1. **Vision Inference Flow:**
   - A client posts an image to `/api/v1/classify-leaf`.
   - The inference result writes an entry to `model_inferences`.
   - The client uses `predicted_disease_id` to fetch the condition details from `diseases` and associated remediation guidelines from `treatments`.

2. **Progression Slider Flow:**
   - Selecting a disease queries `disease_progression_stages` and `progression_visual_assets` ordered by `stage_order ASC`.
   - The frontend loads the stage base images and alpha masks into the WebGL blending buffer.
   - Moving the slider position (0–100%) maps to `[min_slider_pct, max_slider_pct]` to interpolate texture transitions and display corresponding `symptom_markers` in tooltips.
