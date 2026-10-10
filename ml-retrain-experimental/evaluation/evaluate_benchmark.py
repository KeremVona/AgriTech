"""
Evaluation & Field Benchmark Engine.
Precision AgriTech Platform - Retraining Experimentation (Solution 1).

Benchmarks trained multi-task checkpoints or exported ONNX models against:
1. Field Test Manifest / In-The-Wild captures (PlantDoc & Mendeley field).
2. Lab Test Manifest (PlantVillage clean benchmark).

Features:
- Dual-Head Evaluation: Calculates Crop Accuracy, Disease Accuracy, Joint Accuracy, and Disease Macro F1.
- Domain Disaggregation: Evaluates in-field robustness vs clean lab retention.
- Potato Late Blight Fumble Diagnostic: Verifies resolution of host misattribution (Potato vs Tomato).
- CPU/GPU Latency Profiling (P50, P95, mean latency).
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

# Ensure experimental root is in sys.path
exp_root = Path(__file__).resolve().parent.parent
if str(exp_root) not in sys.path:
    sys.path.insert(0, str(exp_root))

import numpy as np
import torch
from torch.utils.data import DataLoader
from PIL import Image

from models.model_multitask import (
    MultiTaskPlantClassifier,
    compute_multitask_evaluation_metrics,
)
from pipeline.dataset import MultiTaskDataset, get_val_transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BenchmarkEvaluator")


class BenchmarkEvaluator:
    """
    Evaluator for multi-task PyTorch or ONNX models.
    """

    def __init__(
        self,
        model: Optional[torch.nn.Module] = None,
        checkpoint_path: Optional[Union[str, Path]] = None,
        device: Optional[torch.device] = None,
    ) -> None:
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = model

        if self.model is None and checkpoint_path is not None:
            ckpt_p = Path(checkpoint_path)
            if not ckpt_p.exists():
                raise FileNotFoundError(f"Checkpoint file not found: {ckpt_p}")
            self.model = MultiTaskPlantClassifier(num_crops=4, num_diseases=8, pretrained=False)
            ckpt = torch.load(ckpt_p, map_location=self.device)
            state_dict = ckpt.get("model_state_dict", ckpt)
            self.model.load_state_dict(state_dict)
            logger.info(f"Loaded weights from {ckpt_p} into MultiTaskPlantClassifier.")

        if self.model is not None:
            self.model.to(self.device)
            self.model.eval()

    @torch.no_grad()
    def evaluate_manifest(
        self,
        manifest_path: Union[str, Path],
        root_dir: Optional[Union[str, Path]] = None,
        batch_size: int = 32,
        num_workers: int = 0,
        image_size: int = 224,
    ) -> Dict[str, Any]:
        """
        Runs comprehensive evaluation over a manifest file.
        Disaggregates metrics across domains (lab vs field).
        """
        if self.model is None:
            raise RuntimeError("No model loaded for evaluation.")

        ds = MultiTaskDataset(
            manifest=manifest_path,
            transform=get_val_transforms(image_size),
            root_dir=root_dir,
            return_metadata=True,
        )
        loader = DataLoader(ds, batch_size=batch_size, shuffle=False, num_workers=num_workers)

        all_crop_preds: List[int] = []
        all_crop_targets: List[int] = []
        all_disease_preds: List[int] = []
        all_disease_targets: List[int] = []
        domains: List[str] = []
        latencies: List[float] = []

        # Tracking for Potato Late Blight fumble diagnosis
        potato_late_blight_diagnostics: List[Dict[str, Any]] = []

        for batch in loader:
            imgs, crops, dis, meta = batch
            imgs = imgs.to(self.device)

            t0 = time.perf_counter()
            crop_logits, disease_logits = self.model(imgs)
            t1 = time.perf_counter()

            batch_latency_ms = (t1 - t0) * 1000 / max(imgs.size(0), 1)
            latencies.extend([batch_latency_ms] * imgs.size(0))

            cp = torch.argmax(crop_logits, dim=-1).cpu().tolist()
            ct = crops.cpu().tolist()
            dp = torch.argmax(disease_logits, dim=-1).cpu().tolist()
            dt = dis.cpu().tolist()

            all_crop_preds.extend(cp)
            all_crop_targets.extend(ct)
            all_disease_preds.extend(dp)
            all_disease_targets.extend(dt)

            # Metadata lists
            for i in range(len(cp)):
                dom = meta["domain"][i]
                domains.append(dom)
                canon = meta["canonical_class"][i]

                if canon == "Potato___Late_blight":
                    potato_late_blight_diagnostics.append({
                        "file_path": meta["file_path"][i],
                        "expected_crop": 2,  # Potato
                        "predicted_crop": cp[i],
                        "crop_correct": cp[i] == 2,
                        "expected_disease": 2,  # Late Blight
                        "predicted_disease": dp[i],
                        "disease_correct": dp[i] == 2,
                        "joint_correct": (cp[i] == 2 and dp[i] == 2),
                        "domain": dom,
                    })

        # Global metrics
        overall_metrics = compute_multitask_evaluation_metrics(
            all_crop_preds, all_crop_targets, all_disease_preds, all_disease_targets
        )

        # Domain breakdown (Field vs Lab)
        field_indices = [i for i, d in enumerate(domains) if d == "field"]
        lab_indices = [i for i, d in enumerate(domains) if d == "lab"]

        def _sub_metrics(indices: List[int]) -> Dict[str, float]:
            if not indices:
                return {"sample_count": 0, "crop_accuracy": 0.0, "disease_accuracy": 0.0, "joint_accuracy": 0.0}
            m = compute_multitask_evaluation_metrics(
                [all_crop_preds[i] for i in indices],
                [all_crop_targets[i] for i in indices],
                [all_disease_preds[i] for i in indices],
                [all_disease_targets[i] for i in indices],
            )
            m["sample_count"] = len(indices)
            return m

        field_metrics = _sub_metrics(field_indices)
        lab_metrics = _sub_metrics(lab_indices)

        # Potato late blight resolution
        plb_total = len(potato_late_blight_diagnostics)
        plb_crop_acc = sum(1 for d in potato_late_blight_diagnostics if d["crop_correct"]) / max(plb_total, 1)
        plb_disease_acc = sum(1 for d in potato_late_blight_diagnostics if d["disease_correct"]) / max(plb_total, 1)
        plb_joint_acc = sum(1 for d in potato_late_blight_diagnostics if d["joint_correct"]) / max(plb_total, 1)

        results = {
            "total_evaluated": len(all_crop_targets),
            "overall_metrics": overall_metrics,
            "field_metrics": field_metrics,
            "lab_metrics": lab_metrics,
            "potato_late_blight_resolution": {
                "total_samples": plb_total,
                "crop_accuracy": plb_crop_acc,
                "disease_accuracy": plb_disease_acc,
                "joint_accuracy": plb_joint_acc,
                "samples": potato_late_blight_diagnostics[:10],
            },
            "latency_ms": {
                "mean": float(np.mean(latencies)) if latencies else 0.0,
                "p50": float(np.percentile(latencies, 50)) if latencies else 0.0,
                "p95": float(np.percentile(latencies, 95)) if latencies else 0.0,
            },
        }
        return results


def format_benchmark_markdown_report(results: Dict[str, Any]) -> str:
    """Formats benchmark results into a markdown evaluation report."""
    ov = results["overall_metrics"]
    fm = results["field_metrics"]
    lm = results["lab_metrics"]
    plb = results["potato_late_blight_resolution"]
    lat = results["latency_ms"]

    lines = [
        "# Multi-Dataset Multi-Task Benchmark Evaluation Report",
        "",
        f"**Total Samples Evaluated:** {results['total_evaluated']}",
        f"**Mean Latency:** {lat['mean']:.2f} ms/sample (P95: {lat['p95']:.2f} ms)",
        "",
        "---",
        "",
        "## 1. Overall Performance Metrics",
        "",
        "| Metric | Value | Target Standard |",
        "| :--- | :---: | :---: |",
        f"| **Crop Species Accuracy** | **{ov['crop_accuracy']*100:.2f}%** | $\\ge 95.0\\%$ |",
        f"| **Disease Pathology Accuracy** | **{ov['disease_accuracy']*100:.2f}%** | $\\ge 90.0\\%$ |",
        f"| **Joint Exact Match (Crop & Disease)** | **{ov['joint_accuracy']*100:.2f}%** | $\\ge 88.0\\%$ |",
        f"| **Disease Macro F1** | **{ov['disease_macro_f1']*100:.2f}%** | $\\ge 85.0\\%$ |",
        f"| **Crop Macro F1** | **{ov['crop_macro_f1']*100:.2f}%** | $\\ge 95.0\\%$ |",
        "",
        "---",
        "",
        "## 2. Domain Disaggregation (In-Field vs Lab)",
        "",
        "| Environment Domain | Sample Count | Crop Accuracy | Disease Accuracy | Joint Accuracy |",
        "| :--- | :---: | :---: | :---: | :---: |",
        f"| **Authentic In-Field (Soil/Sun/Weeds)** | {fm.get('sample_count', 0)} | {fm.get('crop_accuracy', 0)*100:.2f}% | {fm.get('disease_accuracy', 0)*100:.2f}% | **{fm.get('joint_accuracy', 0)*100:.2f}%** |",
        f"| **Clean Lab Benchmark (PlantVillage)** | {lm.get('sample_count', 0)} | {lm.get('crop_accuracy', 0)*100:.2f}% | {lm.get('disease_accuracy', 0)*100:.2f}% | **{lm.get('joint_accuracy', 0)*100:.2f}%** |",
        "",
        "---",
        "",
        "## 3. Potato Late Blight Baseline Fumble Diagnostic",
        "",
        "> **Baseline Behavior:** On the baseline model, authentic field captures of Potato Late Blight fumbled with Tomato Late Blight (due to identical *Phytophthora infestans* morphology and soil background shortcut learning).",
        "",
        f"- **Potato Host Crop Accuracy:** **{plb['crop_accuracy']*100:.1f}%**",
        f"- **Late Blight Pathology Accuracy:** **{plb['disease_accuracy']*100:.1f}%**",
        f"- **Joint Exact Resolution:** **{plb['joint_accuracy']*100:.1f}%**",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate multi-task benchmark")
    parser.add_argument("--manifest", type=str, default="ml-retrain-experimental/data/manifests/test_manifest.json")
    parser.add_argument("--checkpoint", type=str, default="ml-retrain-experimental/models/best_multitask_model.pth")
    parser.add_argument("--output-json", type=str, default="ml-retrain-experimental/evaluation/field_benchmark_results.json")
    parser.add_argument("--output-md", type=str, default="ml-retrain-experimental/evaluation/BENCHMARK_REPORT.md")
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    evaluator = BenchmarkEvaluator(checkpoint_path=args.checkpoint)
    res = evaluator.evaluate_manifest(manifest_path=args.manifest, batch_size=args.batch_size)

    Path(args.output_json).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)

    report_md = format_benchmark_markdown_report(res)
    with open(args.output_md, "w", encoding="utf-8") as f:
        f.write(report_md)

    print(report_md)
