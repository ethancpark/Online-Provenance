"""
End-to-end scan.

Amazon: for each tribe with reference assets, search "<tribe> seal/flag/name",
match each listing image against that tribe's reference embeddings.

Temu: per-tribe queries return 0 results there (verified), so Temu runs a
DRAGNET instead — generic queries like "native american tribe flag" — and each
listing is CLIP-matched against EVERY tribe's reference assets; the listing is
assigned to the best-matching tribe.

Everything is written to Supabase (listings + matches).

Run from the pipeline/ directory:
    python3.14 -m scripts.run_scan                       # all tribes, amazon+temu
    python3.14 -m scripts.run_scan "Navajo Nation"       # one tribe (amazon only)
    python3.14 -m scripts.run_scan --marketplace temu    # temu dragnet only
    python3.14 -m scripts.run_scan --max-per-query 10    # limit listings per search
"""

import argparse
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.db import get_client
from src.amazon_search import search as amazon_search
from src.temu_search import search as temu_search, dragnet_queries_for_today
from src.image_matcher import match_listing_image

# Minimum CLIP similarity required to STORE a match. Below this, the listing is
# almost certainly unrelated (a generic flag, jewelry, a book cover) and would
# only pollute the review queue — so we drop it instead of writing noise.
#
# Set to 0.60 (not 0.70): real merchandise where the seal/flag is photographed
# on a pole, with perspective and a sky/white background, scores noticeably
# lower than a flat reference render — often 0.60-0.69 — so a 0.70 floor was
# silently dropping genuine flags (e.g. the Osage flags on Amazon). The obvious
# junk (random national flags, jewelry) scored 0.15-0.41, well below 0.60, so it
# stays filtered. Tunable via env.
MATCH_MIN_CONFIDENCE = float(os.getenv("MATCH_MIN_CONFIDENCE", "0.60"))

# --- Hybrid matching (image + title text) ---------------------------------
# CLIP scores photos-of-flags against clean vector references surprisingly low
# (a real Mescalero flag photo ~0.33 vs its reference drawing), so an image-only
# 0.60 cut silently drops genuine listings. But the listing TITLE already names
# the tribe (Amazon is searched by tribe name; Temu sellers title flags "Flag of
# The <Tribe>"). So we accept a much lower image score when the title BOTH names
# the tribe AND says it's a flag/seal-type product. Such matches are stored at a
# fixed "medium" confidence — the title makes us fairly sure it's a real
# infringement, and a human reviews before anything is reported.
IMAGE_ONLY_MIN = MATCH_MIN_CONFIDENCE          # strong image match — no text needed
IMAGE_TEXT_FLOOR = float(os.getenv("MATCH_TEXT_FLOOR", "0.25"))  # with title confirmation
TEXT_CONFIRMED_CONFIDENCE = 0.72               # overall confidence for title-confirmed hits

_PRODUCT_RE = re.compile(
    r"\b(flags?|banners?|pennants?|seals?|emblems?|crests?|decals?|stickers?|patch(?:es)?|badges?)\b",
    re.I,
)
# Words that don't identify WHICH tribe (org structure + states). Deliberately
# does NOT include geographic words like lake/river/mountain/superior — those
# distinguish e.g. "Red Lake" from "Leech Lake" and "Cheyenne River" from other
# Sioux tribes. Shared tribal-family words (chippewa, apache, sioux, creek) are
# also NOT here — instead we key off the LEADING distinctive tokens of the name.
_NAME_GENERIC = {
    "tribe", "tribes", "nation", "nations", "band", "bands", "of", "the", "and",
    "indians", "indian", "reservation", "community", "communities", "confederated",
    "oyate", "pueblo", "great", "seal", "flag", "at", "in", "for", "on",
    "oklahoma", "florida", "wisconsin", "michigan", "minnesota", "arizona",
    "montana", "dakota", "south", "north", "new", "mexico",
}


