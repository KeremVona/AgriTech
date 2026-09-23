## Phase 1: Machine Learning Core & Disease Progression Slider Engine

Phase 1 establishes the diagnostic core of the platform: a trained deep learning model for foliar disease classification, a containerized FastAPI microservice with sub-100ms CPU inference, and an interactive frontend progression slider that simulates disease staging.

### Technical Specifications & Architecture

#### 1. Machine Learning Pipeline

- **Base Dataset:** PlantVillage / New Plant Diseases Dataset (Kaggle).
    
- **Target Subset (12 Classes across 4 Target Staples):**
    
    - **Tomato:** Healthy, Early Blight (_Alternaria solani_), Late Blight (_Phytophthora infestans_), Bacterial Spot (_Xanthomonas campestris_).
        
    - **Potato:** Healthy, Early Blight (_Alternaria solani_), Late Blight (_Phytophthora infestans_).
        
    - **Corn (Maize):** Healthy, Common Rust (_Puccinia sorghi_), Northern Leaf Blight (_Exserohilum turcicum_).
        
    - **Apple:** Healthy, Apple Scab (_Venturia inaequalis_), Cedar Apple Rust (_Gymnosporangium juniperi-virginianae_).
        
- **Model Architecture:** MobileNetV3-Small or EfficientNet-B0 pre-trained on ImageNet.
    
- **Input Dimensions:** $3 \times 224 \times 224$ normalized using standard ImageNet mean $[0.485, 0.456, 0.406]$ and standard deviation $[0.229, 0.224, 0.225]$.
    
- **Optimization & Runtime Target:** Export model weights to **ONNX Runtime (Open Neural Network Exchange)** with dynamic batching and FP32/INT8 quantization to maintain sub-100ms latency on standard dual-core x86/ARM CPU runners without requiring dedicated GPUs.
    

#### 2. FastAPI Inference Service Schema

- **Route:** `POST /api/v1/classify-leaf`
    
- **Content-Type:** `multipart/form-data` (File payload key: `file`)
    
- **Payload Validation:** MIME-type check (`image/jpeg`, `image/png`), payload size cap (max 10MB).
    
- **JSON Response Structure:**
    

JSON

```
{
  "inference_id": "c7a9b1c2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
  "prediction": {
    "crop": "Tomato",
    "condition": "Late Blight",
    "scientific_name": "Phytophthora infestans",
    "confidence_score": 0.9642,
    "severity_index": "High"
  },
  "top_probabilities": [
    { "label": "Tomato___Late_blight", "probability": 0.9642 },
    { "label": "Tomato___Early_blight", "probability": 0.0281 },
    { "label": "Tomato___healthy", "probability": 0.0077 }
  ],
  "agronomic_advisory": {
    "immediate_action": "Isolate affected perimeter; restrict overhead irrigation to reduce foliage moisture duration.",
    "fungicide_treatments": [
      "Copper-based preventative spray",
      "Mancozeb or Chlorothalonil application before rain events"
    ],
    "environmental_risk_factors": "High humidity (>90%) with moderate temperatures (15°C to 22°C)."
  },
  "telemetry_linkage_hints": {
    "leaf_wetness_threshold_hours": 6,
    "moisture_risk": true
  },
  "execution_time_ms": 64.2
}
```

#### 3. Disease Progression Slider Engine (Feature #1)

- **Mechanics:** An interactive HTML5 Canvas/WebGL fragment shader component.
    
- **Input Assets:** Three strictly registered, geometrically aligned images per target disease:
    
    - Stage 0: Asymptomatic healthy leaf.
        
    - Stage 1: Initial chlorosis and discrete lesion points.
        
    - Stage 2: Severe confluent necrotic lesions, desiccation, and structural rot.
        
- **Transition Math:** A 0–100% slider control driving a two-phase fragment blend:
    
    - Slider $0 \to 50\%$: Cross-dissolve from Stage 0 to Stage 1 with dynamic contrast masking to accentuate chlorosis.
        
    - Slider $51 \to 100\%$: Cross-dissolve from Stage 1 to Stage 2 with a high-pass necrotic edge reveal mask.
        
