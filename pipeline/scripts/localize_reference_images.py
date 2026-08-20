"""
Copy every remote reference image into public/reference/ and repoint the DB.

Two reasons, both load-bearing:

 1. The site's Content-Security-Policy allows images from 'self' and the two
    marketplace CDNs only. 46 of 142 reference assets were hosted on
    upload.wikimedia.org, tsdr.uspto.gov and 20 tribal government domains, so
    the browser blocked every one of them — a third of nations showed a broken
    "Registered seal" panel next to a perfectly visible infringing product.
    Widening the CSP to 22 third-party hosts would trade a real security
    control for a cosmetic fix.

 2. The reference image is EVIDENCE. It is the thing a notice compares the
    listing against, so it should not depend on someone else's web server
    still serving the same bytes next year. 96 assets were already local; this
    makes the remaining ones match.

Usage (from pipeline/):
    python3 -m scripts.localize_reference_images --dry-run
    python3 -m scripts.localize_reference_images
"""

import argparse
import json
import os
import re
import sys
import time
from collections import Counter
from urllib.parse import urlparse

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.db import get_client  # noqa: E402

PUBLIC_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "public", "reference",
)
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reference_url_backup.json")
UA = "OnlineProvenance/1.0 (+https://onlineprovenance.vercel.app; reference image archival)"
EXT_BY_TYPE = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
               "image/svg+xml": ".svg", "image/webp": ".webp"}


def slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    rows = (
        client.table("reference_assets")
        .select("id,tribe_id,asset_type,description,image_url,tribes(name,canonical_name)")
        .execute()
        .data
    )
    remote = [r for r in rows if (r.get("image_url") or "").startswith("http")]
    print(f"{len(rows)} reference assets, {len(remote)} still remote\n")
    if not remote:
        print("Nothing to do.")
        return 0

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    backup = {r["id"]: r["image_url"] for r in remote}
    if not args.dry_run:
        with open(BACKUP, "w") as fh:
            json.dump(backup, fh, indent=2)
        print(f"Original URLs saved to {BACKUP}\n")

    # A nation can hold several marks — five here have both a Wikimedia seal and
    # the USPTO drawing of the same seal, and Miccosukee-style nations have a
    # seal AND a flag. "<tribe>-<type>" is therefore not unique, and writing it
    # blind would have one asset silently overwrite another. Disambiguate only
    # the names that actually repeat, so the existing files keep their shape.
    planned: list[tuple[dict, str]] = []
    for r in remote:
        tribe = r.get("tribes") or {}
        planned.append((r, slug(tribe.get("canonical_name") or tribe.get("name") or r["tribe_id"])))
    counts = Counter(f"{b}-{r['asset_type']}" for r, b in planned)

    ok = fail = 0
    for r, base in planned:
        stem = f"{base}-{r['asset_type']}"
        if counts[stem] > 1:
            stem = f"{stem}-{r['id'][:8]}"
        host = urlparse(r["image_url"]).netloc
        try:
            # Wikimedia rate-limits bots hard; pace requests and honour a 429.
            resp = None
            for attempt in range(4):
                resp = requests.get(r["image_url"], headers={"User-Agent": UA}, timeout=45)
                if resp.status_code != 429:
                    break
                wait = 5 * (attempt + 1)
                print(f"       429 from {host}; waiting {wait}s")
                time.sleep(wait)
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "").split(";")[0].strip()
            ext = EXT_BY_TYPE.get(ctype) or os.path.splitext(urlparse(r["image_url"]).path)[1] or ".png"
            if not resp.content:
                raise RuntimeError("empty body")
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL {base}-{r['asset_type']}  ({host}): {e}")
            fail += 1
            continue

        name = f"{stem}{ext}"
        local = f"/reference/{name}"
        print(f"  ok   {name:<58} {len(resp.content):>7,}B  <- {host}")
        if not args.dry_run:
            with open(os.path.join(PUBLIC_DIR, name), "wb") as fh:
                fh.write(resp.content)
            client.table("reference_assets").update(
                {"image_url": local, "source_url": r["image_url"]}
            ).eq("id", r["id"]).execute()
        ok += 1
        time.sleep(1.0 if "wikimedia" in host else 0.2)

    print(f"\n{ok} localized, {fail} failed"
          + ("   (dry run — nothing written)" if args.dry_run else ""))
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
