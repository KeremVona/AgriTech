"""
Prepares a self-contained, turnkey Zip bundle for Google Colab training.
Precision AgriTech Platform - Retraining Experimentation.

Packages:
1. Manifests: train_manifest.json, val_manifest.json, test_manifest.json, summary.json
2. Raw Images: The 12 canonical class image folders from PlantVillage (and any in-field images)

Output:
ml-retrain-experimental/colab_training_bundle.zip (~200 MB)
"""

import os
import sys
import zipfile
from pathlib import Path

def create_colab_bundle():
    project_root = Path(__file__).resolve().parent.parent.parent
    exp_dir = project_root / "ml-retrain-experimental"
    manifest_dir = exp_dir / "data" / "manifests"
    raw_dir = project_root / "ml-service" / "data" / "raw" / "PlantVillage"
    output_zip = exp_dir / "colab_training_bundle.zip"

    print("=" * 65)
    print("Preparing Colab Training Bundle...")
    print(f"Project root:  {project_root}")
    print(f"Manifests dir: {manifest_dir}")
    print(f"Images source: {raw_dir}")
    print(f"Output bundle: {output_zip}")
    print("=" * 65)

    if not manifest_dir.exists():
        print(f"ERROR: Manifests directory not found at {manifest_dir}")
        sys.exit(1)

    # 12 canonical classes
    canonical_classes = [
        "Apple___Cedar_apple_rust",
        "Apple___healthy",
        "Corn_(maize)___Common_rust_",
        "Corn_(maize)___Northern_Leaf_Blight",
        "Corn_(maize)___healthy",
        "Potato___Early_blight",
        "Potato___Late_blight",
        "Potato___healthy",
        "Tomato___Bacterial_spot",
        "Tomato___Early_blight",
        "Tomato___Late_blight",
        "Tomato___healthy",
    ]

    total_files = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Add manifests
        print("\n[1/2] Adding manifests...")
        for mf in ["train_manifest.json", "val_manifest.json", "test_manifest.json", "summary.json"]:
            mf_path = manifest_dir / mf
            if mf_path.exists():
                arc_name = f"data/manifests/{mf}"
                zf.write(mf_path, arc_name)
                print(f"  + Added {arc_name}")
                total_files += 1

        # 2. Add raw images
        print("\n[2/2] Adding image files for the 12 canonical classes...")
        for c in canonical_classes:
            class_folder = raw_dir / c
            if class_folder.exists():
                images = [f for f in class_folder.iterdir() if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
                print(f"  + Archiving {c} ({len(images)} images)...")
                for img in images:
                    arc_name = f"data/raw/PlantVillage/{c}/{img.name}"
                    zf.write(img, arc_name)
                    total_files += 1
            else:
                print(f"  ! Warning: {class_folder} not found, skipping.")

    zip_size_mb = output_zip.stat().st_size / (1024 * 1024)
    print("\n" + "=" * 65)
    print(f"[SUCCESS] Colab bundle created: {output_zip.name}")
    print(f"Total files packed: {total_files}")
    print(f"Bundle size:        {zip_size_mb:.1f} MB")
    print("=" * 65)
    print("\nHow to use in Colab:")
    print("1. Open Google Colab and upload notebooks/MultiDataset_Training.ipynb")
    print("2. Set Runtime -> Change runtime type -> T4 GPU")
    print("3. Drag & drop 'colab_training_bundle.zip' into Colab's file tree on the left")
    print("4. Click Runtime -> Run all")
    print("=" * 65)

if __name__ == "__main__":
    create_colab_bundle()
