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

# USPTO.gov has no deep-linkable search: the modern TMSearch is an Angular SPA
# that loads blank from a URL (it ignores query params), and the old TESS is
# retired. So for tribes WITHOUT a specific registered seal we link to Justia's
# trademark mirror, which renders the real USPTO record listing (mark images,
# serial numbers, status) and actually loads from a URL.
JUSTIA_SEARCH_BASE = "https://trademarks.justia.com/search"

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
    "Osage Nation": {
        "status": "registered",
        "notes": "Registered seal mark",
    },
}

# Tribes whose actual seal mark we can deep-link to the specific USPTO record.
# These are the marks that correspond to the seal image we match against.
# serial = USPTO serial number; reg = registration number (if registered).
SEAL_MARKS: dict[str, dict] = {
    "Navajo Nation": {"serial": "90877301", "mark": "GREAT SEAL OF THE NAVAJO NATION"},
    "Choctaw Nation of Oklahoma": {
        "serial": "78139345",
        "mark": "THE GREAT SEAL OF THE CHOCTAW NATION",
    },
    "Chickasaw Nation": {
        "serial": "89000957",
        "mark": "THE GREAT SEAL OF THE CHICKASAW NATION",
    },
    "Eastern Band of Cherokee Indians": {
        "serial": "75481065",
        "reg": "2308610",
        "mark": "SEAL OF THE EASTERN BAND OF THE CHEROKEE NATION",
    },
    "Osage Nation": {
        "serial": "77860702",
        "reg": "3855869",
        "mark": "SEAL OF OSAGE NATION",
    },
}

# Official USPTO TSDR deep link — loads the specific case by serial number.
TSDR_BASE = "https://tsdr.uspto.gov/"


def _build_search_url(tribe_name: str) -> str:
    """Build a Justia trademark-search URL listing the tribe's USPTO records."""
    params = urllib.parse.urlencode({"q": tribe_name})
    return f"{JUSTIA_SEARCH_BASE}?{params}"


def _build_record_url(serial: str) -> str:
    """Deep link to a specific trademark record in USPTO TSDR by serial number."""
    return f"{TSDR_BASE}#caseNumber={serial}&caseType=SERIAL_NO&searchType=statusSearch"


def lookup_trademark(tribe: dict) -> dict:
    """
    Returns trademark info for a tribe. Uses the known-marks map where
    available; falls back to 'unknown' with a manual-check URL.
    """
    name = tribe["name"]
    canonical = tribe.get("canonical_name", name)

    known = KNOWN_MARKS.get(name) or KNOWN_MARKS.get(canonical)
    seal = SEAL_MARKS.get(name) or SEAL_MARKS.get(canonical)

    # Best case: we know the tribe's specific seal mark — deep-link to that exact
    # USPTO record instead of a generic search.
    if seal:
        notes = f'{seal["mark"]} — USPTO Serial No. {seal["serial"]}'
        if seal.get("reg"):
            notes += f' (Reg. No. {seal["reg"]})'
        return {
            "tribe_name": name,
            "has_registered_mark": bool(seal.get("reg")) or (known and known["status"] == "registered"),
            "status": "registered" if seal.get("reg") else (known["status"] if known else "filed"),
            "notes": notes,
            "search_url": _build_record_url(seal["serial"]),
            "uspto_serial": seal["serial"],
            "source": "seal_record",
        }

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
        "notes": "No registered seal mark on file. Use the search to verify.",
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
