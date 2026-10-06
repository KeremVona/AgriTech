"""
Sequence Aligner Module for Prompt-to-Prompt (P2P).
Based on: "Prompt-to-Prompt Image Editing with Cross Attention Control" (Hertz et al., Google Research, 2022).
Source: https://github.com/google/prompt-to-prompt/blob/main/seq_aligner.py

Provides Needleman-Wunsch dynamic programming sequence alignment for CLIP token IDs.
Computes token replacement and refinement mapping matrices (mapper and alphas)
to align matching tokens between source prompt (Stage 0: Healthy) and target prompts
(Stage 1: Early Lesions, Stage 2: Severe Necrosis).
"""

from typing import List, Tuple, Union
import numpy as np

try:
    import torch
    HAS_TORCH = True
except ImportError:
    torch = None
    HAS_TORCH = False


class ScoreParams:
    """Scoring parameters for Needleman-Wunsch global alignment."""

    def __init__(self, gap: int = 0, match: int = 1, mismatch: int = -1):
        self.gap = gap
        self.match = match
        self.mismatch = mismatch

    def mis_match_char(self, x: int, y: int) -> int:
        return self.match if x == y else self.mismatch


def get_matrix(size_x: int, size_y: int, gap: int) -> np.ndarray:
    """Initializes the alignment DP matrix with boundary gap penalties."""
    matrix = np.zeros((size_x + 1, size_y + 1), dtype=np.int32)
    matrix[0, 1:] = (np.arange(size_y) + 1) * gap
    matrix[1:, 0] = (np.arange(size_x) + 1) * gap
    return matrix


def get_traceback_matrix(size_x: int, size_y: int) -> np.ndarray:
    """Initializes the traceback matrix: 1 = left, 2 = up, 3 = diagonal, 4 = origin."""
    matrix = np.zeros((size_x + 1, size_y + 1), dtype=np.int32)
    matrix[0, 1:] = 1
    matrix[1:, 0] = 2
    matrix[0, 0] = 4
    return matrix


def global_align(x: List[int], y: List[int], score: ScoreParams) -> Tuple[np.ndarray, np.ndarray]:
    """Computes global Needleman-Wunsch alignment between token sequences x and y."""
    matrix = get_matrix(len(x), len(y), score.gap)
    trace_back = get_traceback_matrix(len(x), len(y))

    for i in range(1, len(x) + 1):
        for j in range(1, len(y) + 1):
            left = matrix[i, j - 1] + score.gap
            up = matrix[i - 1, j] + score.gap
            diag = matrix[i - 1, j - 1] + score.mis_match_char(x[i - 1], y[j - 1])
            matrix[i, j] = max(left, up, diag)
            if matrix[i, j] == left:
                trace_back[i, j] = 1
            elif matrix[i, j] == up:
                trace_back[i, j] = 2
            else:
                trace_back[i, j] = 3

    return matrix, trace_back


def get_aligned_sequences(x: List[int], y: List[int], trace_back: np.ndarray):
    """Traces back the optimal path through the alignment matrix."""
    x_seq = []
    y_seq = []
    i = len(x)
    j = len(y)
    mapper_y_to_x = []

    while i > 0 or j > 0:
        if trace_back[i, j] == 3:
            x_seq.append(x[i - 1])
            y_seq.append(y[j - 1])
            i -= 1
            j -= 1
            mapper_y_to_x.append((j, i))
        elif trace_back[i, j] == 1:
            x_seq.append("-")
            y_seq.append(y[j - 1])
            j -= 1
            mapper_y_to_x.append((j, -1))
        elif trace_back[i, j] == 2:
            x_seq.append(x[i - 1])
            y_seq.append("-")
            i -= 1
        elif trace_back[i, j] == 4:
            break

    mapper_y_to_x.reverse()
    arr = np.array(mapper_y_to_x, dtype=np.int64) if mapper_y_to_x else np.zeros((0, 2), dtype=np.int64)
    res = torch.tensor(arr, dtype=torch.int64) if HAS_TORCH else arr
    return x_seq, y_seq, res


