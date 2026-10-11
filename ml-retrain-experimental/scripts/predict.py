"""
Standalone CLI Inference Engine for Dual-Head MobileNetV3-Large ONNX Model.
Precision AgriTech Platform - Retraining Experimentation.

Usage:
  python ml-retrain-experimental/scripts/predict.py <image_path>
  python ml-retrain-experimental/scripts/predict.py <image_path> --model <path_to_onnx>
"""

import sys
import time
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

try:
    import onnxruntime as ort
except ImportError:
    print("ERROR: onnxruntime not installed in this environment.")
    sys.exit(1)

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

# Canonical compatibility map
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


def preprocess_image(img_path: Path) -> np.ndarray:
    with Image.open(img_path) as img:
        img = img.convert("RGB")
        # Standard validation resize & center crop
        w, h = img.size
        short = min(w, h)
        scale = 256.0 / short
        nw, nh = int(round(w * scale)), int(round(h * scale))
        img = img.resize((nw, nh), Image.Resampling.BILINEAR)

        # Center crop 224x224
        left = (nw - 224) // 2
        top = (nh - 224) // 2
        img = img.crop((left, top, left + 224, top + 224))

        arr = np.array(img, dtype=np.float32) / 255.0
        # ImageNet normalization
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        # HWC to CHW and add batch dim
        arr = np.transpose(arr, (2, 0, 1))
        return np.expand_dims(arr, axis=0)


def softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / np.sum(e_x, axis=-1, keepdims=True)


def predict(image_path: Path, model_path: Path):
    if not image_path.exists():
        print(f"ERROR: Image not found at {image_path}")
        sys.exit(1)
    if not model_path.exists():
        print(f"ERROR: ONNX model not found at {model_path}")
        sys.exit(1)

    session = ort.InferenceSession(str(model_path))
    input_tensor = preprocess_image(image_path)

    t0 = time.perf_counter()
    crop_logits, disease_logits = session.run(None, {"input": input_tensor})
    latency_ms = (time.perf_counter() - t0) * 1000

    crop_probs = softmax(crop_logits[0])
    disease_probs = softmax(disease_logits[0])

    top_crop_idx = int(np.argmax(crop_probs))
    top_disease_idx = int(np.argmax(disease_probs))

    pred_crop = CROP_NAMES[top_crop_idx]
    pred_disease = DISEASE_NAMES[top_disease_idx]
    crop_conf = crop_probs[top_crop_idx] * 100
    disease_conf = disease_probs[top_disease_idx] * 100

    canonical_key = (pred_crop, pred_disease)
    is_valid_pair = canonical_key in VALID_COMBINATIONS
    canonical_class = VALID_COMBINATIONS.get(canonical_key, "ANOMALY: Incompatible Pair")

    print("\n" + "=" * 65)
    print("DUAL-HEAD MULTI-TASK INFERENCE RESULTS")
    print("=" * 65)
    print(f"Image File:         {image_path.name}")
    print(f"Inference Latency:  {latency_ms:.2f} ms (CPU)")
    print("-" * 65)
    print(f"Crop Species:       {pred_crop:<10} (Confidence: {crop_conf:5.2f}%)")
    print(f"Pathology:          {pred_disease:<18} (Confidence: {disease_conf:5.2f}%)")
    print(f"Canonical Class:    {canonical_class}")
    print(f"Consistency Check:  {'[VALID] Botanically Compatible Pair' if is_valid_pair else '[ANOMALY] Incompatible Host-Pathogen Pair'}")
    print("-" * 65)
    print("Top Crop Probabilities:")
    for i in np.argsort(-crop_probs)[:4]:
        bar = "#" * int(crop_probs[i] * 30)
        print(f"  {CROP_NAMES[i]:<8} {crop_probs[i]*100:5.1f}% | {bar}")
    print("\nTop Disease Probabilities:")
    for i in np.argsort(-disease_probs)[:4]:
        bar = "#" * int(disease_probs[i] * 30)
        print(f"  {DISEASE_NAMES[i]:<20} {disease_probs[i]*100:5.1f}% | {bar}")
    print("=" * 65 + "\n")

    return {
        "crop": pred_crop,
        "crop_confidence": crop_conf,
        "disease": pred_disease,
        "disease_confidence": disease_conf,
        "canonical_class": canonical_class,
        "is_consistent": is_valid_pair,
        "latency_ms": latency_ms,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Dual-Head ONNX inference on an image")
    parser.add_argument("image", type=str, help="Path to input image")
    parser.add_argument(
        "--model",
        type=str,
        default="ml-retrain-experimental/models/agritech_multitask.onnx",
        help="Path to agritech_multitask.onnx",
    )
    args = parser.parse_args()

    predict(Path(args.image), Path(args.model))