- **UI Feedback:** Real-time visual symptom tags pinpointing active pathology markers (e.g., at 25% "Initial water-soaked flecks"; at 75% "Concentric target-like rings & tissue collapse").
    

### Team Project Board TODOs

#### Track A: Machine Learning & Data Engineering

##### TODO-101: Dataset Ingestion, Filtering, and Class Balancing

- **Assignee:** ML Engineer
    
- **Description:** Filter the PlantVillage dataset to the 12 targeted crop-disease classes. Implement a deterministic dataset splitting script.
    
- **Deliverables:**
    
    - Python script `scripts/prepare_dataset.py` downloading and organizing images into standard directory layout (`train`, `val`, `test`).
        
    - Stratified 70/15/15 split producing identical class distributions.
        
    - Image validation pass rejecting corrupt JPEG headers, non-RGB channels, or resolutions below $224 \times 224$.
        
- **Acceptance Criteria:**
    
    - Clean directory structure with exactly 12 class subdirectories.
        
    - Automated sanity test confirming zero label leakage across train, val, and test splits.
        

##### TODO-102: CNN Model Training, Transfer Learning, and Evaluation

- **Assignee:** ML Engineer
    
- **Description:** Fine-tune a lightweight CNN backbone (MobileNetV3-Small or EfficientNet-B0) using PyTorch with data augmentations tailored to outdoor lighting.
    
- **Deliverables:**
    
    - Training script with torchvision augmentations: `RandomHorizontalFlip`, `RandomRotation(degrees=30)`, `ColorJitter(brightness=0.2, contrast=0.2)`, and standard normalization.
        
    - Early stopping callback monitoring validation loss with a patience of 5 epochs.
        
    - Evaluation notebook outputting confusion matrix, Precision, Recall, and F1-score across all 12 classes.
        
- **Acceptance Criteria:**
    
    - Overall Top-1 Macro F1-score $\ge 0.94$ on the held-out test split.
        
    - Model artifacts saved as `.pth` checkpoints with logged hyperparameters.
        

##### TODO-103: ONNX Model Export, Quantization, and Benchmarking

- **Assignee:** ML Engineer
    
- **Description:** Convert PyTorch model weights to an optimized ONNX computational graph with INT8 quantization for CPU execution.
    
- **Deliverables:**
    
    - Export script `scripts/export_onnx.py` defining dynamic batch axes.
        
    - Post-training static/dynamic quantization pipeline via `onnxruntime.quantization`.
        
    - Standalone test harness measuring latency across 100 sequential inferences.
        
- **Acceptance Criteria:**
    
    - Model artifact size $\le 25\text{ MB}$.
        
    - Median CPU inference latency $\le 85\text{ ms}$ on single-thread execution with zero external GPU dependency.
        
    - Output probability parity within $\Delta < 10^{-3}$ against the native PyTorch baseline.
        

#### Track B: Backend & Serving API (FastAPI)

##### TODO-104: FastAPI Application Setup & Inference Endpoint

- **Assignee:** Backend Engineer
    
- **Description:** Build the asynchronous FastAPI microservice to ingest multipart leaf photos, run ONNX inference, and return typed results.
    
- **Deliverables:**
    
    - FastAPI project initialized with uv or poetry dependency tracking.
        
    - Route handler `POST /api/v1/classify-leaf` with image buffer preprocessing via `Pillow` or `OpenCV`.
        
    - Global ONNX runtime session initialization on application startup (`lifespan` handler) to prevent cold-start reload per request.
        
- **Acceptance Criteria:**
    
    - Malformed files return `422 Unprocessable Entity` or `400 Bad Request` with descriptive JSON errors.
        
    - End-to-end request turnaround $\le 150\text{ ms}$ under concurrent load of 5 requests.
        

##### TODO-105: Agronomic Advisory Knowledge Base Engine

- **Assignee:** Backend Engineer / Agronomy Lead
    
- **Description:** Build an internal lookup engine that associates diagnosed conditions with actionable treatment steps, chemical interventions, and environmental risk triggers.
    
