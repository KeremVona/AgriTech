# Prompt-to-Prompt (P2P) Disease Progression Asset Pipeline

Implementation of the text-guided generative diffusion model with cross-attention control from Hertz et al. (2022) — [arXiv:2208.01626](https://arxiv.org/abs/2208.01626) to generate biologically registered, photorealistic leaf assets for the interactive 0–100% frontend disease progression slider (Feature #1 / TODO-107).

---

## Files in this Directory

- **`cross_attention_control.py`**:
  Core PyTorch modules implementing `AttentionStore`, `AttentionControlEdit`, and UNet processor hooks (`register_attention_control`). Freezes spatial cross-attention maps of Stage 0 (Healthy) into subsequent stages.
- **`p2p_generator.py`**:
  Local CLI generator and postprocessing engine. Normalizes images to transparent RGBA $800 \times 800$ WebP format and extracts companion pathology difference masks (`stage1_mask.webp`, `stage2_mask.webp`).
- **`Prompt_to_Prompt_Asset_Generator.ipynb`**:
  Ready-to-run Google Colab notebook configured with free GPU acceleration (T4), generation loops for Tomato, Potato, Corn, and Apple, and automatic packaging into a single downloadable `.zip`.

---

## How to Run in Google Colab (Recommended)

1. Open [Google Colab](https://colab.research.google.com/).
2. Select **Upload** and upload `Prompt_to_Prompt_Asset_Generator.ipynb`.
3. Set hardware accelerator: **Runtime $\to$ Change runtime type $\to$ T4 GPU**.
4. Click **Runtime $\to$ Run all**.
5. Once complete, Colab will automatically download `p2p_progression_assets.zip` containing all 12 normalized WebP leaf images and 8 companion WebGL transition masks.
6. Extract the folders directly into `frontend/public/progression/`.
