"""
Image matcher.

Given a listing's product image, compare it against each of a tribe's
reference assets (seal/flag embeddings stored in Supabase). Returns the
best-matching asset and a confidence score.

Confidence interpretation (CLIP cosine similarity, L2-normalized):
  >= 0.85   high       — almost certainly the same mark
  0.70–0.85 medium     — visually similar, human review needed
  < 0.70    low        — probably unrelated, suppress unless tuning
"""

import io
from dataclasses import dataclass

import requests

from src.clip_model import embed_image_bytes, cosine_similarity, confidence_to_band


REQ_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


@dataclass
class MatchResult:
    reference_asset_id: str
    confidence: float
    confidence_band: str    # 'low' | 'medium' | 'high'


def _fetch_image(url: str, timeout: int = 20) -> bytes:
    resp = requests.get(url, headers=REQ_HEADERS, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def match_listing_image(
    listing_image_url: str,
    reference_assets: list[dict],
) -> tuple[MatchResult | None, list[float] | None]:
    """
    Embed a listing image and compare to each reference asset.
    Returns (best_match, listing_embedding) — embedding cached so the
    caller can persist it on the listing row.
    """
    if not reference_assets:
        return None, None

    try:
        data = _fetch_image(listing_image_url)
    except Exception as e:
        print(f"    image fetch failed: {e}")
        return None, None

    try:
        listing_emb = embed_image_bytes(data)
    except Exception as e:
        print(f"    embedding failed: {e}")
        return None, None

    best: MatchResult | None = None
    for asset in reference_assets:
        ref_emb = asset.get("embedding")
        if not ref_emb:
            continue
        # Supabase returns pgvector embeddings as a string like "[0.1,0.2,...]"
        if isinstance(ref_emb, str):
            ref_emb = [float(x) for x in ref_emb.strip("[]").split(",")]
        score = cosine_similarity(listing_emb, ref_emb)
        if best is None or score > best.confidence:
            best = MatchResult(
                reference_asset_id=asset["id"],
                confidence=score,
                confidence_band=confidence_to_band(score),
            )

    return best, listing_emb
