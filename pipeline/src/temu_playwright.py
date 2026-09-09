"""
Temu search by driving a real browser. No per-result billing.

Replaces the Apify actor, which charged $0.01 per row.

What actually blocks this, established by testing rather than assumed: Temu's
homepage is open, but an anonymous session asking for search results is
redirected to "Temu | Login" — verified with a headless shell, with real Chrome
headless, cold and session-warmed, and a network capture showing no product
data on the wire at all. sitemap-index.xml is 403 outside verified crawler IPs.

So there are two ways in, and this supports both:

  session    a saved Temu login (scripts/save_temu_session.py). Free, and you
             need a free Temu account to file a report anyway.
  proxy      a residential exit, set through TEMU_PROXY_SERVER. Worth trying
             anonymously, since the gate may be IP reputation as much as
             session — but it costs per request, so the budget guard applies.

Either can be used alone or together.

Config (pipeline/.env):
    TEMU_PROXY_SERVER      e.g. http://gate.provider.com:7000
    TEMU_PROXY_USERNAME    proxy auth, if any
    TEMU_PROXY_PASSWORD
    TEMU_HEADLESS          "0" to watch it work
    TEMU_MAX_REQUESTS      per-run allowance, default 40
    TEMU_QUERY_DELAY_S     pause between queries, default 6
"""

import json
import os
import re
import time
from dataclasses import dataclass
from urllib.parse import quote_plus

from src.temu_budget import Budget, BudgetExceeded

SESSION_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".temu_session.json"
)
TEMU_BASE = "https://www.temu.com"
HEADLESS = os.getenv("TEMU_HEADLESS", "1") != "0"
PAGE_TIMEOUT = int(os.getenv("TEMU_PAGE_TIMEOUT", "60000"))
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


class TemuBlocked(RuntimeError):
    """Temu served a login wall or a page with no products."""


class TemuNotConfigured(TemuBlocked):
    """Neither a session nor a proxy is set up.

    Separate from TemuBlocked because it is a setup problem, not a per-query
    one: repeating it once per query in a dragnet is fifteen identical lines
    saying the same thing.
    """


def _proxy_config() -> dict | None:
    server = os.getenv("TEMU_PROXY_SERVER", "").strip()
    if not server:
        return None
    cfg: dict[str, str] = {"server": server}
    user = os.getenv("TEMU_PROXY_USERNAME", "").strip()
    pw = os.getenv("TEMU_PROXY_PASSWORD", "").strip()
    if user:
        cfg["username"] = user
    if pw:
        cfg["password"] = pw
    return cfg


# Runs in the page. Temu's class names are hashed and change without notice, so
# this anchors on the product link — the one thing that cannot change without
# breaking their own URLs — and walks out to the surrounding card.
_EXTRACT_DOM = """
() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll("a[href*='goods_id=']")) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/goods_id=(\\d+)/);
    if (!m || seen.has(m[1])) continue;
    let card = a, hops = 0;
    while (card.parentElement && hops < 4) {
      if ((card.innerText || '').trim().length > 20) break;
      card = card.parentElement; hops++;
    }
    const img = a.querySelector('img') || card.querySelector('img');
    const text = (card.innerText || '').trim();
    const price = (text.match(/\\$\\s?[\\d,]+(?:\\.\\d{2})?/) || [null])[0];
    let title = (img && (img.getAttribute('alt') || '').trim()) || '';
    if (!title) title = (text.split('\\n').find(l => l.trim().length > 15) || '').trim();
    if (!title) continue;
    seen.add(m[1]);
    out.push({
      goods_id: m[1], title: title.slice(0, 300), price,
      image_url: img ? (img.getAttribute('src') || img.getAttribute('data-src')) : null,
    });
  }
  return out;
}
"""

# Fallback: Temu ships an initial-state blob in a <script>. When the DOM is
# virtualised, or lazily rendered below the fold, the blob still holds rows the
# DOM has not painted.
_GOODS_RE = re.compile(
    r'"goods_id"\s*:\s*"?(\d{6,})"?.{0,400}?"goods_name"\s*:\s*"((?:[^"\\]|\\.){3,300})"',
    re.S,
)
_IMG_RE = re.compile(r'"(?:hd_thumb_url|thumb_url|image_url)"\s*:\s*"([^"]+)"')