- **Deliverables:**
    
    - Structured JSON/YAML agronomic database (`data/disease_advisories.json`) indexed by class labels.
        
    - Pydantic schema mapping `condition`, `pathogen_type`, `chemical_treatments`, `cultural_controls`, and `microclimate_risks`.
        
    - Integration into the `/classify-leaf` response payload.
        
- **Acceptance Criteria:**
    
    - 100% coverage of all 12 model classes with factual agronomic mitigation data.
        
    - Fallback handler for low-confidence classifications ($< 60\%$) prompting field operator re-scan.
        

##### TODO-106: Containerization & Health Check Instrumentation

- **Assignee:** DevOps / Backend Engineer
    
- **Description:** Package the vision service into an optimized, multi-stage Docker container with production health checking.
    
- **Deliverables:**
    
    - Multi-stage `Dockerfile` utilizing a lightweight base image (`python:3.11-slim`).
        
    - Endpoints: `GET /health/live` and `GET /health/ready` (checking ONNX model memory residency).
        
    - `docker-compose.yml` block allowing isolated local testing of the ML microservice.
        
- **Acceptance Criteria:**
    
    - Final Docker image size $\le 450\text{ MB}$.
        
    - Container boots and responds with `HTTP 200 OK` on health endpoints within 10 seconds.
        

#### Track C: Frontend & Feature #1 (Disease Progression Slider)

##### TODO-107: Morphological Leaf Asset Preparation & Normalization

- **Assignee:** Frontend / UI Engineer
    
- **Description:** Curate and process aligned 3-stage visual sequences (Healthy $\to$ Moderate Lesions $\to$ Severe Necrosis) for the 4 primary crop targets.
    
- **Deliverables:**
    
    - 12 normalized image assets (4 crops $\times$ 3 progression stages) centered, cropped, and balanced to $800 \times 800$ resolution with transparent or neutral matte backgrounds.
        
    - JSON manifest `public/progression/manifest.json` mapping crop ID, stage thresholds, and symptom descriptions per percentage step.
        
- **Acceptance Criteria:**
    
    - Visual anchor points (petiole, primary leaf veins) line up across stages with minimal jarring movement during opacity blending.
        
    - Assets fully optimized via WebP/AVIF format with file sizes $< 150\text{ KB}$ each.
        

##### TODO-108: Interactive HTML5 Canvas / WebGL Blending Engine

- **Assignee:** Frontend Engineer
    
- **Description:** Construct the core React canvas component that accepts two image inputs and dynamically executes a localized texture blend based on the slider value.
    
- **Deliverables:**
    
    - React component `<DiseaseProgressionViewer cropId="{selectedCrop}"/>`.
        
    - HTML5 2D Canvas or WebGL shader executing a weighted blend:
        
        $$\text{Pixel}_{\text{out}} = \text{Pixel}_{A} \cdot (1 - \alpha) + \text{Pixel}_{B} \cdot \alpha$$
        
        accentuated with localized contrast weighting to make necrotic lesions emerge organically rather than looking like a flat opacity fade.
        
- **Acceptance Criteria:**
    
    - Smooth 60 FPS slider scrubbing without UI thread blocking or memory leaks.
        
    - Fully responsive container adapting to mobile portrait and desktop widescreen views.
        

##### TODO-109: Slider UI Controls, Symptom Callouts & Diagnostic Overlays

- **Assignee:** Frontend Engineer
    
- **Description:** Wrap the canvas in an intuitive agronomy inspection UI featuring milestone tick marks, live pathology descriptions, and stage markers.
    
- **Deliverables:**
    
    - Range input slider component styled with Tailwind CSS displaying 3 primary stages: Early Inoculation (0–30%), Active Spread (31–70%), and Tissue Necrosis (71–100%).
        
    - Dynamic metadata card below the canvas updating diagnostic text based on active scrub position.
        
    - Side-by-side "Compare Healthy" toggle switch allowing immediate contrast with baseline stage 0 foliage.
        
- **Acceptance Criteria:**
    
    - Scrubbing dynamically updates the text status without hitching.
        
    - Meets accessibility standards with full keyboard arrow navigation support.