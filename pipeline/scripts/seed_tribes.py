"""
Seeds the `tribes` table in Supabase with the top 50 federally recognized
tribes and their known USPTO trademark status.

Run from the pipeline/ directory:
    python3.14 -m scripts.seed_tribes
"""

import sys
import os

# Allow running as a script from the pipeline/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.tribes import get_top50_tribes
from src.uspto import lookup_all_trademarks
from src.db import get_client


def seed():
    client = get_client()

    print("Loading top 50 tribes...")
    tribes = get_top50_tribes()

    print("Looking up trademark status...")
    trademarks = lookup_all_trademarks(tribes)

    rows = []
    for t in tribes:
        canonical = t["canonical_name"]
        tm = trademarks.get(canonical, {})
        rows.append({
            "name": t["name"],
            "canonical_name": canonical,
            "rank": t["rank"],
            "has_registered_mark": tm.get("has_registered_mark", False),
            "uspto_status": tm.get("status", "unknown"),
            "uspto_notes": tm.get("notes", ""),
            "uspto_search_url": tm.get("search_url", ""),
        })

    print(f"Upserting {len(rows)} tribes to Supabase...")
    # `name` is unique, so on_conflict makes this re-runnable
    resp = client.table("tribes").upsert(rows, on_conflict="name").execute()
    print(f"  Upserted {len(resp.data)} rows.")

    # Sanity check
    count_resp = client.table("tribes").select("id", count="exact").execute()
    print(f"  Total rows in tribes table: {count_resp.count}")


if __name__ == "__main__":
    seed()
