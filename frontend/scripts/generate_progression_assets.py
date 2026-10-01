"""
Progression Asset Generator - Precision AgriTech Platform
Phase 1 - TODO-107: Morphological Leaf Asset Preparation & Normalization

Generates 12 normalized, geometrically registered 800x800 WebP images across
4 primary crops (Tomato, Potato, Corn, Apple) and 3 progression stages
(Healthy -> Moderate Lesions -> Severe Necrosis), plus companion transition masks.
All assets are strictly aligned, antialiased, transparent/neutral matte RGBA,
and optimized to < 150 KB per asset.
"""

import math
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "progression"
CANVAS_SIZE = (800, 800)


def create_smooth_gradient_noise(width: int, height: int, scale: float = 20.0, seed: int = 42) -> Image.Image:
    """Creates a gentle organic noise layer for natural leaf texture."""
    random.seed(seed)
    small_w, small_h = max(10, int(width / scale)), max(10, int(height / scale))
    small = Image.new("L", (small_w, small_h))
    pixels = [random.randint(210, 255) for _ in range(small_w * small_h)]
    small.putdata(pixels)
    noise = small.resize((width, height), Image.Resampling.BICUBIC)
    return noise


def draw_antialiased_polygon(size: tuple, points: list, fill_color: tuple) -> Image.Image:
    """Draws a smoothly antialiased polygon on a transparent RGBA canvas using 2x supersampling."""
    w, h = size
    scale = 2
    big = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    big_draw = ImageDraw.Draw(big)
    scaled_points = [(int(p[0] * scale), int(p[1] * scale)) for p in points]
    big_draw.polygon(scaled_points, fill=fill_color)
    return big.resize((w, h), Image.Resampling.LANCZOS)


# ---------------------------------------------------------------------------
# Morphological Outline Generators (Pixel-perfect registration across stages)
# ---------------------------------------------------------------------------

def get_tomato_leaf_contour() -> list:
    """
    Parametric pinnate-lobed tomato leaflet geometry.
    Centered at x=400, base at y=680, apex at y=120.
    Features terminal lobe and two distinct pairs of lateral serrated lobes.
    """
    points = []
    # Left side from petiole base (400, 720) up to tip (400, 110)
    left_side = [
        (400, 720), (396, 680), (385, 650),
        # Lower left lobe
        (350, 630), (300, 615), (250, 585), (220, 545), (210, 505),
        (230, 485), (275, 490), (320, 510), (345, 495),
        # Middle left lobe
        (300, 470), (240, 440), (205, 400), (195, 350), (215, 315),
        (255, 310), (300, 325), (335, 350), (355, 340),
        # Upper left shoulder
        (325, 300), (280, 260), (265, 215), (285, 180), (325, 175),
        (360, 205), (375, 185), (385, 150), (400, 110),
    ]
    # Mirror for right side
    right_side = []
    for x, y in reversed(left_side[:-1]):
        rx = 400 + (400 - x)
        right_side.append((rx, y))

    points = left_side + right_side
    return points


def get_potato_leaf_contour() -> list:
    """
    Broad ovate potato leaflet with soft wavy margins and rounded base.
    Petiole at (400, 720), base at (400, 660), apex at (400, 120).
    """
    points = []
    left_side = [
        (400, 720), (395, 670), (375, 645),
        (325, 615), (265, 565), (220, 500), (195, 425),
        (190, 350), (205, 285), (240, 230), (285, 185),
        (340, 150), (375, 130), (400, 115),
    ]
    right_side = []
    for x, y in reversed(left_side[:-1]):
        rx = 400 + (400 - x)
        right_side.append((rx, y))

    return left_side + right_side


