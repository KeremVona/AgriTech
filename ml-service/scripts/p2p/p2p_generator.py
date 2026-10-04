"""
Standalone generation and postprocessing script for Prompt-to-Prompt Disease Progression.
Executable locally or directly in Google Colab.
Precision AgriTech Platform - Phase 1 (TODO-107 / Feature #1).
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict, Tuple
from PIL import Image, ImageOps, ImageChops, ImageFilter
import numpy as np


UNIVERSAL_NEGATIVE_PROMPT = (
    "fruit, vegetable, food, slice, cut, tuber, potato, tomato fruit, kiwi, "
    "wood, wooden table, cutting board, plate, bowl, kitchen, grass, soil, "
    "slate, stone, dark background, textured background, complex background, "
    "shadow, blurry, 3d render, illustration"
)

# Default prompt triplets and agronomic definitions for the 4 target crops
DEFAULT_CROP_SPECS = {
    "tomato": {
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "pathogen_scientific": "Alternaria solani",
        "seed": 42,
        "prompts": [
            "botanical specimen photograph of a single healthy green leaf blade of a tomato plant (Solanum lycopersicum foliage), distinct venation, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single green leaf blade of a tomato plant with small dark brown concentric target-like early blight spots and faint yellow chlorotic halos, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single withered leaf blade of a tomato plant with large dark brown necrotic patches, dry tissue collapse, and leaf margin chlorosis, centered, flat lay, pure solid white background, sharp focus, 8k",
        ],
        "cross_replace_steps": 0.75,
        "self_replace_steps": 0.60,
    },
    "potato": {
        "crop_name": "Potato",
        "disease_name": "Late Blight",
        "pathogen_scientific": "Phytophthora infestans",
        "seed": 108,
        "prompts": [
            "botanical specimen photograph of a single broad oval healthy green leaf blade of a potato plant (Solanum tuberosum foliage), distinct center vein, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single green leaf blade of a potato plant with irregular water-soaked dark brown late blight lesions and pale green margins, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single decaying leaf blade of a potato plant with large dark brown necrotic blotches, shriveled leaf edges, and severe tissue rot, centered, flat lay, pure solid white background, sharp focus, 8k",
        ],
        "cross_replace_steps": 0.75,
        "self_replace_steps": 0.60,
    },
    "corn": {
        "crop_name": "Corn (Maize)",
        "disease_name": "Common Rust",
        "pathogen_scientific": "Puccinia sorghi",
        "seed": 204,
        "prompts": [
            "botanical specimen photograph of a single long lanceolate healthy green leaf blade of a corn plant (Zea mays foliage), parallel longitudinal venation, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single green leaf blade of a corn plant with scattered elongated cinnamon-brown powdery rust pustules, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single dry leaf blade of a corn plant with dense confluent dark brown rust pustules, necrotic scorch streaks, and tissue brittleness, centered, flat lay, pure solid white background, sharp focus, 8k",
        ],
        "cross_replace_steps": 0.70,
        "self_replace_steps": 0.55,
    },
    "apple": {
        "crop_name": "Apple",
        "disease_name": "Apple Scab",
        "pathogen_scientific": "Venturia inaequalis",
        "seed": 312,
        "prompts": [
            "botanical specimen photograph of a single elliptical healthy green leaf blade of an apple tree (Malus domestica foliage), finely serrated margins, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single green leaf blade of an apple tree with discrete dull olive-green to black velvety scab spots, centered, flat lay, pure solid white background, sharp focus, 8k",
            "botanical specimen photograph of a single distorted leaf blade of an apple tree with large corky brown scab lesions, puckered lamina, and severe necrotic leaf margins, centered, flat lay, pure solid white background, sharp focus, 8k",
        ],
        "cross_replace_steps": 0.75,
        "self_replace_steps": 0.60,
    },
}


def remove_white_background(img: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Converts background to transparent RGBA.
    Uses AI salient object segmentation (rembg) if installed,
    falling back to color thresholding.
    """
    try:
        from rembg import remove
        return remove(img)
    except ImportError:
        img = img.convert("RGBA")
        data = np.array(img)
        r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
        white_mask = (r > threshold) & (g > threshold) & (b > threshold)
        data[white_mask, 3] = 0
        return Image.fromarray(data)


def compute_difference_mask(img_base: Image.Image, img_target: Image.Image, blur_radius: float = 3.0) -> Image.Image:
    """
    Computes a localized grayscale pathology mask highlighting where symptoms emerged
    between two progression stages. Fed to WebGL fragment shader uniforms u_mask1 and u_mask2.
    """
    # Convert to grayscale
    gray_base = img_base.convert("L")
    gray_target = img_target.convert("L")
    
    # Calculate absolute difference
    diff = ImageChops.difference(gray_base, gray_target)
    
    # Contrast stretch to maximize mask separation
    diff = ImageOps.autocontrast(diff, cutoff=2)
    
    # Smooth with Gaussian blur for organic shader edge blending
    if blur_radius > 0:
        diff = diff.filter(ImageFilter.GaussianBlur(radius=blur_radius))
        
    return diff


