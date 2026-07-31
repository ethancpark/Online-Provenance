"""
Amazon product search.

Fetch layer: Bright Data Web Unlocker (preferred) with ScraperAPI as fallback.

Why Bright Data is the default: its free tier is 5,000 credits/month at
*1 credit = 1 request*, whereas ScraperAPI bills ~5 credits per Amazon search
(it escalates to premium proxies), so its 1,000-credit free tier only bought
200 Amazon searches/month. Same free-tier concept, 25x the Amazon coverage.

Budget math at 1 credit/search:
  50 tribes  x 1 query x 4 weekly sweeps =   200 requests/month
  100 tribes x 1 query x 4 weekly sweeps =   400 requests/month
  574 tribes x 1 query x 4 weekly sweeps = 2,296 requests/month
...all inside the 5,000/month free tier.

Config (pipeline/.env):
  BRIGHTDATA_API_TOKEN  — API token from the Bright Data dashboard
  BRIGHTDATA_ZONE       — Web Unlocker zone name (default "web_unlocker1")
  SCRAPER_API_KEY       — optional legacy fallback if the token is absent
"""

import os
import re
import time
from dataclasses import dataclass, asdict
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY")
SCRAPER_ENDPOINT = "http://api.scraperapi.com/"
BRIGHTDATA_API_TOKEN = os.getenv("BRIGHTDATA_API_TOKEN")
BRIGHTDATA_ZONE = os.getenv("BRIGHTDATA_ZONE", "web_unlocker1")
BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request"
AMAZON_BASE = "https://www.amazon.com"

# Runaway guard. The Bright Data account has a $10/month spend limit and a
# 5,000-request/month free tier; a normal weekly sweep uses ~100 requests
# (100 tribes) and even all 574 tribes would use ~574. If a bug ever loops,
# this ceiling stops the process long before either limit is reached — the
# $10 cap stays an untouched backstop rather than a budget.
MAX_REQUESTS_PER_RUN = int(os.getenv("BRIGHTDATA_MAX_REQUESTS_PER_RUN", "700"))
_requests_made = 0


def requests_made() -> int:
    """Bright Data requests issued so far in this process (1 credit each)."""
    return _requests_made


@dataclass
class AmazonListing:
    marketplace: str
    marketplace_id: str          # ASIN
    title: str
    seller: str | None
    price: str | None
    listing_url: str
    image_url: str | None
    search_query: str


