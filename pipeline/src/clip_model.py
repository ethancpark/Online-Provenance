"""
CLIP image embedder.

Uses open_clip with ViT-B/32 (LAION pretrain) — 512-dim embeddings,
runs fine on a Mac CPU. First call downloads ~600 MB of weights and
caches them locally.

The embedding is L2-normalized so cosine similarity == dot product,
and matches in 0..1 range (well, -1..1, but for natural images it's
typically 0.2..0.9).
"""

import io
from functools import lru_cache
from PIL import Image

import torch
import open_clip


MODEL_NAME = "ViT-B-32"
PRETRAINED = "laion2b_s34b_b79k"
EMBED_DIM = 512


@lru_cache(maxsize=1)
def _load_model():
    """Load CLIP model + preprocessor once and reuse."""
    print(f"Loading CLIP {MODEL_NAME} / {PRETRAINED}...")
    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME, pretrained=PRETRAINED
    )
    model.eval()
    return model, preprocess


def embed_image_bytes(data: bytes) -> list[float]:
    """Compute a 512-dim L2-normalized CLIP embedding for an image."""
    model, preprocess = _load_model()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        emb = model.encode_image(tensor)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    return emb.squeeze(0).tolist()


def embed_image_path(path: str) -> list[float]:
    with open(path, "rb") as f:
        return embed_image_bytes(f.read())


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Cosine similarity between two embeddings. Since both are L2-normalized
    by embed_image_*, this is just a dot product.
    """
    return float(sum(x * y for x, y in zip(a, b)))


def confidence_to_band(confidence: float) -> str:
    """Map a similarity score to the UI band (low/medium/high)."""
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.70:
        return "medium"
    return "low"


if __name__ == "__main__":
    # Smoke test: load model, embed a tiny dummy image, print shape
    from PIL import Image as PILImage
    import tempfile
    img = PILImage.new("RGB", (224, 224), color="red")
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        img.save(f.name)
        emb = embed_image_path(f.name)
    print(f"Embedding length: {len(emb)} (expected {EMBED_DIM})")
    print(f"First 5 dims: {emb[:5]}")
    print(f"Self-similarity: {cosine_similarity(emb, emb):.4f} (expected ~1.0)")
