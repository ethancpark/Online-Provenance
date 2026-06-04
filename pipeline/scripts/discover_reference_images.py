"""
Auto-discover each tribe's seal/flag reference image on Wikimedia Commons,
embed it with CLIP, and upsert into Supabase reference_assets.

Unlike fetch_reference_images.py (which needs exact filenames in a manifest),
this SEARCHES Commons for each tribe, so we don't have to hand-guess filenames.

Run from the pipeline/ directory:
    python3.14 -m scripts.discover_reference_images --dry-run   # just print findings
    python3.14 -m scripts.discover_reference_images             # also store to DB
    python3.14 -m scripts.discover_reference_images "Hopi Tribe"  # one tribe
"""

import argparse
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db import get_client
from src.clip_model import embed_image_bytes

WIKI_API = "https://commons.wikimedia.org/w/api.php"
WP_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "IndigenousScraperBot/0.2 (https://github.com/iphonezoomcalll/Indigenous-Scraper)"
THUMB_WIDTH = 512

# US state names — stripped from core tokens so a tribe named "... of Florida"
# doesn't match "Flag of Florida". (Tribe's own name must appear in the file.)
_STATE_NAMES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
    "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
    "missouri", "montana", "nebraska", "nevada", "ohio", "oklahoma", "oregon",
    "pennsylvania", "tennessee", "texas", "utah", "vermont", "virginia",
    "washington", "wisconsin", "wyoming", "carolina", "dakota", "jersey",
    "mexico", "hampshire", "island", "rhode",
}

# Generic words to strip when deriving a tribe's distinctive "core" tokens.
STOPWORDS = {
    "tribe", "tribes", "nation", "indian", "indians", "band", "bands", "of",
    "the", "community", "reservation", "confederated", "people", "peoples",
    "and", "at", "a",
} | _STATE_NAMES
IMG_EXT = (".svg", ".png", ".jpg", ".jpeg")


def _core_tokens(name: str) -> list[str]:
    """Distinctive lowercase tokens from a tribe name (drop generic words)."""
    cleaned = name.replace("(", " ").replace(")", " ").replace("-", " ")
    toks = [t.strip(".,'").lower() for t in cleaned.split()]
    return [t for t in toks if t and t not in STOPWORDS]