def get_corn_leaf_contour() -> list:
    """
    Long lanceolate corn blade with parallel longitudinal margins.
    Base at (400, 740), wide center at y=400, tapering apex at (400, 80).
    """
    points = []
    left_side = [
        (400, 740), (385, 700), (360, 640),
        (335, 560), (315, 470), (305, 380),
        (315, 290), (335, 210), (360, 145),
        (385, 105), (400, 75),
    ]
    right_side = []
    for x, y in reversed(left_side[:-1]):
        rx = 400 + (400 - x)
        right_side.append((rx, y))

    return left_side + right_side


def get_apple_leaf_contour() -> list:
    """
    Elliptical apple leaf with finely serrated margins and pointed tip.
    Petiole at (400, 730), base at (400, 660), apex at (400, 100).
    """
    points = []
    left_side = [
        (400, 730), (395, 670), (370, 630),
        (310, 580), (250, 510), (210, 430),
        (200, 350), (215, 275), (255, 210),
        (310, 160), (365, 125), (400, 95),
    ]
    right_side = []
    for x, y in reversed(left_side[:-1]):
        rx = 400 + (400 - x)
        right_side.append((rx, y))

    return left_side + right_side


# ---------------------------------------------------------------------------
# Base Leaf Renderer
# ---------------------------------------------------------------------------

def render_base_leaf(crop_id: str, contour_fn, primary_color: tuple, midrib_color: tuple, vein_color: tuple, seed: int = 100) -> Image.Image:
    """Renders high-fidelity Stage 0 healthy leaf with veins, texture, and shading."""
    w, h = CANVAS_SIZE
    leaf_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    contour = contour_fn()

    # Base shape mask
    mask = draw_antialiased_polygon((w, h), contour, (255, 255, 255, 255)).split()[3]

    # Leaf blade color layer with gradient
    blade = Image.new("RGBA", (w, h), primary_color)
    blade_draw = ImageDraw.Draw(blade)

    # Shading gradient along the leaf
    for y in range(h):
        ratio = y / h
        # Subtly darker towards the petiole, vibrant in the lamina
        factor = 0.85 + 0.3 * math.sin(ratio * math.pi)
        r = min(255, int(primary_color[0] * factor))
        g = min(255, int(primary_color[1] * factor))
        b = min(255, int(primary_color[2] * factor))
        blade_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Apply organic cellular texture
    noise = create_smooth_gradient_noise(w, h, scale=15.0, seed=seed)
    noise_rgba = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    noise_rgba.putalpha(Image.eval(noise, lambda p: int((p - 210) * 1.8)))
    blade = Image.alpha_composite(blade, noise_rgba)

    # Draw Central Midrib & Lateral Veins
    vein_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vein_draw = ImageDraw.Draw(vein_layer)

    if crop_id == "corn":
        # Corn has distinct parallel venation along the blade
        for offset in range(-75, 80, 10):
            if offset == 0:
                continue
            vein_draw.line([(400 + offset, 700), (400 + int(offset * 0.4), 85)], fill=vein_color, width=2)
        # Prominent central midrib
        vein_draw.line([(400, 740), (400, 75)], fill=midrib_color, width=8)
        vein_draw.line([(400, 740), (400, 100)], fill=(255, 255, 255, 120), width=3)
    else:
        # Dicotyledon branching venation (Tomato, Potato, Apple)
        # Main midrib
        vein_draw.line([(400, 730), (400, 100)], fill=midrib_color, width=9)
        vein_draw.line([(400, 730), (400, 110)], fill=(240, 255, 230, 140), width=3)

        # Secondary lateral pinnate veins
        y_nodes = [620, 540, 460, 380, 300, 230, 170]
        for idx, y_pos in enumerate(y_nodes):
            angle = 0.55 + 0.05 * idx
            length = 90 + 35 * math.sin(idx * 0.6)
            if crop_id == "potato":
                length *= 1.2
            elif crop_id == "apple":
                length *= 1.1

            lx = 400 - int(length * math.cos(angle))
            ly = y_pos - int(length * math.sin(angle))
            rx = 400 + int(length * math.cos(angle))
            ry = y_pos - int(length * math.sin(angle))

            vein_draw.line([(400, y_pos), (lx, ly)], fill=vein_color, width=4)
            vein_draw.line([(400, y_pos), (rx, ry)], fill=vein_color, width=4)

            # Sub-vein branches
            vein_draw.line([(lx + 20, ly + 15), (lx - 15, ly - 10)], fill=vein_color, width=2)
            vein_draw.line([(rx - 20, ry + 15), (rx + 15, ry - 10)], fill=vein_color, width=2)

    vein_blurred = vein_layer.filter(ImageFilter.GaussianBlur(radius=0.7))
    blade = Image.alpha_composite(blade, vein_blurred)

    # Petiole stem stalk
    stem_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    stem_draw = ImageDraw.Draw(stem_layer)
    stem_draw.line([(400, 770), (400, 680)], fill=(120, 160, 90, 255), width=12)
    blade = Image.alpha_composite(blade, stem_layer)

    # Cut to leaf mask
    leaf_img.paste(blade, (0, 0), mask)
    return leaf_img


