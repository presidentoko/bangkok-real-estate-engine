"""The substance bar, shared by every script that asks Google for a page.

Python mirror of `hasIndexableSubstance()` in web/lib/condoIndexability.ts,
which is the authority — read the reasoning there. This file exists because
two scripts had each grown their own copy, and on 2026-10-25 one of them
(submit_indexnow.py) was still pushing URLs the site had already started
serving as `noindex` because only the TypeScript copy had been updated.

Keep this in step with the TypeScript. If the bar moves, it moves here and
there, together.
"""
from __future__ import annotations

SELECT = (
    "active_listings_count, market_sale_median, market_rent_median, "
    "gross_yield_pct, description"
)

#: Below this, a description is a scraped fragment rather than content.
MIN_DESCRIPTION_CHARS = 120

#: Coarse PostgREST pre-filter for the same rule, for callers that only want
#: the passing rows. Deliberately looser than has_substance() — it cannot
#: measure description length — so always run the predicate over the result.
OR_FILTER = ",".join(
    (
        "active_listings_count.gte.1",
        "market_sale_median.not.is.null",
        "market_rent_median.not.is.null",
        "gross_yield_pct.not.is.null",
        "description.not.is.null",
    )
)


def has_substance(row: dict) -> bool:
    """True when we can say something about this building a portal cannot."""
    if (row.get("active_listings_count") or 0) >= 1:
        return True
    if row.get("market_sale_median") is not None:
        return True
    if row.get("market_rent_median") is not None:
        return True
    if row.get("gross_yield_pct") is not None:
        return True
    if len((row.get("description") or "").strip()) >= MIN_DESCRIPTION_CHARS:
        return True
    return False
