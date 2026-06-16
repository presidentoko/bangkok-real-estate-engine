# Retiree Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a retiree suitability score to every condo in the DB, then auto-generate `/retiree/[city]` segment pages for the 8 non-Bangkok cities.

**Architecture:** Port the existing `web/lib/retiree.ts` scoring logic to Python, store the result as `condos.retiree_score`, wire it into the nightly discovery chain, and build a new Next.js route that queries that column and computes city-level stats from returned rows in JavaScript.

**Tech Stack:** Python 3.12 · supabase-py (`src.db.get_client`) · Next.js 15 App Router · `@supabase/supabase-js` (`getServerSupabase`) · TypeScript

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/013_retiree_score.sql` | **Create** — DB columns + index |
| `scripts/compute_retiree_score.py` | **Create** — bulk score computation |
| `tests/test_compute_retiree_score.py` | **Create** — unit tests for score logic |
| `scripts/overnight_discovery.py` | **Modify** — add step to POST_STEPS |
| `web/lib/types.ts` | **Modify** — add `retiree_score` to `Condo` type |
| `web/app/[lang]/retiree/[city]/page.tsx` | **Create** — segment page |
| `web/app/sitemap.ts` | **Modify** — add 16 retiree URLs |
| `web/app/[lang]/city/[slug]/page.tsx` | **Modify** — add retiree card link |
| `web/app/[lang]/condo/[id]/page.tsx` | **Modify** — add retiree city link + fetch fields |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/013_retiree_score.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Retiree suitability score (0-100) stored per condo.
-- Computed by scripts/compute_retiree_score.py, which ports web/lib/retiree.ts.
-- Idempotent — safe to re-apply.

alter table condos
    add column if not exists retiree_score             numeric(5,1),
    add column if not exists retiree_score_computed_at timestamptz;

create index if not exists condos_retiree_score_idx
    on condos (retiree_score)
    where retiree_score is not null;

comment on column condos.retiree_score is
    'Retiree suitability 0-100. >=75 excellent / >=55 good / >=35 fair / <35 weak. '
    'Computed from livability_metrics (hospitals, supermarkets, transit) + aqi_score.';
comment on column condos.retiree_score_computed_at is
    'When compute_retiree_score.py last updated this row.';

-- Refresh the published view so it includes the new columns.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Open Supabase SQL editor → paste → run.  
Verify:
```sql
select column_name, data_type
from information_schema.columns
where table_name = 'condos'
  and column_name in ('retiree_score', 'retiree_score_computed_at');
```
Expected: 2 rows returned.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_retiree_score.sql
git commit -m "feat(db): add retiree_score column (migration 013)"
```

---

## Task 2: Python Compute Script + Tests

**Files:**
- Create: `scripts/compute_retiree_score.py`
- Create: `tests/test_compute_retiree_score.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_compute_retiree_score.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.compute_retiree_score import compute_score


def test_excellent_score():
    # 4 hospitals, AQI 25, 300m transit, 3 supermarkets → near-max
    # healthcare=100*0.4 + air=100*0.25 + transit=100*0.2 + errands=95*0.15 = 99.25
    score = compute_score(hospitals=4, aqi=25, nearest_bts_m=300, nearest_mrt_m=None, supermarkets=3)
    assert score is not None
    assert score >= 95.0


def test_no_hospitals_gives_low_score():
    # healthcare=10*0.4=4 + air=85*0.25=21.25 + transit=85*0.2=17 + errands=55*0.15=8.25 = 50.5
    score = compute_score(hospitals=0, aqi=50, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is not None
    assert score < 55.0  # below "good" threshold


def test_missing_livability_returns_none():
    score = compute_score(hospitals=None, aqi=50, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is None


def test_missing_aqi_renormalises():
    # Without AQI: weights renormalised across 3 components (0.4+0.2+0.15=0.75 denom)
    score = compute_score(hospitals=1, aqi=None, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is not None
    assert score > 0


def test_uses_closer_transit_station():
    # min(300, 2000) == min(2000, 300) == 300 → same transit score either way
    score_a = compute_score(hospitals=1, aqi=50, nearest_bts_m=300, nearest_mrt_m=2000, supermarkets=1)
    score_b = compute_score(hospitals=1, aqi=50, nearest_bts_m=2000, nearest_mrt_m=300, supermarkets=1)
    assert score_a == score_b


def test_score_clamped_0_to_100():
    # pathological values shouldn't escape the range
    score = compute_score(hospitals=999, aqi=1, nearest_bts_m=0, nearest_mrt_m=0, supermarkets=999)
    assert score is not None
    assert 0.0 <= score <= 100.0
```