# ---------------------------------------------------------------------------
# Pathology Simulation Engines (Stage 1 & Stage 2)
# ---------------------------------------------------------------------------

def apply_disease_features(base_img: Image.Image, crop_id: str, stage: int, seed: int = 42) -> tuple:
    """
    Applies biologically accurate pathology onto base leaf:
    - Stage 1: Initial chlorosis, discrete water-soaked flecks, localized lesions.
    - Stage 2: Coalesced necrotic blotches, concentric ring collapse, yellowing borders, tissue breakdown.
    Returns: (diseased_img, mask_img)
    """
    random.seed(seed)
    w, h = CANVAS_SIZE

    # Clone base image and extract leaf alpha
    leaf_alpha = base_img.split()[3]
    result = base_img.copy()

    # Pure black mask for shader transition tracking
    transition_mask = Image.new("L", (w, h), 0)

    # Overlay layers
    chlorosis_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    chlorosis_draw = ImageDraw.Draw(chlorosis_layer)
    mask_draw = ImageDraw.Draw(transition_mask)

    lesion_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lesion_draw = ImageDraw.Draw(lesion_layer)

    # Loci definition per crop
    if crop_id == "tomato":
        # Early Blight (Alternaria solani): Concentric target-board rings on lower/middle leaf
        loci = [
            (320, 520, 45 if stage == 1 else 95),
            (480, 500, 40 if stage == 1 else 85),
            (290, 360, 35 if stage == 1 else 75),
            (490, 350, 30 if stage == 1 else 70),
            (380, 240, 25 if stage == 1 else 60),
            (420, 420, 20 if stage == 1 else 55),
        ]
        if stage == 2:
            loci.extend([(340, 440, 70), (450, 460, 65), (310, 260, 50), (460, 270, 50)])
    elif crop_id == "potato":
        # Late Blight (Phytophthora infestans): Margin water-soaked blotches moving inward
        loci = [
            (240, 460, 50 if stage == 1 else 105),
            (560, 440, 55 if stage == 1 else 115),
            (260, 320, 40 if stage == 1 else 90),
            (540, 310, 45 if stage == 1 else 95),
            (350, 200, 30 if stage == 1 else 75),
            (430, 210, 35 if stage == 1 else 80),
        ]
        if stage == 2:
            loci.extend([(300, 560, 80), (500, 550, 85), (400, 340, 75)])
    elif crop_id == "corn":
        # Common Rust (Puccinia sorghi): Elongated oval pustules following parallel veins
        loci = [
            (370, 450, 30 if stage == 1 else 60),
            (430, 420, 25 if stage == 1 else 55),
            (350, 350, 30 if stage == 1 else 65),
            (440, 320, 28 if stage == 1 else 60),
            (365, 240, 22 if stage == 1 else 50),
            (425, 230, 25 if stage == 1 else 52),
            (380, 540, 25 if stage == 1 else 55),
            (420, 530, 24 if stage == 1 else 50),
        ]
        if stage == 2:
            loci.extend([
                (355, 480, 45), (445, 470, 45),
                (370, 390, 50), (430, 380, 50),
                (385, 290, 45), (415, 280, 45),
                (390, 180, 40), (410, 170, 40),
            ])
    else:  # Apple
        # Apple Scab (Venturia inaequalis): Circular velvety olive-to-corky scab spots
        loci = [
            (330, 480, 35 if stage == 1 else 80),
            (470, 460, 40 if stage == 1 else 85),
            (290, 360, 30 if stage == 1 else 70),
            (500, 350, 32 if stage == 1 else 75),
            (340, 250, 25 if stage == 1 else 60),
            (450, 240, 28 if stage == 1 else 65),
            (390, 180, 20 if stage == 1 else 50),
        ]
        if stage == 2:
            loci.extend([(380, 400, 70), (420, 410, 75), (320, 300, 60), (480, 290, 60)])

    # Draw Chlorotic Halos (Yellowish fading margins)
    for x, y, r in loci:
        halo_r = int(r * (1.6 if stage == 1 else 2.2))
        chlorotic_color = (215, 195, 60, 140 if stage == 1 else 220)
        chlorosis_draw.ellipse(
            [(x - halo_r, y - halo_r), (x + halo_r, y + halo_r)],
            fill=chlorotic_color
        )
        mask_draw.ellipse(
            [(x - halo_r, y - halo_r), (x + halo_r, y + halo_r)],
            fill=140 if stage == 1 else 230
        )

    # Blur chlorosis for soft biological diffusion
    chlorosis_blurred = chlorosis_layer.filter(ImageFilter.GaussianBlur(radius=12 if stage == 1 else 18))
    transition_mask = transition_mask.filter(ImageFilter.GaussianBlur(radius=8 if stage == 1 else 12))

    # Composite chlorosis onto leaf blade
    result = Image.alpha_composite(result, chlorosis_blurred)

    # Draw Discrete & Coalesced Lesions
    for x, y, r in loci:
        if crop_id == "tomato":
            # Early blight concentric target rings
            outer_color = (75, 40, 15, 230 if stage == 1 else 255)
            ring_color = (40, 20, 8, 240 if stage == 1 else 255)
            core_color = (25, 12, 5, 250 if stage == 1 else 255)
            lesion_draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=outer_color)
            if r > 20:
                mid_r = int(r * 0.65)
                lesion_draw.ellipse([(x - mid_r, y - mid_r), (x + mid_r, y + mid_r)], fill=ring_color)
                core_r = int(r * 0.35)
                lesion_draw.ellipse([(x - core_r, y - core_r), (x + core_r, y + core_r)], fill=core_color)
        elif crop_id == "potato":
            # Late blight purplish-black water-soaked zone with pale mold edge
            dark_core = (35, 22, 20, 230 if stage == 1 else 255)
            lesion_draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=dark_core)
            if stage == 2:
                # White sporulation halo ring
                rim_r = int(r * 1.1)
                lesion_draw.arc([(x - rim_r, y - rim_r), (x + rim_r, y + rim_r)], 0, 360, fill=(200, 200, 190, 120), width=4)
        elif crop_id == "corn":
            # Common rust elongated pustules
            pustule_color = (190, 80, 20, 240 if stage == 1 else 255)
            dark_slit = (70, 20, 10, 250 if stage == 1 else 255)
            # Oval elongation along y-axis
            ry = int(r * 1.5)
            rx = int(r * 0.7)
            lesion_draw.ellipse([(x - rx, y - ry), (x + rx, y + ry)], fill=pustule_color)
            lesion_draw.line([(x, y - int(ry * 0.7)), (x, y + int(ry * 0.7))], fill=dark_slit, width=3)
        else:  # Apple
            # Apple scab velvety olive-brown corky crust
            scab_dark = (45, 50, 30, 230 if stage == 1 else 255)
            crust_center = (25, 20, 15, 245 if stage == 1 else 255)
            lesion_draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=scab_dark)
            c_r = int(r * 0.5)
            lesion_draw.ellipse([(x - c_r, y - c_r), (x + c_r, y + c_r)], fill=crust_center)

    lesion_blurred = lesion_layer.filter(ImageFilter.GaussianBlur(radius=2.0))
    result = Image.alpha_composite(result, lesion_blurred)

    # Ensure mask and result respect original leaf boundaries
    result_final = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    result_final.paste(result, (0, 0), leaf_alpha)

    mask_final = Image.new("L", (w, h), 0)
    mask_final.paste(transition_mask, (0, 0), leaf_alpha)

    return result_final, mask_final


