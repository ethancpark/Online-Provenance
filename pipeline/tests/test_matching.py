"""
The matching rules, pinned.

Every case here is a real listing that was in the database, or a real one that
had to keep working while the wrong ones were removed. They are the record of
what each rule is for — a rule that stops mattering should fail here first.

No dependencies. Run it directly:

    cd pipeline && python3 -m tests.test_matching
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.matching_rules import (  # noqa: E402
    _evaluate,
    _names_another_nation,
    _title_confirms,
    register_nations,
)
from src.temu_budget import Budget, BudgetExceeded  # noqa: E402


class FakeMatch:
    def __init__(self, confidence):
        self.confidence = confidence
        self.confidence_band = "high"


NATIONS = [
    "Chickasaw Nation", "Choctaw Nation of Oklahoma", "Osage Nation",
    "Navajo Nation", "Cherokee Nation", "Delaware Tribe of Indians",
    "Miami Tribe of Oklahoma", "Omaha Tribe of Nebraska", "Oneida Indian Nation",
    "Narragansett Indian Tribe", "Coeur d'Alene Tribe", "Ottawa Tribe of Oklahoma",
    "Mississippi Band of Choctaw Indians", "Blackfeet Tribe of the Blackfeet Indian Reservation",
    "Mandan, Hidatsa and Arikara Nation", "Pueblo of Sandia", "Apache Tribe of Oklahoma",
    "Cheyenne River Sioux Tribe", "Leech Lake Band of Ojibwe", "Pueblo of Laguna",
]

failures: list[str] = []


def check(name, got, want):
    if got != want:
        failures.append(f"{name}: got {got!r}, wanted {want!r}")
    print(f"  {'ok  ' if got == want else 'FAIL'} {name}")


def title_rule():
    print("\n-- the title path: a weak image score plus a corroborating title --")
    # Accepted: the title names the nation and the product type.
    for title, nation in [
        ("Large Flag Chickasaw Nation | flag | 3x5ft outdoor flag", "Chickasaw Nation"),
        ("Flag Of The Mississippi Choctaw Garden Flag 12x18in", "Mississippi Band of Choctaw Indians"),
        ("Durable Bandera Leech Lake Flags For Outside 3x5 Ft", "Leech Lake Band of Ojibwe"),
        ("Bandera Dels Laguna Flags for Outside 3x5 Ft", "Pueblo of Laguna"),
        ("POOEDSO Bandera Sandia Flags 3x5 Ft Outdoor Flag", "Pueblo of Sandia"),
        ("Flag of The Cheyenne River Sioux Tribe Headbands Athletic", "Cheyenne River Sioux Tribe"),
    ]:
        check(f"accepts {title[:44]!r}", _title_confirms(title, nation), True)

    # Another institution that happens to share the name.
    for title, nation in [
        ("Desert Cactus University of Delaware UD Flag 3x5 Ft", "Delaware Tribe of Indians"),
        ("Delaware State Seal (2 Pack) Vinyl Decal Sticker", "Delaware Tribe of Indians"),
        ("Briarwood Lane House Flag Miami Hurricanes NCAA Licensed", "Miami Tribe of Oklahoma"),
        ("W Republic Nebraska Omaha Mavericks Seal Hat NCAA Officially Licensed", "Omaha Tribe of Nebraska"),
        ("Coeur d'Alene Idaho Flag Souvenir Throw Pillow", "Coeur d'Alene Tribe"),
    ]:
        check(f"refuses {title[:44]!r}", _title_confirms(title, nation), False)

    # A place that shares the nation's name, with nothing tribal in the title.
    for title, nation in [
        ("Miami City Flag 3x5FT Heavy Duty Polyester", "Miami Tribe of Oklahoma"),
        ("Miami Pennant Full Size Felt", "Miami Tribe of Oklahoma"),
        ("Narragansett Rhode Island Vinyl Sticker Waterproof Decal", "Narragansett Indian Tribe"),
        ("Nebraska Omaha Pennant Full Size Felt", "Omaha Tribe of Nebraska"),
        ("Reminisce Jet Setters 2 3-Dimensional Sticker, Delaware", "Delaware Tribe of Indians"),
        ("Lake Coeur d'Alene Sticker for Hydroflask CDA Idaho", "Coeur d'Alene Tribe"),
    ]:
        check(f"refuses place {title[:40]!r}", _title_confirms(title, nation), False)

    # Naming the nation properly rescues the same word.
    check("accepts 'Flag of the Miami Tribe of Oklahoma'",
          _title_confirms("Flag of the Miami Tribe of Oklahoma 3x5", "Miami Tribe of Oklahoma"), True)


def image_veto():
    print("\n-- a title naming another institution beats any image score --")
    for title, nation, sim in [
        ("Anley Fly Breeze 3x5 Foot Oklahoma State Flag", "Ottawa Tribe of Oklahoma", 0.63),
        ("G128 Oklahoma OK State Flag 3x5 Ft", "Ottawa Tribe of Oklahoma", 0.60),
        ("Desert Cactus University of Delaware UD Flag", "Delaware Tribe of Indians", 0.85),
    ]:
        check(f"vetoes at sim={sim} {title[:34]!r}",
              _evaluate(title, nation, FakeMatch(sim))[0], False)

    # "Souvenir" must not veto: a souvenir shop selling a seal is the target.
    check("keeps a Navajo souvenir sticker at 0.80",
          _evaluate("Navajo Nation Souvenir Sticker Pack", "Navajo Nation", FakeMatch(0.80))[0], True)
    check("keeps the Chickasaw seal at 0.90",
          _evaluate("Great Seal of the Chickasaw Nation Flag", "Chickasaw Nation", FakeMatch(0.90))[0], True)


def cross_nation():
    print("\n-- one nation's mark is not another's to claim --")
    register_nations(NATIONS)
    for title, holder, rightful in [
        ("1pc Chickasaw Nation Great Seal Flag 3x5ft", "Mississippi Band of Choctaw Indians", "Chickasaw Nation"),
        ("Flag of the Oneida Nation Made of Polyester", "Mississippi Band of Choctaw Indians", "Oneida Indian Nation"),
        ("2D Printed Mandan, Hidatsa, And Arikara Tribal Flags",
         "Blackfeet Tribe of the Blackfeet Indian Reservation", "Mandan, Hidatsa and Arikara Nation"),
    ]:
        check(f"spots {rightful} in {title[:30]!r}",
              _names_another_nation(title, holder), rightful)
        check(f"refuses it for {holder[:26]}",
              _evaluate(title, holder, FakeMatch(0.71))[0], False)

    check("the rightful nation still keeps it",
          _evaluate("1pc Chickasaw Nation Great Seal Flag 3x5ft", "Chickasaw Nation", FakeMatch(0.71))[0], True)
    check("a title naming nobody is unaffected",
          _names_another_nation("Great Seal Flag 3x5ft Outdoor Banner", "Osage Nation"), None)


def spend_guard():
    print("\n-- the scraper stops rather than spending into a wall --")
    b = Budget(max_requests=3, max_consecutive_failures=99)
    n = 0
    try:
        while True:
            b.check(); b.spent(ok=True); n += 1
    except BudgetExceeded:
        pass
    check("stops at the request allowance", n, 3)

    b = Budget(max_requests=100, max_consecutive_failures=3)
    n = 0
    try:
        while True:
            b.check(); b.spent(ok=False); n += 1
    except BudgetExceeded:
        pass
    check("trips the breaker after 3 blocked pages", n, 3)

    b = Budget(max_requests=100, max_consecutive_failures=3)
    b.spent(ok=False); b.spent(ok=False); b.spent(ok=True)
    try:
        b.check()
        ok = True
    except BudgetExceeded:
        ok = False
    check("a success resets the streak", ok, True)


if __name__ == "__main__":
    title_rule()
    image_veto()
    cross_nation()
    spend_guard()
    print()
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  {f}")
        raise SystemExit(1)
    print("all matching rules hold")
