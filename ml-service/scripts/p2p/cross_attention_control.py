"""
Prompt-to-Prompt (P2P) Cross-Attention Control Implementation.
Based on: "Prompt-to-Prompt Image Editing with Cross Attention Control" (Hertz et al., 2022 - arXiv:2208.01626).
Precision AgriTech Platform - Phase 1 (Feature #1 / TODO-107).

Implements:
1. AttentionStore: Intercepts and caches cross-attention and self-attention tensors during diffusion steps.
2. AttentionControlEdit: Enforces spatial geometry preservation from a source prompt (Stage 0: Healthy)
   to target prompts (Stage 1: Early Lesions, Stage 2: Severe Necrosis) using cross-attention injection
   and spatial replacement masks.
"""

from typing import Dict, List, Optional, Tuple, Union
import torch
import torch.nn.functional as F


class AttentionControl:
    """Base interface for controlling diffusion attention layers."""

    def __init__(self):
        self.cur_step = 0
        self.num_att_layers = -1
        self.cur_att_layer = 0

    def step(self):
        self.cur_step += 1
        self.cur_att_layer = 0

    def between_steps(self):
        pass

    def reset(self):
        self.cur_step = 0
        self.cur_att_layer = 0

    def __call__(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        return attn


class AttentionStore(AttentionControl):
    """
    Stores cross-attention and self-attention maps produced during UNet forward passes.
    Enables attention map visualization and inter-prompt spatial injection.
    """

    @staticmethod
    def get_empty_store():
        return {"down_cross": [], "mid_cross": [], "up_cross": [],
                "down_self": [], "mid_self": [], "up_self": []}

    def __init__(self):
        super().__init__()
        self.step_store = self.get_empty_store()
        self.attention_store = {}

    def __call__(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        key = f"{place_in_unet}_{'cross' if is_cross else 'self'}"
        if attn.shape[1] <= 32 ** 2:  # Store spatial resolutions suitable for cross-attention control
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

    def get_average_attention(self):
        """Averages stored attention maps across all diffusion steps."""
        average_attention = {
            key: [item / self.cur_step for item in self.attention_store[key]]
            for key in self.attention_store
        }
        return average_attention

    def reset(self):
        super().reset()
        self.step_store = self.get_empty_store()
        self.attention_store = {}


class AttentionControlEdit(AttentionStore):
    """
    Prompt-to-Prompt controller that injects cross-attention maps from the source image
    (Stage 0: Healthy) into modified target images (Stage 1 / Stage 2: Diseased)
    up to a specified diffusion timestep threshold (cross_replace_steps).

    This freezes leaf boundaries, venation, and petiole orientation while allowing
    the target prompt words to synthesize localized disease symptoms.
    """

    def __init__(
        self,
        prompts: List[str],
        num_steps: int,
        cross_replace_steps: Union[float, Tuple[float, float]] = 0.8,
        self_replace_steps: float = 0.6,
        tokenizer=None,
        device: str = "cuda",
    ):
        super().__init__()
        self.batch_size = len(prompts)
        self.num_steps = num_steps
        self.tokenizer = tokenizer
        self.device = device

        if isinstance(cross_replace_steps, float):
            self.cross_replace_steps = (0.0, cross_replace_steps)
        else:
            self.cross_replace_steps = cross_replace_steps
        self.self_replace_steps = self_replace_steps

    def __call__(self, attn: torch.Tensor, is_cross: bool, place_in_unet: str) -> torch.Tensor:
        super().__call__(attn, is_cross, place_in_unet)

        # attn shape: [batch_size * num_heads, pixels, tokens]
        if self.cur_step < self.num_steps * self.cross_replace_steps[1]:
            if is_cross:
                # Replace cross-attention maps of target images with the source (Stage 0) maps
                # for the background and structural tokens
                h = attn.shape[0] // self.batch_size
                attn_source = attn[:h]
                for b in range(1, self.batch_size):
                    attn[b * h : (b + 1) * h] = attn_source
            else:
                if self.cur_step < self.num_steps * self.self_replace_steps:
                    # Self-attention replacement preserves high-level layout and edge structure
                    h = attn.shape[0] // self.batch_size
                    attn_source = attn[:h]
                    for b in range(1, self.batch_size):
                        attn[b * h : (b + 1) * h] = attn_source

        return attn


def register_attention_control(model, controller: AttentionControl):
    """
    Hooks into Stable Diffusion UNet cross-attention and self-attention processor modules
    to route forward-pass attention maps through the AttentionControl object.
    """
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

            # Compute scaled dot-product attention
            scale = 1.0 / (head_dim ** 0.5)
            scores = torch.matmul(query, key.transpose(-1, -2)) * scale
            attn_probs = scores.softmax(dim=-1)

            # Reshape for controller: [batch * heads, query_len, key_len]
            b_heads, q_len, k_len = batch_size * attn_module.heads, query.shape[2], key.shape[2]
            attn_probs_flat = attn_probs.view(b_heads, q_len, k_len)

            # Route through controller
            attn_probs_flat = controller(attn_probs_flat, is_cross, self.place_in_unet)
            attn_probs = attn_probs_flat.view(batch_size, attn_module.heads, q_len, k_len)

            hidden_states = torch.matmul(attn_probs, value)
            hidden_states = hidden_states.transpose(1, 2).reshape(batch_size, -1, attn_module.heads * head_dim)
            hidden_states = attn_module.to_out[0](hidden_states)
            hidden_states = attn_module.to_out[1](hidden_states)

            return hidden_states

    # Register hook on all cross and self attention modules in UNet
    for name, module in model.unet.named_modules():
        if module.__class__.__name__ == "Attention":
            place = "mid"
            if "down_blocks" in name:
                place = "down"
            elif "up_blocks" in name:
                place = "up"
            module.set_processor(P2PAttentionProcessor(place_in_unet=place))
