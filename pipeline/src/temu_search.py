"""
Temu product search.

⚠️ KNOWN LIMITATION (verified): ScraperAPI cannot retrieve Temu *products*.
A plain fetch returns only the SPA shell + config (no product data — Temu loads
results via a separate signed API call after page load), and ScraperAPI's JS
render 500s on Temu's page. So `search()` below will return 0 listings until the
fetch is repointed at a source that can actually load Temu.

TODO(apify): swap `_scraperapi_get` for a call to Apify's Temu scraper actor
(https://apify.com/store, search "Temu"). It returns structured JSON; map its
fields into TemuListing in `_parse_search_results`. Everything downstream
(run_scan, matching, UI, /api/report) already speaks "temu", so only the fetch
+ parse layer here needs to change.

The JSON-blob + anchor parser below is kept for if/when a fetch source returns
real Temu HTML/JSON.
"""

import os
import re
import json
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")
SCRAPER_ENDPOINT = "http://api.scraperapi.com/"
TEMU_BASE = "https://www.temu.com"

# Temu goods ids: long numbers in goods.html?goods_id=... or ...-g-<id>.html
_GOODS_ID_QUERY_RE = re.compile(r"goods_id=(\d{6,})")
_GOODS_ID_SEO_RE = re.compile(r"-g-(\d{6,})\.html")
_PRICE_RE = re.compile(r"\$\s?[\d,]+(?:\.\d{1,2})?(?:\s?-\s?\$?[\d,]+(?:\.\d{1,2})?)?")
# Temu image CDN hosts
_IMG_HOST_RE = re.compile(r"https?://[a-z0-9.\-]*kwcdn\.com/[^\s\"'\\]+", re.I)


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


def _scraperapi_get(url: str, render: bool = False, retries: int = 2) -> str:
    """
    Fetch via ScraperAPI. Temu's search HTML already embeds product JSON, so a
    PLAIN fetch works (1 credit) — and ScraperAPI's JS render actually 500s on
    Temu's heavy page, so we deliberately do NOT render. Retries transient 5xx.
    """
    if not SCRAPER_API_KEY:
        raise RuntimeError("Missing SCRAPER_API_KEY. Set it in pipeline/.env.")
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        "country_code": "us",
    }
    if render:
        params["render"] = "true"

    last_err: Exception | None = None
    for attempt in range(1, retries + 2):
        try:
            resp = requests.get(SCRAPER_ENDPOINT, params=params, timeout=150)
            if resp.status_code >= 500:
                raise requests.HTTPError(f"ScraperAPI {resp.status_code}")
            resp.raise_for_status()
            return resp.text
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt <= retries:
                print(f"  [temu]   fetch attempt {attempt} failed ({e}); retrying...")
                time.sleep(2)
    raise RuntimeError(f"Temu fetch failed after {retries + 1} attempts: {last_err}")


def _norm_img(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip().replace("\\u002F", "/").replace("\\/", "/")
    if url.startswith("//"):
        return "https:" + url
    return url


def _goods_id(href: str) -> str | None:
    m = _GOODS_ID_QUERY_RE.search(href) or _GOODS_ID_SEO_RE.search(href)
    return m.group(1) if m else None


def _parse_json_blobs(html: str, query: str) -> list[TemuListing]:
    """
    Temu embeds product objects in JSON within the page. Pull out objects that
    look like goods (have a goods id + title + image), without depending on the
    exact top-level shape (which changes).
    """
    listings: list[TemuListing] = []
    seen: set[str] = set()

    # Find goods-object fragments: a goodsId/goods_id near a title and an image.
    # We scan for goods ids, then look at a window of surrounding JSON text.
    for m in re.finditer(r'["\']goods[_]?[iI]d["\']\s*:\s*"?(\d{6,})"?', html):
        gid = m.group(1)
        if gid in seen:
            continue
        window = html[max(0, m.start() - 600): m.end() + 1200]

        title_m = re.search(r'["\'](?:goodsName|title|goods_name)["\']\s*:\s*"([^"]{6,200})"', window)
        if not title_m:
            continue
        title = title_m.group(1).encode().decode("unicode_escape", "ignore").strip()

        img_m = _IMG_HOST_RE.search(window)
        image_url = _norm_img(img_m.group(0)) if img_m else None

        price_m = _PRICE_RE.search(window)
        price = price_m.group(0) if price_m else None

        seen.add(gid)
        listings.append(TemuListing(
            marketplace="temu",
            marketplace_id=gid,
            title=title[:300],
            seller=None,
            price=price,
            listing_url=f"{TEMU_BASE}/goods.html?goods_id={gid}",
            image_url=image_url,
            search_query=query,
        ))
    return listings


def _parse_anchors(html: str, query: str) -> list[TemuListing]:
    """Fallback: parse rendered DOM for goods links + nearby image/title/price."""
    soup = BeautifulSoup(html, "lxml")
    listings: list[TemuListing] = []
    seen: set[str] = set()

    for a in soup.select("a[href*='goods']"):
        href = a.get("href") or ""
        gid = _goods_id(href)
        if not gid or gid in seen:
            continue

        card = a
        for _ in range(4):
            if card.parent is None:
                break
            card = card.parent
            if card.select_one("img"):
                break

        img = card.select_one("img")
        image_url = _norm_img(
            (img.get("src") or img.get("data-src")) if img else None
        )
        title = a.get_text(" ", strip=True) or (img.get("alt") if img else "") or ""
        if not title:
            continue
        pm = _PRICE_RE.search(card.get_text(" ", strip=True))

        seen.add(gid)
        listings.append(TemuListing(
            marketplace="temu",
            marketplace_id=gid,
            title=title[:300],
            seller=None,
            price=pm.group(0) if pm else None,
            listing_url=href if href.startswith("http") else f"{TEMU_BASE}/goods.html?goods_id={gid}",
            image_url=image_url,
            search_query=query,
        ))
    return listings


def _parse_search_results(html: str, query: str) -> list[TemuListing]:
    listings = _parse_json_blobs(html, query)
    if not listings:
        listings = _parse_anchors(html, query)
    return listings


def search(query: str, *, max_results: int = 20, render: bool = False) -> list[TemuListing]:
    """Run a Temu search for `query`, return parsed listings."""
    print(f"  [temu] searching: {query!r}")
    search_url = f"{TEMU_BASE}/search_result.html?{urlencode({'search_key': query})}"
    html = _scraperapi_get(search_url, render=render)
    listings = _parse_search_results(html, query)[:max_results]
    print(f"  [temu]   parsed {len(listings)} listings")
    return listings


if __name__ == "__main__":
    results = search("Navajo Nation flag", max_results=5)
    for r in results:
        print(f"\n  {r.title[:80]}")
        print(f"    id: {r.marketplace_id}  price: {r.price}")
        print(f"    image: {r.image_url}")
        print(f"    url: {r.listing_url}")
