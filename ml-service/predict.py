"""
Precision AgriTech - Single Image CLI Prediction Tool
Quickly test the ONNX model on any leaf image file from the command line.

Usage:
    python predict.py <image_path>
    python predict.py <image_path> --crop tomato
"""

import sys
import argparse
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import inference_engine, get_class_meta, CLASS_LABELS
from advisory import get_advisory
from config import settings


def main():
    parser = argparse.ArgumentParser(description="AgriTech Leaf Disease Prediction CLI")
    parser.add_argument("image_path", type=str, help="Path to the leaf image (JPG, PNG, WEBP)")
    parser.add_argument("--crop", type=str, default=None, help="Optional crop hint (apple, corn, potato, tomato)")
    args = parser.parse_args()

    img_path = Path(args.image_path)
    if not img_path.exists():
        print(f"[!] HATA: '{img_path}' dosyası bulunamadı.")
        sys.exit(1)

    # 1. Load ONNX Model
    model_path = Path(settings.onnx_model_path)
    if not model_path.is_absolute():
        model_path = Path(__file__).parent / model_path

    if not model_path.exists():
        print(f"[!] HATA: ONNX model dosyası bulunamadı: {model_path}")
        sys.exit(1)

    inference_engine.load(str(model_path))
    if not inference_engine.is_loaded():
        print("[!] HATA: ONNX modeli yüklenemedi.")
        sys.exit(1)

    # 2. Read image bytes
    with open(img_path, "rb") as f:
        img_bytes = f.read()

    # 3. Run Inference
    try:
        res = inference_engine.run(img_bytes, crop_hint=args.crop)
    except Exception as exc:
        print(f"[!] HATA: Görsel işlenirken hata oluştu: {exc}")
        sys.exit(1)

    top_label = res["top_label"]
    confidence = res["confidence"] * 100.0
    meta = get_class_meta(top_label)

    # 4. Display Results
    print("\n" + "=" * 65)
    print("🌿  AGRITECH YAPRAK HASTALIK TEŞHİS SONUCU")
    print("=" * 65)
    print(f"📁 Test Edilen Görsel : {img_path.name}")
    if args.crop:
        print(f"🎯 Bitki İpucu (Filtre) : {args.crop.capitalize()}")
    print(f"🌱 Tespit Edilen Bitki : {meta['crop']}")
    print(f"🔬 Sağlık Durumu      : {meta['condition']}")
    if meta.get("scientific_name"):
        print(f"🧬 Patojen Adı        : {meta['scientific_name']}")
    print(f"📊 Teşhis Güveni      : %{confidence:.2f}")
    print(f"⏱️  Çıkarım Süresi     : {res['execution_time_ms']} ms")

    print("\n📈 En Yüksek 3 Olasılık:")
    for i, p in enumerate(res["top_probabilities"], 1):
        bar = "█" * int(p["probability"] * 25)
        print(f"   {i}. {p['label']:<36} : %{p['probability'] * 100:>5.1f}  {bar}")

    # 5. Advisory Preview
    advisory, _, low_conf = get_advisory(top_label, res["confidence"])
    if low_conf:
        print("\n⚠️  DÜŞÜK GÜVEN UYARISI:")
        print("   " + low_conf.message)
    elif advisory:
        print("\n🛡️  Zirai Mücadele ve Tavsiye Özeti:")
        print(f"   • Acil Eylem: {advisory.immediate_action}")
        if advisory.chemical_treatments:
            treat = advisory.chemical_treatments[0]
            print(f"   • İlaçlama Önerisi: {treat.product} ({treat.active_substance}) - Doz: {treat.dosage}")
        if advisory.cultural_controls:
            print(f"   • Kültürel Önlem: {advisory.cultural_controls[0]}")

    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