- [ ] **Step 2: Run tests — expect failure**

```bash
python -m pytest tests/test_compute_retiree_score.py -v
```
Expected: `ModuleNotFoundError: No module named 'scripts.compute_retiree_score'`

- [ ] **Step 3: Write the compute script**

```python
# scripts/compute_retiree_score.py
"""Compute retiree_score (0-100) for every condo that has livability_metrics.

Ports the same formula as web/lib/retiree.ts — identical weights and breakpoints.

Usage:
    python scripts/compute_retiree_score.py
"""
from __future__ import annotations

import io
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import get_client  # noqa: E402

_W = {"healthcare": 0.4, "air": 0.25, "transit": 0.2, "errands": 0.15}


def _healthcare(hospitals: int) -> float:
    if hospitals <= 0: return 10.0
    if hospitals == 1: return 55.0
    if hospitals == 2: return 75.0
    if hospitals == 3: return 88.0
    return 100.0


def _air(aqi: int) -> float:
    if aqi <= 25:  return 100.0
    if aqi <= 50:  return 85.0
    if aqi <= 75:  return 65.0
    if aqi <= 100: return 45.0
    if aqi <= 150: return 25.0
    return 8.0


def _transit(metres: float | None) -> float:
    if metres is None: return 20.0
    if metres <= 300:  return 100.0
    if metres <= 500:  return 85.0
    if metres <= 800:  return 65.0
    if metres <= 1200: return 40.0
    return 15.0


def _errands(supermarkets: int | None) -> float:
    n = supermarkets or 0
    if n <= 0: return 15.0
    if n == 1: return 55.0
    if n == 2: return 75.0
    return 95.0


def compute_score(
    hospitals: int | None,
    aqi: int | None,
    nearest_bts_m: float | None,
    nearest_mrt_m: float | None,
    supermarkets: int | None,
) -> float | None:
    """Return retiree suitability 0-100, or None if livability data is missing."""
    if hospitals is None:
        return None

    healthcare = _healthcare(hospitals)
    candidates = [v for v in (nearest_bts_m, nearest_mrt_m) if v is not None]
    transit = _transit(min(candidates) if candidates else None)
    errands = _errands(supermarkets)
    has_air = aqi is not None
    air = _air(aqi) if has_air else 0.0

    if has_air:
        score = (
            _W["healthcare"] * healthcare
            + _W["air"] * air
            + _W["transit"] * transit
            + _W["errands"] * errands
        )
    else:
        denom = _W["healthcare"] + _W["transit"] + _W["errands"]
        score = (
            _W["healthcare"] * healthcare
            + _W["transit"] * transit
            + _W["errands"] * errands
        ) / denom

    return round(max(0.0, min(100.0, score)) * 10) / 10


def main() -> int:
    db = get_client()

    resp = (
        db.from_("condos")
        .select(
            "id, aqi_score, "
            "livability_metrics(hospitals_within_1km, supermarkets_within_1km, "
            "nearest_bts_distance_m, nearest_mrt_distance_m)"
        )
        .execute()
    )

    rows = resp.data or []
    now = datetime.now(timezone.utc).isoformat()
    updates: list[dict] = []

    for row in rows:
        lm = row.get("livability_metrics")
        if isinstance(lm, list):
            lm = lm[0] if lm else None
        if not lm:
            continue
        score = compute_score(
            hospitals=lm.get("hospitals_within_1km"),
            aqi=row.get("aqi_score"),
            nearest_bts_m=lm.get("nearest_bts_distance_m"),
            nearest_mrt_m=lm.get("nearest_mrt_distance_m"),
            supermarkets=lm.get("supermarkets_within_1km"),
        )
        if score is None:
            continue
        updates.append({
            "id": row["id"],
            "retiree_score": score,
            "retiree_score_computed_at": now,
        })

    if not updates:
        print("no condos with livability data — nothing to update")
        return 0

    db.from_("condos").upsert(updates, on_conflict="id").execute()
    good_plus = sum(1 for u in updates if u["retiree_score"] >= 55)
    print(f"retiree_score computed for {len(updates)} condos ({good_plus} scored >= 55 / good+)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run tests — expect pass**

```bash
python -m pytest tests/test_compute_retiree_score.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Run the script against the real DB**

