"""
USPTO trademark lookup for tribal marks.

The USPTO's public search (tmsearch.uspto.gov) is a JavaScript SPA with no
stable public REST API. This module provides:
  1. A pre-built direct search URL per tribe (click-to-verify in the report)
  2. A known-registrations map for the most prominent tribes (manually verified)
  3. Graceful "check manually" fallback for all others

To look up programmatically in a future version, download the USPTO bulk
trademark dataset from bulkdata.uspto.gov and parse locally.
"""

import urllib.parse

TMSEARCH_BASE = "https://tmsearch.uspto.gov/search/search-information"

# Tribes confirmed to hold USPTO-registered marks (based on public record).
# status: "registered" | "pending" | "unknown"
KNOWN_MARKS: dict[str, dict] = {
    "Navajo Nation": {
        "status": "registered",
        "notes": "Multiple registrations including seal and word marks",
    },
    "Cherokee Nation": {
        "status": "registered",
        "notes": "Registered word and logo marks",
    },
    "Choctaw Nation of Oklahoma": {
        "status": "registered",
        "notes": "Registered marks including seal",
    },
    "Chickasaw Nation": {
        "status": "registered",
        "notes": "Registered word and design marks",
    },
    "Seminole Tribe of Florida": {
        "status": "registered",
        "notes": "Multiple registrations; licensor of Hard Rock brand",
    },
    "Oneida Indian Nation": {
        "status": "registered",
        "notes": "Registered marks for gaming and other enterprises",
    },
    "Eastern Band of Cherokee Indians": {
        "status": "registered",
        "notes": "Registered marks for tourism and gaming",
    },
    "Ho-Chunk Nation of Wisconsin": {
        "status": "registered",
        "notes": "Registered word marks",
    },
    "Tohono O'odham Nation": {
        "status": "registered",
        "notes": "Registered marks for gaming enterprises",
    },
    "Gila River Indian Community": {
        "status": "registered",
        "notes": "Registered marks",
    },
}


def _build_search_url(tribe_name: str) -> str:
    """Build a direct tmsearch.uspto.gov URL for a tribe name."""
    params = urllib.parse.urlencode({"searchInput": tribe_name, "searchType": "basic"})
    return f"{TMSEARCH_BASE}?{params}"


def lookup_trademark(tribe: dict) -> dict:
    """
    Returns trademark info for a tribe. Uses the known-marks map where
    available; falls back to 'unknown' with a manual-check URL.
    """
    name = tribe["name"]
    canonical = tribe.get("canonical_name", name)

    known = KNOWN_MARKS.get(name) or KNOWN_MARKS.get(canonical)

    if known:
        return {
            "tribe_name": name,
            "has_registered_mark": known["status"] == "registered",
            "status": known["status"],
            "notes": known.get("notes", ""),
            "search_url": _build_search_url(name),
            "source": "known_registrations",
        }

    return {
        "tribe_name": name,
        "has_registered_mark": False,
        "status": "unknown",
        "notes": "Trademark status not confirmed. Verify via the search URL.",
        "search_url": _build_search_url(name),
        "source": "manual_check_required",
    }


def lookup_all_trademarks(tribes: list[dict]) -> dict:
    """
    Returns trademark info for all tribes, keyed by canonical_name.
    No network calls — instant.
    """
    results = {}
    confirmed = 0
    for tribe in tribes:
        key = tribe.get("canonical_name", tribe["name"])
        info = lookup_trademark(tribe)
        results[key] = info
        if info["status"] == "registered":
            confirmed += 1

    print(
        f"  Trademark lookup complete: {confirmed} confirmed registrations, "
        f"{len(tribes) - confirmed} require manual verification."
    )
    return results


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    from src.tribes import get_top50_tribes

    tribes = get_top50_tribes()
    results = lookup_all_trademarks(tribes)
    for key, info in results.items():
        mark = "REGISTERED" if info["has_registered_mark"] else info["status"].upper()
        print(f"  [{mark:10}] {info['tribe_name']}")
