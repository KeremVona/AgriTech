#!/usr/bin/env python3
"""
Process and export photorealistic 800x800 WebP plates and companion difference masks
for the remade baseline 4 crops (Tomato, Potato, Corn, Apple) into:
frontend/public/progression-experimental/

Also mirrors the 4 earlier photorealistic crops (Grape, Pepper, Peach, Squash)
into progression-experimental/ so all 8 crops reside in the isolated experimental suite.

Leaves frontend/public/progression/ completely untouched.
"""

import shutil
from pathlib import Path
from typing import Tuple
import numpy as np
from PIL import Image, ImageChops, ImageFilter, ImageOps

BASE_DIR = Path("C:/Users/kerem/.gemini/antigravity/brain/82a8fc03-a5e1-4f22-86ac-fbc0351251fe")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXP_DEST_DIR = PROJECT_ROOT / "frontend/public/progression-experimental"
STD_DIR = PROJECT_ROOT / "frontend/public/progression"

REMAKE_CROPS = {
    "tomato": {
        "s0": BASE_DIR / "tomato_stage0_healthy_1791488390305.jpg",
        "s1": BASE_DIR / "tomato_stage1_clean_1791574455954.jpg",
        "s2": BASE_DIR / "tomato_stage2_severe_1791574436644.jpg",
    },
    "potato": {
        "s0": BASE_DIR / "potato_stage0_healthy_1791574475943.jpg",
        "s1": BASE_DIR / "potato_stage1_early_1791574494801.jpg",
        "s2": BASE_DIR / "potato_stage2_severe_1791574514432.jpg",
    },
    "corn": {
        "s0": BASE_DIR / "corn_stage0_healthy_1791574533514.jpg",
        "s1": BASE_DIR / "corn_stage1_early_1791574553911.jpg",
        "s2": BASE_DIR / "corn_stage2_severe_1791574573527.jpg",
    },
    "apple": {
        "s0": BASE_DIR / "apple_stage0_healthy_1791574593270.jpg",
        "s1": BASE_DIR / "apple_stage1_early_1791574615637.jpg",
        "s2": BASE_DIR / "apple_stage2_severe_1791574641781.jpg",
    },
}

EXISTING_4CROPS = ["grape", "pepper", "peach", "squash"]


def remove_white_background(img: Image.Image, tolerance: int = 35) -> Image.Image:
    """Isolates leaf from white background cleanly with smooth alpha feathered edges."""
    img = img.convert("RGBA")
    arr = np.array(img).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # Distance from pure white
    dist = np.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)
    
    # Smooth alpha feathering
    alpha = np.clip((dist - 10) / float(tolerance), 0.0, 1.0) * 255.0
    alpha = alpha.astype(np.uint8)
    
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(radius=1.0))
    img.putalpha(alpha_img)
    return img


def normalize_to_target_spec(img: Image.Image, target_size: Tuple[int, int] = (800, 800)) -> Image.Image:
    """Resizes and pads image to strictly 800x800 RGBA."""
    img = img.convert("RGBA")
    # Leave 40px margin
    inner_size = (target_size[0] - 80, target_size[1] - 80)
    img.thumbnail(inner_size, Image.Resampling.LANCZOS)
    
    final_img = Image.new("RGBA", target_size, (0, 0, 0, 0))
    paste_x = (target_size[0] - img.width) // 2
    paste_y = (target_size[1] - img.height) // 2
    final_img.paste(img, (paste_x, paste_y), img)
    return final_img


def compute_difference_mask(img_base: Image.Image, img_target: Image.Image, blur_radius: float = 3.0) -> Image.Image:
    """Computes grayscale difference mask for WebGL shader uniforms u_mask1, u_mask2."""
    # Multiply by combined alpha channel to ensure background is 100% black
    alpha_base = np.array(img_base.split()[-1]).astype(np.float32) / 255.0
    alpha_target = np.array(img_target.split()[-1]).astype(np.float32) / 255.0
    combined_alpha = np.minimum(alpha_base, alpha_target)

    gray_base = img_base.convert("L")
    gray_target = img_target.convert("L")
    diff = ImageChops.difference(gray_base, gray_target)
    diff_arr = (np.array(diff).astype(np.float32) * combined_alpha).astype(np.uint8)
    diff = Image.fromarray(diff_arr)
    diff = ImageOps.autocontrast(diff, cutoff=2)
    if blur_radius > 0:
        diff = diff.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    return diff.convert("RGB")


