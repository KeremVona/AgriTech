"""
Google Prompt-to-Prompt (P2P) Cross-Attention Control & LocalBlend Engine.
Based on: "Prompt-to-Prompt Image Editing with Cross Attention Control" (Hertz et al., Google Research, 2022).
Reference: https://github.com/google/prompt-to-prompt

Implements:
1. init_latent: Broadcasts a single identical Gaussian latent noise tensor across all prompt stages.
2. LocalBlend: Dynamically extracts cross-attention masks for localized disease tokens and
   blends latents at each timestep t so that background and healthy leaf blade are 100% frozen to Stage 0.
3. AttentionRefine: Uses Needleman-Wunsch sequence alignment (seq_aligner) to map shared tokens
   from Stage 0 to Stage 1 and Stage 2 while allowing newly added pathology tokens to form lesions.
4. register_attention_control: Hooks into UNet Attention modules using Diffusers processor interface.
5. run_p2p_diffusion: Complete deterministic diffusion runner implementing CFG and step_callback.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import seq_aligner
from PIL import Image

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    torch = None
    F = None
    HAS_TORCH = False


def init_latent(
    latent: Optional[torch.FloatTensor],
    model,
    height: int = 512,
    width: int = 512,
    generator: Optional[torch.Generator] = None,
    batch_size: int = 3,
) -> Tuple[torch.FloatTensor, torch.FloatTensor]:
    """
    Broadcasts a single Gaussian noise tensor across all prompts in the batch.
    Ensures that Stage 0, Stage 1, and Stage 2 start from the exact same initial spatial noise.
    """
    channels = model.unet.config.in_channels
    latent_h = height // 8
    latent_w = width // 8
    if latent is None:
        latent = torch.randn(
            (1, channels, latent_h, latent_w),
            generator=generator,
            device=model.device,
            dtype=model.unet.dtype,
        )
    latents = latent.repeat(batch_size, 1, 1, 1)
    return latent, latents


def update_alpha_time_word(
    alpha: torch.Tensor,
    bounds: Union[float, Tuple[float, float]],
    prompt_ind: int,
    word_inds: Optional[torch.Tensor] = None,
) -> torch.Tensor:
    if isinstance(bounds, (float, int)):
        bounds = (0.0, float(bounds))
    start = int(bounds[0] * alpha.shape[0])
    end = int(bounds[1] * alpha.shape[0])
    if word_inds is None:
        word_inds = torch.arange(alpha.shape[2])
    alpha[:start, prompt_ind, word_inds] = 0.0
    alpha[start:end, prompt_ind, word_inds] = 1.0
    alpha[end:, prompt_ind, word_inds] = 0.0
    return alpha


def get_time_words_attention_alpha(
    prompts: List[str],
    num_steps: int,
    cross_replace_steps: Union[float, Tuple[float, float], Dict[str, Tuple[float, float]]],
    tokenizer,
    max_num_words: int = 77,
) -> torch.Tensor:
    if not isinstance(cross_replace_steps, dict):
        cross_replace_steps = {"default_": cross_replace_steps}
    if "default_" not in cross_replace_steps:
        cross_replace_steps["default_"] = (0.0, 1.0)
    alpha_time_words = torch.zeros(num_steps + 1, len(prompts) - 1, max_num_words)
    for i in range(len(prompts) - 1):
        alpha_time_words = update_alpha_time_word(alpha_time_words, cross_replace_steps["default_"], i)
    for key, item in cross_replace_steps.items():
        if key != "default_":
            inds = [seq_aligner.get_word_inds(prompts[i], key, tokenizer) for i in range(1, len(prompts))]
            for i, ind in enumerate(inds):
                if len(ind) > 0:
                    ind_tensor = torch.tensor(ind, dtype=torch.long)
                    alpha_time_words = update_alpha_time_word(alpha_time_words, item, i, ind_tensor)
    alpha_time_words = alpha_time_words.reshape(num_steps + 1, len(prompts) - 1, 1, 1, max_num_words)
    return alpha_time_words


class LocalBlend:
    """
    Dynamically blends diffusion latents x_t using cross-attention maps of edited pathology words.
    Guarantees that regions outside localized disease symptoms are 100% locked to Stage 0.
    """

    def __init__(
        self,
        prompts: List[str],
        words: List[Union[str, List[str]]],
        tokenizer,
        device: str = "cuda",
        threshold: float = 0.3,
        max_num_words: int = 77,
    ):
        self.device = device
        self.threshold = threshold
        alpha_layers = torch.zeros(len(prompts), 1, 1, 1, 1, max_num_words)
        for i, (prompt, word_group) in enumerate(zip(prompts, words)):
            if word_group:
                ind = seq_aligner.get_word_inds(prompt, word_group, tokenizer)
                if len(ind) > 0:
                    alpha_layers[i, :, :, :, :, ind] = 1.0
        self.alpha_layers = alpha_layers.to(device)

    def __call__(self, x_t: torch.Tensor, attention_store: dict) -> torch.Tensor:
        if len(attention_store.get("down_cross", [])) < 4 or len(attention_store.get("up_cross", [])) < 3:
            return x_t

        k = 1
        maps = attention_store["down_cross"][2:4] + attention_store["up_cross"][:3]
        num_prompts = self.alpha_layers.shape[0]
        reshaped_maps = []
        for item in maps:
            if item.shape[1] == 16 * 16:
                reshaped_maps.append(
                    item.reshape(num_prompts, -1, 1, 16, 16, self.alpha_layers.shape[-1])
                )

        if not reshaped_maps:
            return x_t

        cat_maps = torch.cat(reshaped_maps, dim=1)
        # Weight maps by targeted word indicator
        weighted_maps = (cat_maps * self.alpha_layers).sum(-1).mean(1)
        mask = F.max_pool2d(weighted_maps, (k * 2 + 1, k * 2 + 1), (1, 1), padding=(k, k))
        mask = F.interpolate(mask, size=(x_t.shape[2], x_t.shape[3]))
        max_val = mask.max(2, keepdim=True)[0].max(3, keepdim=True)[0]
        mask = mask / (max_val + 1e-5)
        mask = mask.gt(self.threshold)

        # General N-prompt mask handling: target stages >= 1 receive mask from Stage 0 and their own words
        mask_targets = (mask[:1] + mask[1:]).gt(0).float()

        # Latent blend: keep Stage 0 outside the disease mask
        x_t_edited = x_t.clone()
        x_t_edited[1:] = x_t[:1] + mask_targets * (x_t[1:] - x_t[:1])
        return x_t_edited


class AttentionControl:
    """Base interface for controlling diffusion attention layers."""

    def __init__(self):
        self.cur_step = 0
        self.cur_att_layer = 0
        self.num_att_layers = -1

    def step_callback(self, x_t: torch.Tensor) -> torch.Tensor:
        return x_t

    def between_steps(self):
        pass

    def reset(self):
        self.cur_step = 0
        self.cur_att_layer = 0

    def forward(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        return attn

    def __call__(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        # CFG split: unconditional is first half, conditional is second half
        h = attn.shape[0]
        attn[h // 2:] = self.forward(attn[h // 2:], is_cross, place_in_unet)
        self.cur_att_layer += 1
        if self.num_att_layers > 0 and self.cur_att_layer == self.num_att_layers:
            self.cur_att_layer = 0
            self.cur_step += 1
            self.between_steps()
        return attn


class AttentionStore(AttentionControl):
    """Caches cross-attention maps across diffusion steps for LocalBlend and inspection."""

    @staticmethod
    def get_empty_store():
        return {
            "down_cross": [], "mid_cross": [], "up_cross": [],
            "down_self": [], "mid_self": [], "up_self": []
        }

    def __init__(self):
        super().__init__()
        self.step_store = self.get_empty_store()
        self.attention_store = {}

    def forward(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        key = f"{place_in_unet}_{'cross' if is_cross else 'self'}"
        # Only cache cross-attention maps at resolution <= 32x32 (what LocalBlend actually reads)
        # to prevent caching multi-gigabyte self-attention tensors in VRAM
        if is_cross and attn.shape[1] <= 32 ** 2:
            self.step_store[key].append(attn)
        return attn

    def between_steps(self):
        if len(self.attention_store) == 0:
            self.attention_store = self.step_store
        else:
            for key in self.attention_store:
                for i in range(len(self.attention_store[key])):
                    self.attention_store[key][i] += self.step_store[key][i]
        self.step_store = self.get_empty_store()

    def reset(self):
        super().reset()
        self.step_store = self.get_empty_store()
        self.attention_store = {}


class AttentionControlEdit(AttentionStore):
    """
    Prompt-to-Prompt controller that injects cross-attention and self-attention
    from Stage 0 into Stage 1 and Stage 2 with CFG stream isolation.
    """

    def __init__(
        self,
        prompts: List[str],
        num_steps: int,
        cross_replace_steps: Union[float, Tuple[float, float], Dict[str, Tuple[float, float]]] = 0.75,
        self_replace_steps: Union[float, Tuple[float, float]] = 0.55,
        tokenizer=None,
        device: str = "cuda",
        local_blend: Optional[LocalBlend] = None,
    ):
        super().__init__()
        self.batch_size = len(prompts)
        self.num_steps = num_steps
        self.tokenizer = tokenizer
        self.device = device
        self.local_blend = local_blend

        if tokenizer is not None and HAS_TORCH:
            self.cross_replace_alpha = get_time_words_attention_alpha(
                prompts, num_steps, cross_replace_steps, tokenizer
            ).to(device)
        else:
            self.cross_replace_alpha = None

        if isinstance(self_replace_steps, (float, int)):
            self.num_self_replace = (0, int(num_steps * float(self_replace_steps)))
        else:
            self.num_self_replace = (
                int(num_steps * float(self_replace_steps[0])),
                int(num_steps * float(self_replace_steps[1])),
            )

    def step_callback(self, x_t: torch.Tensor) -> torch.Tensor:
        if self.local_blend is not None:
            x_t = self.local_blend(x_t, self.attention_store if len(self.attention_store) > 0 else self.step_store)
        return x_t

    def replace_self_attention(self, attn_base: torch.Tensor, att_replace: torch.Tensor) -> torch.Tensor:
        if att_replace.shape[2] <= 16 ** 2:
            return attn_base.unsqueeze(0).expand(att_replace.shape[0], *attn_base.shape)
        return att_replace

    def replace_cross_attention(self, attn_base: torch.Tensor, att_replace: torch.Tensor) -> torch.Tensor:
        return attn_base.unsqueeze(0).expand(att_replace.shape[0], *attn_base.shape)

    def forward(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        super().forward(attn, is_cross, place_in_unet)
        if is_cross or (self.num_self_replace[0] <= self.cur_step < self.num_self_replace[1]):
            h = attn.shape[0] // self.batch_size
            attn_reshaped = attn.reshape(self.batch_size, h, *attn.shape[1:])
            attn_base, attn_replace = attn_reshaped[0], attn_reshaped[1:]
            if is_cross:
                if self.cross_replace_alpha is not None and self.cur_step < self.cross_replace_alpha.shape[0]:
                    alpha_words = self.cross_replace_alpha[self.cur_step]
                else:
                    alpha_words = 1.0
                attn_replace_new = self.replace_cross_attention(attn_base, attn_replace) * alpha_words + (1.0 - alpha_words) * attn_replace
                attn_reshaped[1:] = attn_replace_new
            else:
                attn_reshaped[1:] = self.replace_self_attention(attn_base, attn_replace)
            attn = attn_reshaped.reshape(self.batch_size * h, *attn.shape[1:])
        return attn


class AttentionRefine(AttentionControlEdit):
    """
    Prompt-to-Prompt Refinement controller based on Hertz et al. (Google Research, 2022).
    Uses Needleman-Wunsch sequence alignment to map corresponding tokens between source
    (Stage 0) and target prompts (Stage 1 / Stage 2), injecting cross-attention only on
    shared tokens while allowing newly added pathology tokens to synthesize localized lesions.
    """

    def __init__(
        self,
        prompts: List[str],
        num_steps: int,
        cross_replace_steps: Union[float, Tuple[float, float], Dict[str, Tuple[float, float]]] = 0.75,
        self_replace_steps: Union[float, Tuple[float, float]] = 0.55,
        tokenizer=None,
        device: str = "cuda",
        local_blend: Optional[LocalBlend] = None,
    ):
        super().__init__(
            prompts=prompts,
            num_steps=num_steps,
            cross_replace_steps=cross_replace_steps,
            self_replace_steps=self_replace_steps,
            tokenizer=tokenizer,
            device=device,
            local_blend=local_blend,
        )

        if tokenizer is not None and HAS_TORCH:
            mapper, alphas = seq_aligner.get_refinement_mapper(prompts, tokenizer)
            self.mapper = mapper.to(device) if hasattr(mapper, "to") else torch.tensor(mapper, device=device)
            alphas_t = alphas.to(device) if hasattr(alphas, "to") else torch.tensor(alphas, device=device)
            self.alphas = alphas_t.reshape(alphas_t.shape[0], 1, 1, alphas_t.shape[1])
        else:
            self.mapper = None
            self.alphas = None

    def replace_cross_attention(self, attn_base: torch.Tensor, att_replace: torch.Tensor) -> torch.Tensor:
        if self.mapper is None or self.alphas is None:
            return att_replace
        attn_base_replace = attn_base[:, :, self.mapper].permute(2, 0, 1, 3)
        attn_replace_new = attn_base_replace * self.alphas + att_replace * (1.0 - self.alphas)
        return attn_replace_new


def register_attention_control(model, controller: AttentionControl):
    """
    Hooks into Stable Diffusion UNet cross-attention and self-attention processor modules
    to route forward-pass attention maps through the AttentionControl object.
    """
    attn_modules = [m for m in model.unet.modules() if m.__class__.__name__ == "Attention"]
    controller.num_att_layers = len(attn_modules)
    controller.reset()

    class P2PAttentionProcessor:
        def __init__(self, place_in_unet: str):
            self.place_in_unet = place_in_unet

        def __call__(self, attn_module, hidden_states, encoder_hidden_states=None, attention_mask=None, **kwargs):
            batch_size, sequence_length, _ = hidden_states.shape
            is_cross = encoder_hidden_states is not None
            encoder_hidden_states = encoder_hidden_states if is_cross else hidden_states

            query = attn_module.to_q(hidden_states)
            key = attn_module.to_k(encoder_hidden_states)
            value = attn_module.to_v(encoder_hidden_states)

            inner_dim = key.shape[-1]
            head_dim = inner_dim // attn_module.heads

            query = query.view(batch_size, -1, attn_module.heads, head_dim).transpose(1, 2)
            key = key.view(batch_size, -1, attn_module.heads, head_dim).transpose(1, 2)
            value = value.view(batch_size, -1, attn_module.heads, head_dim).transpose(1, 2)

            # MEMORY OPTIMIZATION:
            # Self-attention at resolutions > 16x16 (i.e. 32x32=1024, 64x64=4096) is never modified
            # by Prompt-to-Prompt (replace_self_attention only operates at <= 16x16) and never stored.
            # Materializing the (batch, heads, 4096, 4096) matrix requires 1.5 GiB per layer and causes CUDA OOM.
            # Using PyTorch F.scaled_dot_product_attention computes this in O(1) memory via FlashAttention.
            if not is_cross and sequence_length > 16 ** 2:
                if hasattr(F, "scaled_dot_product_attention"):
                    hidden_states = F.scaled_dot_product_attention(query, key, value)
                    hidden_states = hidden_states.transpose(1, 2).reshape(batch_size, -1, attn_module.heads * head_dim)
                    hidden_states = attn_module.to_out[0](hidden_states)
                    hidden_states = attn_module.to_out[1](hidden_states)
                    controller.cur_att_layer += 1
                    if controller.num_att_layers > 0 and controller.cur_att_layer == controller.num_att_layers:
                        controller.cur_att_layer = 0
                        controller.cur_step += 1
                        controller.between_steps()
                    return hidden_states

            scale = 1.0 / (head_dim ** 0.5)
            scores = torch.matmul(query, key.transpose(-1, -2)) * scale
            attn_probs = scores.softmax(dim=-1)

            b_heads, q_len, k_len = batch_size * attn_module.heads, query.shape[2], key.shape[2]
            attn_probs_flat = attn_probs.view(b_heads, q_len, k_len)

            attn_probs_flat = controller(attn_probs_flat, is_cross, self.place_in_unet)
            attn_probs = attn_probs_flat.view(batch_size, attn_module.heads, q_len, k_len)

            hidden_states = torch.matmul(attn_probs, value)
            hidden_states = hidden_states.transpose(1, 2).reshape(batch_size, -1, attn_module.heads * head_dim)
            hidden_states = attn_module.to_out[0](hidden_states)
            hidden_states = attn_module.to_out[1](hidden_states)

            return hidden_states

    for name, module in model.unet.named_modules():
        if module.__class__.__name__ == "Attention":
            place = "mid"
            if "down_blocks" in name:
                place = "down"
            elif "up_blocks" in name:
                place = "up"
            module.set_processor(P2PAttentionProcessor(place_in_unet=place))


def no_grad_if_torch(fn):
    if HAS_TORCH:
        return torch.no_grad()(fn)
    return fn


@no_grad_if_torch
def run_p2p_diffusion(
    pipe,
    prompts: List[str],
    controller: AttentionControl,
    num_inference_steps: int = 50,
    guidance_scale: float = 7.5,
    generator: Optional[torch.Generator] = None,
    negative_prompt: Optional[str] = None,
) -> List[Image.Image]:
    """
    Deterministic diffusion runner implementing Google's reference P2P loop:
    1. Registers attention controller hook.
    2. Initializes shared noise latents (init_latent).
    3. Runs diffusion steps with CFG and step_callback (LocalBlend).
    4. Decodes latents into PIL RGBA images.
    """
    device = pipe.device
    controller.reset()
    register_attention_control(pipe, controller)
    batch_size = len(prompts)

    # 1. Encode text prompts
    text_inputs = pipe.tokenizer(
        prompts,
        padding="max_length",
        max_length=pipe.tokenizer.model_max_length,
        truncation=True,
        return_tensors="pt",
    )
    text_embeddings = pipe.text_encoder(text_inputs.input_ids.to(device))[0]

    # 2. Encode unconditional / negative prompts
    neg_prompts = [negative_prompt or ""] * batch_size
    uncond_inputs = pipe.tokenizer(
        neg_prompts,
        padding="max_length",
        max_length=pipe.tokenizer.model_max_length,
        truncation=True,
        return_tensors="pt",
    )
    uncond_embeddings = pipe.text_encoder(uncond_inputs.input_ids.to(device))[0]

    # Context: [uncond_embeddings, text_embeddings]
    context = torch.cat([uncond_embeddings, text_embeddings])

    # 3. Initialize single shared noise tensor across all 3 prompts
    _, latents = init_latent(None, pipe, height=512, width=512, generator=generator, batch_size=batch_size)

    # 4. Set scheduler timesteps (offset=1 avoids warning in DDIMScheduler)
    try:
        pipe.scheduler.set_timesteps(num_inference_steps, offset=1)
    except TypeError:
        pipe.scheduler.set_timesteps(num_inference_steps)

    for t in pipe.scheduler.timesteps:
        # Classifier-Free Guidance: duplicate latents
        latents_input = torch.cat([latents] * 2)
        latents_input = pipe.scheduler.scale_model_input(latents_input, t)

        noise_pred = pipe.unet(latents_input, t, encoder_hidden_states=context).sample
        noise_pred_uncond, noise_pred_text = noise_pred.chunk(2)
        noise_pred = noise_pred_uncond + guidance_scale * (noise_pred_text - noise_pred_uncond)

        latents = pipe.scheduler.step(noise_pred, t, latents).prev_sample
        # Google LocalBlend step_callback
        latents = controller.step_callback(latents)

    # 5. Decode latents with VAE
    latents = 1.0 / 0.18215 * latents
    decoded = pipe.vae.decode(latents).sample
    decoded = (decoded / 2.0 + 0.5).clamp(0, 1)
    decoded = decoded.cpu().permute(0, 2, 3, 1).numpy()
    decoded = (decoded * 255).astype(np.uint8)

    images = [Image.fromarray(img) for img in decoded]
    return images