def _name_tokens(name: str) -> list[str]:
    words = re.sub(r"[^a-z0-9 ]", " ", name.lower()).split()
    return [w for w in words if len(w) >= 3 and w not in _NAME_GENERIC]


# A title can name the tribe and still be about something else entirely.
# 56 of 132 nations reduce to a SINGLE distinctive token (Delaware, Miami,
# Omaha, Osage, Seminole...), and those words are also US states, cities and
# universities — so "University of Delaware Flag" satisfied "names the tribe
# AND is a flag" and was stored as a Delaware Tribe of Indians infringement.
# Every one of that nation's seven flagged listings was the state, the college
# or its football team.
#
# These markers name a RIVAL owner of the same word. They are deliberately
# narrow: "athletic" is not here, because athletic apparel is exactly what gets
# infringed, and team nicknames are not here because NCAA / university /
# officially licensed already catch those listings.
_RIVAL_ENTITY_RE = re.compile(
    r"\b(universit(?:y|ies)|college|collegiate|ncaa|varsity|alumni|"
    r"officially\s+licensed|state\s+seal|state\s+flag|souvenir)\b",
    re.I,
)


def _title_confirms(title: str, tribe_name: str) -> bool:
    """
    True if the title says it's a flag/seal product AND names the tribe by its
    leading distinctive tokens (e.g. "red lake", "cheyenne river", "mescalero
    apache") — so a "Sokaogon Chippewa" flag is NOT accepted for "Red Lake ...
    Chippewa", and a generic "Apache flag" is NOT accepted for a specific Apache
    tribe.
    """
    if not title or not _PRODUCT_RE.search(title):
        return False
    # A university's or a state's own merchandise is not the nation's mark,
    # however well the name matches.
    if _RIVAL_ENTITY_RE.search(title):
        return False
    toks = set(re.sub(r"[^a-z0-9 ]", " ", title.lower()).split())
    sig = _name_tokens(tribe_name)
    if not sig:
        return False
    need = sig[:2]  # leading identifying tokens of the official name
    return all(w in toks for w in need)


def _evaluate(title: str, tribe_name: str, match):
    """(store?, confidence, band): image-only path or title-confirmed path."""
    sim = match.confidence
    if sim >= IMAGE_ONLY_MIN:
        return True, round(sim, 3), match.confidence_band
    if sim >= IMAGE_TEXT_FLOOR and _title_confirms(title, tribe_name):
        return True, TEXT_CONFIRMED_CONFIDENCE, "medium"
    return False, round(sim, 3), match.confidence_band

# --- Budget guards -------------------------------------------------------
# Both scrapers run on free monthly allowances. Rather than discovering they're
# exhausted through a wall of 403s (and a red CI run every day until reset), the
# scan checks the remaining balance UP FRONT and skips that marketplace with a
# clear message. Skipping on an empty wallet is expected, not a failure.
APIFY_MONTHLY_BUDGET_USD = float(os.getenv("APIFY_MONTHLY_BUDGET_USD", "5"))
APIFY_RESERVE_USD = float(os.getenv("APIFY_RESERVE_USD", "0.40"))
# The Temu actor is PAY_PER_EVENT at $0.01 per dataset item (confirmed against
# its pricingInfos). Cost therefore scales with results returned, NOT with the
# number of queries: one query for 10 results costs the same as ten for one.
# That makes max_per_query the budget lever, and it makes the whole dragnet's
# cost predictable before a single request goes out.
APIFY_USD_PER_RESULT = float(os.getenv("APIFY_USD_PER_RESULT", "0.01"))


def amazon_cost_per_search() -> int:
    """Bright Data Web Unlocker bills 1 credit/request; ScraperAPI ~5 for Amazon."""
    if os.getenv("BRIGHTDATA_API_TOKEN"):
        return 1
    return int(os.getenv("CREDITS_PER_AMAZON_SEARCH", "5"))