def get_mapper(x: str, y: str, tokenizer, max_len: int = 77):
    """
    Computes token-to-token index mapping from prompt x (source) to prompt y (target).
    Returns:
    - mapper: (max_len,) tensor mapping target token index -> source token index
    - alphas: (max_len,) float tensor where 1.0 indicates a matched token, 0.0 indicates a new/modified token
    """
    x_seq = tokenizer.encode(x)
    y_seq = tokenizer.encode(y)
    score = ScoreParams(gap=0, match=1, mismatch=-1)
    matrix, trace_back = global_align(x_seq, y_seq, score)
    mapper_base = get_aligned_sequences(x_seq, y_seq, trace_back)[-1]

    if HAS_TORCH:
        alphas = torch.ones(max_len, dtype=torch.float32)
        alphas[: mapper_base.shape[0]] = mapper_base[:, 1].ne(-1).float()
        mapper = torch.zeros(max_len, dtype=torch.int64)
        mapper[: mapper_base.shape[0]] = mapper_base[:, 1]
        mapper[mapper_base.shape[0] :] = len(y_seq) + torch.arange(max_len - len(y_seq))
    else:
        alphas = np.ones(max_len, dtype=np.float32)
        alphas[: mapper_base.shape[0]] = (mapper_base[:, 1] != -1).astype(np.float32)
        mapper = np.zeros(max_len, dtype=np.int64)
        mapper[: mapper_base.shape[0]] = mapper_base[:, 1]
        mapper[mapper_base.shape[0] :] = len(y_seq) + np.arange(max_len - len(y_seq))

    return mapper, alphas


def get_refinement_mapper(prompts: List[str], tokenizer, max_len: int = 77):
    """
    Computes sequence alignment mappers and alphas for a batch of prompts against prompts[0].
    Returns:
    - mappers: (batch_size - 1, max_len)
    - alphas: (batch_size - 1, max_len)
    """
    x_seq = prompts[0]
    mappers, alphas = [], []
    for i in range(1, len(prompts)):
        mapper, alpha = get_mapper(x_seq, prompts[i], tokenizer, max_len)
        mappers.append(mapper)
        alphas.append(alpha)

    if HAS_TORCH:
        return torch.stack(mappers), torch.stack(alphas)
    return np.stack(mappers), np.stack(alphas)


def get_word_inds(text: str, word_place: Union[int, str, List[Union[int, str]]], tokenizer) -> np.ndarray:
    """
    Finds the subword token indices in tokenizer.encode(text) corresponding to specified word(s).
    Used by LocalBlend to extract the spatial cross-attention maps for targeted words.
    """
    split_text = text.split(" ")
    if isinstance(word_place, str):
        target_words = [word_place]
        word_indices = [i for i, word in enumerate(split_text) if any(w in word.lower() for w in target_words)]
    elif isinstance(word_place, (list, tuple)):
        word_indices = []
        for wp in word_place:
            if isinstance(wp, str):
                word_indices.extend([i for i, word in enumerate(split_text) if wp.lower() in word.lower()])
            elif isinstance(wp, int):
                word_indices.append(wp)
    elif isinstance(word_place, int):
        word_indices = [word_place]
    else:
        word_indices = []

    out = []
    if len(word_indices) > 0:
        words_encode = [tokenizer.decode([item]).strip("#") for item in tokenizer.encode(text)][1:-1]
        cur_len, ptr = 0, 0
        for i in range(len(words_encode)):
            cur_len += len(words_encode[i].strip())
            if ptr in word_indices:
                out.append(i + 1)  # +1 for <startoftext> BOS token
            if ptr < len(split_text) and cur_len >= len(split_text[ptr].strip()):
                ptr += 1
                cur_len = 0
    return np.array(out, dtype=np.int64)