```bash
python scripts/compute_retiree_score.py
```
Expected output: `retiree_score computed for N condos (M scored >= 55 / good+)`  
N should be in the hundreds (condos with livability data).

- [ ] **Step 6: Commit**

```bash
git add scripts/compute_retiree_score.py tests/test_compute_retiree_score.py
git commit -m "feat(data): add compute_retiree_score.py — ports retiree.ts scoring to Python"
```

---

## Task 3: Wire into Discovery Chain

**Files:**
- Modify: `scripts/overnight_discovery.py` lines 197–198

- [ ] **Step 1: Insert the new step into POST_STEPS**

In `scripts/overnight_discovery.py`, find this block (lines 197–198):

```python
    ("compute_super_value",
     [PYTHON, "scripts/compute_super_value.py"]),
```

Replace with:

```python
    ("compute_super_value",
     [PYTHON, "scripts/compute_super_value.py"]),
    ("compute_retiree_score",
     [PYTHON, "scripts/compute_retiree_score.py"]),
```

- [ ] **Step 2: Dry-run to verify placement**

```bash
python scripts/overnight_discovery.py --dry-run --skip-post
```
Then:
```bash
python scripts/overnight_discovery.py --dry-run 2>&1 | grep -A2 "retiree"
```
Expected: `(dry-run) compute_retiree_score` appears after `compute_super_value` in the output.

- [ ] **Step 3: Commit**

```bash
git add scripts/overnight_discovery.py
git commit -m "feat(discovery): add compute_retiree_score step to POST_STEPS"
```

---

## Task 4: TypeScript Type

**Files:**
- Modify: `web/lib/types.ts`

- [ ] **Step 1: Add retiree_score to Condo type**

In `web/lib/types.ts`, find:

```typescript
export type Condo = {
  id: string;
  name: string;
  developer: string | null;
  url: string | null;
  regions?: { name: string } | null;
};
```

Replace with:

```typescript
export type Condo = {
  id: string;
  name: string;
  developer: string | null;
  url: string | null;
  regions?: { name: string } | null;
  retiree_score?: number | null;
};
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(types): add retiree_score to Condo type"
```

---

## Task 5: Retiree Segment Page

**Files:**
- Create: `web/app/[lang]/retiree/[city]/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "web/app/[lang]/retiree/[city]"
```

- [ ] **Step 2: Write the page**

```typescript
// web/app/[lang]/retiree/[city]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, cityProvinceSlugs, getCity } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

type Row = {
  id: string;
  name: string;
  province: string | null;
  retiree_score: number | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  foreign_quota_inventory_pct: number | null;
  cam_fee_per_month: number | null;
  regions: { name: string } | { name: string }[] | null;
  livability_metrics:
    | { hospitals_within_1km: number }
    | { hospitals_within_1km: number }[]
    | null;
};

function regionLabel(r: Row): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return region?.name ?? (r.province ?? "").replace(/-/g, " ");
}

function lm(r: Row): { hospitals_within_1km: number } | null {
  if (!r.livability_metrics) return null;
  return Array.isArray(r.livability_metrics)
    ? r.livability_metrics[0] ?? null
    : r.livability_metrics;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; lang: string }>;
}): Promise<Metadata> {
  const { city, lang } = await params;
  const cityObj = getCity(city);
  if (!cityObj || !isLang(lang)) return { title: "Retiree-Friendly Condos" };

  const cityName = cityObj.name.en;
  const title = `Retiree-Friendly Condos in ${cityName} | RealData`;
  const description =
    `Condos in ${cityName} ranked by retiree suitability score — ` +
    `healthcare access, air quality, transit, and daily errands. ` +
    `Foreign-quota availability and monthly maintenance fees included.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/retiree/${city}`,
      languages: langAlternates(`/retiree/${city}`),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/retiree/${city}`, type: "website" },
  };
}