def _search_commons(query: str, limit: int = 8) -> list[str]:
    """Return File-namespace titles matching a search query."""
    params = {
        "action": "query", "list": "search", "srsearch": query,
        "srnamespace": "6", "srlimit": str(limit), "format": "json",
    }
    r = requests.get(WIKI_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
    r.raise_for_status()
    return [hit["title"] for hit in r.json().get("query", {}).get("search", [])]


def _article_images(article_title: str) -> list[str]:
    """Return seal/flag-like File titles embedded in a tribe's Wikipedia article."""
    params = {
        "action": "query", "prop": "images", "titles": article_title,
        "imlimit": "200", "redirects": "1", "format": "json",
    }
    try:
        r = requests.get(WP_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=25)
        data = r.json()
    except Exception:
        return []
    titles = []
    for page in data.get("query", {}).get("pages", {}).values():
        for im in page.get("images", []):
            titles.append(im["title"])
    return titles


def _resolve_image_url(title: str) -> tuple[str, str] | None:
    """Resolve a 'File:...' title to (thumb_url, description_url). Tries Commons
    then English Wikipedia (covers files hosted locally on enwiki)."""
    params = {
        "action": "query", "titles": title, "prop": "imageinfo",
        "iiprop": "url", "iiurlwidth": str(THUMB_WIDTH), "format": "json",
    }
    for api in (WIKI_API, WP_API):
        try:
            r = requests.get(api, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
            for page in r.json().get("query", {}).get("pages", {}).values():
                info = (page.get("imageinfo") or [{}])[0]
                thumb = info.get("thumburl") or info.get("url")
                if thumb:
                    return thumb, info.get("descriptionurl", "")
        except Exception:
            continue
    return None


# Words that signal a photo or a wrong/partial variant rather than the clean
# official flag/seal vector.
_BAD_WORDS = (
    "confederate", "district", "over", " at ", "inn", "center", "building",
    "parade", "powwow", "pow wow", "museum", "map", "logo of", "former",
    "historical", "proposed", "veterans",
)


def _best_match(titles: list[str], core: list[str], kind: str) -> str | None:
    """
    Pick the best file title: must be an image, mention the asset kind
    (seal/flag), contain the tribe's first distinctive token, and look like the
    clean official mark (SVG preferred, photos/variants penalized).
    """
    key = core[0] if core else ""
    best = None
    for title in titles:
        low = title.lower()
        if not low.endswith(IMG_EXT):
            continue
        if kind not in low:
            continue
        if key and key not in low:
            continue
        if any(b in low for b in _BAD_WORDS):
            continue
        # Photo IDs look like "... (52214784129).jpg" — skip those
        if any(ch.isdigit() for ch in low.split("(")[-1]) and "(" in low:
            continue
        score = sum(1 for t in core if t in low)      # token overlap
        if low.endswith(".svg"):
            score += 3                                 # clean vector strongly preferred
        elif low.endswith((".jpg", ".jpeg")):
            score -= 2                                 # likely a photo
        score -= len(title) / 100.0                    # tie-break toward shorter/cleaner
        if best is None or score > best[0]:
            best = (score, title)
    return best[1] if best else None


def discover_for_tribe(name: str) -> list[dict]:
    """Search Commons for this tribe's seal and flag; return resolved assets."""
    core = _core_tokens(name)
    found = []
    for kind in ("seal", "flag"):  # prefer seal first
        # Full-name query only — looser queries pull in county/city seals that
        # merely share a word (e.g. "Cherokee County" seal), which is worse than
        # no reference at all.
        query = f"{name} {kind}"
        try:
            titles = _search_commons(query)
        except Exception as e:
            print(f"    [{kind}] search failed: {e}")
            titles = []
        match = _best_match(titles, core, kind)
        # Fallback: pull the asset from the tribe's Wikipedia article infobox,
        # which often hosts a seal/flag the Commons keyword search misses.
        if not match:
            article_titles = [
                t for t in _article_images(name)
                if kind in t.lower() and any(tok in t.lower() for tok in core)
            ]
            match = _best_match(article_titles, core, kind)
        if not match:
            continue
        resolved = _resolve_image_url(match)
        if not resolved:
            continue
        url, source = resolved
        found.append({
            "asset_type": kind,
            "description": f"{match[5:].rsplit('.', 1)[0]}",  # strip 'File:' + ext
            "image_url": url,
            "source_url": source,
            "wiki_title": match,
        })
    return found


def run(name_filter: str | None, dry_run: bool):
    client = get_client()
    tribes = client.table("tribes").select("id,name,canonical_name").order("rank").execute().data
    if name_filter:
        tribes = [t for t in tribes if t["name"] == name_filter]

    stored = 0
    tribes_with_assets = 0
    for t in tribes:
        assets = discover_for_tribe(t["name"])
        if not assets:
            print(f"✗ {t['name']}: nothing found on Commons")
            continue
        tribes_with_assets += 1
        print(f"✓ {t['name']}:")
        for a in assets:
            print(f"    [{a['asset_type']}] {a['wiki_title']}")
            if dry_run:
                continue
            try:
                data = requests.get(a["image_url"], headers={"User-Agent": USER_AGENT}, timeout=30).content
                embedding = embed_image_bytes(data)
            except Exception as e:
                print(f"        embed failed: {e}")
                continue
            # replace any existing asset of this type for the tribe
            client.table("reference_assets").delete().eq("tribe_id", t["id"]).eq("asset_type", a["asset_type"]).execute()
            client.table("reference_assets").insert({
                "tribe_id": t["id"],
                "asset_type": a["asset_type"],
                "description": a["description"],
                "image_url": a["image_url"],
                "source_url": a["source_url"],
                "embedding": embedding,
            }).execute()
            stored += 1

    print(f"\n{tribes_with_assets}/{len(tribes)} tribes have a reference image"
          + ("" if dry_run else f"; stored {stored} assets"))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("tribe", nargs="?", default=None)
    p.add_argument("--dry-run", action="store_true", help="search & print, don't store")
    args = p.parse_args()
    run(args.tribe, args.dry_run)