# ---------------------------------------------------------------------------
# Master Generation Routine
# ---------------------------------------------------------------------------

CROP_CONFIGS = [
    {
        "crop_id": "tomato",
        "common_name": "Tomato",
        "scientific_name": "Solanum lycopersicum",
        "primary_disease": "Early Blight",
        "pathogen_scientific": "Alternaria solani",
        "pathogen_type": "FUNGAL",
        "contour_fn": get_tomato_leaf_contour,
        "primary_color": (45, 106, 79, 255),
        "midrib_color": (116, 198, 157, 240),
        "vein_color": (82, 183, 136, 180),
        "stages": [
            {
                "order": 0,
                "label": "Asymptomatic Baseline",
                "min_pct": 0.0,
                "max_pct": 30.0,
                "symptoms": "Healthy turgid leaflet with intact lamina, normal chlorophyll pigmentation, and crisp venation.",
                "agronomic_advice": "Maintain preventive cultural hygiene; ensure drip irrigation to avoid foliar wetness.",
                "color_palette_hex": ["#2D6A4F", "#52B788", "#74C69D"],
            },
            {
                "order": 1,
                "label": "Early Concentric Lesions",
                "min_pct": 30.01,
                "max_pct": 70.0,
                "symptoms": "Discrete brown-black lesions with faint yellow chlorotic halos; emerging concentric target-like rings on lower foliage.",
                "agronomic_advice": "Apply preventive copper hydroxide or chlorothalonil barrier before upcoming precipitation events.",
                "color_palette_hex": ["#D4A373", "#E9C46A", "#582F0E"],
            },
            {
                "order": 2,
                "label": "Severe Necrosis & Defoliation",
                "min_pct": 70.01,
                "max_pct": 100.0,
                "symptoms": "Extensive coalescing necrotic blotches, brittle necrotic leaf tissue collapse, and widespread chlorosis leading to blight defoliation.",
                "agronomic_advice": "Immediately prune and isolate infected stems; apply systemic fungicide (mancozeb/difenoconazole); lock out overhead irrigation.",
                "color_palette_hex": ["#BC6C25", "#3D2616", "#1D1208"],
            },
        ],
    },
    {
        "crop_id": "potato",
        "common_name": "Potato",
        "scientific_name": "Solanum tuberosum",
        "primary_disease": "Late Blight",
        "pathogen_scientific": "Phytophthora infestans",
        "pathogen_type": "OOMYCETE / FUNGAL",
        "contour_fn": get_potato_leaf_contour,
        "primary_color": (40, 89, 67, 255),
        "midrib_color": (120, 180, 140, 240),
        "vein_color": (90, 160, 120, 180),
        "stages": [
            {
                "order": 0,
                "label": "Asymptomatic Baseline",
                "min_pct": 0.0,
                "max_pct": 30.0,
                "symptoms": "Vibrant emerald green leaf blade with smooth ovate margins, healthy stomatal turgor, and zero necrotic marks.",
                "agronomic_advice": "Inspect field margins; monitor ambient relative humidity and leaf wetness hours.",
                "color_palette_hex": ["#285943", "#4A8B66", "#78B48C"],
            },
            {
                "order": 1,
                "label": "Water-Soaked Margins",
                "min_pct": 30.01,
                "max_pct": 70.0,
                "symptoms": "Irregular pale water-soaked grayish lesions emerging on leaf margins and expanding rapidly under humid conditions.",
                "agronomic_advice": "Initiate protective spray program (metalaxyl/mancozeb) prior to prolonged wet periods.",
                "color_palette_hex": ["#859B7A", "#6B8E6B", "#C8B88A"],
            },
            {
                "order": 2,
                "label": "Severe Necrotic Blight",
                "min_pct": 70.01,
                "max_pct": 100.0,
                "symptoms": "Dark purplish-black necrotic collapse with white sporulation mycelial halos at lesion margins; irreversible tissue degradation.",
                "agronomic_advice": "Emergency systemic intervention; halt overhead watering immediately; destroy heavily blighted vine refuse.",
                "color_palette_hex": ["#2B1D19", "#3D231E", "#9A988D"],
            },
        ],
    },
    {
        "crop_id": "corn",
        "common_name": "Corn (Maize)",
        "scientific_name": "Zea mays",
        "primary_disease": "Common Rust",
        "pathogen_scientific": "Puccinia sorghi",
        "pathogen_type": "FUNGAL",
        "contour_fn": get_corn_leaf_contour,
        "primary_color": (56, 102, 65, 255),
        "midrib_color": (181, 228, 140, 240),
        "vein_color": (106, 153, 78, 180),
        "stages": [
            {
                "order": 0,
                "label": "Asymptomatic Baseline",
                "min_pct": 0.0,
                "max_pct": 30.0,
                "symptoms": "Uniform linear blade with prominent central midrib, intact cuticle, and healthy light-to-forest green parallel striations.",
                "agronomic_advice": "Ensure balanced nitrogen nutrition; scout lower canopy during early vegetative stages.",
                "color_palette_hex": ["#386641", "#6A994E", "#B5E48C"],
            },
            {
                "order": 1,
                "label": "Active Pustule Eruption",
                "min_pct": 30.01,
                "max_pct": 70.0,
                "symptoms": "Small oval to elongate cinnamon-brown pustules erupting through the epidermis along parallel veins, encircled by chlorotic halos.",
                "agronomic_advice": "Monitor rust pustule coverage on ear leaf; evaluate triazole or strobilurin fungicide threshold.",
                "color_palette_hex": ["#CB6824", "#D97724", "#E9D8A6"],
            },
            {
                "order": 2,
                "label": "Severe Pustule Coalescence",
                "min_pct": 70.01,
                "max_pct": 100.0,
                "symptoms": "Dense coalescent dark reddish-brown to black teliospores; longitudinal necrotic banding causing premature leaf death and tip shredding.",
                "agronomic_advice": "Apply fungicide immediately if rust threatens upper canopy before dent stage (R5); note hybrid resistance for next planting.",
                "color_palette_hex": ["#49111C", "#5E1914", "#2E080D"],
            },
        ],
    },
    {
        "crop_id": "apple",
        "common_name": "Apple",
        "scientific_name": "Malus domestica",
        "primary_disease": "Apple Scab",
        "pathogen_scientific": "Venturia inaequalis",
        "pathogen_type": "FUNGAL",
        "contour_fn": get_apple_leaf_contour,
        "primary_color": (45, 90, 39, 255),
        "midrib_color": (128, 185, 24, 240),
        "vein_color": (83, 144, 50, 180),
        "stages": [
            {
                "order": 0,
                "label": "Asymptomatic Baseline",
                "min_pct": 0.0,
                "max_pct": 30.0,
                "symptoms": "Broad elliptical glossy apple foliage with fine marginal serrations, rich green cuticle, and intact vascular arching.",
                "agronomic_advice": "Maintain seasonal primary scab ascospore monitoring; schedule preventive cover sprays based on Mills periods.",
                "color_palette_hex": ["#2D5A27", "#539032", "#80B918"],
            },
            {
                "order": 1,
                "label": "Velvety Olive Lesions",
                "min_pct": 30.01,
                "max_pct": 70.0,
                "symptoms": "Dull olive-green to smoky velvety spots with indistinct margins developing on upper leaf surface, accompanied by slight leaf crinkling.",
                "agronomic_advice": "Apply kick-back curative fungicides (flusilazole/difenoconazole) within 72 hours of primary infection event.",
                "color_palette_hex": ["#555B38", "#474E2B", "#8C8343"],
            },
            {
                "order": 2,
                "label": "Corky Scab Necrosis",
                "min_pct": 70.01,
                "max_pct": 100.0,
                "symptoms": "Thickened dark corky scab lesions, extensive chlorotic yellowing, puckered distortion, and premature necrotic leaf drop.",
                "agronomic_advice": "Apply autumn urea spray or shredded leaf sanitation to accelerate leaf decay and reduce overwintering pseudothecia inocula.",
                "color_palette_hex": ["#1F2416", "#2D1F14", "#C9A227"],
            },
        ],
    },
]


