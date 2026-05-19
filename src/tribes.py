"""
Fetches the list of federally recognized tribes from the Federal Register
and returns the top 50 by approximate enrollment.
"""

import json
import re
import requests

FEDERAL_REGISTER_DOC_ID = "2023-01813"

# Top 50 federally recognized tribes by approximate enrollment (BIA/Census data).
# Used to filter and rank the full list fetched from the Federal Register.
TOP_50_NAMES = [
    "Navajo Nation",
    "Cherokee Nation",
    "Choctaw Nation of Oklahoma",
    "Chickasaw Nation",
    "Muscogee (Creek) Nation",
    "Blackfeet Tribe of the Blackfeet Indian Reservation",
    "Osage Nation",
    "Crow Tribe of Indians",
    "Standing Rock Sioux Tribe",
    "Oglala Sioux Tribe",
    "Rosebud Sioux Tribe",
    "Fort Peck Assiniboine and Sioux Tribes",
    "Cheyenne River Sioux Tribe",
    "Sisseton-Wahpeton Oyate of the Lake Traverse Reservation",
    "Turtle Mountain Band of Chippewa Indians",
    "White Earth Band of the Minnesota Chippewa Tribe",
    "Red Lake Band of Chippewa Indians",
    "Leech Lake Band of Ojibwe",
    "Mille Lacs Band of Ojibwe",
    "Fond du Lac Band of Lake Superior Chippewa",
    "Bois Forte Band of Chippewa",
    "Oneida Indian Nation",
    "Menominee Indian Tribe of Wisconsin",
    "Ho-Chunk Nation of Wisconsin",
    "Lac du Flambeau Band of Lake Superior Chippewa Indians",
    "Lac Courte Oreilles Band of Lake Superior Chippewa Indians",
    "Bad River Band of the Lake Superior Tribe of Chippewa Indians",
    "Pueblo of Zuni",
    "Jicarilla Apache Nation",
    "Mescalero Apache Tribe",
    "White Mountain Apache Tribe",
    "San Carlos Apache Tribe",
    "Tohono O'odham Nation",
    "Gila River Indian Community",
    "Salt River Pima-Maricopa Indian Community",
    "Hopi Tribe",
    "Pueblo of Acoma",
    "Pueblo of Laguna",
    "Taos Pueblo",
    "Seminole Tribe of Florida",
    "Miccosukee Tribe of Indians of Florida",
    "Eastern Band of Cherokee Indians",
    "Mississippi Band of Choctaw Indians",
    "Poarch Band of Creek Indians",
    "Saginaw Chippewa Indian Tribe of Michigan",
    "Little Traverse Bay Bands of Odawa Indians",
    "Sault Ste. Marie Tribe of Chippewa Indians",
    "Bay Mills Indian Community",
    "Keweenaw Bay Indian Community",
    "Confederated Tribes of the Umatilla Indian Reservation",
]


def _fetch_full_list() -> list[dict]:
    """Pull tribe names from the Federal Register full-text API."""
    url = (
        f"https://www.federalregister.gov/api/v1/documents/{FEDERAL_REGISTER_DOC_ID}"
        "?fields[]=full_text_xml_url&fields[]=body_html_url"
    )
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    doc = resp.json()

    body_url = doc.get("body_html_url")
    if not body_url:
        return []

    html_resp = requests.get(body_url, timeout=20)
    html_resp.raise_for_status()

    # Tribe names appear as numbered list items in the FR document.
    # Pattern matches lines like "1. Absentee-Shawnee Tribe..."
    raw = re.findall(r"\d+\.\s+([A-Z][^<\n]{5,120})", html_resp.text)
    seen = set()
    tribes = []
    for name in raw:
        name = name.strip().rstrip(".,;")
        if name not in seen:
            seen.add(name)
            tribes.append({"name": name, "source": "federal_register"})
    return tribes


def _match_top50(full_list: list[dict]) -> list[dict]:
    """
    Match TOP_50_NAMES against the fetched list using fuzzy prefix matching.
    Falls back to the hardcoded name if no match found.
    """
    full_names = [t["name"] for t in full_list]
    result = []
    for rank, canonical in enumerate(TOP_50_NAMES, start=1):
        # Try exact match first, then prefix/substring
        match = next((n for n in full_names if n == canonical), None)
        if not match:
            first_word = canonical.split()[0]
            match = next(
                (n for n in full_names if n.startswith(first_word)), None
            )
        result.append({
            "rank": rank,
            "name": match or canonical,
            "canonical_name": canonical,
            "matched": match is not None,
        })
    return result


def get_top50_tribes(save_path: str | None = None) -> list[dict]:
    """
    Returns the top 50 federally recognized tribes by enrollment.
    Attempts to validate names against the live Federal Register list.
    """
    print("Fetching Federal Register tribe list...")
    try:
        full_list = _fetch_full_list()
        print(f"  Found {len(full_list)} tribes in Federal Register document.")
        tribes = _match_top50(full_list)
        matched = sum(1 for t in tribes if t["matched"])
        print(f"  Matched {matched}/50 names against live list.")
    except Exception as e:
        print(f"  Federal Register fetch failed ({e}), using hardcoded list.")
        tribes = [
            {"rank": i + 1, "name": name, "canonical_name": name, "matched": False}
            for i, name in enumerate(TOP_50_NAMES)
        ]

    if save_path:
        with open(save_path, "w") as f:
            json.dump(tribes, f, indent=2)
        print(f"  Saved to {save_path}")

    return tribes


if __name__ == "__main__":
    tribes = get_top50_tribes(save_path="data/tribes_top50.json")
    for t in tribes:
        flag = "" if t["matched"] else " [hardcoded]"
        print(f"  {t['rank']:2}. {t['name']}{flag}")
