# Retiree Lens — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

---

## Overview

Add a retiree suitability score to every condo in the DB, then auto-generate dedicated `/retiree/[city]` segment pages for the 8 non-Bangkok cities. Goal: capture high-intent longtail search (foreign retirees researching Chiang Mai, Hua Hin, Phuket) with data-rich pages that avoid the thin-content trap.

---

## 1. Data Layer

### DB Migration

One new migration (`supabase/migrations/013_retiree_score.sql`):

```sql
ALTER TABLE condos
  ADD COLUMN retiree_score numeric,
  ADD COLUMN retiree_score_computed_at timestamptz;

CREATE INDEX idx_condos_retiree_score ON condos(retiree_score)
  WHERE retiree_score IS NOT NULL;
```

Only the final score is stored. Component breakdowns stay in-memory (same as before).

### Python Script — `scripts/compute_retiree_score.py`

Ports the existing `web/lib/retiree.ts` logic exactly:

| Component | Weight | Input |
|-----------|--------|-------|
| Healthcare | 40% | `livability_metrics.hospitals_within_1km` |
| Air quality | 25% | `condos.aqi_score` |
| Transit | 20% | min(nearest_bts_distance_m, nearest_mrt_distance_m) |
| Daily errands | 15% | `livability_metrics.supermarkets_within_1km` |

Output: score 0–100. Grades: ≥75 excellent / ≥55 good / ≥35 fair / <35 weak.

Runs a bulk UPDATE via upsert. Skips condos with no livability_metrics row.

### Discovery Chain

Add `compute_retiree_score` step to `overnight_discovery.py` immediately after the livability metrics step. Same pattern as existing steps (timeout 30 min, budget-aware).

---

## 2. Segment Pages

### Route

`web/app/[lang]/retiree/[city]/page.tsx`

### Page Structure

```
[City] Retiree-Friendly Condos           ← h1
├── Stats Block (3 cards, build-time)
│   ├── Avg foreign quota remaining %
│   ├── Condos with hospital within 1km
│   └── Median monthly maintenance fee (THB)
└── Condo listing grid
    └── Reuses existing CondoCard component
        (sorted by retiree_score DESC, score ≥ 55)
```

### Data Queries (2 per page, build-time)

1. **Listing query:** `condos JOIN livability_metrics WHERE retiree_score >= 55 AND province = [city]`, sorted by `retiree_score DESC`
2. **Stats query:** `avg(foreign_quota_inventory_pct)`, `count(*) WHERE hospitals_within_1km >= 1`, `percentile_cont(0.5) of cam_fee_per_month`

### generateStaticParams

- Cities: `CITIES` array from `web/lib/cities.ts` (8 non-Bangkok cities)
- Languages: `['en', 'th']`
- Total: 16 pages

### Guard — Skip Thin Pages

If a city returns fewer than 3 condos with `retiree_score >= 55`, return `notFound()`. Prevents near-empty pages from getting crawled.

---

## 3. SEO & Discoverability

### Meta Tags (auto-generated from stats)

- `<title>`: `Retiree-Friendly Condos in {City} | Bangkok Condo`
- `<description>`: `{N} condos in {City} with retiree score ≥ Good. Avg foreign quota {X}%, {Y} condos near a hospital, median maintenance fee ฿{Z}/mo.`
- JSON-LD: `ItemList` schema with condo list

### Sitemap

Add all 16 `/retiree/[city]` URLs to `web/app/sitemap.ts`:
- `priority: 0.8`
- `changefreq: weekly`

### Internal Links

- Each city page (`/city/[slug]`) gets a "Retiree-Friendly Condos" card linking to `/retiree/[city]`
- Each condo detail page with `retiree_score >= 55` gets a "See more retiree-friendly condos in [City]" link

### Launch Sequence

1. **Phase 1:** Hua Hin, Chiang Mai, Phuket — clearest retiree demand, most data
2. **Phase 2:** Remaining 5 cities after Phase 1 pages are indexed

---

## 4. Out of Scope (this iteration)

- Leasehold/freehold field — no scraping source yet, add later
- Elevator/barrier-free normalization — complex, add later
- On-site medical/amenities — add later
- Bangkok retiree page — lower priority vs. city pages
- `/best/` slug additions — may add later if `/retiree/` route performs

---

## 5. Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/013_retiree_score.sql` | New migration |
| `scripts/compute_retiree_score.py` | New script |
| `scripts/overnight_discovery.py` | Add compute step |
| `web/app/[lang]/retiree/[city]/page.tsx` | New route |
| `web/app/[lang]/retiree/[city]/opengraph-image.tsx` | OG image (optional) |
| `web/app/sitemap.ts` | Add 16 URLs |
| `web/app/[lang]/city/[slug]/page.tsx` | Add retiree card link |
| `web/app/[lang]/condo/[id]/page.tsx` | Add retiree city link |
| `web/lib/types.ts` | Add `retiree_score` to Condo type |