def generate_all_assets() -> dict:
    """Generates all 12 normalized images + companion masks and builds the manifest."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stats = []
    manifest_crops = []

    for cfg in CROP_CONFIGS:
        crop_id = cfg["crop_id"]
        crop_dir = OUTPUT_DIR / crop_id
        crop_dir.mkdir(parents=True, exist_ok=True)

        print(f"[*] Processing crop: {cfg['common_name']} ({crop_id})...")

        # 1. Generate Base Leaf (Stage 0 - Healthy)
        base_img = render_base_leaf(
            crop_id=crop_id,
            contour_fn=cfg["contour_fn"],
            primary_color=cfg["primary_color"],
            midrib_color=cfg["midrib_color"],
            vein_color=cfg["vein_color"],
        )

        stage0_path = crop_dir / f"{crop_id}_stage0_healthy.webp"
        base_img.save(stage0_path, "WEBP", quality=92, method=6)
        s0_size = stage0_path.stat().st_size
        stats.append({"file": str(stage0_path.relative_to(OUTPUT_DIR)), "bytes": s0_size, "stage": 0})

        # 2. Generate Stage 1 (Early / Moderate)
        img_s1, mask_s1 = apply_disease_features(base_img, crop_id=crop_id, stage=1, seed=42)
        stage1_path = crop_dir / f"{crop_id}_stage1_early.webp"
        mask1_path = crop_dir / f"{crop_id}_stage1_mask.webp"
        img_s1.save(stage1_path, "WEBP", quality=92, method=6)
        mask_s1.save(mask1_path, "WEBP", quality=85, method=6)
        s1_size = stage1_path.stat().st_size
        m1_size = mask1_path.stat().st_size
        stats.append({"file": str(stage1_path.relative_to(OUTPUT_DIR)), "bytes": s1_size, "stage": 1})
        stats.append({"file": str(mask1_path.relative_to(OUTPUT_DIR)), "bytes": m1_size, "stage": "1_mask"})

        # 3. Generate Stage 2 (Severe Necrosis)
        img_s2, mask_s2 = apply_disease_features(base_img, crop_id=crop_id, stage=2, seed=84)
        stage2_path = crop_dir / f"{crop_id}_stage2_severe.webp"
        mask2_path = crop_dir / f"{crop_id}_stage2_mask.webp"
        img_s2.save(stage2_path, "WEBP", quality=92, method=6)
        mask_s2.save(mask2_path, "WEBP", quality=85, method=6)
        s2_size = stage2_path.stat().st_size
        m2_size = mask2_path.stat().st_size
        stats.append({"file": str(stage2_path.relative_to(OUTPUT_DIR)), "bytes": s2_size, "stage": 2})
        stats.append({"file": str(mask2_path.relative_to(OUTPUT_DIR)), "bytes": m2_size, "stage": "2_mask"})

        # Build Manifest Crop Entry
        manifest_crop_entry = {
            "crop_id": crop_id,
            "crop_name": cfg["common_name"],
            "scientific_name": cfg["scientific_name"],
            "disease_name": cfg["primary_disease"],
            "pathogen_scientific": cfg["pathogen_scientific"],
            "pathogen_type": cfg["pathogen_type"],
            "resolution": {"width": 800, "height": 800},
            "stages": [
                {
                    "stage_order": 0,
                    "stage_label": cfg["stages"][0]["label"],
                    "min_slider_pct": cfg["stages"][0]["min_pct"],
                    "max_slider_pct": cfg["stages"][0]["max_pct"],
                    "symptom_markers": cfg["stages"][0]["symptoms"],
                    "agronomic_advice": cfg["stages"][0]["agronomic_advice"],
                    "color_palette_hex": cfg["stages"][0]["color_palette_hex"],
                    "assets": {
                        "base_image_url": f"/progression/{crop_id}/{crop_id}_stage0_healthy.webp",
                        "mask_image_url": None,
                    },
                },
                {
                    "stage_order": 1,
                    "stage_label": cfg["stages"][1]["label"],
                    "min_slider_pct": cfg["stages"][1]["min_pct"],
                    "max_slider_pct": cfg["stages"][1]["max_pct"],
                    "symptom_markers": cfg["stages"][1]["symptoms"],
                    "agronomic_advice": cfg["stages"][1]["agronomic_advice"],
                    "color_palette_hex": cfg["stages"][1]["color_palette_hex"],
                    "assets": {
                        "base_image_url": f"/progression/{crop_id}/{crop_id}_stage1_early.webp",
                        "mask_image_url": f"/progression/{crop_id}/{crop_id}_stage1_mask.webp",
                    },
                },
                {
                    "stage_order": 2,
                    "stage_label": cfg["stages"][2]["label"],
                    "min_slider_pct": cfg["stages"][2]["min_pct"],
                    "max_slider_pct": cfg["stages"][2]["max_pct"],
                    "symptom_markers": cfg["stages"][2]["symptoms"],
                    "agronomic_advice": cfg["stages"][2]["agronomic_advice"],
                    "color_palette_hex": cfg["stages"][2]["color_palette_hex"],
                    "assets": {
                        "base_image_url": f"/progression/{crop_id}/{crop_id}_stage2_severe.webp",
                        "mask_image_url": f"/progression/{crop_id}/{crop_id}_stage2_mask.webp",
                    },
                },
            ],
        }
        manifest_crops.append(manifest_crop_entry)

    # 4. Generate Master JSON Manifest
    manifest_data = {
        "version": "1.0.0",
        "description": "Morphological Leaf Disease Progression Manifest for Precision AgriTech Platform",
        "asset_spec": {
            "format": "WEBP",
            "resolution": "800x800",
            "channels": "RGBA",
            "target_size_limit_kb": 150,
        },
        "crops": manifest_crops,
    }

    manifest_file = OUTPUT_DIR / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    print(f"\n[+] Manifest generated at: {manifest_file}")
    return {"stats": stats, "crops_count": len(manifest_crops), "manifest_path": str(manifest_file)}


if __name__ == "__main__":
    result = generate_all_assets()
    print("\n--- Asset Generation Summary ---")
    for s in result["stats"]:
        kb = s["bytes"] / 1024
        status = "OK (< 150 KB)" if kb < 150 else "EXCEEDS LIMIT!"
        print(f"  {s['file']:<35} | {kb:6.1f} KB | {status}")
