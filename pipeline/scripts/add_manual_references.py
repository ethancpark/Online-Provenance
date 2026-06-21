"""
Add reference seal/flag images you've sourced by hand.

HOW TO USE:
  1. Save each tribe's seal (or flag) image into:
        pipeline/reference_images/manual/
  2. Name the file with the tribe's name as it appears in the dashboard, e.g.:
        Hopi Tribe.png
        Pueblo of Zuni.jpg
        Ho-Chunk Nation of Wisconsin seal.png      (add "seal"/"flag" to set the type)
     (Spaces, apostrophes, case don't matter — it matches loosely. Add "flag"
      in the name if the image is a flag; otherwise it's stored as a seal.)
  3. Run from the pipeline/ directory:
        python3.14 -m scripts.add_manual_references

It matches each file to a tribe, computes its CLIP embedding, and stores it.
Unmatched files are reported so you can rename them.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db import get_client
from src.clip_model import embed_image_bytes

MANUAL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "reference_images",
    "manual",
)
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".svg")


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def run():
    os.makedirs(MANUAL_DIR, exist_ok=True)
    client = get_client()
    tribes = client.table("tribes").select("id,name,canonical_name").execute().data

    # Build a slug -> tribe index (both display + canonical names)
    index = {}
    for t in tribes:
        index[_slug(t["name"])] = t
        if t.get("canonical_name"):
            index[_slug(t["canonical_name"])] = t

    files = [f for f in os.listdir(MANUAL_DIR) if f.lower().endswith(IMG_EXT)]
    if not files:
        print(f"No images found in {MANUAL_DIR}")
        print("Drop seal/flag image files there (named by tribe) and re-run.")
        return

    stored, unmatched = 0, []
    for fname in sorted(files):
        base = os.path.splitext(fname)[0]
        asset_type = "flag" if "flag" in base.lower() else "seal"
        # strip trailing "seal"/"flag" hint before matching
        name_part = re.sub(r"\b(seal|flag)\b", "", base, flags=re.I).strip()
        fslug = _slug(name_part)

        # exact, then containment match
        tribe = index.get(fslug)
        if not tribe:
            cand = [t for s, t in index.items() if s and (s in fslug or fslug in s)]
            tribe = cand[0] if cand else None
        if not tribe:
            unmatched.append(fname)
            continue

        path = os.path.join(MANUAL_DIR, fname)
        try:
            with open(path, "rb") as fh:
                data = fh.read()
            embedding = embed_image_bytes(data)
        except Exception as e:
            print(f"  ✗ {fname}: couldn't read/embed ({e})")
            continue

        # store (replace any existing asset of this type for the tribe)
        client.table("reference_assets").delete().eq("tribe_id", tribe["id"]).eq(
            "asset_type", asset_type
        ).execute()
        client.table("reference_assets").insert({
            "tribe_id": tribe["id"],
            "asset_type": asset_type,
            "description": f"{tribe['name']} {asset_type} (manually added)",
            "image_url": f"manual://{fname}",
            "source_url": None,
            "embedding": embedding,
        }).execute()
        stored += 1
        print(f"  ✅ {fname}  →  {tribe['name']} [{asset_type}]")

    print(f"\nStored {stored} reference image(s).")
    if unmatched:
        print(f"\n⚠️  {len(unmatched)} file(s) didn't match a tribe — rename them:")
        for f in unmatched:
            print(f"   {f}")


if __name__ == "__main__":
    run()
