"""
Remove stored matches the title rule no longer accepts.

The title-confirmation rule accepts a weak image score when a listing's title
names the tribe and says "flag" or "seal". 56 of 132 nations reduce to a single
distinctive token, and 16 of those are also a US state, city or university — so
"University of Delaware Flag" satisfied both halves and was filed as a Delaware
Tribe of Indians infringement. Every one of that nation's flagged listings was
the state, the college or its football team.

run_scan now rejects those titles, but only for listings it sees again. The
rows already in the table stay until a sweep re-evaluates them, and until then
a nation opening its dashboard sees merchandise that has nothing to do with it.

This applies the same rule to what is already stored. It only touches matches
that came through the title path — a strong image match is left alone, whatever
its title says, because that is a different claim.

    python3 -m scripts.prune_misattributed_matches            # report only
    python3 -m scripts.prune_misattributed_matches --apply    # delete

Every removed row is appended to scripts/pruned_matches.json, never
overwritten — a second run must not erase the record of the first.
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.db import get_client  # noqa: E402

# Imported from run_scan so this cannot drift from what the scanner does.
from scripts.run_scan import (  # noqa: E402
    TEXT_CONFIRMED_CONFIDENCE,
    _NOT_A_TRIBAL_MARK_RE,
    _names_another_nation,
    _title_confirms,
    register_nations,
)

BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pruned_matches.json")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually delete")
    args = ap.parse_args()

    client = get_client()
    # The cross-nation check needs to know every nation that exists, not just
    # the ones with matches.
    register_nations(
        [t["name"] for t in (client.table("tribes").select("name").execute().data or [])]
    )
    # PostgREST caps a response at 1000 rows, so a single select silently reads
    # only the first page and the prune would miss everything past it.
    rows = []
    page = 0
    PAGE = 1000
    while True:
        batch = (
            client.table("matches")
            .select(
                "id, confidence, "
                "listings!inner(title, tribe_id, listing_url, tribes!inner(name))"
            )
            .range(page * PAGE, page * PAGE + PAGE - 1)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        page += 1
    print(f"{len(rows)} matches in the table (read in {page + 1} page(s))")

    doomed = []
    for m in rows:
        listing = m.get("listings") or {}
        title = listing.get("title") or ""
        nation = ((listing.get("tribes") or {}) or {}).get("name", "")
        if not nation:
            continue

        # The stored confidence says which path let the match in, and each has
        # its own test. A title-confirmed row carries the fixed 0.72, so its
        # original image score is gone and only the title can be re-judged.
        title_path = abs(float(m["confidence"]) - TEXT_CONFIRMED_CONFIDENCE) <= 1e-6
        if title_path:
            rejected = not _title_confirms(title, nation)
        else:
            # An image match stands on its own unless the title names another
            # institution outright.
            rejected = bool(_NOT_A_TRIBAL_MARK_RE.search(title))
        # Either way: a title naming a different nation's mark is that nation's
        # to act on, not this one's.
        if not rejected and _names_another_nation(title, nation):
            rejected = True

        if rejected:
            doomed.append({
                "id": m["id"],
                "nation": nation,
                "title": title,
                "listing_url": listing.get("listing_url"),
                "confidence": m["confidence"],
            })

    if not doomed:
        print("nothing to prune — no stored match trips the rival-entity rule")
        return 0

    by_nation: dict[str, int] = {}
    for d in doomed:
        by_nation[d["nation"]] = by_nation.get(d["nation"], 0) + 1

    print(f"\n{len(doomed)} match(es) would be removed, across {len(by_nation)} nation(s):\n")
    for nation, n in sorted(by_nation.items(), key=lambda x: -x[1]):
        print(f"  {n:>3}  {nation}")
    print("\nsample:")
    for d in doomed[:8]:
        print(f"  [{d['nation'][:26]:26}] {d['title'][:76]}")

    if not args.apply:
        print("\nreport only — re-run with --apply to delete")
        return 0

    # Append. Overwriting would destroy the record of an earlier prune, which
    # is the one thing this file exists for.
    existing = []
    if os.path.exists(BACKUP):
        try:
            with open(BACKUP) as fh:
                existing = json.load(fh)
        except Exception:  # noqa: BLE001
            existing = []
    with open(BACKUP, "w") as fh:
        json.dump(existing + doomed, fh, indent=2)
    print(f"\nappended {len(doomed)} row(s) to {BACKUP} ({len(existing) + len(doomed)} total)")

    removed = 0
    for d in doomed:
        client.table("matches").delete().eq("id", d["id"]).execute()
        removed += 1
    print(f"deleted {removed} match(es)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
