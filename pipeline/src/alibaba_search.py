"""
Alibaba product search via ScraperAPI.

Alibaba's search results page is heavily JavaScript-rendered, so unlike Amazon
we request it with `render=true` (10 ScraperAPI credits/page instead of 1).
The markup churns constantly and varies by A/B bucket, so the parser is
deliberately defensive: it anchors on product-detail links and then climbs to
the surrounding card to pull title / image / price, with several fallbacks.

Credit accounting (free tier = 5,000 credits):
  - Search page fetch with render: 10 credits
  - We do NOT fetch per-product detail pages (seller is parsed from the card)
"""

import os
import re
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")
SCRAPER_ENDPOINT = "http://api.scraperapi.com/"
ALIBABA_BASE = "https://www.alibaba.com"

# Matches the numeric offer id inside a product-detail URL, e.g.
#   /product-detail/Custom-Navajo-Nation-Seal-Flag_1600312345678.html
_OFFER_ID_RE = re.compile(r"_?(\d{10,})\.html")
# Alibaba shows prices like "$1.70-5.15" or "$3.20" (sometimes "US$").
_PRICE_RE = re.compile(r"(?:US)?\s?\$\s?[\d,]+(?:\.\d{1,2})?(?:\s?-\s?\$?[\d,]+(?:\.\d{1,2})?)?")


@dataclass
class AlibabaListing:
    marketplace: str
    marketplace_id: str          # Alibaba offer id
    title: str
    seller: str | None
    price: str | None
    listing_url: str
    image_url: str | None
    search_query: str


def _scraperapi_get(url: str, render: bool = True, retries: int = 2) -> str:
    """
    Fetch a URL through ScraperAPI and return the HTML.

    Alibaba guards `/trade/search` with the Baxia anti-bot wall ("Captcha
    Interception"). Plain fetches — even with render — get the captcha page.
    The combination `premium=true` + `render=true` (residential proxy + JS
    execution) gets through. This costs more credits per page (~25) but is the
    only reliably working option on the free plan (ultra_premium is gated).
    """
    if not SCRAPER_API_KEY:
        raise RuntimeError("Missing SCRAPER_API_KEY. Set it in pipeline/.env.")
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        "country_code": "us",
        "premium": "true",
    }
    if render:
        params["render"] = "true"

    last_err: Exception | None = None
    for attempt in range(1, retries + 2):
        try:
            resp = requests.get(SCRAPER_ENDPOINT, params=params, timeout=150)
            # ScraperAPI returns 500 on transient render timeouts — retry those.
            if resp.status_code >= 500:
                raise requests.HTTPError(f"ScraperAPI {resp.status_code}")
            resp.raise_for_status()
            if "Captcha Interception" in resp.text:
                raise requests.HTTPError("hit Alibaba captcha wall")
            return resp.text
        except Exception as e:  # noqa: BLE001 - retry any transient failure
            last_err = e
            if attempt <= retries:
                print(f"  [alibaba]   fetch attempt {attempt} failed ({e}); retrying...")
                time.sleep(2)
    raise RuntimeError(f"Alibaba fetch failed after {retries + 1} attempts: {last_err}")


def _normalize_img(src: str | None) -> str | None:
    if not src:
        return None
    src = src.strip()
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return ALIBABA_BASE + src
    return src


def _normalize_url(href: str) -> str:
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return ALIBABA_BASE + href
    return href


def _best_product_image(card) -> str | None:
    """
    Return the main product photo from a card. Alibaba's image area holds the
    real product image; supplier badges / UI sprites (tiny tps-34-34 icons)
    live elsewhere, so we scope to the image area and skip obvious icons.
    """
    img_area = card.select_one(".searchx-img-area, .img-area-layout, [class*='img-area']")
    candidates = (img_area or card).select("img")
    for im in candidates:
        src = _normalize_img(
            im.get("src") or im.get("data-src") or im.get("data-lazy-src")
        )
        if not src:
            continue
        # Skip tiny sprite/badge icons (e.g. ..._!!...-tps-34-34.png)
        if re.search(r"tps-\d{1,2}-\d{1,2}\.png", src):
            continue
        return src
    return None


def _extract_card(card, query: str) -> AlibabaListing | None:
    """Pull a listing out of a search result card container."""
    # Title + its product-detail link
    title_el = card.select_one(
        ".searchx-product-e-title, .searchx-title-area, [class*='title-area'], [class*='e-title']"
    )
    anchor = (title_el or card).select_one("a[href*='product-detail']")
    if anchor is None:
        anchor = card.select_one("a[href*='product-detail']")
    if anchor is None:
        return None

    href = anchor.get("href") or ""
    m = _OFFER_ID_RE.search(href)
    if not m:
        return None
    offer_id = m.group(1)

    title = (title_el.get_text(" ", strip=True) if title_el else anchor.get_text(" ", strip=True))
    if not title:
        img_el = card.select_one("img[alt]")
        title = (img_el.get("alt") if img_el else "").strip()
    if not title:
        return None
    title = title[:300]

    image_url = _best_product_image(card)

    # Price
    price = None
    price_el = card.select_one(".searchx-price-area, [class*='price-area'], [class*='price']")
    if price_el:
        pm = _PRICE_RE.search(price_el.get_text(" ", strip=True))
        if pm:
            price = pm.group(0).strip()

    # Supplier (company name link if present; the supplier badge text otherwise)
    seller = None
    company = card.select_one(
        ".searchx-supplier-content a, [class*='supplier'] a, a[href*='.en.alibaba.com']"
    )
    if company and company.get_text(strip=True):
        seller = company.get_text(strip=True)[:120]

    return AlibabaListing(
        marketplace="alibaba",
        marketplace_id=offer_id,
        title=title,
        seller=seller,
        price=price,
        listing_url=_normalize_url(href),
        image_url=image_url,
        search_query=query,
    )


def _parse_search_results(html: str, query: str) -> list[AlibabaListing]:
    soup = BeautifulSoup(html, "lxml")
    listings: list[AlibabaListing] = []
    seen: set[str] = set()

    cards = soup.select(
        ".searchx-offer-item, .fy26-product-card-wrapper, [class*='product-card-wrapper']"
    )
    # Fallback: if the card classes churn, anchor on product-detail links and
    # treat a few-levels-up container as the card.
    if not cards:
        cards = []
        for anchor in soup.select("a[href*='product-detail']"):
            c = anchor
            for _ in range(4):
                if c.parent is None:
                    break
                c = c.parent
                if c.select_one("img"):
                    break
            cards.append(c)

    for card in cards:
        listing = _extract_card(card, query)
        if not listing or listing.marketplace_id in seen:
            continue
        seen.add(listing.marketplace_id)
        listings.append(listing)

    return listings


def search(query: str, *, max_results: int = 20, render: bool = True) -> list[AlibabaListing]:
    """Run an Alibaba search for `query`, return parsed listings."""
    print(f"  [alibaba] searching: {query!r}")
    search_url = f"{ALIBABA_BASE}/trade/search?{urlencode({'SearchText': query})}"
    html = _scraperapi_get(search_url, render=render)
    listings = _parse_search_results(html, query)[:max_results]
    print(f"  [alibaba]   parsed {len(listings)} listings")
    return listings


if __name__ == "__main__":
    results = search("Navajo Nation seal flag", max_results=5)
    for r in results:
        print(f"\n  {r.title[:80]}")
        print(f"    id: {r.marketplace_id}  price: {r.price}  seller: {r.seller}")
        print(f"    image: {r.image_url}")
        print(f"    url: {r.listing_url}")
