"""
Downloads each tribe's reference seal/flag images via the MediaWiki API,
computes CLIP embeddings, and upserts them into Supabase.

Run from the pipeline/ directory:
    python3.14 -m scripts.fetch_reference_images

The manifest at pipeline/reference_images/manifest.json lists each asset
by its Wikimedia Commons filename. This script:
  1. Calls the MediaWiki API to resolve each filename to a thumbnail URL
  2. Downloads the PNG thumbnail (with a compliant User-Agent)
  3. Computes a CLIP embedding
  4. Upserts to Supabase reference_assets
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

WIKI_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "IndigenousScraperBot/0.1 "
    "(https://github.com/iphonezoomcalll/Indigenous-Scraper)"
)
THUMB_WIDTH = 512  # The CLIP preprocessor will resize anyway; 512 is plenty


def _resolve_image_url(filename: str) -> tuple[str, str] | None:
    """
    Use the MediaWiki API to get a usable thumbnail URL for a Commons file.
    Returns (thumb_url, description_url) or None if not found.
    """
    params = {
        "action": "query",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(THUMB_WIDTH),
        "format": "json",
    }
    resp = requests.get(
        WIKI_API,
        params=params,
        headers={"User-Agent": USER_AGENT},
        timeout=20,
    )
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        desc = info.get("descriptionurl", "")
        if thumb:
            return thumb, desc
    return None


def _fetch_image_bytes(url: str) -> bytes:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return resp.content


def run():
    client = get_client()

    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    # Look up tribes by name in Supabase
    tribes_resp = client.table("tribes").select("id,name,canonical_name").execute()
    tribe_by_name = {}
    for t in tribes_resp.data:
        tribe_by_name[t["name"]] = t
        tribe_by_name[t["canonical_name"]] = t

    if not tribe_by_name:
        print("No tribes in Supabase. Run seed_tribes.py first.")
        return

    rows_to_upsert = []
    skipped = []

    for tribe_name, payload in manifest.items():
        if tribe_name.startswith("_"):
            continue
        tribe = tribe_by_name.get(tribe_name)
        if not tribe:
            skipped.append((tribe_name, "tribe not in Supabase"))
            continue

        for asset in payload.get("assets", []):
            filename = asset.get("wiki_filename")
            if not filename:
                skipped.append((tribe_name, f"{asset.get('asset_type')}: no wiki_filename"))
                continue

            print(f"Processing {tribe_name} {asset['asset_type']}...")
            try:
                resolved = _resolve_image_url(filename)
                if not resolved:
                    skipped.append((tribe_name, f"{asset['asset_type']}: file not found on Commons"))
                    continue
                image_url, source_url = resolved
                print(f"  Resolved: {image_url}")

                data = _fetch_image_bytes(image_url)
                print(f"  Fetched {len(data):,} bytes; embedding...")
                embedding = embed_image_bytes(data)
            except Exception as e:
                skipped.append((tribe_name, f"{asset['asset_type']}: {e}"))
                continue

            rows_to_upsert.append({
                "tribe_id": tribe["id"],
                "asset_type": asset["asset_type"],
                "description": asset["description"],
                "image_url": image_url,
                "source_url": source_url,
                "embedding": embedding,
            })

    if rows_to_upsert:
        print(f"\nUpserting {len(rows_to_upsert)} reference assets to Supabase...")
        for row in rows_to_upsert:
            client.table("reference_assets").delete().eq(
                "tribe_id", row["tribe_id"]
            ).eq("asset_type", row["asset_type"]).execute()
        client.table("reference_assets").insert(rows_to_upsert).execute()
        print("  Done.")

    if skipped:
        print(f"\nSkipped {len(skipped)} entries:")
        for name, reason in skipped:
            print(f"  - {name}: {reason}")


if __name__ == "__main__":
    run()
