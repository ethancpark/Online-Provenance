"""
The matching rules: which listing belongs to which nation, and whether it
belongs to anyone.

Split out of run_scan so it can be reasoned about — and tested — without the
scanner. run_scan reaches CLIP through image_matcher, so importing it drags in
torch and open_clip; these rules are string work and should not need two
gigabytes of machine learning to exercise.

Everything here is pure. No network, no database, no model.
"""

import os
import re

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


# Names whose dominant meaning is a place that is not the nation. When a
# nation's identifying tokens rest on one of these, the name in a title is not
# evidence on its own: "Miami City Flag", "Narragansett Rhode Island Sticker"
# and "Coeur d'Alene Idaho T-Shirt" all name the city, not the tribe.
#
# Pueblo names where the pueblo IS the place — Sandia, Jemez, San Carlos — are
# deliberately absent, or a genuine "Bandera Sandia Flags" would be thrown out.
# Tribal-family words are absent too; the test below already recognises them.
_SHARED_PLACE_NAMES = {
    "delaware", "miami", "omaha", "ottawa", "peoria", "seneca", "cheyenne",
    "wichita", "kansas", "iowa", "narragansett", "coeur", "alene", "modoc",
    "yuma", "tacoma", "tulsa", "biloxi",
}

# Something in the title that says this is a Tribal item at all.
_TRIBAL_CONTEXT_RE = re.compile(
    r"\b(tribes?|tribal|nations?|indian|indians|indigenous|native|band|bands|"
    r"pueblo|rancheria|reservation|chippewa|ojibwe|sioux|choctaw|chickasaw|creek|"
    r"muscogee|seminole|navajo|paiute|shoshone|pomo|yakama|potawatomi|odawa|"
    r"oneida|laguna|cherokee|apache|comanche|kiowa|osage|ponca|pawnee|arapaho|"
    r"blackfeet)\b",
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
    if not all(w in toks for w in need):
        return False

    # A nation named after a place it shares needs the title to say, somewhere,
    # that this is a Tribal item. Without that, "Miami Pennant" and "Nebraska
    # Omaha Mavericks Banner" satisfy every other test.
    if any(tok in _SHARED_PLACE_NAMES for tok in need):
        return bool(_TRIBAL_CONTEXT_RE.search(title))
    return True


# A title that names another institution outright. Unlike _RIVAL_ENTITY_RE,
# which only weighs in when the name matched, this vetoes a strong image score
# too: CLIP scored the Oklahoma state flag at 0.60-0.63 against the Ottawa
# Tribe's reference, and a listing called "Oklahoma State Flag" is not that
# nation's mark however similar the picture looks.
#
# "Souvenir" is deliberately not here. A souvenir shop selling a tribal seal is
# exactly the infringement this tool is looking for.
_NOT_A_TRIBAL_MARK_RE = re.compile(
    r"\b(state\s+flag|state\s+seal|universit(?:y|ies)|college|collegiate|ncaa)\b",
    re.I,
)


# Every monitored nation's identifying tokens, filled in at the start of a scan
# by register_nations(). Empty outside a scan, and the check below then does
# nothing, so importing this module in isolation stays safe.
_NATION_SIGNATURES: dict[str, list[str]] = {}


def register_nations(names) -> None:
    """Tell the matcher which nations exist, so it can spot a title naming
    somebody else's mark."""
    _NATION_SIGNATURES.clear()
    for n in names:
        sig = _name_tokens(n)[:2]
        if sig:
            _NATION_SIGNATURES[n] = sig


def _names_another_nation(title: str, tribe_name: str) -> str | None:
    """The nation this title actually names, when that is not this one.

    The worst thing this tool can do is handed a nation a notice for somebody
    else's mark: "Chickasaw Nation Great Seal Flag" was filed under Mississippi
    Band of Choctaw, and a Mandan, Hidatsa and Arikara flag under Blackfeet.
    Both are real infringements — of a different nation's seal, which this
    nation has no standing to swear to.
    """
    if not title or not _NATION_SIGNATURES:
        return None
    toks = set(re.sub(r"[^a-z0-9 ]", " ", title.lower()).split())
    mine = _NATION_SIGNATURES.get(tribe_name) or []
    if mine and all(w in toks for w in mine):
        return None  # it names this nation; that is the ordinary case
    for other, sig in _NATION_SIGNATURES.items():
        if other != tribe_name and all(w in toks for w in sig):
            return other
    return None


def _evaluate(title: str, tribe_name: str, match):
    """(store?, confidence, band): image-only path or title-confirmed path."""
    sim = match.confidence
    # Checked before the image path, so a picture that merely resembles the
    # mark cannot carry a listing that says in words it belongs to someone else.
    if title and _NOT_A_TRIBAL_MARK_RE.search(title):
        return False, round(sim, 3), match.confidence_band
    # Somebody else's seal, however well it matched this nation's reference.
    other = _names_another_nation(title, tribe_name)
    if other:
        return False, round(sim, 3), match.confidence_band
    if sim >= IMAGE_ONLY_MIN:
        return True, round(sim, 3), match.confidence_band
    if sim >= IMAGE_TEXT_FLOOR and _title_confirms(title, tribe_name):
        return True, TEXT_CONFIRMED_CONFIDENCE, "medium"
    return False, round(sim, 3), match.confidence_band
