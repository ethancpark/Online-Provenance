"""
Temu search via a real browser and a saved sign-in session. Free.

Replaces the Apify actor, which billed $0.01 per result. Nothing here costs
anything: it drives a browser on your own machine, from your own residential
connection, using your own Temu account.

Why it has to be signed in. Temu's homepage is open, but search results are
not — every anonymous configuration tested (headless shell, real Chrome
headless, cold URL, session-warmed navigation) was redirected to "Temu |
Login", and a network capture showed no product data reaching the page at all.
The sitemap is 403 outside verified crawler IPs. A signed-in session is the
only way in, and you need a free Temu account to file a report anyway.

Set up once:
    python3 -m scripts.save_temu_session

Then this module is a drop-in for temu_search.search().

Config (pipeline/.env):
    TEMU_HEADLESS       "0" to watch it work; default headless
    TEMU_PAGE_TIMEOUT   ms per navigation, default 60000
"""

import os
import re
import time
from dataclasses import dataclass
from urllib.parse import quote_plus

SESSION_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            ".temu_session.json")
TEMU_BASE = "https://www.temu.com"
HEADLESS = os.getenv("TEMU_HEADLESS", "1") != "0"
PAGE_TIMEOUT = int(os.getenv("TEMU_PAGE_TIMEOUT", "60000"))

# Temu is aggressive about rate. Pace navigations rather than discovering the
# limit by getting the household IP blocked.
DELAY_BETWEEN_QUERIES_S = float(os.getenv("TEMU_QUERY_DELAY_S", "6"))


@dataclass
class TemuListing:
    marketplace: str
    marketplace_id: str
    title: str
    seller: str | None
    price: str | None
    listing_url: str
    image_url: str | None
    search_query: str


class TemuSessionMissing(RuntimeError):
    pass


def _goods_id(href: str) -> str | None:
    m = re.search(r"goods_id=(\d+)", href or "")
    return m.group(1) if m else None


# Runs inside the page. Temu's class names are hashed and change, so anchor on
# the product link and walk out from it rather than on styling.
_EXTRACT_JS = """
() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll("a[href*='goods_id=']")) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/goods_id=(\\d+)/);
    if (!m || seen.has(m[1])) continue;
    const card = a.closest('div') || a;
    const img = a.querySelector('img') || card.querySelector('img');
    const text = (card.innerText || '').trim();
    const price = (text.match(/\\$\\s?[\\d,]+(?:\\.\\d{2})?/) || [null])[0];
    let title = (img && (img.getAttribute('alt') || '').trim()) || '';
    if (!title) title = text.split('\\n').find(l => l.trim().length > 15) || '';
    if (!title) continue;
    seen.add(m[1]);
    out.push({
      goods_id: m[1],
      title: title.slice(0, 300),
      price,
      image_url: img ? (img.getAttribute('src') || img.getAttribute('data-src')) : null,
      href,
    });
  }
  return out;
}
"""


def search(query: str, *, max_results: int = 20, retries: int = 1) -> list[TemuListing]:
    """One Temu search through a signed-in browser. Same shape as temu_search.search()."""
    if not os.path.exists(SESSION_PATH):
        raise TemuSessionMissing(
            "No Temu session. Run: python3 -m scripts.save_temu_session"
        )
    from playwright.sync_api import sync_playwright

    print(f"  [temu] browser search: {query!r}")
    results: list[TemuListing] = []

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=HEADLESS)
        except Exception:
            browser = p.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(
            storage_state=SESSION_PATH,
            viewport={"width": 1440, "height": 950},
            locale="en-US",
            timezone_id="America/Chicago",
        )
        ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        page = ctx.new_page()
        try:
            url = f"{TEMU_BASE}/search_result.html?search_key={quote_plus(query)}"
            for attempt in range(retries + 1):
                page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT)
                page.wait_for_timeout(6000)
                # Products load lazily; nudge the page.
                for _ in range(3):
                    page.mouse.wheel(0, 2200)
                    page.wait_for_timeout(1800)

                if "login" in page.title().lower():
                    if attempt < retries:
                        print("  [temu]   session looked signed-out; retrying")
                        page.wait_for_timeout(4000)
                        continue
                    raise TemuSessionMissing(
                        "Temu redirected to login — the saved session has expired. "
                        "Re-run: python3 -m scripts.save_temu_session"
                    )

                for item in page.evaluate(_EXTRACT_JS):
                    gid = item["goods_id"]
                    results.append(TemuListing(
                        marketplace="temu",
                        marketplace_id=gid,
                        title=item["title"],
                        seller=None,          # not shown on the search grid
                        price=item.get("price"),
                        listing_url=f"{TEMU_BASE}/goods.html?goods_id={gid}",
                        image_url=item.get("image_url"),
                        search_query=query,
                    ))
                break
        finally:
            browser.close()

    print(f"  [temu]   parsed {len(results)} listings")
    time.sleep(DELAY_BETWEEN_QUERIES_S)
    return results[:max_results]


if __name__ == "__main__":
    for r in search("native american tribe flag", max_results=5):
        print(f"\n  {r.title[:80]}")
        print(f"    id={r.marketplace_id} price={r.price}")
        print(f"    {r.listing_url}")