def amazon_credits_left() -> int | None:
    """
    Remaining Amazon-scraper credits, or None when the balance can't be read
    (None means "unknown — go ahead"; only a confirmed-low balance skips).
    """
    if os.getenv("BRIGHTDATA_API_TOKEN"):
        # Bright Data exposes no simple free-credit balance endpoint, and the
        # allowance (5,000/month) is ~12x a 100-tribe sweep, so we don't gate on
        # it. Per-request failures still surface in failed_queries.
        return None
    key = os.getenv("SCRAPER_API_KEY")
    if not key:
        return 0
    try:
        import requests

        d = requests.get(
            f"http://api.scraperapi.com/account?api_key={key}", timeout=30
        ).json()
        return int(d.get("creditsLeft", 0))
    except Exception as e:  # noqa: BLE001
        print(f"  (couldn't read ScraperAPI balance: {e})")
        return None


def apify_usd_left() -> float | None:
    """Remaining Apify monthly credit, or None if it can't be read."""
    token = os.getenv("APIFY_TOKEN")
    if not token:
        return 0.0
    try:
        import requests

        d = requests.get(
            f"https://api.apify.com/v2/users/me/limits?token={token}", timeout=30
        ).json()["data"]
        used = float(d.get("current", {}).get("monthlyUsageUsd", 0.0))
        cap = float(d.get("limits", {}).get("maxMonthlyUsageUsd") or APIFY_MONTHLY_BUDGET_USD)
        return round(cap - used, 4)
    except Exception as e:  # noqa: BLE001
        print(f"  (couldn't read Apify balance: {e})")
        return None


def _query_terms_for(tribe_name: str) -> list[str]:
    """
    Two Amazon queries per tribe per sweep: "<tribe> flag" and "<tribe> seal".

    Budget math on Bright Data Web Unlocker (1 credit = 1 request, 5,000/month
    free), at one weekly sweep:
        50 tribes  x 2 =   400 credits/month  (8% of free tier)
        100 tribes x 2 =   800 credits/month  (16%)
        574 tribes x 2 = 4,592 credits/month  (92% — still inside)
    Thorough (every tribe, both merchandise types, every 7 days) while leaving
    most of the allowance spare for backfills.

    The bare "<tribe>" query is deliberately excluded: the diagnostic showed it
    returns books, t-shirts and unrelated goods, whereas "<tribe> flag" returned
    20 genuine flags. AMAZON_QUERY_KIND=flag|seal pins a single term for
    one-off manual backfills.
    """
    kind = os.getenv("AMAZON_QUERY_KIND", "").strip().lower()
    if kind in ("flag", "seal"):
        return [f"{tribe_name} {kind}"]
    return [f"{tribe_name} flag", f"{tribe_name} seal"]


def _tribes_with_reference_assets(client, name_filter: str | None) -> list[dict]:
    """Return tribes that have at least one reference asset with an embedding."""
    q = client.table("tribes").select("id, name, canonical_name, reference_assets(id, embedding, asset_type, description)")
    if name_filter:
        q = q.eq("name", name_filter)
    resp = q.execute()
    return [
        t for t in resp.data
        if any(a.get("embedding") for a in (t.get("reference_assets") or []))
    ]


def _upsert_listing(client, tribe_id: str, listing, image_embedding) -> str:
    """Upsert a listing row, returning its id."""
    payload = {
        "tribe_id": tribe_id,
        "marketplace": listing.marketplace,
        "marketplace_id": listing.marketplace_id,
        "title": listing.title,
        "seller": listing.seller,
        "price": listing.price,
        "listing_url": listing.listing_url,
        "image_url": listing.image_url,
        "image_embedding": image_embedding,
        "search_query": listing.search_query,
    }
    resp = (
        client.table("listings")
        .upsert(payload, on_conflict="marketplace,marketplace_id")
        .execute()
    )
    return resp.data[0]["id"]


def _upsert_match(client, listing_id: str, match) -> None:
    """Upsert a match row."""
    payload = {
        "listing_id": listing_id,
        "reference_asset_id": match.reference_asset_id,
        "confidence": round(match.confidence, 3),
        "confidence_band": match.confidence_band,
        "status": "awaiting_review",
    }
    client.table("matches").upsert(payload, on_conflict="listing_id,reference_asset_id").execute()