def normalize_to_target_spec(img: Image.Image, target_size: Tuple[int, int] = (800, 800)) -> Image.Image:
    """Resizes and pads image to strictly 800x800 RGBA while maintaining aspect ratio."""
    img = img.convert("RGBA")
    img.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    # Center on transparent canvas
    final_img = Image.new("RGBA", target_size, (0, 0, 0, 0))
    paste_x = (target_size[0] - img.width) // 2
    paste_y = (target_size[1] - img.height) // 2
    final_img.paste(img, (paste_x, paste_y), img)
    return final_img


def run_prompt_to_prompt_generation(
    crop_id: str,
    output_dir: Path,
    device: str = "cuda",
    model_id: str = "runwayml/stable-diffusion-v1-5",
    num_inference_steps: int = 50,
    guidance_scale: float = 7.5,
):
    """
    Runs the complete Prompt-to-Prompt pipeline for a specified crop:
    1. Loads Stable Diffusion pipeline.
    2. Hooks AttentionControlEdit controller.
    3. Runs joint batched generation for [Stage 0, Stage 1, Stage 2].
    4. Postprocesses outputs into 800x800 WebP assets and companion masks.
    """
    import torch
    from diffusers import StableDiffusionPipeline, DDIMScheduler
    from cross_attention_control import AttentionControlEdit, register_attention_control

    spec = DEFAULT_CROP_SPECS[crop_id]
    prompts = spec["prompts"]
    seed = spec["seed"]
    cross_replace = spec["cross_replace_steps"]
    self_replace = spec["self_replace_steps"]

    print(f"\n[+] Starting Prompt-to-Prompt Generation for: {spec['crop_name']} ({spec['disease_name']})")
    print(f"    Device: {device} | Model: {model_id} | Seed: {seed}")
    print(f"    Cross Replace Steps: {cross_replace} | Self Replace Steps: {self_replace}")

    generator = torch.Generator(device=device).manual_seed(seed)

    scheduler = DDIMScheduler(
        beta_start=0.00085,
        beta_end=0.012,
        beta_schedule="scaled_linear",
        clip_sample=False,
        set_alpha_to_one=False,
    )

    pipe = StableDiffusionPipeline.from_pretrained(
        model_id,
        scheduler=scheduler,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
    ).to(device)

    # Instantiate Prompt-to-Prompt controller
    controller = AttentionControlEdit(
        prompts=prompts,
        num_steps=num_inference_steps,
        cross_replace_steps=cross_replace,
        self_replace_steps=self_replace,
        tokenizer=pipe.tokenizer,
        device=device,
    )
    register_attention_control(pipe, controller)

    # Execute batched generation
    with torch.autocast(device if device == "cuda" else "cpu"):
        outputs = pipe(
            prompts,
            negative_prompt=[UNIVERSAL_NEGATIVE_PROMPT] * len(prompts),
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).images

    img_stage0, img_stage1, img_stage2 = outputs[0], outputs[1], outputs[2]

    # Postprocessing
    crop_out = output_dir / crop_id
    crop_out.mkdir(parents=True, exist_ok=True)

    print("    Post-processing output assets (800x800 RGBA WebP)...")
    s0 = normalize_to_target_spec(remove_white_background(img_stage0))
    s1 = normalize_to_target_spec(remove_white_background(img_stage1))
    s2 = normalize_to_target_spec(remove_white_background(img_stage2))

    # Masks for WebGL shaders
    mask1 = compute_difference_mask(s0, s1)
    mask2 = compute_difference_mask(s1, s2)

    s0.save(crop_out / f"{crop_id}_stage0_healthy.webp", "WEBP", quality=90)
    s1.save(crop_out / f"{crop_id}_stage1_early.webp", "WEBP", quality=90)
    s2.save(crop_out / f"{crop_id}_stage2_severe.webp", "WEBP", quality=90)
    mask1.save(crop_out / f"{crop_id}_stage1_mask.webp", "WEBP", quality=85)
    mask2.save(crop_out / f"{crop_id}_stage2_mask.webp", "WEBP", quality=85)

    print(f"[✓] Saved all 5 assets for {crop_id} in: {crop_out}")


def main():
    parser = argparse.ArgumentParser(description="Prompt-to-Prompt Disease Progression Asset Generator")
    parser.add_argument("--crop", type=str, choices=["all", "tomato", "potato", "corn", "apple"], default="all")
    parser.add_argument("--output-dir", type=str, default="frontend/public/progression")
    parser.add_argument("--device", type=str, default="cuda" if sys.platform != "darwin" else "cpu")
    parser.add_argument("--steps", type=int, default=50)
    args = parser.parse_args()

    out_path = Path(args.output_dir)
    crops_to_run = list(DEFAULT_CROP_SPECS.keys()) if args.crop == "all" else [args.crop]

    for crop in crops_to_run:
        run_prompt_to_prompt_generation(
            crop_id=crop,
            output_dir=out_path,
            device=args.device,
            num_inference_steps=args.steps,
        )


if __name__ == "__main__":
    main()
