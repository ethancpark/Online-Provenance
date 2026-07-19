"""
Temu product search via an Apify actor.

ScraperAPI cannot retrieve Temu products (verified: the SPA shell has no product
data and ScraperAPI's JS render 500s on Temu), so Temu goes through an Apify
actor instead. The actor is swappable via env in case it breaks:

    APIFY_TOKEN        — required (apify.com account token)
    APIFY_TEMU_ACTOR   — actor id, default "crw~temu-products-scraper"

IMPORTANT — query strategy (verified 2026-07-18): searching Temu for
"<Tribe Name> flag" returns nothing; sellers title these listings generically
("Local American Indian Tribe ... Flag"). Temu is therefore scanned with
generic DRAGNET_QUERIES and each result is CLIP-matched against every tribe's
reference assets (see run_scan.run_temu_dragnet), instead of per-tribe queries.
"""

import os
import time
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_TEMU_ACTOR = os.getenv("APIFY_TEMU_ACTOR", "crw~temu-products-scraper")
# Hard ceiling per actor run — a runaway run can never exceed this charge.
APIFY_MAX_CHARGE_USD = os.getenv("APIFY_MAX_CHARGE_USD", "1")
APIFY_RUN_SYNC = (
    "https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
)
TEMU_BASE = "https://www.temu.com"

# Generic queries that actually surface tribal seal/flag merchandise on Temu.
# Per-tribe queries return 0 results there — do not add "<tribe> flag" here.
DRAGNET_QUERIES = [
    "native american tribe flag",
    "indian tribe flag 3x5",
    "native american tribal seal",
    "indian nation flag",
    "tribal seal sticker decal",
]


@dataclass
class TemuListing:
    marketplace: str
    marketplace_id: str          # Temu goods id
    title: str
    seller: str | None
    price: str | None
    listing_url: str
    image_url: str | None
    search_query: str


def _map_item(item: dict, query: str) -> TemuListing | None:
    gid = str(item.get("goods_id") or "").strip()
    title = (item.get("title") or "").strip()
    if not gid or not title:
        return None
    image = item.get("image_url") or item.get("thumb_url") or None
    mall_id = item.get("mall_id")
    return TemuListing(
        marketplace="temu",
        marketplace_id=gid,
        title=title[:300],
        seller=f"mall {mall_id}" if mall_id else None,
        price=item.get("price_str") or None,
        listing_url=f"{TEMU_BASE}/goods.html?goods_id={gid}",
        image_url=image,
        search_query=query,
    )


def search(query: str, *, max_results: int = 20, retries: int = 1) -> list[TemuListing]:
    """Run one Temu search through the Apify actor, return parsed listings."""
    if not APIFY_TOKEN:
        raise RuntimeError("Missing APIFY_TOKEN. Set it in pipeline/.env.")

    print(f"  [temu] searching via {APIFY_TEMU_ACTOR}: {query!r}")
    url = APIFY_RUN_SYNC.format(actor=APIFY_TEMU_ACTOR)
    params = {
        "token": APIFY_TOKEN,
        "maxTotalChargeUsd": APIFY_MAX_CHARGE_USD,
        "timeout": 300,
    }
    payload = {
        "keyword": query,
        "max_items": max_results,
        "sort": "relevance",
        "region": "US",
    }

    last_err: Exception | None = None
    for attempt in range(1, retries + 2):
        try:
            resp = requests.post(url, params=params, json=payload, timeout=330)
            resp.raise_for_status()
            items = resp.json()
            listings = [m for m in (_map_item(i, query) for i in items) if m]
            print(f"  [temu]   parsed {len(listings)} listings")
            return listings[:max_results]
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt <= retries:
                print(f"  [temu]   attempt {attempt} failed ({e}); retrying...")
                time.sleep(3)
    raise RuntimeError(f"Temu search failed after {retries + 1} attempts: {last_err}")


if __name__ == "__main__":
    results = search("native american tribe flag", max_results=5)
    for r in results:
        print(f"\n  {r.title[:80]}")
        print(f"    id: {r.marketplace_id}  price: {r.price}  seller: {r.seller}")
        print(f"    image: {r.image_url}")
        print(f"    url: {r.listing_url}")
