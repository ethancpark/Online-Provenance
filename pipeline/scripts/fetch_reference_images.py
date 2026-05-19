"""
Downloads each tribe's reference seal/flag images, computes CLIP
embeddings, and upserts them into Supabase's reference_assets table.

Run from the pipeline/ directory:
    python3.14 -m scripts.fetch_reference_images

Notes:
  - Reads pipeline/reference_images/manifest.json
  - Only processes entries where `image_url` is set (skip-stubs)
  - Images are not re-hosted; the manifest URL goes into Supabase as-is
  - CLIP model loads on first call (~600 MB download, cached)
"""

import json
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db import get_client
from src.clip_model import embed_image_bytes


MANIFEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "reference_images",
    "manifest.json",
)


def _fetch_image(url: str) -> bytes:
    headers = {"User-Agent": "IndigenousScraper/0.1 (research)"}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.content


def run():
    client = get_client()

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    # Map canonical_name -> tribe row from Supabase
    tribes_resp = client.table("tribes").select("id,name,canonical_name").execute()
    tribe_by_name = {t["canonical_name"]: t for t in tribes_resp.data}
    tribe_by_name.update({t["name"]: t for t in tribes_resp.data})

    if not tribe_by_name:
        print("No tribes in Supabase yet. Run seed_tribes.py first.")
        return

    rows_to_upsert = []
    skipped = []

    for tribe_name, payload in manifest.items():
        if tribe_name.startswith("_"):
            continue
        tribe = tribe_by_name.get(tribe_name)
        if not tribe:
            skipped.append((tribe_name, "tribe not in DB"))
            continue

        for asset in payload.get("assets", []):
            if not asset.get("image_url"):
                skipped.append((tribe_name, f"{asset['asset_type']}: no image_url"))
                continue

            print(f"Processing {tribe_name} {asset['asset_type']}...")
            try:
                data = _fetch_image(asset["image_url"])
                print(f"  Fetched {len(data)} bytes; embedding...")
                embedding = embed_image_bytes(data)
            except Exception as e:
                skipped.append((tribe_name, f"{asset['asset_type']}: {e}"))
                continue

            rows_to_upsert.append({
                "tribe_id": tribe["id"],
                "asset_type": asset["asset_type"],
                "description": asset["description"],
                "image_url": asset["image_url"],
                "source_url": asset.get("source_url", ""),
                "embedding": embedding,
            })

    if rows_to_upsert:
        print(f"\nUpserting {len(rows_to_upsert)} reference assets to Supabase...")
        # No natural unique key on this table, so we delete-then-insert per tribe+type
        # to keep the script idempotent.
        for row in rows_to_upsert:
            client.table("reference_assets").delete().eq(
                "tribe_id", row["tribe_id"]
            ).eq("asset_type", row["asset_type"]).execute()
        client.table("reference_assets").insert(rows_to_upsert).execute()
        print(f"  Done.")

    if skipped:
        print(f"\nSkipped {len(skipped)} entries:")
        for name, reason in skipped:
            print(f"  - {name}: {reason}")


if __name__ == "__main__":
    run()