def main():
    print("[+] Starting WebP progression asset conversion for remade 4 baseline crops...")
    EXP_DEST_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Process 4 Remade Crops
    for crop_id, paths in REMAKE_CROPS.items():
        out_dir = EXP_DEST_DIR / crop_id
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n[*] Processing remade photorealistic crop: {crop_id}...")
        
        # Load raw images
        raw_s0 = Image.open(paths["s0"])
        raw_s1 = Image.open(paths["s1"])
        raw_s2 = Image.open(paths["s2"])

        # Tomato and Corn botanical plates are oriented horizontally with base on the left;
        # Rotate 90 degrees counter-clockwise (ROTATE_90) so plant base is at bottom and tip at top.
        if crop_id in ["tomato", "corn"]:
            print(f"    Rotating {crop_id} 90 degrees so plant base is at bottom...")
            raw_s0 = raw_s0.transpose(Image.Transpose.ROTATE_90)
            raw_s1 = raw_s1.transpose(Image.Transpose.ROTATE_90)
            raw_s2 = raw_s2.transpose(Image.Transpose.ROTATE_90)
        
        # Cutout white background and normalize to 800x800 RGBA
        s0_rgba = normalize_to_target_spec(remove_white_background(raw_s0))
        s1_rgba = normalize_to_target_spec(remove_white_background(raw_s1))
        s2_rgba = normalize_to_target_spec(remove_white_background(raw_s2))
        
        # Compute masks
        m1_rgb = compute_difference_mask(s0_rgba, s1_rgba)
        m2_rgb = compute_difference_mask(s1_rgba, s2_rgba)
        
        # Save WebP files
        p_s0 = out_dir / f"{crop_id}_stage0_healthy.webp"
        p_s1 = out_dir / f"{crop_id}_stage1_early.webp"
        p_m1 = out_dir / f"{crop_id}_stage1_mask.webp"
        p_s2 = out_dir / f"{crop_id}_stage2_severe.webp"
        p_m2 = out_dir / f"{crop_id}_stage2_mask.webp"
        
        s0_rgba.save(p_s0, "WEBP", quality=85, method=6)
        s1_rgba.save(p_s1, "WEBP", quality=85, method=6)
        m1_rgb.save(p_m1, "WEBP", quality=85, method=6)
        s2_rgba.save(p_s2, "WEBP", quality=85, method=6)
        m2_rgb.save(p_m2, "WEBP", quality=85, method=6)
        
        for p in [p_s0, p_s1, p_m1, p_s2, p_m2]:
            kb = p.stat().st_size / 1024
            assert kb < 150.0, f"Asset {p.name} exceeds 150 KB limit: {kb:.1f} KB"
            # Verify image dimensions
            with Image.open(p) as test_im:
                assert test_im.size == (800, 800), f"Asset {p.name} invalid size {test_im.size}"
            print(f"    Saved: {p.name} ({kb:.1f} KB, 800x800)")

    # 2. Mirror Grape, Pepper, Peach, Squash into progression-experimental/
    print("\n[*] Mirroring existing photorealistic crops (grape, pepper, peach, squash) into progression-experimental/...")
    for crop_id in EXISTING_4CROPS:
        src_crop_dir = STD_DIR / crop_id
        tgt_crop_dir = EXP_DEST_DIR / crop_id
        tgt_crop_dir.mkdir(parents=True, exist_ok=True)
        for f in src_crop_dir.glob("*.webp"):
            tgt_file = tgt_crop_dir / f.name
            shutil.copy2(f, tgt_file)
            kb = tgt_file.stat().st_size / 1024
            print(f"    Mirrored {crop_id}/{tgt_file.name} ({kb:.1f} KB)")
            
    print("\n[SUCCESS] All 8 crops (40 WebP assets) successfully generated and verified in public/progression-experimental/!")


if __name__ == "__main__":
    main()