def _store(client, stats, tribe_id, listing, listing_emb, match, mp_label) -> None:
    stats["listings"] += 1
    try:
        listing_id = _upsert_listing(client, tribe_id, listing, listing_emb)
        _upsert_match(client, listing_id, match)
        stats["matches"] += 1
        stats[match.confidence_band] += 1
        print(
            f"  [{mp_label}/{match.confidence_band:6}] {match.confidence:.3f}  "
            f"{listing.title[:70]}"
        )
    except Exception as e:
        print(f"  DB write failed: {e}")


def run_amazon(client, tribes, max_per_query, stats) -> None:
    """Per-tribe Amazon scan (tribe name in the query, match vs that tribe)."""
    for tribe in tribes:
        stats["tribes"] += 1
        ref_assets = [a for a in (tribe.get("reference_assets") or []) if a.get("embedding")]
        print(f"=== {tribe['name']} ({len(ref_assets)} reference asset(s)) ===")

        for query in _query_terms_for(tribe["name"]):
            stats["queries"] += 1
            try:
                listings = amazon_search(query, fetch_sellers=False, max_results=max_per_query)
            except Exception as e:
                print(f"  [amazon] search failed: {e}")
                stats["failed_queries"] += 1
                continue

            for listing in listings:
                if not listing.image_url:
                    continue
                match, listing_emb = match_listing_image(listing.image_url, ref_assets)
                if not match:
                    continue
                store, conf, band = _evaluate(listing.title, tribe["name"], match)
                if not store:
                    stats["suppressed"] += 1
                    continue
                match.confidence, match.confidence_band = conf, band
                _store(client, stats, tribe["id"], listing, listing_emb, match, "amazon")

            time.sleep(0.5)  # polite pacing between queries


def run_temu_dragnet(client, tribes, max_per_query, stats, queries=None) -> None:
    """
    Generic Temu queries, matched against ALL tribes' reference assets.
    Each listing is assigned to the tribe whose asset it best matches.
    """
    all_assets: list[dict] = []
    tribe_by_asset: dict[str, dict] = {}
    for tribe in tribes:
        for a in tribe.get("reference_assets") or []:
            if a.get("embedding"):
                all_assets.append(a)
                tribe_by_asset[a["id"]] = tribe

    if queries is None:
        queries = dragnet_queries_for_today()
    print(f"=== Temu dragnet ({len(queries)} queries today, {len(all_assets)} reference assets) ===")

    for query in queries:
        stats["queries"] += 1
        try:
            listings = temu_search(query, max_results=max_per_query)
        except Exception as e:
            print(f"  [temu] search failed: {e}")
            stats["failed_queries"] += 1
            continue

        for listing in listings:
            if not listing.image_url:
                continue
            match, listing_emb = match_listing_image(listing.image_url, all_assets)
            if not match:
                continue
            tribe = tribe_by_asset[match.reference_asset_id]
            store, conf, band = _evaluate(listing.title, tribe["name"], match)
            if not store:
                stats["suppressed"] += 1
                continue
            match.confidence, match.confidence_band = conf, band
            _store(client, stats, tribe["id"], listing, listing_emb, match, "temu")

        time.sleep(0.5)