def _from_blob(html: str, query: str) -> list[TemuListing]:
    found: dict[str, TemuListing] = {}
    for m in _GOODS_RE.finditer(html):
        gid, raw_title = m.group(1), m.group(2)
        if gid in found:
            continue
        try:
            title = json.loads(f'"{raw_title}"')
        except Exception:  # noqa: BLE001
            title = raw_title
        img = _IMG_RE.search(html, m.end(), m.end() + 600)
        found[gid] = TemuListing(
            marketplace="temu",
            marketplace_id=gid,
            title=title[:300],
            seller=None,
            price=None,
            listing_url=f"{TEMU_BASE}/goods.html?goods_id={gid}",
            image_url=img.group(1) if img else None,
            search_query=query,
        )
    return list(found.values())


def search(
    query: str,
    *,
    max_results: int = 20,
    retries: int = 1,
    budget: Budget | None = None,
) -> list[TemuListing]:
    """One Temu search. Same shape as the Apify path it replaces."""
    from playwright.sync_api import sync_playwright

    budget = budget or Budget()
    budget.check()

    proxy = _proxy_config()
    have_session = os.path.exists(SESSION_PATH)
    if not proxy and not have_session:
        raise TemuNotConfigured(
            "No Temu session and no proxy configured. Either run\n"
            "  python3 -m scripts.save_temu_session\n"
            "or set TEMU_PROXY_SERVER in pipeline/.env."
        )

    how = "session+proxy" if (proxy and have_session) else ("proxy" if proxy else "session")
    print(f"  [temu] {query!r} via {how}")

    results: list[TemuListing] = []
    with sync_playwright() as p:
        launch: dict = {"headless": HEADLESS}
        if proxy:
            launch["proxy"] = proxy
        try:
            browser = p.chromium.launch(channel="chrome", **launch)
        except Exception:  # noqa: BLE001
            browser = p.chromium.launch(**launch)

        ctx_args: dict = {
            "viewport": {"width": 1440, "height": 950},
            "locale": "en-US",
            "timezone_id": "America/Chicago",
        }
        if have_session:
            ctx_args["storage_state"] = SESSION_PATH
        ctx = browser.new_context(**ctx_args)
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        )
        page = ctx.new_page()
        # Images are the bulk of the bytes and none of the data. On a metered
        # residential proxy that is most of the bill.
        page.route(
            re.compile(r"\.(png|jpe?g|gif|webp|svg|woff2?|mp4)(\?|$)"),
            lambda route: route.abort(),
        )

        try:
            url = f"{TEMU_BASE}/search_result.html?search_key={quote_plus(query)}"
            for attempt in range(retries + 1):
                budget.check()
                page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT)
                page.wait_for_timeout(5000)
                for _ in range(3):
                    page.mouse.wheel(0, 2200)
                    page.wait_for_timeout(1500)

                title = page.title()
                blocked = "login" in title.lower()
                items = [] if blocked else page.evaluate(_EXTRACT_DOM)
                if not items and not blocked:
                    items = []  # fall through to the blob

                for item in items:
                    results.append(
                        TemuListing(
                            marketplace="temu",
                            marketplace_id=item["goods_id"],
                            title=item["title"],
                            seller=None,
                            price=item.get("price"),
                            listing_url=f"{TEMU_BASE}/goods.html?goods_id={item['goods_id']}",
                            image_url=item.get("image_url"),
                            search_query=query,
                        )
                    )
                if not results and not blocked:
                    results = _from_blob(page.content(), query)
                    if results:
                        print(f"  [temu]   DOM was empty; recovered {len(results)} from the page blob")

                budget.spent(ok=bool(results))
                if results:
                    break
                if blocked:
                    print(f"  [temu]   blocked (title={title!r})")
                if attempt < retries:
                    page.wait_for_timeout(4000)
        finally:
            browser.close()

    if not results:
        raise TemuBlocked(
            f"No products for {query!r}. "
            + ("The saved session may have expired — re-run scripts/save_temu_session.py."
               if have_session else "Try a residential proxy, or sign in and save a session.")
        )

    print(f"  [temu]   {len(results)} listings  [{budget.summary()}]")
    time.sleep(DELAY_BETWEEN_QUERIES_S)
    return results[:max_results]


if __name__ == "__main__":
    import sys

    q = sys.argv[1] if len(sys.argv) > 1 else "native american tribe flag"
    try:
        for r in search(q, max_results=5):
            print(f"\n  {r.title[:80]}")
            print(f"    id={r.marketplace_id}  price={r.price}")
            print(f"    {r.listing_url}")
    except (TemuBlocked, BudgetExceeded) as e:
        print(f"\n  {e}")
        raise SystemExit(1)
