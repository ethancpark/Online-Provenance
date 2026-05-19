"""
End-to-end scan: for each tribe with reference assets, search Amazon
for merchandise using their seal/flag/name, match each listing image
against the tribe's reference embeddings, and write everything to
Supabase (listings + matches).

Run from the pipeline/ directory:
    python3.14 -m scripts.run_scan                       # all tribes with reference assets
    python3.14 -m scripts.run_scan "Navajo Nation"       # one tribe only
    python3.14 -m scripts.run_scan --max-per-query 10    # limit listings per search

Credit accounting (rough):
  N tribes * Q queries/tribe * 1 search credit ≈ search cost
  Image downloads from Amazon CDN are free (not via ScraperAPI)
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db import get_client
from src.amazon_search import search as amazon_search
from src.image_matcher import match_listing_image


def _query_terms_for(tribe_name: str) -> list[str]:
    """
    Search queries to run against Amazon for a given tribe. Tuned to find
    merchandise using the tribe's seal, flag, or name.
    """
    base = tribe_name
    return [
        f"{base} seal",
        f"{base} flag",
        f"{base}",
    ]


def _tribes_with_reference_assets(client, name_filter: str | None) -> list[dict]:
    """Return tribes that have at least one reference asset with an embedding."""
    q = client.table("tribes").select("id, name, canonical_name, reference_assets(id, embedding, asset_type, description)")
    if name_filter:
        q = q.eq("name", name_filter)
    resp = q.execute()
    return [
        t for t in resp.data
        if any(a.get("embedding") for a in (t.get("reference_assets") or []))
    ]


def _upsert_listing(client, tribe_id: str, listing, image_embedding) -> str:
    """Upsert a listing row, returning its id."""
    payload = {
        "tribe_id": tribe_id,
        "marketplace": listing.marketplace,
        "marketplace_id": listing.marketplace_id,
        "title": listing.title,
        "seller": listing.seller,
        "price": listing.price,
        "listing_url": listing.listing_url,
        "image_url": listing.image_url,
        "image_embedding": image_embedding,
        "search_query": listing.search_query,
    }
    resp = (
        client.table("listings")
        .upsert(payload, on_conflict="marketplace,marketplace_id")
        .execute()
    )
    return resp.data[0]["id"]


def _upsert_match(client, listing_id: str, match) -> None:
    """Upsert a match row."""
    payload = {
        "listing_id": listing_id,
        "reference_asset_id": match.reference_asset_id,
        "confidence": round(match.confidence, 3),
        "confidence_band": match.confidence_band,
        "status": "awaiting_review",
    }
    client.table("matches").upsert(payload, on_conflict="listing_id,reference_asset_id").execute()


def run_scan(name_filter: str | None = None, max_per_query: int = 10) -> dict:
    client = get_client()
    tribes = _tribes_with_reference_assets(client, name_filter)
    print(f"Scanning {len(tribes)} tribe(s) with reference assets...\n")

    stats = {"tribes": 0, "queries": 0, "listings": 0, "matches": 0, "high": 0, "medium": 0, "low": 0}

    for tribe in tribes:
        stats["tribes"] += 1
        ref_assets = [a for a in (tribe.get("reference_assets") or []) if a.get("embedding")]
        print(f"=== {tribe['name']} ({len(ref_assets)} reference asset(s)) ===")

        for query in _query_terms_for(tribe["name"]):
            stats["queries"] += 1
            try:
                listings = amazon_search(query, fetch_sellers=False, max_results=max_per_query)
            except Exception as e:
                print(f"  search failed: {e}")
                continue

            for listing in listings:
                if not listing.image_url:
                    continue

                match, listing_emb = match_listing_image(listing.image_url, ref_assets)
                if not match:
                    continue

                stats["listings"] += 1
                try:
                    listing_id = _upsert_listing(client, tribe["id"], listing, listing_emb)
                    _upsert_match(client, listing_id, match)
                    stats["matches"] += 1
                    stats[match.confidence_band] += 1
                    print(
                        f"  [{match.confidence_band:6}] {match.confidence:.3f}  "
                        f"{listing.title[:70]}"
                    )
                except Exception as e:
                    print(f"  DB write failed: {e}")

            time.sleep(0.5)  # polite pacing between queries

    print("\n=== Scan complete ===")
    print(
        f"  tribes scanned:   {stats['tribes']}\n"
        f"  queries run:      {stats['queries']}\n"
        f"  listings matched: {stats['listings']}\n"
        f"  HIGH matches:     {stats['high']}\n"
        f"  MEDIUM matches:   {stats['medium']}\n"
        f"  LOW matches:      {stats['low']}"
    )
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("tribe", nargs="?", default=None, help="Limit scan to one tribe by name")
    parser.add_argument("--max-per-query", type=int, default=10)
    args = parser.parse_args()
    run_scan(name_filter=args.tribe, max_per_query=args.max_per_query)