def run_scan(
    name_filter: str | None = None,
    max_per_query: int = 10,
    marketplace: str = "both",
) -> dict:
    client = get_client()
    tribes = _tribes_with_reference_assets(client, name_filter)
    print(f"Scanning with {len(tribes)} tribe(s) that have reference assets\n")
    print(f"  (storing matches with confidence >= {MATCH_MIN_CONFIDENCE:.2f})\n")

    stats = {"tribes": 0, "queries": 0, "failed_queries": 0, "listings": 0,
             "matches": 0, "high": 0, "medium": 0, "low": 0, "suppressed": 0}

    skipped: list[str] = []

    if marketplace in ("amazon", "both"):
        per_tribe = len(_query_terms_for("x"))  # queries issued per tribe
        need = len(tribes) * per_tribe * amazon_cost_per_search()
        left = amazon_credits_left()
        if left is not None and left < need:
            msg = (f"amazon SKIPPED — needs ~{need} ScraperAPI credits, {left} left "
                   f"(free allowance resets monthly)")
            print(f"\n{msg}\n")
            skipped.append(msg)
        else:
            print(f"\n=== Amazon sweep: {len(tribes)} tribe(s), ~{need} credits "
                  f"(balance {left if left is not None else '?'}) ===")
            run_amazon(client, tribes, max_per_query, stats)

    if marketplace in ("temu", "both"):
        # The dragnet matches across all tribes, so a single-tribe filter would
        # silently mis-scope it — only run when scanning every tribe.
        if name_filter:
            print("(skipping Temu dragnet: it always scans across all tribes)")
        else:
            # The browser backend costs nothing, so the Apify credit guard
            # would block a free run for no reason.
            if os.getenv("TEMU_BACKEND", "playwright").strip().lower() == "playwright":
                queries = dragnet_queries_for_today()
                print(f"\n=== Temu dragnet ({len(queries)} queries, local browser, $0) ===")
                run_temu_dragnet(client, tribes, max_per_query, stats, queries=queries)
                left_usd = None
            else:
                left_usd = apify_usd_left()
            # Cost the whole dragnet up front. Checking a flat reserve instead
            # let a run start with $0.45 left and spend $0.50, which is how the
            # balance reached -$0.34 and locked Temu out for the rest of the
            # cycle. Project it, and either the run fits or it does not start.
            queries = dragnet_queries_for_today() if left_usd is not None else []
            need_usd = round(len(queries) * max_per_query * APIFY_USD_PER_RESULT, 4)
            if left_usd is not None and left_usd < need_usd + APIFY_RESERVE_USD:
                msg = (f"temu SKIPPED — needs ~${need_usd} "
                       f"({len(queries)} queries x {max_per_query} results), "
                       f"${left_usd} left (free allowance resets monthly)")
                print(f"\n{msg}\n")
                skipped.append(msg)
            elif left_usd is not None:
                print(f"\n=== Temu dragnet (~${need_usd} of ${left_usd} available) ===")
                run_temu_dragnet(client, tribes, max_per_query, stats, queries=queries)

    print("\n=== Scan complete ===")
    try:
        from src.amazon_search import requests_made as _bd_used

        used = _bd_used()
        if used:
            print(f"  Bright Data credits used this run: {used} "
                  f"(free tier 5,000/month)")
    except Exception:  # noqa: BLE001
        pass
    print(
        f"  tribes scanned:   {stats['tribes']}\n"
        f"  queries run:      {stats['queries']}\n"
        f"  failed queries:   {stats['failed_queries']}\n"
        f"  listings stored:  {stats['listings']}\n"
        f"  HIGH matches:     {stats['high']}\n"
        f"  MEDIUM matches:   {stats['medium']}\n"
        f"  LOW matches:      {stats['low']}\n"
        f"  suppressed (noise below {MATCH_MIN_CONFIDENCE:.2f}): {stats['suppressed']}"
    )

    # A scan where every query failed is an outage (e.g. scraper credits
    # exhausted), not a success — exit non-zero so CI turns red.
    if stats["queries"] > 0 and stats["failed_queries"] == stats["queries"]:
        print("\nERROR: every search query failed — treat this scan as an outage.")
        raise SystemExit(1)

    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("tribe", nargs="?", default=None, help="Limit scan to one tribe by name")
    parser.add_argument("--max-per-query", type=int, default=10)
    parser.add_argument(
        "--marketplace",
        choices=["amazon", "temu", "both"],
        default="both",
        help="Which marketplace(s) to scan (default: both)",
    )
    args = parser.parse_args()
    run_scan(
        name_filter=args.tribe,
        max_per_query=args.max_per_query,
        marketplace=args.marketplace,
    )
