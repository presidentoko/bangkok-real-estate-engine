"""One-off repair: collapse the punctuation variants of regions.name and
condos.province that split every district into 2-3 parallel rows.

WHY
---
`regions.name` and `condos.province` are both free text written by
db.upsert_region()/upsert_condo() straight from scraper output, and the
portals spell the same district three different ways. Measured 2026-08-13:

  * regions holds 266 rows for ~154 real districts. 66 districts exist under
    2-3 names each ("Bang Rak" / "Bang-rak" / "bang-rak") = 178 rows.
  * Condos scatter across those parallel rows, so a district page renders
    whichever fragment it resolved and silently omits the rest: Khlong Toei
    shows 205 of its 411 condos, Pathum Wan 144 of 264. Across all split
    districts 2,513 of 8,486 condos (29.6%) are invisible on their own page.
  * recompute_region_averages() aggregates per region_id, so avg_price_per_sqm
    -- the denominator of bubble_index, i.e. the "priced X% above district
    average" line that is the site's whole differentiator -- is computed over
    an arbitrary fragment of each district.
  * app/sitemap-areas.xml emits encodeURIComponent(name.toLowerCase()), so a
    space variant publishes as /district/pathum%20wan while the hyphen
    variant publishes /district/pathum-wan. Both return 200, both carry
    identical content, and each self-canonicalises -- which is what GSC
    reports as "Duplicate, Google chose different canonical" (393 pages) and
    "Alternate page with proper canonical" (1,219).

WHAT THIS DOES
--------------
Formatting only. It lowercases and converts runs of whitespace/underscore to
a single hyphen, then merges rows that collide under that rule. It does NOT
remap one place onto another: "surat-thani" is left alone rather than folded
into "samui", because those are genuinely different administrative units even
though web/lib/cities.ts happens to display them together.

The one non-punctuation equivalence applied is PROVINCE_ALIASES below, which
collapses spelling variants of a single name ("ko-samui" -> "samui", "ko" is
just Thai for island). Every target there is already a value that
web/lib/cities.ts's CITY_PROVINCE_ALIASES recognises, so the site keeps
resolving these condos to the same city page it does today.

SAFETY
------
* Dry-run by default. Pass --apply to write.
* Writes a full JSON backup of every row it will touch before the first write.
* Idempotent: re-running after a successful pass is a no-op.
* condos.region_id is the ONLY foreign key into regions (schema.sql:24,
  "on delete set null"), so repointing condos and then deleting the losing
  region rows is the complete merge.

Usage:
    python scripts/normalize_regions_and_provinces.py            # dry run
    python scripts/normalize_regions_and_provinces.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.db import get_client, fetch_all  # noqa: E402

# Spelling variants of one province name -> the value web/lib/cities.ts
# already lists in CITY_PROVINCE_ALIASES. Applied AFTER punctuation
# normalisation, so "chiang mai" has already become "chiang-mai" by the time
# it is looked up here.
PROVINCE_ALIASES = {
    "chiang-mai": "chiangmai",
    "chiang-rai": "chiangrai",
    "hua-hin": "huahin",
    "chon-buri": "chonburi",
    "ko-samui": "samui",
    "koh-samui": "samui",
}


def norm_text(value: str | None) -> str:
    """Lowercase; collapse whitespace/underscore/hyphen runs to one hyphen."""
    return re.sub(r"[\s_-]+", "-", (value or "").strip().lower())


def norm_province(value: str | None) -> str:
    base = norm_text(value)
    return PROVINCE_ALIASES.get(base, base)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually write (default: dry run)")
    args = ap.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    client = get_client()

    regions = fetch_all(client, "regions", "id, name, province")
    condos = fetch_all(client, "condos", "id, region_id, province")
    print(f"loaded {len(regions)} regions, {len(condos)} condos\n")

    # ---- plan region merges -------------------------------------------------
    # Group on the normalised NAME alone, not (name, province).
    #
    # Grouping by both looked safer — it would refuse to conflate two
    # same-named districts in different provinces — but regions.name carries a
    # global UNIQUE constraint (schema.sql:10), so that pairing cannot exist in
    # the first place, and trying to normalise two rows onto one name raised
    # 23505 duplicate key ... (name)=(mueang-surat-thani) partway through the
    # first --apply run. Where the province differs it is because the province
    # column itself has variants at different granularity ("surat-thani" vs
    # "samui" for the same district, Hua Hin recorded under both "huahin" and
    # its actual province "prachuap-khiri-khan"), so collapsing them is right.
    # The surviving row keeps the province of whichever variant holds the most
    # condos.
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in regions:
        groups[norm_text(r["name"])].append(r)

    condos_per_region: dict[str, int] = defaultdict(int)
    for c in condos:
        if c.get("region_id"):
            condos_per_region[c["region_id"]] += 1

    # winner = most condos (tie -> lowest id, for a deterministic re-run)
    remap: dict[str, str] = {}          # loser region id -> winner region id
    rename: dict[str, tuple[str, str]] = {}  # winner id -> (new name, new province)
    doomed: list[dict] = []
    for nname, rows in groups.items():
        winner = sorted(rows, key=lambda r: (-condos_per_region[r["id"]], r["id"]))[0]
        nprov = norm_province(winner.get("province"))
        for r in rows:
            if r["id"] != winner["id"]:
                remap[r["id"]] = winner["id"]
                doomed.append(r)
        if winner["name"] != nname or (winner.get("province") or "") != nprov:
            rename[winner["id"]] = (nname, nprov)

    # ---- plan province rewrites --------------------------------------------
    condo_prov_updates: dict[str, list[str]] = defaultdict(list)  # new province -> condo ids
    for c in condos:
        new = norm_province(c.get("province"))
        if new and new != (c.get("province") or ""):
            condo_prov_updates[new].append(c["id"])

    condo_region_updates: dict[str, list[str]] = defaultdict(list)  # winner id -> condo ids
    for c in condos:
        rid = c.get("region_id")
        if rid and rid in remap:
            condo_region_updates[remap[rid]].append(c["id"])

    # ---- report -------------------------------------------------------------
    print(f"region groups                     : {len(groups)}  (from {len(regions)} rows)")
    print(f"region rows to delete after merge : {len(doomed)}")
    print(f"region rows to rename/normalise   : {len(rename)}")
    print(f"condos to repoint to a new region : {sum(len(v) for v in condo_region_updates.values())}")
    print(f"condos to get a normalised province: {sum(len(v) for v in condo_prov_updates.values())}")
    print()
    print("province rewrites:")
    for new, ids in sorted(condo_prov_updates.items(), key=lambda kv: -len(kv[1])):
        olds = sorted({c.get("province") for c in condos if c["id"] in set(ids)})
        print(f"  {str(olds):<46} -> {new:<14} ({len(ids)} condos)")
    print()
    print("largest merges (condos recovered onto one district page):")
    ranked = sorted(condo_region_updates.items(), key=lambda kv: -len(kv[1]))[:12]
    id2name = {r["id"]: r["name"] for r in regions}
    for wid, ids in ranked:
        print(f"  {id2name.get(wid, wid):<28} +{len(ids):>4} condos merged in")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
        return 0

    # ---- backup -------------------------------------------------------------
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = Path(__file__).resolve().parents[1] / f"backup_regions_{stamp}.json"
    backup.write_text(
        json.dumps({"regions": regions, "condos": condos}, indent=2),
        encoding="utf-8",
    )
    print(f"\nbackup written: {backup}")

    # ---- write --------------------------------------------------------------
    # Order matters: repoint condos off the losing rows BEFORE deleting them,
    # or the FK's "on delete set null" would strand those condos with no
    # region at all. Rename last, since regions.name carries a UNIQUE
    # constraint that the losing rows would otherwise collide with.
    for new_prov, ids in condo_prov_updates.items():
        for i in range(0, len(ids), 200):
            client.table("condos").update(
                {"province": new_prov}, returning="minimal"
            ).in_("id", ids[i:i + 200]).execute()
    print(f"provinces normalised on {sum(len(v) for v in condo_prov_updates.values())} condos")

    for winner_id, ids in condo_region_updates.items():
        for i in range(0, len(ids), 200):
            client.table("condos").update(
                {"region_id": winner_id}, returning="minimal"
            ).in_("id", ids[i:i + 200]).execute()
    print(f"region_id repointed on {sum(len(v) for v in condo_region_updates.values())} condos")

    doomed_ids = [r["id"] for r in doomed]
    for i in range(0, len(doomed_ids), 200):
        client.table("regions").delete(returning="minimal").in_(
            "id", doomed_ids[i:i + 200]
        ).execute()
    print(f"deleted {len(doomed_ids)} duplicate region rows")

    for winner_id, (nname, nprov) in rename.items():
        client.table("regions").update(
            {"name": nname, "province": nprov}, returning="minimal"
        ).eq("id", winner_id).execute()
    print(f"normalised name/province on {len(rename)} surviving region rows")

    # Averages are keyed on region_id, so every merged district's denominator
    # is stale until this runs.
    client.rpc("recompute_region_averages", {}).execute()
    print("recompute_region_averages() done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