def _brightdata_get(url: str) -> str:
    """Fetch a URL through Bright Data's Web Unlocker (1 credit = 1 request)."""
    global _requests_made
    if _requests_made >= MAX_REQUESTS_PER_RUN:
        raise RuntimeError(
            f"Bright Data request ceiling hit ({MAX_REQUESTS_PER_RUN} this run). "
            "Refusing more requests — raise BRIGHTDATA_MAX_REQUESTS_PER_RUN only "
            "if this is genuinely expected."
        )
    _requests_made += 1
    resp = requests.post(
        BRIGHTDATA_ENDPOINT,
        headers={
            "Authorization": f"Bearer {BRIGHTDATA_API_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "zone": BRIGHTDATA_ZONE,
            "url": url,
            "format": "raw",
            "country": "us",
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.text


def _scraperapi_get(url: str, render: bool = False) -> str:
    """Legacy fallback: fetch a URL through ScraperAPI (~5 credits/Amazon page)."""
    if not SCRAPER_API_KEY:
        raise RuntimeError("Missing SCRAPER_API_KEY. Set it in pipeline/.env.")
    params = {
        "api_key": SCRAPER_API_KEY,
        "url": url,
        "country_code": "us",
    }
    if render:
        params["render"] = "true"
    resp = requests.get(SCRAPER_ENDPOINT, params=params, timeout=70)
    resp.raise_for_status()
    return resp.text


def fetch_html(url: str) -> str:
    """Fetch a page, preferring Bright Data and falling back to ScraperAPI."""
    if BRIGHTDATA_API_TOKEN:
        return _brightdata_get(url)
    if SCRAPER_API_KEY:
        return _scraperapi_get(url)
    raise RuntimeError(
        "No scraper configured. Set BRIGHTDATA_API_TOKEN (preferred) "
        "or SCRAPER_API_KEY in pipeline/.env."
    )


def _parse_search_results(html: str, query: str) -> list[AmazonListing]:
    """Pull product cards out of an Amazon search results page."""
    soup = BeautifulSoup(html, "lxml")
    listings: list[AmazonListing] = []

    for card in soup.select('div[data-component-type="s-search-result"]'):
        asin = card.get("data-asin", "").strip()
        if not asin:
            continue

        # Title — Amazon's markup churns, so try a few selectors
        title_el = (
            card.select_one("h2 a span")
            or card.select_one("h2 span")
            or card.select_one(".a-text-normal")
        )
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            continue

        # Listing URL
        link_el = card.select_one("h2 a")
        href = link_el.get("href") if link_el else None
        listing_url = urljoin(AMAZON_BASE, href) if href else f"{AMAZON_BASE}/dp/{asin}"

        # Price (often missing for sponsored or out-of-stock items)
        price_el = card.select_one(".a-price .a-offscreen")
        price = price_el.get_text(strip=True) if price_el else None

        # Image
        img_el = card.select_one("img.s-image")
        image_url = img_el.get("src") if img_el else None

        listings.append(AmazonListing(
            marketplace="amazon",
            marketplace_id=asin,
            title=title,
            seller=None,                # populated separately if requested
            price=price,
            listing_url=listing_url,
            image_url=image_url,
            search_query=query,
        ))

    return listings


def _parse_seller_from_detail(html: str) -> str | None:
    """Try to extract the seller name from a product detail page."""
    soup = BeautifulSoup(html, "lxml")
    # The "sold by" link
    for selector in [
        "#sellerProfileTriggerId",
        "#merchant-info a",
        "a#bylineInfo",
    ]:
        el = soup.select_one(selector)
        if el and el.get_text(strip=True):
            return el.get_text(strip=True)

    # Fallback: look for "Sold by" text near the buy box
    text = soup.get_text(" ", strip=True)
    m = re.search(r"Sold by\s+([A-Za-z0-9 .,&'\-]+)", text)
    if m:
        return m.group(1).strip()[:120]
    return None


def search(query: str, *, fetch_sellers: bool = False, max_results: int = 20) -> list[AmazonListing]:
    """
    Run an Amazon search for `query`, return parsed listings.
    If fetch_sellers=True, fetches each detail page (costs 1 extra credit/listing).
    """
    src = "brightdata" if BRIGHTDATA_API_TOKEN else "scraperapi"
    print(f"  [amazon/{src}] searching: {query!r}")
    search_url = f"{AMAZON_BASE}/s?{urlencode({'k': query})}"
    html = fetch_html(search_url)
    listings = _parse_search_results(html, query)[:max_results]
    print(f"  [amazon]   parsed {len(listings)} listings")

    if fetch_sellers and listings:
        print(f"  [amazon]   fetching seller info for {len(listings)} listings...")
        for i, listing in enumerate(listings, 1):
            try:
                detail_html = fetch_html(listing.listing_url)
                listing.seller = _parse_seller_from_detail(detail_html)
            except Exception as e:
                print(f"  [amazon]     {i}/{len(listings)} seller fetch failed: {e}")
            time.sleep(0.3)

    return listings


if __name__ == "__main__":
    # Quick smoke test — one search, no seller fetches
    results = search("Navajo Nation seal", fetch_sellers=False, max_results=5)
    for r in results:
        print(f"\n  {r.title[:80]}")
        print(f"    ASIN: {r.marketplace_id}  Price: {r.price}")
        print(f"    Image: {r.image_url}")
