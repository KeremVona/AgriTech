"""
Evaluation of external test samples in data/raw.
Tests all non-PlantVillage folders one by one using the trained model
and outputs comprehensive diagnostic metrics.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List

from PIL import Image
import numpy as np

# Ensure ml-service root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from inference import InferenceEngine, CLASS_LABELS, get_class_meta
from config import settings

# Mapping of folder names to expected class labels
FOLDER_TO_EXPECTED_CLASS = {
    "patato early blight": "Potato___Early_blight",
    "patato late blight": "Potato___Late_blight",
    "tomato bacterial spot": "Tomato___Bacterial_spot",
    "tomato late blight": "Tomato___Late_blight",
}


def evaluate_raw_dataset(raw_dir: Path = None, output_json: Path = None) -> Dict[str, Any]:
    if raw_dir is None:
        raw_dir = BASE_DIR / "data" / "raw"
    if output_json is None:
        output_json = BASE_DIR / "models" / "raw_test_results.json"

    print(f"[*] Initializing Inference Engine from: {settings.onnx_model_path}")
    engine = InferenceEngine()
    engine.load(str(BASE_DIR / settings.onnx_model_path))

    if not engine.is_loaded():
        raise RuntimeError(f"Failed to load ONNX model from {settings.onnx_model_path}")
    print(f"[+] ONNX model loaded successfully (Version: {engine._model_version})")

    # Discover target folders (excluding PlantVillage)
    target_folders = [
        d for d in raw_dir.iterdir()
        if d.is_dir() and d.name.lower() != "plantvillage"
    ]

    target_folders.sort(key=lambda d: d.name)
    print(f"[*] Found {len(target_folders)} test folders to evaluate:")
    for f in target_folders:
        print(f"    - {f.name} (Expected: {FOLDER_TO_EXPECTED_CLASS.get(f.name, 'Unknown')})")

    all_results = []
    folder_summaries = {}
    total_images = 0
    total_correct = 0

    print("\n" + "=" * 80)
    print("DETAILED IMAGE-BY-IMAGE EVALUATION")
    print("=" * 80)

    for folder in target_folders:
        folder_name = folder.name
        expected_class = FOLDER_TO_EXPECTED_CLASS.get(folder_name)
        image_files = sorted([
            f for f in folder.iterdir()
            if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]
        ])

        folder_correct = 0
        folder_items = []

        print(f"\n📂 FOLDER: [{folder_name}] (Target: {expected_class})")
        print(f"   Image count: {len(image_files)}")
        print("-" * 80)

        for img_path in image_files:
            total_images += 1
            # Inspect image dimensions & file size
            with Image.open(img_path) as img:
                img_width, img_height = img.size
                img_format = img.format
                img_mode = img.mode

            file_size_kb = round(img_path.stat().st_size / 1024, 2)

            with open(img_path, "rb") as f:
                img_bytes = f.read()

            t0 = time.perf_counter()
            inference_res = engine.run(img_bytes)
            latency_ms = inference_res["execution_time_ms"]

            pred_label = inference_res["top_label"]
            confidence = inference_res["confidence"]
            top_3 = inference_res["top_probabilities"]
            all_probs = inference_res["all_probabilities"]

            is_correct = (pred_label == expected_class)
            if is_correct:
                folder_correct += 1
                total_correct += 1
                status_icon = "✅ MATCH"
            else:
                status_icon = "❌ MISMATCH"

            # Check if expected class is in top 3
            expected_rank = None
            expected_prob = all_probs.get(expected_class, 0.0)
            sorted_classes = sorted(all_probs.items(), key=lambda x: x[1], reverse=True)
            for rank, (cls_name, prob) in enumerate(sorted_classes, 1):
                if cls_name == expected_class:
                    expected_rank = rank
                    break

            item_data = {
                "folder": folder_name,
                "file_name": img_path.name,
                "file_size_kb": file_size_kb,
                "resolution": f"{img_width}x{img_height}",
                "color_mode": img_mode,
                "expected_class": expected_class,
                "predicted_class": pred_label,
                "confidence": confidence,
                "confidence_pct": round(confidence * 100, 2),
                "is_correct": is_correct,
                "expected_prob_pct": round(expected_prob * 100, 2),
                "expected_rank": expected_rank,
                "top_probabilities": [
                    {"label": p["label"], "prob_pct": round(p["probability"] * 100, 2)}
                    for p in top_3
                ],
                "latency_ms": latency_ms,
            }
            folder_items.append(item_data)
            all_results.append(item_data)

            # Console report
            print(f"  • File: {img_path.name}")
            print(f"    - Dimensions: {img_width}x{img_height} ({img_mode}), Size: {file_size_kb} KB")
            print(f"    - Prediction: {pred_label} ({confidence * 100:.2f}%) -> {status_icon}")
            print(f"    - Expected Class: {expected_class} (Prob: {expected_prob * 100:.2f}%, Rank: #{expected_rank})")
            print(f"    - Top 3: {', '.join([f'{p['label']} ({p['probability']*100:.1f}%)' for p in top_3])}")
            print(f"    - Latency: {latency_ms:.2f} ms\n")

        folder_acc = (folder_correct / len(image_files) * 100) if image_files else 0.0
        folder_summaries[folder_name] = {
            "expected_class": expected_class,
            "total_images": len(image_files),
            "correct_images": folder_correct,
            "accuracy_pct": round(folder_acc, 2),
            "items": folder_items,
        }

    overall_acc = (total_correct / total_images * 100) if total_images else 0.0

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_version": engine._model_version,
        "total_images_evaluated": total_images,
        "total_correct": total_correct,
        "overall_accuracy_pct": round(overall_acc, 2),
        "folder_summaries": folder_summaries,
        "detailed_results": all_results,
    }

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("=" * 80)
    print(f"OVERALL EVALUATION SUMMARY: {total_correct}/{total_images} ({overall_acc:.2f}%)")
    print(f"Report saved to: {output_json}")
    print("=" * 80)

    return report


if __name__ == "__main__":
    evaluate_raw_dataset()
