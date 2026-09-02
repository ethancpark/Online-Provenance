"""
One-time: log into Temu by hand and save the session for the scraper.

Why this exists. Temu's homepage is open to anyone, but search results are not:
an anonymous browser gets redirected to "Temu | Login" no matter how it is
disguised. Verified against a headless shell, real Chrome headless, cold URLs,
session-warmed navigation, and a network capture that showed no product data on
the wire at all — only telemetry and an anti-token scheme. The sitemap is 403
for everyone but verified crawler IPs.

So the scraper needs a real signed-in session. You already need a free Temu
account to file a report, so this is the same account.

Run it, a browser window opens, you log in yourself, then press Enter here.
Your password is typed into Temu's own page and never touches this code; only
the resulting session cookies are saved.

    python3 -m scripts.save_temu_session

Writes pipeline/.temu_session.json — gitignored, and treat it like a password:
anyone holding it is signed in as you.
"""

import os
import sys

from playwright.sync_api import sync_playwright

SESSION_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            ".temu_session.json")


def main() -> int:
    print("Opening Temu. Log in in the browser window, then come back here.\n")
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=False)
        except Exception:
            browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(viewport={"width": 1400, "height": 950}, locale="en-US")
        page = ctx.new_page()
        page.goto("https://www.temu.com/login.html", wait_until="domcontentloaded", timeout=90000)

        input("Signed in? Press Enter to save the session... ")

        # Confirm the session actually works before saving it, so a failed
        # login doesn't get written out and fail silently a week later.
        page.goto("https://www.temu.com/search_result.html?search_key=flag",
                  wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(6000)
        title = page.title()
        links = page.eval_on_selector_all(
            "a[href*='goods.html'], a[href*='goods_id']", "els => els.length")

        if "login" in title.lower() or links == 0:
            print(f"\n  Still gated (title={title!r}, product links={links}).")
            print("  Not saving. Make sure you're fully signed in, then run this again.")
            browser.close()
            return 1

        ctx.storage_state(path=SESSION_PATH)
        os.chmod(SESSION_PATH, 0o600)
        print(f"\n  Session works ({links} products visible). Saved to {SESSION_PATH}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