export default async function RetireeCityPage({
  params,
}: {
  params: Promise<{ city: string; lang: string }>;
}) {
  const { city, lang } = await params;
  if (!isLang(lang)) notFound();
  const cityObj = getCity(city);
  if (!cityObj) notFound();

  const supabase = getServerSupabase();
  const provinces = cityProvinceSlugs(city);

  const { data } = await supabase
    .from("condos")
    .select(
      "id, name, province, retiree_score, gross_yield_pct, avg_sale_price, " +
        "foreign_quota_inventory_pct, cam_fee_per_month, regions(name), " +
        "livability_metrics(hospitals_within_1km)"
    )
    .gte("retiree_score", 55)
    .in("province", provinces)
    .eq("is_active", true)
    .order("retiree_score", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as unknown as Row[];

  // Fewer than 3 condos = not enough content to index.
  if (rows.length < 3) notFound();

  // Stats — computed from returned rows (no second query needed).
  const quotaRows = rows.filter((r) => r.foreign_quota_inventory_pct != null);
  const avgQuota =
    quotaRows.length > 0
      ? quotaRows.reduce((s, r) => s + r.foreign_quota_inventory_pct!, 0) /
        quotaRows.length
      : null;

  const nearHospital = rows.filter(
    (r) => (lm(r)?.hospitals_within_1km ?? 0) >= 1
  ).length;

  const camRows = rows
    .map((r) => r.cam_fee_per_month)
    .filter((v): v is number => v != null);
  const medianCam = median(camRows);

  const cityName = cityObj.name.en;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Retiree-Friendly Condos in ${cityName}`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.id}`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "Retiree Score", value: r.retiree_score ?? 0 },
        ...(r.foreign_quota_inventory_pct != null
          ? [{ "@type": "PropertyValue", name: "Foreign Quota (%)", value: r.foreign_quota_inventory_pct }]
          : []),
      ],
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          RealData · Retiree lens
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Retiree-Friendly Condos in {cityName}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Ranked by RealData&apos;s Retiree Suitability Score — weighted 40%
          healthcare proximity, 25% air quality, 20% transit access, 15% daily
          errands. Only buildings scoring ≥ 55 (Good+) are shown.
        </p>
      </header>

      {/* Stats block */}
      <section className="grid grid-cols-3 gap-3">
        <Stat
          label="Avg foreign quota"
          value={avgQuota != null ? `${avgQuota.toFixed(0)}%` : "—"}
        />
        <Stat
          label="Near a hospital"
          value={`${nearHospital} / ${rows.length}`}
        />
        <Stat
          label="Median CAM fee"
          value={medianCam != null ? `${fmtTHB(medianCam)}/mo` : "—"}
        />
      </section>

      {/* Listing table */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm hidden sm:table">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 w-10">#</th>
              <th className="text-left px-4 py-3">Condo</th>
              <th className="text-left px-4 py-3">District</th>
              <th className="text-right px-4 py-3">Score</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">FQ %</th>
              <th className="text-right px-4 py-3">Sale</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Yield</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="px-4 py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/${lang}/condo/${r.id}`}
                    className="text-zinc-100 hover:underline font-medium"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400 capitalize">
                  {regionLabel(r)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-400">
                  {r.retiree_score?.toFixed(0) ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-500 hidden md:table-cell">
                  {r.foreign_quota_inventory_pct != null
                    ? `${r.foreign_quota_inventory_pct.toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtTHB(r.avg_sale_price)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                  {r.gross_yield_pct != null ? `${r.gross_yield_pct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="sm:hidden divide-y divide-zinc-800/70">
          {rows.map((r, i) => (
            <li key={r.id} className="p-3">
              <Link href={`/${lang}/condo/${r.id}`} className="block space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-600 tabular-nums text-xs w-6 shrink-0">{i + 1}</span>
                  <span className="text-zinc-100 font-medium leading-snug">{r.name}</span>
                </div>
                <div className="flex items-baseline gap-3 pl-8 flex-wrap text-xs">
                  <span className="text-zinc-400 capitalize">{regionLabel(r)}</span>
                  <span className="font-semibold tabular-nums text-emerald-400 text-base">
                    {r.retiree_score?.toFixed(0) ?? "—"}
                  </span>
                </div>
                <div className="flex gap-3 pl-8 text-xs text-zinc-500 tabular-nums">
                  <span>Sale {fmtTHB(r.avg_sale_price)}</span>
                  {r.foreign_quota_inventory_pct != null && (
                    <span>· FQ {r.foreign_quota_inventory_pct.toFixed(0)}%</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
        <p>
          Retiree Suitability Score weights: healthcare proximity 40%, air
          quality (WAQI AQI) 25%, nearest BTS/MRT 20%, supermarkets within 1km
          15%. Score ≥ 75 = Excellent, ≥ 55 = Good, ≥ 35 = Fair. FQ % =
          foreign-quota inventory share of currently listed units.
        </p>
      </section>

      {/* Internal links to other cities */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-200">
          Same lens in other cities
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {CITIES.filter((c) => c.slug !== city).map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/retiree/${c.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {c.name.en}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check the new page**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 4: Build sanity check**

```bash
cd web && npx next build 2>&1 | tail -20
```
Expected: build completes, `/retiree/[city]` route listed in the output.

- [ ] **Step 5: Commit**

```bash
git add "web/app/[lang]/retiree"
git commit -m "feat(web): add /retiree/[city] segment pages"
```

---

## Task 6: Sitemap

**Files:**
- Modify: `web/app/sitemap.ts` lines 76–92

- [ ] **Step 1: Add retiree pages after the city loop**

In `web/app/sitemap.ts`, find this block (lines 77–92):

```typescript
  // Programmatic /best/[city]/[slug] landings — 9 cities × 7 filters × N langs.
  for (const lang of LANGS) {
    for (const city of BEST_CITIES) {
      for (const filter of BEST_FILTERS) {
        const path = `/best/${city.slug}/${filter.slug}`;
        out.push({
          url: `${SITE_URL}/${lang}${path}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.65,
          alternates: { languages: langAlternates(path) },
        });
      }
    }
  }
```

Replace with:

```typescript
  // Programmatic /best/[city]/[slug] landings — 9 cities × 7 filters × N langs.
  for (const lang of LANGS) {
    for (const city of BEST_CITIES) {
      for (const filter of BEST_FILTERS) {
        const path = `/best/${city.slug}/${filter.slug}`;
        out.push({
          url: `${SITE_URL}/${lang}${path}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.65,
          alternates: { languages: langAlternates(path) },
        });
      }
    }
  }

  // Retiree segment pages — 8 cities × N langs.
  for (const lang of LANGS) {
    for (const city of CITIES) {
      const path = `/retiree/${city.slug}`;
      out.push({
        url: `${SITE_URL}/${lang}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages: langAlternates(path) },
      });
    }
  }
```

- [ ] **Step 2: Verify sitemap builds**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/sitemap.ts
git commit -m "feat(seo): add /retiree/[city] URLs to sitemap"
```

---

## Task 7: City Page Internal Link

**Files:**
- Modify: `web/app/[lang]/city/[slug]/page.tsx`

- [ ] **Step 1: Add retiree link before TravelAffiliateCard**

In `web/app/[lang]/city/[slug]/page.tsx`, find this block (around line 356):

```tsx
      {/* Travel affiliate — viewing trip booking */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <TravelAffiliateCard
```

Replace with:

```tsx
      {/* Retiree lens CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href={`/${lang}/retiree/${slug}`}
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 hover:border-zinc-600 transition group"
        >
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Retiree lens
            </div>
            <div className="text-zinc-100 font-semibold group-hover:text-emerald-400 transition">
              Retiree-friendly condos in {city.name[lang as Lang]} →
            </div>
            <div className="text-zinc-500 text-xs mt-0.5">
              Ranked by healthcare access, air quality &amp; transit
            </div>
          </div>
        </Link>
      </section>

      {/* Travel affiliate — viewing trip booking */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <TravelAffiliateCard
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors. (If `Lang` isn't imported, add it: `import { ..., type Lang } from "@/lib/i18n"`)

- [ ] **Step 3: Commit**

```bash
git add "web/app/[lang]/city/[slug]/page.tsx"
git commit -m "feat(city): add retiree-friendly condos link to city pages"
```

---

## Task 8: Condo Page Internal Link

**Files:**
- Modify: `web/app/[lang]/condo/[id]/page.tsx`

- [ ] **Step 1: Add province + retiree_score to the SELECT query**

In `web/app/[lang]/condo/[id]/page.tsx`, find the main condo select (around line 159):

```typescript
        "id, name, developer, url, regions(name), latitude, longitude, " +
        "floors, total_units, completion_year, description, hero_image_url, " +
```

Replace with:

```typescript
        "id, name, developer, url, regions(name), latitude, longitude, " +
        "province, retiree_score, " +
        "floors, total_units, completion_year, description, hero_image_url, " +
```

- [ ] **Step 2: Add the fields to the condoRaw type**

Find (around line 223):

```typescript
  const condoRaw = condoRes.data as unknown as {
    id: string;
    name: string;
    developer: string | null;
    url: string | null;
    regions: { name: string } | { name: string }[] | null;
    latitude: number | null;
    longitude: number | null;
```

Replace with:

```typescript
  const condoRaw = condoRes.data as unknown as {
    id: string;
    name: string;
    developer: string | null;
    url: string | null;
    regions: { name: string } | { name: string }[] | null;
    province: string | null;
    retiree_score: number | null;
    latitude: number | null;
    longitude: number | null;
```

- [ ] **Step 3: Add the retiree city link to the "Nearby & metrics" list**

At the top of the condo file, verify `canonicalCitySlug` and `getCity` are imported from `@/lib/cities`. If not, add them:

```typescript
import { canonicalCitySlug, getCity } from "@/lib/cities";
```

Then find this block (around line 826):

```tsx
      <section className="text-sm">
        <div className="text-zinc-300 font-semibold mb-1">Nearby &amp; metrics</div>
        <ul className="text-blue-400 space-y-1">
          {stationLinkOk && stationName && (
            <li><Link href={`/${lang}/near/${stationSpokeSlug}`}>Condos near {stationName} station</Link></li>
          )}
```

Replace with:

```tsx
      <section className="text-sm">
        <div className="text-zinc-300 font-semibold mb-1">Nearby &amp; metrics</div>
        <ul className="text-blue-400 space-y-1">
          {stationLinkOk && stationName && (
            <li><Link href={`/${lang}/near/${stationSpokeSlug}`}>Condos near {stationName} station</Link></li>
          )}
          {(() => {
            const citySlug = condoRaw.province != null ? canonicalCitySlug(condoRaw.province) : null;
            const cityObj = citySlug ? getCity(citySlug) : null;
            if (!cityObj || (condoRaw.retiree_score ?? 0) < 55) return null;
            return (
              <li>
                <Link href={`/${lang}/retiree/${citySlug}`}>
                  More retiree-friendly condos in {cityObj.name.en}
                </Link>
              </li>
            );
          })()}
```

- [ ] **Step 4: Type-check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "web/app/[lang]/condo/[id]/page.tsx"
git commit -m "feat(condo): add retiree city link for condos scoring >= 55"
```

---

## Final Verification

- [ ] **Run full build**

```bash
cd web && npx next build 2>&1 | tail -30
```
Expected: build completes, no type errors, `/retiree/[city]` appears in route list.

- [ ] **Check a retiree page renders**

```bash
cd web && npx next dev
```
Open `http://localhost:3000/en/retiree/chiangmai` — should show condos with scores ≥ 55, stats block, and table. If `notFound()` fires, run `python scripts/compute_retiree_score.py` first to populate scores.

- [ ] **Verify sitemap includes retiree URLs**

```
http://localhost:3000/sitemap.xml
```
Should contain entries like `/en/retiree/chiangmai`, `/en/retiree/huahin`, `/en/retiree/phuket`.

- [ ] **Final commit if any loose files**

```bash
git status
git add -p  # stage only intentional changes
git commit -m "chore: final retiree lens wiring"
```
