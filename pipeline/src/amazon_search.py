"""
Amazon product search via ScraperAPI.

Strategy:
  1. Build an amazon.com search URL for a given query (e.g. "Cherokee Nation seal")
  2. Fetch through ScraperAPI (handles bot detection, proxies, geo)
  3. Parse the result page for product cards (title, image, link, price)
  4. Optionally fetch each product detail page for seller info (costs 1 extra credit/listing)

Credit accounting (free tier = 5,000 credits):
  - Search page fetch:        1 credit
  - Product detail fetch:     1 credit
  - With JS render (`render=true`): 10 credits — we don't need it for Amazon search
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
AMAZON_BASE = "https://www.amazon.com"


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


def _scraperapi_get(url: str, render: bool = False) -> str:
    """Fetch a URL through ScraperAPI and return the HTML."""
    if not SCRAPER_API_KEY:
        raise RuntimeError(
            "Missing SCRAPER_API_KEY. Set it in pipeline/.env."
        )
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
    print(f"  [amazon] searching: {query!r}")
    search_url = f"{AMAZON_BASE}/s?{urlencode({'k': query})}"
    html = _scraperapi_get(search_url)
    listings = _parse_search_results(html, query)[:max_results]
    print(f"  [amazon]   parsed {len(listings)} listings")

    if fetch_sellers and listings:
        print(f"  [amazon]   fetching seller info for {len(listings)} listings...")
        for i, listing in enumerate(listings, 1):
            try:
                detail_html = _scraperapi_get(listing.listing_url)
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
