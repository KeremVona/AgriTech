"""
Interactive Dual-Head Model Testing Application.
Precision AgriTech Platform - Retraining Experimentation.

Launches a local drag-and-drop web UI on http://127.0.0.1:8050 to test
agritech_multitask.onnx with uploaded photos or sample agricultural images.
"""

import io
import json
import time
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
from PIL import Image
import onnxruntime as ort
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse

current_dir = Path(__file__).resolve().parent
exp_root = current_dir.parent
project_root = exp_root.parent
model_path = exp_root / "models" / "agritech_multitask.onnx"
samples_dir = current_dir / "sample_images"
advisories_path = project_root / "ml-service" / "data" / "disease_advisories.json"

if not model_path.exists():
    # Fallback to downloaded/ if models/ was not populated
    alt_model = exp_root / "downloaded" / "agritech_multitask.onnx"
    if alt_model.exists():
        model_path = alt_model

# Load advisories if available
advisories_kb = {}
if advisories_path.exists():
    try:
        with open(advisories_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            advisories_kb = data.get("classes", {})
    except Exception:
        pass

CROP_NAMES = ["Apple", "Corn", "Potato", "Tomato"]
DISEASE_NAMES = [
    "Healthy",
    "Early Blight",
    "Late Blight",
    "Bacterial Spot",
    "Common Rust",
    "Northern Leaf Blight",
    "Cedar Apple Rust",
    "Apple Scab",
]

VALID_COMBINATIONS = {
    ("Apple", "Healthy"): "Apple___healthy",
    ("Apple", "Cedar Apple Rust"): "Apple___Cedar_apple_rust",
    ("Apple", "Apple Scab"): "Apple___Apple_scab",
    ("Corn", "Healthy"): "Corn_(maize)___healthy",
    ("Corn", "Common Rust"): "Corn_(maize)___Common_rust_",
    ("Corn", "Northern Leaf Blight"): "Corn_(maize)___Northern_Leaf_Blight",
    ("Potato", "Healthy"): "Potato___healthy",
    ("Potato", "Early Blight"): "Potato___Early_blight",
    ("Potato", "Late Blight"): "Potato___Late_blight",
    ("Tomato", "Healthy"): "Tomato___healthy",
    ("Tomato", "Early Blight"): "Tomato___Early_blight",
    ("Tomato", "Late Blight"): "Tomato___Late_blight",
    ("Tomato", "Bacterial Spot"): "Tomato___Bacterial_spot",
}

# Initialize ONNX session
session = ort.InferenceSession(str(model_path))

app = FastAPI(title="AgriTech Model Interactive Tester")


def preprocess_pil(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB")
    w, h = img.size
    short = min(w, h)
    scale = 256.0 / short
    nw, nh = int(round(w * scale)), int(round(h * scale))
    img = img.resize((nw, nh), Image.Resampling.BILINEAR)

    left = (nw - 224) // 2
    top = (nh - 224) // 2
    img = img.crop((left, top, left + 224, top + 224))

    arr = np.array(img, dtype=np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0)


def softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / np.sum(e_x, axis=-1, keepdims=True)


def run_model_inference(img: Image.Image) -> Dict[str, Any]:
    tensor = preprocess_pil(img)
    t0 = time.perf_counter()
    crop_logits, disease_logits = session.run(None, {"input": tensor})
    latency_ms = (time.perf_counter() - t0) * 1000

    crop_probs = softmax(crop_logits[0])
    disease_probs = softmax(disease_logits[0])

    top_crop_idx = int(np.argmax(crop_probs))
    top_disease_idx = int(np.argmax(disease_probs))

    pred_crop = CROP_NAMES[top_crop_idx]
    pred_disease = DISEASE_NAMES[top_disease_idx]
    crop_conf = float(crop_probs[top_crop_idx])
    disease_conf = float(disease_probs[top_disease_idx])

    canonical_key = (pred_crop, pred_disease)
    is_valid_pair = canonical_key in VALID_COMBINATIONS
    canonical_class = VALID_COMBINATIONS.get(canonical_key, f"{pred_crop}___{pred_disease.replace(' ', '_')}")

    # Top predictions list
    crop_breakdown = [
        {"name": CROP_NAMES[i], "probability": float(crop_probs[i])}
        for i in np.argsort(-crop_probs)
    ]
    disease_breakdown = [
        {"name": DISEASE_NAMES[i], "probability": float(disease_probs[i])}
        for i in np.argsort(-disease_probs)
    ]

    # Advisory lookup
    advisory = advisories_kb.get(canonical_class, {
        "condition": pred_disease,
        "crop": pred_crop,
        "risk_level": "UNKNOWN" if is_valid_pair else "INCOMPATIBLE",
        "immediate_action": "Consult certified agronomist for confirmation." if is_valid_pair else "Flagged as botanical anomaly. Verify plant species.",
        "pathogen_type": "N/A",
        "cultural_controls": ["Inspect leaf underside for lesions", "Check soil drainage"],
    })

    return {
        "crop": pred_crop,
        "crop_confidence": crop_conf,
        "disease": pred_disease,
        "disease_confidence": disease_conf,
        "canonical_class": canonical_class,
        "is_consistent": is_valid_pair,
        "latency_ms": round(latency_ms, 2),
        "crops": crop_breakdown,
        "diseases": disease_breakdown,
        "advisory": advisory,
    }


@app.get("/samples/{filename}")
def get_sample_file(filename: str):
    fpath = samples_dir / filename
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Sample not found")
    return FileResponse(fpath)


@app.post("/api/predict")
async def api_predict(file: UploadFile = File(...)):
    try:
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        result = run_model_inference(img)
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")


@app.post("/api/predict-sample")
def api_predict_sample(filename: str):
    fpath = samples_dir / filename
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Sample not found")
    try:
        with Image.open(fpath) as img:
            result = run_model_inference(img)
            result["sample_url"] = f"/samples/{filename}"
            return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/", response_class=HTMLResponse)
def index_page():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Precision AgriTech - Dual-Head Model Tester</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f293d;
      --accent: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.2);
      --accent-blue: #3b82f6;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 30px 20px;
      min-height: 100vh;
    }
    .container { max-width: 1080px; margin: 0 auto; }
    header {
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    h1 { font-size: 24px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 10px; }
    .badge {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 9999px;
      background: var(--accent-glow);
      color: var(--accent);
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-weight: 600;
    }
    .specs-strip {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .spec-item {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .spec-item strong { color: #fff; font-family: 'JetBrains Mono', monospace; }
    
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 840px) { .grid { grid-template-columns: 1fr; } }
    
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      position: relative;
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    /* Upload Box */
    .drop-zone {
      border: 2px dashed #2d3748;
      border-radius: 12px;
      padding: 36px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(17, 24, 39, 0.4);
    }
    .drop-zone:hover, .drop-zone.dragover {
      border-color: var(--accent);
      background: var(--accent-glow);
    }
    .drop-zone p { color: var(--text-muted); font-size: 14px; margin-top: 8px; }
    .drop-zone svg { width: 44px; height: 44px; color: var(--accent); margin-bottom: 8px; }
    #fileInput { display: none; }
    
    .preview-container {
      margin-top: 18px;
      display: none;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      max-height: 280px;
      background: #000;
      text-align: center;
    }
    .preview-container img {
      max-width: 100%;
      max-height: 280px;
      object-fit: contain;
    }
    
    /* Presets */
    .presets-title { font-size: 13px; font-weight: 600; margin-top: 20px; margin-bottom: 10px; color: var(--text-muted); }
    .preset-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .preset-btn {
      background: #1a2234;
      border: 1px solid #28354f;
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .preset-btn:hover {
      background: var(--accent-blue);
      border-color: var(--accent-blue);
      color: #fff;
    }
    
    /* Results */
    .hero-diagnosis {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .hero-crop { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .hero-disease { font-size: 22px; font-weight: 700; color: #fff; margin: 4px 0 8px 0; }
    .hero-meta { display: flex; gap: 12px; font-size: 12px; }
    .hero-pill {
      background: #1a2333;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 500;
    }
    .pill-green { color: var(--accent); border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-warn { color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    
    /* Progress Bars */
    .prob-group { margin-bottom: 18px; }
    .prob-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; font-weight: 500; }
    .prob-bar-bg {
      background: #1e293b;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }
    .prob-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;
    }
    .fill-crop { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .fill-disease { background: linear-gradient(90deg, #10b981, #34d399); }
    
    .advisory-box {
      margin-top: 18px;
      padding: 14px;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
    }
    .advisory-box strong { color: #fff; display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; color: var(--accent); }
    
    .spinner {
      display: none;
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Dual-Head MobileNetV3-Large <span class="badge">In-Field ONNX</span></h1>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Precision AgriTech Platform - Solution 1 Retraining Model Tester</p>
      </div>
      <div id="loader" class="spinner"></div>
    </header>

    <div class="specs-strip">
      <div class="spec-item">Architecture: <strong>MobileNetV3-Large (Dual-Head)</strong></div>
      <div class="spec-item">Model Size: <strong>14.16 MB</strong></div>
      <div class="spec-item">In-Field Test Acc: <strong>91.89%</strong></div>
      <div class="spec-item">Latency (CPU): <strong id="latencyDisplay">~2.3 ms</strong></div>
    </div>

    <div class="grid">
      <!-- Upload Column -->
      <div class="card">
        <div class="card-title">Image Input</div>
        <div class="drop-zone" id="dropZone">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p><strong>Click to browse</strong> or drag and drop any plant leaf photo</p>
          <p style="font-size: 11px; color: #64748b;">Supports JPEG, PNG, WEBP</p>
          <input type="file" id="fileInput" accept="image/*">
        </div>

        <div class="preview-container" id="previewContainer">
          <img id="imagePreview" src="" alt="Preview">
        </div>

        <div class="presets-title">Quick Test with Field Samples:</div>
        <div class="preset-btns">
          <button class="preset-btn" onclick="testSample('potato_late_blight.jpg')">🥔 Potato Late Blight</button>
          <button class="preset-btn" onclick="testSample('potato_healthy.jpg')">🥔 Potato Healthy</button>
          <button class="preset-btn" onclick="testSample('tomato_early_blight.jpg')">🍅 Tomato Early Blight</button>
          <button class="preset-btn" onclick="testSample('corn_common_rust.jpg')">🌽 Corn Rust</button>
          <button class="preset-btn" onclick="testSample('apple_cedar_rust.jpg')">🍎 Apple Rust</button>
        </div>
      </div>

      <!-- Results Column -->
      <div class="card">
        <div class="card-title">
          <span>Diagnostic Inference</span>
          <span id="inferTime" style="font-size: 12px; font-family: monospace; color: var(--accent);"></span>
        </div>

        <div id="resultsEmpty" style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 60px 0;">
          Upload or select an image on the left to see dual-head predictions and field advisory.
        </div>

        <div id="resultsContent" style="display: none;">
          <!-- Hero Banner -->
          <div class="hero-diagnosis">
            <div class="hero-crop" id="resHeroCrop">Potato</div>
            <div class="hero-disease" id="resHeroDisease">Late Blight</div>
            <div class="hero-meta">
              <div class="hero-pill pill-green" id="resConfidence">98.4% Confidence</div>
              <div class="hero-pill" id="resConsistency">✓ Botanical Match Verified</div>
            </div>
          </div>

          <!-- Crop Head Breakdown -->
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
            Head 1: Crop Species Distribution
          </div>
          <div id="cropBars"></div>

          <!-- Disease Head Breakdown -->
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-top: 16px; margin-bottom: 8px;">
            Head 2: Disease Pathology Distribution
          </div>
          <div id="diseaseBars"></div>

          <!-- Advisory Box -->
          <div class="advisory-box" id="advisoryBox">
            <strong id="advisoryTitle">Agronomic Advisory</strong>
            <p id="advisoryAction" style="color: #cbd5e1; margin-bottom: 6px;"></p>
            <p id="advisoryRisk" style="font-size: 11px; color: var(--text-muted);"></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const loader = document.getElementById('loader');
    const resultsEmpty = document.getElementById('resultsEmpty');
    const resultsContent = document.getElementById('resultsContent');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('file', file);

      loader.style.display = 'block';
      fetch('/api/predict', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => renderResults(data))
        .catch(err => alert('Inference error: ' + err))
        .finally(() => loader.style.display = 'none');
    }

    function testSample(filename) {
      imagePreview.src = '/samples/' + filename;
      previewContainer.style.display = 'block';
      loader.style.display = 'block';

      fetch('/api/predict-sample?filename=' + filename, { method: 'POST' })
        .then(r => r.json())
        .then(data => renderResults(data))
        .catch(err => alert('Sample error: ' + err))
        .finally(() => loader.style.display = 'none');
    }

    function renderResults(data) {
      resultsEmpty.style.display = 'none';
      resultsContent.style.display = 'block';

      document.getElementById('inferTime').textContent = data.latency_ms + ' ms';
      document.getElementById('latencyDisplay').textContent = data.latency_ms + ' ms';

      document.getElementById('resHeroCrop').textContent = data.crop;
      document.getElementById('resHeroDisease').textContent = data.disease;
      
      const jointConf = (data.crop_confidence * data.disease_confidence * 100).toFixed(1);
      document.getElementById('resConfidence').textContent = jointConf + '% Joint Match';

      const consEl = document.getElementById('resConsistency');
      if (data.is_consistent) {
        consEl.textContent = '✓ Botanically Valid Pair';
        consEl.className = 'hero-pill pill-green';
      } else {
        consEl.textContent = '⚠️ Host-Pathogen Mismatch Anomaly';
        consEl.className = 'hero-pill pill-warn';
      }

      // Render Crop bars
      const cropContainer = document.getElementById('cropBars');
      cropContainer.innerHTML = '';
      data.crops.slice(0, 3).forEach(c => {
        const pct = (c.probability * 100).toFixed(1);
        cropContainer.innerHTML += `
          <div class="prob-group">
            <div class="prob-label"><span>${c.name}</span><span style="font-family: monospace;">${pct}%</span></div>
            <div class="prob-bar-bg"><div class="prob-bar-fill fill-crop" style="width: ${pct}%;"></div></div>
          </div>
        `;
      });

      // Render Disease bars
      const disContainer = document.getElementById('diseaseBars');
      disContainer.innerHTML = '';
      data.diseases.slice(0, 3).forEach(d => {
        const pct = (d.probability * 100).toFixed(1);
        disContainer.innerHTML += `
          <div class="prob-group">
            <div class="prob-label"><span>${d.name}</span><span style="font-family: monospace;">${pct}%</span></div>
            <div class="prob-bar-bg"><div class="prob-bar-fill fill-disease" style="width: ${pct}%;"></div></div>
          </div>
        `;
      });

      // Advisory
      const adv = data.advisory;
      document.getElementById('advisoryTitle').textContent = adv.condition ? 'Agronomic Protocol: ' + adv.condition : 'Advisory Note';
      document.getElementById('advisoryAction').textContent = adv.immediate_action || 'Continue routine scouting.';
      document.getElementById('advisoryRisk').textContent = 'Pathogen: ' + (adv.pathogen_type || 'N/A') + ' | Risk Level: ' + (adv.risk_level || 'N/A');
    }
  </script>
</body>
</html>
"""
    return HTMLResponse(html_content)


if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("Launching AgriTech Dual-Head Interactive Tester")
    print("Local URL: http://127.0.0.1:8050")
    print("=" * 65 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8050)
