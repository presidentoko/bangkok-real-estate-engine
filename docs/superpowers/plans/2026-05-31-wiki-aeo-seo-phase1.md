# Wiki-Style AEO/SEO Data Pages — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase-1 wiki layer — station spokes, three authority hubs, and a glossary — wired for AEO/SEO (JSON-LD, internal links, sitemap, llms.txt), reusing the existing data + SEO infrastructure.

**Architecture:** New Next.js App Router routes under `web/app/[lang]/` (`near/[station]`, `guide/foreign-ownership`, `guide/investment`, `glossary`, `glossary/[term]`) plus an enhancement to the existing `flood` page. New query functions live in `web/lib/queries/`, new JSON-LD/data helpers in `web/lib/seo/` and `web/lib/`. All prose is either human-written authority content (hubs/glossary) or templated from real per-station numbers (spokes) — never free-LLM-generated.

**Tech Stack:** Next.js 15 App Router (RSC), TypeScript, Supabase PostgREST client (`@supabase/supabase-js`), Tailwind. i18n: `en`/`ko`/`th` via `getDictionary`. No test runner exists in `web/` — verification uses `npm run typecheck`, `npm run build`, dev-server route checks, and (for pure logic only) `node --test` on `.ts` files via Node's native type-stripping (Node ≥23; environment is v24.15.0).

---

## Grounded data facts (verified against the live DB on 2026-05-31)

These numbers drove the scope decisions below — do not re-assume the spec's optimistic figures.

- `condos_published` has **11,296** rows; only **1,885** have a `livability_metrics` row (≈17%). Station pages can only cover those 1,885.
- `livability_metrics` columns (type `Livability` in `web/lib/types.ts:18`): `condo_id`, `nearest_bts_station`, `nearest_bts_distance_m`, `nearest_mrt_station`, `nearest_mrt_distance_m`, `hospitals_within_1km`, `schools_within_1km`, `supermarkets_within_1km`, `livability_score`.
- The `nearest_bts_station` / `nearest_mrt_station` **labels are unreliable** (e.g. "Asok", "Phrom Phong", "Siam" appear in the MRT column). **Do not split routes by line.** Treat both columns as one "nearest rail station" namespace, merge by name, take the **minimum** of the two distances per condo.
- **Scope decision (locked):** a station page is built only when **≥5 distinct condos sit within 1 km** (union of both columns, min distance). That yields ≈**73** stations, all `province = "bangkok"`. Stations below the threshold are skipped (anti-thin-content).
- Province distribution: `bangkok` 6155, `phuket` 2166, `pattaya` 1115, `hua-hin` 559, `chon-buri` 532, `ko-samui` 365, `chiang-mai` 337, `krabi` 57, `chiang-rai` 10. Stations are Bangkok-only in practice.

## Reused infrastructure (do not re-invent)

- DB client: `getServerSupabase()` from `web/lib/supabase.ts` (cached singleton, PostgREST builder — **no raw SQL, no GROUP BY**; aggregate in JS like `district/[slug]/page.tsx` does).
- Condo card: `BuildingCard` from `web/components/BuildingCard.tsx` — props `{ condo: CondoSummary; hrefPrefix?: string; size?: "sm"|"md" }`.
- Condo type + fetch: `CondoSummary` and the `SELECT` constant in `web/lib/queries/condos.ts` (fields incl. `bubble_index`, `is_super_value`, `flood_risk_level`, `market_sale_median`, `market_rent_median`, `market_summary_currency`, `region`, `province`).
- JSON-LD: `buildFaqJsonLd(items: FaqItem[])` + `type FaqItem = { q: string; a: string }` from `web/lib/seo/faqJsonLd.ts`.
- `langAlternates(path)` + `SEO_SITE_URL` from `web/lib/seo.ts`.
- i18n: `LANGS = ["en","ko","th"]`, `isLang`, `DEFAULT_LANG` from `web/lib/i18n.ts`; `getDictionary(lang)` from `web/lib/getDictionary.ts`; `type Dict = typeof dict` exported at the bottom of `web/lib/dictionaries/en.ts` (ko/th must mirror its shape).
- Routing pattern: dynamic routes export `generateStaticParams()` returning param objects, and `async generateMetadata({ params })` that `await params` then sets `alternates.canonical` + `alternates.languages: langAlternates(path)`. Pages `await params`, guard `if (!isLang(lang)) notFound()`, and set `export const revalidate = 3600`.
- Footer + header NAV live in `web/app/[lang]/layout.tsx` (footer is the `t.footer.sectionsTitle` column around line 146).
- Sitemap: `web/app/sitemap.ts` (default export `async sitemap()`, has a local `langAlternates` and a per-lang loop over `STATIC_PATHS`, plus dynamic city/district/condo blocks). `revalidate = 3600`.
- AI crawler doc: `web/public/llms.txt` (static markdown).

---

## File structure

**Create:**
- `web/lib/seo/breadcrumbsJsonLd.ts` — generic `BreadcrumbList` builder.
- `web/lib/seo/definedTermJsonLd.ts` — `DefinedTerm` + `DefinedTermSet` builders.
- `web/lib/glossary.ts` — static glossary term data + lookups.
- `web/lib/stations.ts` — pure station-name → slug normalization + reverse lookup.
- `web/lib/stations.test.ts` — `node:test` unit tests for the above.
- `web/lib/queries/stations.ts` — `getViableStations()`, `getStationData(slug)`.
- `web/lib/queries/areas.ts` — `getYieldByArea()` for the investment hub.
- `web/app/[lang]/near/[station]/page.tsx` — station spoke.
- `web/app/[lang]/guide/foreign-ownership/page.tsx` — hub ①.
- `web/app/[lang]/guide/investment/page.tsx` — hub ②.
- `web/app/[lang]/glossary/page.tsx` — glossary index.
- `web/app/[lang]/glossary/[term]/page.tsx` — glossary term.

**Modify:**
- `web/lib/dictionaries/en.ts`, `ko.ts`, `th.ts` — add `near`, `guide`, `glossary` sections.
- `web/app/[lang]/flood/page.tsx` — add flood-risk ranking table + prose (hub ③ enhancement).
- `web/app/[lang]/condo/[id]/page.tsx` — backlink to station spoke + glossary.
- `web/app/[lang]/layout.tsx` — add "Guides" footer column.
- `web/app/sitemap.ts` — add new routes.
- `web/public/llms.txt` — list new hubs + glossary.

---

# Group A — Shared infrastructure

### Task 1: Generic breadcrumb JSON-LD helper

**Files:**
- Create: `web/lib/seo/breadcrumbsJsonLd.ts`

- [ ] **Step 1: Implement the helper**

```typescript
// web/lib/seo/breadcrumbsJsonLd.ts
// Generic BreadcrumbList JSON-LD. The condo-specific builder in condoJsonLd.ts
// stays as-is; this one serves hubs, station spokes, and the glossary.

export type Crumb = { name: string; url: string };

export function buildBreadcrumbsJsonLd(items: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add web/lib/seo/breadcrumbsJsonLd.ts
git commit -m "feat(seo): generic BreadcrumbList JSON-LD builder"
```

---

### Task 2: DefinedTerm JSON-LD helpers

**Files:**
- Create: `web/lib/seo/definedTermJsonLd.ts`

- [ ] **Step 1: Implement the helpers**

```typescript
// web/lib/seo/definedTermJsonLd.ts
// DefinedTerm (single glossary entry) + DefinedTermSet (the glossary as a whole).
// Used for AEO definition-query eligibility.

export type DefinedTermInput = {
  term: string;
  definition: string;
  url: string;
  inSetUrl: string; // URL of the glossary index (the DefinedTermSet)
};

export function buildDefinedTermJsonLd(t: DefinedTermInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    url: t.url,
    inDefinedTermSet: t.inSetUrl,
  };
}

export function buildDefinedTermSetJsonLd(args: {
  name: string;
  url: string;
  terms: Array<{ term: string; url: string }>;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: args.name,
    url: args.url,
    hasDefinedTerm: args.terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      url: t.url,
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/lib/seo/definedTermJsonLd.ts
git commit -m "feat(seo): DefinedTerm + DefinedTermSet JSON-LD builders"
```

---

### Task 3: Glossary data module

**Files:**
- Create: `web/lib/glossary.ts`

Definitions map to the site's own metrics. `howCalculated` must match the codebase (`value_scores.bubble_index`, `gross_yield_pct`, `risk_factors.flood_risk_level` L1–L5, `livability_metrics.livability_score`, `is_super_value`, BOT MRR via `macro_indicators`).

- [ ] **Step 1: Implement the data + lookups**

```typescript
// web/lib/glossary.ts
// Static glossary. English copy only in Phase 1 (Thai/Korean prose = Phase 2);
// numbers/structure are language-agnostic. Each term anchors internal links and
// powers DefinedTerm JSON-LD.

export type GlossaryTerm = {
  slug: string;
  term: string;
  /** One-sentence answer-engine definition (used in DefinedTerm + meta description). */
  definition: string;
  /** How RealData computes/sources it (the differentiator vs generic glossaries). */
  howCalculated: string;
  /** Slugs of other terms to cross-link. */
  related: string[];
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "bubble-index",
    term: "Bubble Index",
    definition:
      "RealData's Bubble Index scores a condo's asking price against the median price-per-sqm of its district: 100 is on par, above 100 is overpriced, below 100 is underpriced.",
    howCalculated:
      "We take each building's median sale price-per-sqm from active listings and divide it by the district median, indexed to 100. A reading of 115 means the building asks ~15% above its district; 85 means ~15% below. Stored as value_scores.bubble_index.",
    related: ["price-per-sqm", "super-value"],
  },
  {
    slug: "gross-yield",
    term: "Gross Rental Yield",
    definition:
      "Gross rental yield is annual rental income as a percentage of purchase price, before costs — a quick gauge of income return on a Bangkok condo.",
    howCalculated:
      "We compute (median monthly rent x 12) / median sale price for the building from active sale and rent listings, expressed as a percentage (condos.gross_yield_pct). Bangkok condos typically run 4–7% gross.",
    related: ["price-per-sqm", "mrr"],
  },
  {
    slug: "price-per-sqm",
    term: "Price per Square Metre",
    definition:
      "Price per square metre normalises condo prices by unit size so buildings of different unit mixes can be compared like-for-like.",
    howCalculated:
      "Median asking sale price divided by interior area across a building's active listings, in THB/sqm. It is the base input to the Bubble Index.",
    related: ["bubble-index", "gross-yield"],
  },
  {
    slug: "flood-risk-level",
    term: "Flood Risk Level (L1–L5)",
    definition:
      "Flood Risk Level rates a location's flooding exposure on a five-step scale, L1 (lowest) to L5 (highest), based on Bangkok's district flood model.",
    howCalculated:
      "Each building inherits the flood level of its district polygon from our Bangkok flood layer (risk_factors.flood_risk_level). Where a per-building score exists it overrides the district value. See the live map on the Flood page.",
    related: ["livability-score"],
  },
  {
    slug: "foreign-quota",
    term: "Foreign Ownership Quota (49%)",
    definition:
      "Thai law lets foreigners collectively own up to 49% of the total saleable floor area of any condominium; the other 51% must be Thai-owned.",
    howCalculated:
      "Set by the Condominium Act B.E. 2522. A building's remaining foreign quota determines whether a foreigner can buy a given unit in freehold. See our foreign-ownership guide.",
    related: ["freehold", "leasehold"],
  },
  {
    slug: "freehold",
    term: "Freehold",
    definition:
      "Freehold means owning a condo unit outright and indefinitely in your own name, registered at the Land Department.",
    howCalculated:
      "Foreigners can hold a condo freehold only within the building's 49% foreign quota, and must remit the purchase funds from abroad in foreign currency (FET form).",
    related: ["foreign-quota", "leasehold"],
  },
  {
    slug: "leasehold",
    term: "Leasehold",
    definition:
      "Leasehold is a registered long-term lease of a property — up to 30 years per term — used by foreigners when freehold is unavailable or for land/villas.",
    howCalculated:
      "Leases are registered at the Land Department for a maximum 30-year term; renewal clauses are contractual, not automatically enforceable. Common when a building's foreign quota is full.",
    related: ["freehold", "foreign-quota"],
  },
  {
    slug: "livability-score",
    term: "Livability Score",
    definition:
      "The Livability Score summarises how convenient a building's location is — proximity to rail transit plus nearby hospitals, schools, and supermarkets.",
    howCalculated:
      "Derived from livability_metrics: distance to the nearest BTS/MRT station and counts of hospitals, schools, and supermarkets within 1 km. Closer transit and denser amenities raise the score.",
    related: ["flood-risk-level"],
  },
  {
    slug: "super-value",
    term: "Super Value",
    definition:
      "A Super Value badge flags a condo our model considers materially underpriced versus comparable buildings in its district.",
    howCalculated:
      "Set when a building's Bubble Index sits well below its district median with enough listing samples to be reliable (value_scores.is_super_value).",
    related: ["bubble-index"],
  },
  {
    slug: "days-on-market",
    term: "Days on Market (DOM)",
    definition:
      "Days on Market is how long a listing has been advertised — a high DOM hints at overpricing or weak demand.",
    howCalculated:
      "Measured from a listing's first-seen date in our portal sweeps to today. We surface median and max DOM per building on the condo report.",
    related: ["bubble-index"],
  },
  {
    slug: "mrr",
    term: "MRR (Minimum Retail Rate)",
    definition:
      "MRR is a benchmark lending rate published by Thai banks; it sets the baseline for most Thai mortgage pricing.",
    howCalculated:
      "We track the Bank of Thailand MRR series (macro_indicators, series FM_RT_001_S2) and use it as the financing-cost reference in yield and affordability context.",
    related: ["gross-yield"],
  },
  {
    slug: "completion-year",
    term: "Completion Year",
    definition:
      "Completion Year is the year a condominium was finished and handed over — a proxy for building age, condition, and depreciation.",
    howCalculated:
      "Sourced per building (condos.completion_year). Newer completions command price premiums; older buildings often show higher gross yields.",
    related: ["gross-yield", "price-per-sqm"],
  },
];

const BY_SLUG = new Map(GLOSSARY.map((t) => [t.slug, t]));

export function getTerm(slug: string): GlossaryTerm | null {
  return BY_SLUG.get(slug) ?? null;
}

export function allTermSlugs(): string[] {
  return GLOSSARY.map((t) => t.slug);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/lib/glossary.ts
git commit -m "feat(glossary): static term data + lookups (12 terms)"
```

---

### Task 4: Dictionary additions (en/ko/th)

Only headings + short summary prose are localized (per spec). Korean/Thai reuse the English strings in Phase 1 to stay type-safe and Thai-ready; Korean headings are translated where trivial. The `Dict` type is `typeof dict` from `en.ts`, so **ko.ts and th.ts must have identical key shape**.

**Files:**
- Modify: `web/lib/dictionaries/en.ts`
- Modify: `web/lib/dictionaries/ko.ts`
- Modify: `web/lib/dictionaries/th.ts`

- [ ] **Step 1: Add the `near`, `guide`, `glossary` blocks to `en.ts`**

Insert these three keys into the `dict` object in `web/lib/dictionaries/en.ts` (before the closing brace; keep the existing `export type Dict = typeof dict;` at the very end):

```typescript
  near: {
    breadcrumb: "Stations",
    titleSuffix: "condos near",
    metaSuffix: "Condos near {station} — prices, yield, flood risk & ratings | RealData",
    summaryLead: "Within 1 km of {station} we track",
    statCondos: "condos",
    statMedianPsm: "median ฿/sqm",
    statMedianYield: "median gross yield",
    statAvgFlood: "avg flood risk",
    statAvgRating: "avg Google rating",
    listTitle: "Condos near {station}",
    faqTitle: "FAQ",
    emptyNote: "Not enough geo-located condos near this station yet.",
    relatedHubs: "Related guides",
  },
  guide: {
    breadcrumb: "Guides",
    foreign: {
      title: "Can Foreigners Buy a Condo in Thailand? (2026 Guide)",
      lead: "Yes — foreigners can own Bangkok condos freehold, within limits. Here is exactly how the 49% quota, freehold vs leasehold, money transfer, and taxes work.",
    },
    investment: {
      title: "Bangkok Condo Investment Guide 2026",
      lead: "Where the yields are, which areas look overpriced, financing costs, and the data behind a Bangkok buy-to-let decision — refreshed weekly.",
      yieldTableTitle: "Gross rental yield by area",
      colArea: "Area",
      colCondos: "Condos",
      colYield: "Median gross yield",
      colPsm: "Median ฿/sqm",
    },
  },
  glossary: {
    breadcrumb: "Glossary",
    title: "Bangkok Real-Estate Glossary",
    lead: "Plain-English definitions of every metric RealData publishes — and exactly how we calculate each one.",
    howWeCalculate: "How we calculate it",
    relatedTitle: "Related terms",
    backToIndex: "All terms",
  },
```

- [ ] **Step 2: Mirror the identical key shape into `ko.ts` and `th.ts`**

Add the same three keys to `web/lib/dictionaries/ko.ts` and `web/lib/dictionaries/th.ts`. Korean version (translate headings, keep templated tokens like `{station}`):

```typescript
  near: {
    breadcrumb: "역",
    titleSuffix: "역 주변 콘도",
    metaSuffix: "{station} 주변 콘도 — 가격, 수익률, 침수 위험, 평점 | RealData",
    summaryLead: "{station} 반경 1km 내",
    statCondos: "콘도",
    statMedianPsm: "중위 ฿/sqm",
    statMedianYield: "중위 총수익률",
    statAvgFlood: "평균 침수 위험",
    statAvgRating: "평균 구글 평점",
    listTitle: "{station} 주변 콘도",
    faqTitle: "자주 묻는 질문",
    emptyNote: "이 역 주변에 위치 정보가 있는 콘도가 아직 부족합니다.",
    relatedHubs: "관련 가이드",
  },
  guide: {
    breadcrumb: "가이드",
    foreign: {
      title: "외국인의 태국 콘도 구매 가능 여부 (2026 가이드)",
      lead: "가능합니다 — 외국인은 한도 내에서 방콕 콘도를 자유 보유(freehold)할 수 있습니다. 49% 쿼터, freehold와 leasehold, 송금, 세금까지 정확히 정리합니다.",
    },
    investment: {
      title: "방콕 콘도 투자 가이드 2026",
      lead: "어디 수익률이 높은지, 어느 지역이 고평가인지, 금융 비용과 매수 판단의 근거 데이터 — 매주 갱신.",
      yieldTableTitle: "지역별 총 임대 수익률",
      colArea: "지역",
      colCondos: "콘도 수",
      colYield: "중위 총수익률",
      colPsm: "중위 ฿/sqm",
    },
  },
  glossary: {
    breadcrumb: "용어집",
    title: "방콕 부동산 용어집",
    lead: "RealData가 발표하는 모든 지표의 쉬운 정의 — 그리고 우리가 정확히 어떻게 계산하는지.",
    howWeCalculate: "계산 방식",
    relatedTitle: "관련 용어",
    backToIndex: "전체 용어",
  },
```

For `th.ts`, reuse the **English** strings verbatim for these three blocks (Thai prose is Phase 2; structure stays Thai-ready). Copy the exact `en.ts` block from Step 1 into `th.ts`.

- [ ] **Step 3: Typecheck (catches any key-shape drift across locales)**

Run: `cd web && npm run typecheck`
Expected: PASS. If it fails with a missing-property error on ko/th, a key is misspelled or absent — fix to match `en.ts` exactly.

- [ ] **Step 4: Commit**

```bash
git add web/lib/dictionaries/en.ts web/lib/dictionaries/ko.ts web/lib/dictionaries/th.ts
git commit -m "feat(i18n): add near/guide/glossary dictionary sections"
```

---

# Group B — Station spokes

### Task 5: Station name → slug normalization (pure, tested)

**Files:**
- Create: `web/lib/stations.ts`
- Test: `web/lib/stations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/lib/stations.test.ts
// Run with: node --test web/lib/stations.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { stationSlug, slugToDisplayName, buildStationIndex } from "./stations.ts";

test("stationSlug lowercases and hyphenates", () => {
  assert.equal(stationSlug("Phrom Phong"), "phrom-phong");
  assert.equal(stationSlug("Saint Louis"), "saint-louis");
  assert.equal(stationSlug("Phra Ram 9"), "phra-ram-9");
});

test("stationSlug strips punctuation and collapses separators", () => {
  assert.equal(stationSlug("Outer Ring Road-Ram Inthra"), "outer-ring-road-ram-inthra");
  assert.equal(stationSlug("Queen Sirikit National Convention Centre"),
    "queen-sirikit-national-convention-centre");
});

test("buildStationIndex maps slug back to a canonical display name", () => {
  const idx = buildStationIndex(["Phrom Phong", "Chit Lom", "On Nut"]);
  assert.equal(slugToDisplayName(idx, "phrom-phong"), "Phrom Phong");
  assert.equal(slugToDisplayName(idx, "on-nut"), "On Nut");
  assert.equal(slugToDisplayName(idx, "nonexistent"), null);
});

test("buildStationIndex dedupes names that share a slug", () => {
  const idx = buildStationIndex(["Phrom Phong", "phrom phong", "Phrom Phong"]);
  assert.equal(idx.size, 1);
  assert.equal(slugToDisplayName(idx, "phrom-phong"), "Phrom Phong");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && node --test lib/stations.test.ts`
Expected: FAIL — cannot find module `./stations.ts` (file not created yet).

- [ ] **Step 3: Implement `stations.ts`**

```typescript
// web/lib/stations.ts
// Pure station-name normalization. Station data labels are noisy and the
// BTS/MRT columns are not reliable line indicators, so we treat all station
// names as one namespace keyed by a URL slug.

export function stationSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** slug -> first-seen canonical display name. */
export type StationIndex = Map<string, string>;

export function buildStationIndex(names: string[]): StationIndex {
  const idx: StationIndex = new Map();
  for (const raw of names) {
    if (!raw) continue;
    const slug = stationSlug(raw);
    if (!slug) continue;
    // Prefer the first non-empty, trimmed canonical spelling.
    if (!idx.has(slug)) idx.set(slug, raw.trim());
  }
  return idx;
}

export function slugToDisplayName(idx: StationIndex, slug: string): string | null {
  return idx.get(slug) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && node --test lib/stations.test.ts`
Expected: PASS (4 tests).
If `node --test` cannot strip TS types in this environment, rename the two files to `.mjs` and remove the `: string`/`: StationIndex` annotations; the assertions stay identical.

- [ ] **Step 5: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS. (`*.test.ts` is type-checked too; that's fine.)

- [ ] **Step 6: Commit**

```bash
git add web/lib/stations.ts web/lib/stations.test.ts
git commit -m "feat(stations): pure name->slug normalization with tests"
```

---

### Task 6: Station query layer

Aggregates `livability_metrics` + condos in JS (PostgREST has no GROUP BY). Union both station columns per condo, take min distance, keep condos within 1 km, require ≥5 distinct condos per station.

**Files:**
- Create: `web/lib/queries/stations.ts`

- [ ] **Step 1: Implement the query functions**

```typescript
// web/lib/queries/stations.ts
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { buildStationIndex, stationSlug, type StationIndex } from "@/lib/stations";
import type { CondoSummary } from "@/lib/queries/condos";

const RADIUS_M = 1000;
const MIN_CONDOS = 5;

type LivRow = {
  condo_id: string;
  nearest_bts_station: string | null;
  nearest_bts_distance_m: number | null;
  nearest_mrt_station: string | null;
  nearest_mrt_distance_m: number | null;
};

// condo_id -> [station name, best distance within radius]
type StationToCondos = Map<string, Map<string, number>>;

async function fetchAllLivability(): Promise<LivRow[]> {
  const sb = getServerSupabase();
  const out: LivRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("livability_metrics")
      .select(
        "condo_id,nearest_bts_station,nearest_bts_distance_m,nearest_mrt_station,nearest_mrt_distance_m",
      )
      .range(from, from + page - 1);
    if (error || !data) break;
    out.push(...(data as LivRow[]));
    if (data.length < page) break;
  }
  return out;
}

/** Build the station -> {condoId: minDist} map, unioning both columns. */
function indexStations(rows: LivRow[]): StationToCondos {
  const map: StationToCondos = new Map();
  for (const r of rows) {
    const pairs: Array<[string | null, number | null]> = [
      [r.nearest_bts_station, r.nearest_bts_distance_m],
      [r.nearest_mrt_station, r.nearest_mrt_distance_m],
    ];
    for (const [name, dist] of pairs) {
      if (!name || dist == null || dist > RADIUS_M) continue;
      if (!map.has(name)) map.set(name, new Map());
      const condos = map.get(name)!;
      const prev = condos.get(r.condo_id);
      if (prev == null || dist < prev) condos.set(r.condo_id, dist);
    }
  }
  return map;
}

export type ViableStation = {
  slug: string;
  name: string;
  condoCount: number;
};

/** Stations with >= MIN_CONDOS distinct condos within RADIUS_M. Cached 1h. */
export const getViableStations = unstable_cache(
  async (): Promise<ViableStation[]> => {
    const rows = await fetchAllLivability();
    const byStation = indexStations(rows);
    const idx: StationIndex = buildStationIndex([...byStation.keys()]);
    // Merge condo sets per slug (different spellings -> same slug).
    const bySlug = new Map<string, Set<string>>();
    for (const [name, condos] of byStation) {
      const slug = stationSlug(name);
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      const set = bySlug.get(slug)!;
      for (const id of condos.keys()) set.add(id);
    }
    const out: ViableStation[] = [];
    for (const [slug, condoIds] of bySlug) {
      if (condoIds.size < MIN_CONDOS) continue;
      out.push({ slug, name: idx.get(slug) ?? slug, condoCount: condoIds.size });
    }
    out.sort((a, b) => b.condoCount - a.condoCount);
    return out;
  },
  ["viable-stations-v1"],
  { revalidate: 3600 },
);

export type StationData = {
  name: string;
  slug: string;
  condos: CondoSummary[];
  medianPsm: number | null;
  medianYieldPct: number | null;
  avgFloodLevel: number | null;
};

const CONDO_SELECT =
  "id, name, url, latitude, longitude, hero_image_url, total_units, available_units_count, market_sale_median, market_rent_median, market_summary_currency, property_type, province, source, regions(name), value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

function median(xs: number[]): number | null {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function rowToSummary(r: Record<string, any>): CondoSummary {
  const region = Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name;
  const vs = Array.isArray(r.value_scores) ? r.value_scores[0] : r.value_scores;
  const rf = Array.isArray(r.risk_factors) ? r.risk_factors[0] : r.risk_factors;
  return {
    id: r.id,
    name: r.name,
    url: r.url ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    region: region ?? null,
    province: r.province,
    hero_image_url: r.hero_image_url ?? null,
    bubble_index: vs?.bubble_index ?? null,
    is_super_value: vs?.is_super_value ?? null,
    flood_risk_level: rf?.flood_risk_level ?? null,
    total_units: r.total_units ?? null,
    available_units_count: r.available_units_count ?? null,
    market_sale_median: r.market_sale_median ?? null,
    market_rent_median: r.market_rent_median ?? null,
    market_summary_currency: r.market_summary_currency ?? null,
    property_type: r.property_type,
    source: r.source,
  };
}

/** Full data for one station spoke. Returns null if slug is unknown/sub-threshold. */
export const getStationData = unstable_cache(
  async (slug: string): Promise<StationData | null> => {
    const rows = await fetchAllLivability();
    const byStation = indexStations(rows);
    const idx = buildStationIndex([...byStation.keys()]);
    const name = idx.get(slug);
    if (!name) return null;

    // condo ids within radius for any spelling that maps to this slug
    const condoIds = new Set<string>();
    for (const [stName, condos] of byStation) {
      if (stationSlug(stName) !== slug) continue;
      for (const id of condos.keys()) condoIds.add(id);
    }
    if (condoIds.size < MIN_CONDOS) return null;

    const sb = getServerSupabase();
    const ids = [...condoIds];
    const condoRows: Record<string, any>[] = [];
    const chunk = 200; // keep .in() filter URL length sane
    for (let i = 0; i < ids.length; i += chunk) {
      const { data } = await sb
        .from("condos_published")
        .select(CONDO_SELECT)
        .in("id", ids.slice(i, i + chunk));
      if (data) condoRows.push(...(data as Record<string, any>[]));
    }
    const condos = condoRows.map(rowToSummary);

    // gross yield per condo from the condos table (not in condos_published)
    const { data: yieldRows } = await sb
      .from("condos")
      .select("id, gross_yield_pct, market_sale_per_sqm")
      .in("id", ids);
    const yields = (yieldRows ?? [])
      .map((r: any) => r.gross_yield_pct)
      .filter((n: any): n is number => typeof n === "number");
    const psm = (yieldRows ?? [])
      .map((r: any) => r.market_sale_per_sqm)
      .filter((n: any): n is number => typeof n === "number");
    const floods = condos
      .map((c) => c.flood_risk_level)
      .filter((n): n is number => typeof n === "number");

    return {
      name,
      slug,
      condos: condos.sort((a, b) => (a.name > b.name ? 1 : -1)),
      medianPsm: median(psm),
      medianYieldPct: median(yields),
      avgFloodLevel: floods.length
        ? Math.round((floods.reduce((s, n) => s + n, 0) / floods.length) * 10) / 10
        : null,
    };
  },
  ["station-data-v1"],
  { revalidate: 3600 },
);
```

> Note: `market_sale_per_sqm` lives on the `condos` table (confirmed in `web/lib/queries/rag.ts`). If a column is absent at runtime the `.select` returns an error and that metric is simply `null` — the page must tolerate nulls (it does, see Task 7).

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify against live data with a throwaway probe**

Create `web/probe_stations.mjs` (delete after):

```javascript
import { getViableStations } from "./lib/queries/stations.ts";
const s = await getViableStations();
console.log("viable stations:", s.length);
console.log(s.slice(0, 8));
```

Run: `cd web && node --env-file=.env.local probe_stations.mjs`
Expected: `viable stations:` prints ~73 and the top entries include `saint-louis`, `phrom-phong`, `chit-lom`. If `unstable_cache` errors outside Next, skip this probe and rely on the Task 7 route check instead. Then: `rm web/probe_stations.mjs`.

- [ ] **Step 4: Commit**

```bash
git add web/lib/queries/stations.ts
git commit -m "feat(stations): viable-station + station-data query layer"
```

---

### Task 7: Station spoke route

**Files:**
- Create: `web/app/[lang]/near/[station]/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// web/app/[lang]/near/[station]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BuildingCard } from "@/components/BuildingCard";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { getViableStations, getStationData } from "@/lib/queries/stations";

export const revalidate = 3600;

export async function generateStaticParams() {
  const stations = await getViableStations();
  return stations.flatMap((s) =>
    LANGS.map((lang) => ({ lang, station: s.slug })),
  );
}

function fill(tpl: string, station: string): string {
  return tpl.replace(/\{station\}/g, station);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; station: string }>;
}): Promise<Metadata> {
  const { lang, station } = await params;
  if (!isLang(lang)) return { title: "Stations — RealData" };
  const data = await getStationData(station);
  const t = getDictionary(lang);
  if (!data) return { title: "Stations — RealData" };
  const title = fill(t.near.metaSuffix, data.name);
  const desc = `${fill(t.near.summaryLead, data.name)} ${data.condos.length} condos${
    data.medianYieldPct != null ? `, median gross yield ${data.medianYieldPct.toFixed(1)}%` : ""
  }.`;
  return {
    title,
    description: desc,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/near/${station}`,
      languages: langAlternates(`/near/${station}`),
    },
    openGraph: { title, description: desc, url: `${SEO_SITE_URL}/${lang}/near/${station}`, type: "article" },
  };
}

export default async function StationPage({
  params,
}: {
  params: Promise<{ lang: string; station: string }>;
}) {
  const { lang, station } = await params;
  if (!isLang(lang)) notFound();
  const data = await getStationData(station);
  if (!data) notFound();
  const t = getDictionary(lang);

  const faq = [
    {
      q: `How many condos are near ${data.name} station?`,
      a: `RealData tracks ${data.condos.length} condos within 1 km of ${data.name}${
        data.medianPsm != null ? `, at a median of ฿${Math.round(data.medianPsm).toLocaleString()}/sqm` : ""
      }.`,
    },
    {
      q: `What is the rental yield near ${data.name}?`,
      a:
        data.medianYieldPct != null
          ? `The median gross rental yield for condos near ${data.name} is ${data.medianYieldPct.toFixed(1)}%.`
          : `Yield data near ${data.name} is still being compiled.`,
    },
    {
      q: `Is the area around ${data.name} prone to flooding?`,
      a:
        data.avgFloodLevel != null
          ? `Buildings near ${data.name} carry an average flood-risk level of ${data.avgFloodLevel} on our L1–L5 scale.`
          : `Flood-risk data near ${data.name} is still being compiled.`,
    },
  ];

  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.near.breadcrumb, url: `${SEO_SITE_URL}/${lang}/inventory` },
    { name: data.name, url: `${SEO_SITE_URL}/${lang}/near/${station}` },
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faq)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {data.condos.length} {t.near.titleSuffix} {data.name}
        </h1>
        <p className="text-zinc-400 text-sm">
          {fill(t.near.summaryLead, data.name)} {data.condos.length} {t.near.statCondos}
          {data.medianPsm != null && ` · ${Math.round(data.medianPsm).toLocaleString()} ${t.near.statMedianPsm}`}
          {data.medianYieldPct != null && ` · ${data.medianYieldPct.toFixed(1)}% ${t.near.statMedianYield}`}
          {data.avgFloodLevel != null && ` · L${data.avgFloodLevel} ${t.near.statAvgFlood}`}
        </p>
      </header>

      <h2 className="text-xl font-semibold mb-3">{fill(t.near.listTitle, data.name)}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">{t.near.faqTitle}</h2>
        <dl className="space-y-3">
          {faq.map((f) => (
            <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <dt className="font-semibold text-zinc-200">{f.q}</dt>
              <dd className="text-zinc-400 text-sm mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 text-sm">
        <div className="text-zinc-300 font-semibold mb-1">{t.near.relatedHubs}</div>
        <ul className="text-blue-400 space-y-1">
          <li><Link href={`/${lang}/guide/investment`}>Bangkok condo investment guide</Link></li>
          <li><Link href={`/${lang}/guide/foreign-ownership`}>Can foreigners buy a condo?</Link></li>
          <li><Link href={`/${lang}/glossary/gross-yield`}>What is gross yield?</Link></li>
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Build + route check**

Run: `cd web && npm run build`
Expected: build completes; output lists `/[lang]/near/[station]` as a generated/dynamic route with no errors.
Then start dev and curl one page:
Run: `cd web && (npm run dev &) && sleep 8 && curl -s http://localhost:3000/en/near/phrom-phong | grep -o '<h1[^>]*>[^<]*' | head -1 && kill %1`
Expected: an `<h1>` like `NN condos near Phrom Phong`. A sub-threshold/unknown slug (e.g. `/en/near/xyz`) must 404.

- [ ] **Step 4: Commit**

```bash
git add web/app/[lang]/near/[station]/page.tsx
git commit -m "feat(near): station spoke pages with FAQ + breadcrumb JSON-LD"
```

---

# Group C — Hubs

### Task 8: Area-yield query for the investment hub

**Files:**
- Create: `web/lib/queries/areas.ts`

- [ ] **Step 1: Implement**

```typescript
// web/lib/queries/areas.ts
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

export type AreaYield = {
  area: string;
  condoCount: number;
  medianYieldPct: number | null;
  medianPsm: number | null;
};

function median(xs: number[]): number | null {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Median gross yield + price/sqm grouped by region name, Bangkok only. Cached 1h. */
export const getYieldByArea = unstable_cache(
  async (minCondos = 5, limit = 25): Promise<AreaYield[]> => {
    const sb = getServerSupabase();
    const rows: Array<{ gross_yield_pct: number | null; market_sale_per_sqm: number | null; region_name: string | null }> = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb
        .from("condos")
        .select("gross_yield_pct, market_sale_per_sqm, region_name, province")
        .eq("province", "bangkok")
        .range(from, from + page - 1);
      if (error || !data) break;
      rows.push(...(data as any[]));
      if (data.length < page) break;
    }
    const byArea = new Map<string, { y: number[]; p: number[] }>();
    for (const r of rows) {
      const a = r.region_name?.trim();
      if (!a) continue;
      if (!byArea.has(a)) byArea.set(a, { y: [], p: [] });
      const e = byArea.get(a)!;
      if (typeof r.gross_yield_pct === "number") e.y.push(r.gross_yield_pct);
      if (typeof r.market_sale_per_sqm === "number") e.p.push(r.market_sale_per_sqm);
    }
    const out: AreaYield[] = [];
    for (const [area, e] of byArea) {
      const count = Math.max(e.y.length, e.p.length);
      if (count < minCondos) continue;
      out.push({ area, condoCount: count, medianYieldPct: median(e.y), medianPsm: median(e.p) });
    }
    out.sort((a, b) => (b.medianYieldPct ?? 0) - (a.medianYieldPct ?? 0));
    return out.slice(0, limit);
  },
  ["yield-by-area-v1"],
  { revalidate: 3600 },
);
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/lib/queries/areas.ts
git commit -m "feat(areas): median yield/psm by Bangkok area query"
```

---

### Task 9: Hub ① — Foreign-ownership guide

Human-written authority content. Facts are accurate as of 2026 (Condominium Act B.E. 2522; 49% foreign quota; FET requirement for inbound funds; foreigners cannot own land; lease max 30 years; transfer fee 2%, specific business tax 3.3% if sold <5y else stamp duty 0.5%, withholding tax).

**Files:**
- Create: `web/app/[lang]/guide/foreign-ownership/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/app/[lang]/guide/foreign-ownership/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/faqJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";

export const revalidate = 86400;

const FAQ: FaqItem[] = [
  { q: "Can foreigners buy a condo in Thailand?", a: "Yes. Foreigners can own a condominium unit freehold in their own name, provided the building has not exceeded its 49% foreign-ownership quota and the purchase funds are remitted into Thailand from abroad in foreign currency." },
  { q: "What is the 49% foreign quota?", a: "Under the Condominium Act B.E. 2522, foreigners may collectively own up to 49% of the total saleable floor area of any condominium. The remaining 51% must be held by Thai nationals or Thai-majority entities." },
  { q: "Can a foreigner own land or a house in Thailand?", a: "Generally no. Foreigners cannot own land outright. Houses and villas are typically secured via a registered leasehold (up to 30 years) or, less commonly, through a Thai company structure — which carries legal risk and should be reviewed by a lawyer." },
  { q: "What taxes and fees apply when buying a condo?", a: "At transfer expect a 2% transfer fee on the appraised value, plus either 3.3% specific business tax (if the seller sells within 5 years) or 0.5% stamp duty, and a withholding tax. Who pays what is negotiable between buyer and seller." },
  { q: "How do I transfer the money correctly?", a: "Funds must enter Thailand in foreign currency and be converted to baht by the receiving Thai bank, which issues a Foreign Exchange Transaction (FET) certificate. The Land Department requires this proof to register foreign freehold ownership." },
];

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Foreign ownership — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.guide.foreign.title} | RealData`,
    description: t.guide.foreign.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/guide/foreign-ownership`,
      languages: langAlternates(`/guide/foreign-ownership`),
    },
    openGraph: { title: t.guide.foreign.title, description: t.guide.foreign.lead, url: `${SEO_SITE_URL}/${lang}/guide/foreign-ownership`, type: "article" },
  };
}

export default async function ForeignOwnershipPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.guide.breadcrumb, url: `${SEO_SITE_URL}/${lang}/guide/investment` },
    { name: t.guide.foreign.title, url: `${SEO_SITE_URL}/${lang}/guide/foreign-ownership` },
  ]);
  return (
    <main className="max-w-3xl mx-auto p-6 prose-invert">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(FAQ)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <h1 className="text-3xl font-bold mb-2">{t.guide.foreign.title}</h1>
      <p className="text-zinc-400 mb-6">{t.guide.foreign.lead}</p>

      <article className="space-y-6 text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">The 49% rule, in plain terms</h2>
          <p>Thailand’s Condominium Act lets non-Thais collectively own up to <strong>49% of the total saleable floor area</strong> of a condominium building. If a building still has room under that quota, a foreigner can buy a unit <Link className="text-blue-400" href={`/${lang}/glossary/freehold`}>freehold</Link> — outright, in their own name, registered at the Land Department. Once a building hits 49%, remaining units can only be sold to foreigners on a <Link className="text-blue-400" href={`/${lang}/glossary/leasehold`}>leasehold</Link> basis.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Land and houses</h2>
          <p>Foreigners generally <strong>cannot own land</strong> in Thailand. A villa or landed house is usually structured as a registered lease (maximum 30 years per term) or through a Thai company — the latter carries real legal exposure and needs qualified advice. For most overseas buyers, a condo is the only clean route to direct freehold ownership.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Moving the money (FET)</h2>
          <p>To register foreign freehold, the purchase funds must arrive in Thailand <strong>in foreign currency</strong> and be converted to baht by the receiving bank, which issues a <strong>Foreign Exchange Transaction (FET) certificate</strong>. The Land Department requires this document at transfer — so never bring the money in as baht.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Taxes and transfer costs</h2>
          <ul className="list-disc pl-5">
            <li>Transfer fee: <strong>2%</strong> of the appraised value.</li>
            <li>Specific Business Tax: <strong>3.3%</strong> if the seller owned under 5 years; otherwise <strong>0.5%</strong> stamp duty.</li>
            <li>Withholding tax: progressive (individual) or 1% (company).</li>
            <li>All of the above are negotiable between buyer and seller.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Buying process, step by step</h2>
          <ol className="list-decimal pl-5">
            <li>Reserve the unit and sign a reservation agreement.</li>
            <li>Confirm the building’s remaining <Link className="text-blue-400" href={`/${lang}/glossary/foreign-quota`}>foreign quota</Link> in writing.</li>
            <li>Due diligence: title deed, encumbrances, juristic-person debts.</li>
            <li>Remit funds from abroad and collect the FET certificate.</li>
            <li>Transfer ownership at the Land Department and pay fees.</li>
          </ol>
        </section>
      </article>

      <section className="mt-8 border-t border-zinc-800 pt-4 text-sm">
        <p className="text-zinc-500">This guide is general information, not legal advice. Next: <Link className="text-blue-400" href={`/${lang}/guide/investment`}>the Bangkok condo investment guide</Link> with live yield data.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS; route `/[lang]/guide/foreign-ownership` generated.

- [ ] **Step 3: Commit**

```bash
git add web/app/[lang]/guide/foreign-ownership/page.tsx
git commit -m "feat(guide): foreign-ownership authority hub with FAQPage JSON-LD"
```

---

### Task 10: Hub ② — Investment guide (live yield tables)

**Files:**
- Create: `web/app/[lang]/guide/investment/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/app/[lang]/guide/investment/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/faqJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { getYieldByArea } from "@/lib/queries/areas";

export const revalidate = 3600;

const FAQ: FaqItem[] = [
  { q: "What rental yield can you get on a Bangkok condo?", a: "Gross rental yields in Bangkok typically range from 4% to 7%, varying by area and building age. Older buildings and outer areas tend to show higher gross yields; prime central buildings trade at lower yields but stronger capital appreciation." },
  { q: "Which Bangkok areas have the highest condo yields?", a: "Yields shift with the market; the live table on this page ranks Bangkok areas by current median gross yield from active listings, refreshed weekly." },
  { q: "Is now a good time to buy a Bangkok condo?", a: "Use the Bubble Index to see whether a specific building is priced above or below its district, and check the BOT MRR for financing costs. RealData surfaces both so the decision rests on data, not sentiment." },
];

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Investment guide — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.guide.investment.title} | RealData`,
    description: t.guide.investment.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/guide/investment`,
      languages: langAlternates(`/guide/investment`),
    },
    openGraph: { title: t.guide.investment.title, description: t.guide.investment.lead, url: `${SEO_SITE_URL}/${lang}/guide/investment`, type: "article" },
  };
}

export default async function InvestmentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const areas = await getYieldByArea();
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.guide.breadcrumb, url: `${SEO_SITE_URL}/${lang}/guide/investment` },
    { name: t.guide.investment.title, url: `${SEO_SITE_URL}/${lang}/guide/investment` },
  ]);
  return (
    <main className="max-w-4xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(FAQ)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <h1 className="text-3xl font-bold mb-2">{t.guide.investment.title}</h1>
      <p className="text-zinc-400 mb-6">{t.guide.investment.lead}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">{t.guide.investment.yieldTableTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.guide.investment.colArea}</th>
                <th className="py-2 pr-4">{t.guide.investment.colCondos}</th>
                <th className="py-2 pr-4">{t.guide.investment.colYield}</th>
                <th className="py-2 pr-4">{t.guide.investment.colPsm}</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.area} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-200">{a.area}</td>
                  <td className="py-2 pr-4 text-zinc-400">{a.condoCount}</td>
                  <td className="py-2 pr-4 text-emerald-400">{a.medianYieldPct != null ? `${a.medianYieldPct.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 pr-4 text-zinc-400">{a.medianPsm != null ? `฿${Math.round(a.medianPsm).toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Median of active-listing data, Bangkok areas with ≥5 tracked condos. Refreshed weekly.</p>
      </section>

      <article className="space-y-4 text-zinc-300 leading-relaxed">
        <p>Bangkok condo returns split into two levers: <Link className="text-blue-400" href={`/${lang}/glossary/gross-yield`}>gross rental yield</Link> and capital appreciation. The table above ranks areas by current yield; pair it with each building’s <Link className="text-blue-400" href={`/${lang}/glossary/bubble-index`}>Bubble Index</Link> to avoid overpaying. Foreign buyers should first read <Link className="text-blue-400" href={`/${lang}/guide/foreign-ownership`}>can foreigners buy a condo?</Link>.</p>
      </article>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build + route check**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS; `/[lang]/guide/investment` generated. Spot-check `/en/guide/investment` renders a non-empty yield table.

- [ ] **Step 3: Commit**

```bash
git add web/app/[lang]/guide/investment/page.tsx
git commit -m "feat(guide): investment hub with live yield-by-area table"
```

---

### Task 11: Hub ③ — Enhance flood page with a ranking table

Add a flood-risk-by-area ranking table and explanatory prose above the existing map, without disturbing the current Bangkok choropleth logic. Reuse the `byLevel`/`levelByKhet` data already computed.

**Files:**
- Modify: `web/app/[lang]/flood/page.tsx`

- [ ] **Step 1: Build a per-district ranking from existing data**

In `web/app/[lang]/flood/page.tsx`, after `points`/`byLevel` are built (after line 185), and only for Bangkok, derive a district ranking from `levelByKhet` + condo counts. Insert:

```tsx
  // Flood-risk ranking by district (Bangkok only) — pillar table for SEO/AEO.
  const districtRanking: Array<{ district: string; level: number; condos: number }> = [];
  if (isBangkok) {
    const condosByKhet = new Map<string, number>();
    for (const c of condos) {
      const region = regionName(c);
      if (!region) continue;
      condosByKhet.set(normalize(region), (condosByKhet.get(normalize(region)) ?? 0) + 1);
    }
    for (const f of features) {
      const name = f.properties?.name ?? "";
      const lvl = f.properties?.flood_risk_level;
      if (!name || typeof lvl !== "number") continue;
      districtRanking.push({ district: name, level: lvl, condos: condosByKhet.get(normalize(name)) ?? 0 });
    }
    districtRanking.sort((a, b) => b.level - a.level || b.condos - a.condos);
  }
```

- [ ] **Step 2: Render the table between the header and `<FloodStats>`**

Insert this block just before the `<div className="mb-4"><FloodStats ... /></div>` (around line 244):

```tsx
      {isBangkok && districtRanking.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Bangkok districts by flood risk</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">District</th>
                  <th className="py-2 pr-4">Flood risk</th>
                  <th className="py-2 pr-4">Tracked condos</th>
                </tr>
              </thead>
              <tbody>
                {districtRanking.slice(0, 20).map((d) => (
                  <tr key={d.district} className="border-b border-zinc-900">
                    <td className="py-2 pr-4 text-zinc-200">{d.district}</td>
                    <td className="py-2 pr-4 text-zinc-300">L{d.level}</td>
                    <td className="py-2 pr-4 text-zinc-400">{d.condos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Flood risk is rated L1 (lowest) to L5 (highest) from Bangkok’s district flood model. See{" "}
            <Link className="text-blue-400" href={`/${lang}/glossary/flood-risk-level`}>how we score flood risk</Link>.
          </p>
        </section>
      )}
```

(`Link` is already imported at the top of the file.)

- [ ] **Step 3: Typecheck + build**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS; `/en/flood` shows the ranking table above the map; non-Bangkok cities (`?city=phuket`) are unaffected.

- [ ] **Step 4: Commit**

```bash
git add web/app/[lang]/flood/page.tsx
git commit -m "feat(flood): district flood-risk ranking table (pillar enhancement)"
```

---

# Group D — Glossary pages

### Task 12: Glossary index

**Files:**
- Create: `web/app/[lang]/glossary/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/app/[lang]/glossary/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildDefinedTermSetJsonLd } from "@/lib/seo/definedTermJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { GLOSSARY } from "@/lib/glossary";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Glossary — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.glossary.title} | RealData`,
    description: t.glossary.lead,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}/glossary`, languages: langAlternates(`/glossary`) },
  };
}

export default async function GlossaryIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const setJsonLd = buildDefinedTermSetJsonLd({
    name: t.glossary.title,
    url: `${SEO_SITE_URL}/${lang}/glossary`,
    terms: GLOSSARY.map((g) => ({ term: g.term, url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}` })),
  });
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.glossary.breadcrumb, url: `${SEO_SITE_URL}/${lang}/glossary` },
  ]);
  return (
    <main className="max-w-3xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(setJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <h1 className="text-3xl font-bold mb-2">{t.glossary.title}</h1>
      <p className="text-zinc-400 mb-6">{t.glossary.lead}</p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {GLOSSARY.map((g) => (
          <li key={g.slug} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <Link href={`/${lang}/glossary/${g.slug}`} className="font-semibold text-blue-400">{g.term}</Link>
            <p className="text-zinc-400 text-sm mt-1">{g.definition}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd web && npm run typecheck`
Expected: PASS.

```bash
git add web/app/[lang]/glossary/page.tsx
git commit -m "feat(glossary): index page with DefinedTermSet JSON-LD"
```

---

### Task 13: Glossary term page

**Files:**
- Create: `web/app/[lang]/glossary/[term]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/app/[lang]/glossary/[term]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildDefinedTermJsonLd } from "@/lib/seo/definedTermJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { GLOSSARY, getTerm } from "@/lib/glossary";

export const revalidate = 86400;

export function generateStaticParams() {
  return GLOSSARY.flatMap((g) => LANGS.map((lang) => ({ lang, term: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; term: string }> }): Promise<Metadata> {
  const { lang, term } = await params;
  const g = getTerm(term);
  if (!isLang(lang) || !g) return { title: "Glossary — RealData" };
  return {
    title: `${g.term} — definition & how it's calculated | RealData`,
    description: g.definition,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}/glossary/${term}`, languages: langAlternates(`/glossary/${term}`) },
  };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ lang: string; term: string }> }) {
  const { lang, term } = await params;
  if (!isLang(lang)) notFound();
  const g = getTerm(term);
  if (!g) notFound();
  const t = getDictionary(lang);
  const jsonLd = buildDefinedTermJsonLd({
    term: g.term,
    definition: g.definition,
    url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}`,
    inSetUrl: `${SEO_SITE_URL}/${lang}/glossary`,
  });
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.glossary.breadcrumb, url: `${SEO_SITE_URL}/${lang}/glossary` },
    { name: g.term, url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}` },
  ]);
  const related = g.related.map(getTerm).filter((x): x is NonNullable<typeof x> => x != null);
  return (
    <main className="max-w-2xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <Link href={`/${lang}/glossary`} className="text-xs text-blue-400">← {t.glossary.backToIndex}</Link>
      <h1 className="text-3xl font-bold mt-2 mb-3">{g.term}</h1>
      <p className="text-lg text-zinc-200 leading-relaxed">{g.definition}</p>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-1">{t.glossary.howWeCalculate}</h2>
        <p className="text-zinc-400 leading-relaxed">{g.howCalculated}</p>
      </section>
      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-1">{t.glossary.relatedTitle}</h2>
          <ul className="text-blue-400 text-sm space-y-1">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/${lang}/glossary/${r.slug}`}>{r.term}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build + route check**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS; routes like `/en/glossary/bubble-index` generated (12 terms × 3 langs = 36). Unknown slug `/en/glossary/foo` → 404.

- [ ] **Step 3: Commit**

```bash
git add web/app/[lang]/glossary/[term]/page.tsx
git commit -m "feat(glossary): per-term page with DefinedTerm + breadcrumb JSON-LD"
```

---

# Group E — Internal linking + crawl

### Task 14: Condo detail backlinks (station + glossary)

Feed authority from the 14k existing condo pages into the new spokes/glossary. Add a small "Nearby & metrics" block that links to the condo's station spoke (if it has one ≥ threshold) and to glossary terms.

**Files:**
- Modify: `web/app/[lang]/condo/[id]/page.tsx`

- [ ] **Step 1: Compute the station slug for this condo**

The page already fetches `livRes` (livability_metrics row). After that data is available in the component body, derive the best station slug:

```tsx
  // Backlink target: this condo's nearest rail station spoke (if any).
  const livRow = livRes.data as
    | { nearest_bts_station?: string | null; nearest_mrt_station?: string | null }
    | null;
  const { stationSlug } = await import("@/lib/stations");
  const stationName = livRow?.nearest_bts_station || livRow?.nearest_mrt_station || null;
  const stationSpokeSlug = stationName ? stationSlug(stationName) : null;
```

(Use a static top-of-file import `import { stationSlug } from "@/lib/stations";` instead of dynamic `await import` if the file's import style prefers it — match the existing pattern.)

- [ ] **Step 2: Render the backlink block near the building facts**

Add inside the page JSX, after the market-signals section (place it where other secondary cards render):

```tsx
      <section className="max-w-5xl mx-auto px-6 mt-6 text-sm">
        <div className="text-zinc-300 font-semibold mb-1">Nearby & metrics</div>
        <ul className="text-blue-400 space-y-1">
          {stationSpokeSlug && stationName && (
            <li><Link href={`/${lang}/near/${stationSpokeSlug}`}>Condos near {stationName} station</Link></li>
          )}
          <li><Link href={`/${lang}/glossary/bubble-index`}>What is the Bubble Index?</Link></li>
          <li><Link href={`/${lang}/glossary/gross-yield`}>What is gross yield?</Link></li>
          <li><Link href={`/${lang}/glossary/flood-risk-level`}>How we score flood risk</Link></li>
        </ul>
      </section>
```

> The `/near/[slug]` link is a best-effort backlink; if that station is sub-threshold the target 404s. To avoid dead links, the link is acceptable only because Google drops 404 targets quietly — but prefer guarding it: a stricter option is to import `getViableStations()` and only render the link if the slug is in that set. Implement the guard if build-time data fetching here is acceptable; otherwise keep the unguarded link and note it. **Default: add the guard.**

Guarded variant:

```tsx
  const { getViableStations } = await import("@/lib/queries/stations");
  const viable = new Set((await getViableStations()).map((s) => s.slug));
  const stationLinkOk = stationSpokeSlug != null && viable.has(stationSpokeSlug);
```

…and render the `<li>` only when `stationLinkOk`.

- [ ] **Step 3: Typecheck + build**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS. Open a condo page that has livability (e.g. one near Phrom Phong) and confirm the station link appears and resolves.

- [ ] **Step 4: Commit**

```bash
git add web/app/[lang]/condo/[id]/page.tsx
git commit -m "feat(condo): backlinks to station spoke + glossary"
```

---

### Task 15: Footer "Guides" column

**Files:**
- Modify: `web/app/[lang]/layout.tsx`

- [ ] **Step 1: Add a Guides column to the footer grid**

The footer is a `grid sm:grid-cols-3`. Change it to `sm:grid-cols-4` and add a fourth `<div>` after the "sources" column (after line 183), before the closing `</div>` of the grid:

```tsx
          <div>
            <div className="text-zinc-300 font-semibold mb-2">Guides</div>
            <ul className="space-y-1 text-zinc-500">
              <li><Link href={`/${lang}/guide/foreign-ownership`} className="hover:text-zinc-300">Foreign ownership</Link></li>
              <li><Link href={`/${lang}/guide/investment`} className="hover:text-zinc-300">Investment guide</Link></li>
              <li><Link href={`/${lang}/glossary`} className="hover:text-zinc-300">Glossary</Link></li>
            </ul>
          </div>
```

Update the grid class on line 139 from `grid sm:grid-cols-3 gap-6` to `grid sm:grid-cols-2 lg:grid-cols-4 gap-6`.

- [ ] **Step 2: Typecheck + build**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS; footer shows a Guides column on every page (zero-orphan requirement met).

- [ ] **Step 3: Commit**

```bash
git add web/app/[lang]/layout.tsx
git commit -m "feat(layout): footer Guides column (hubs + glossary)"
```

---

### Task 16: Sitemap additions

**Files:**
- Modify: `web/app/sitemap.ts`

- [ ] **Step 1: Add hub + glossary static paths**

Add `/guide/foreign-ownership`, `/guide/investment`, and `/glossary` to the existing `STATIC_PATHS` array so the per-lang loop emits them with `langAlternates`.

- [ ] **Step 2: Add glossary term + station entries**

After the existing dynamic blocks (cities/districts/condos), append:

```typescript
  // Glossary terms
  const { allTermSlugs } = await import("@/lib/glossary");
  for (const slug of allTermSlugs()) {
    for (const l of LANGS) {
      entries.push({
        url: `${SITE_URL}/${l}/glossary/${slug}`,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: langAlternates(`/glossary/${slug}`) },
      });
    }
  }

  // Station spokes (viable only)
  const { getViableStations } = await import("@/lib/queries/stations");
  const stations = await getViableStations();
  for (const s of stations) {
    for (const l of LANGS) {
      entries.push({
        url: `${SITE_URL}/${l}/near/${s.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langAlternates(`/near/${s.slug}`) },
      });
    }
  }
```

Match the actual accumulator name and entry shape used in `sitemap.ts` (it may push to a differently-named array and use a local `langAlternates`). Read the file first and conform to its existing pattern; the above is the shape to replicate, not necessarily the exact variable names.

- [ ] **Step 3: Build + verify**

Run: `cd web && npm run build`
Expected: PASS. Then check the generated sitemap contains new URLs:
Run: `cd web && (npm run dev &) && sleep 8 && curl -s http://localhost:3000/sitemap.xml | grep -c -E '/near/|/glossary/|/guide/' && kill %1`
Expected: a count well above zero (≈ 73 stations + 12 terms + 3 hubs, × langs).

- [ ] **Step 4: Commit**

```bash
git add web/app/sitemap.ts
git commit -m "feat(sitemap): add station, glossary, and hub routes"
```

---

### Task 17: Extend llms.txt

**Files:**
- Modify: `web/public/llms.txt`

- [ ] **Step 1: Append a wiki section**

Add to `web/public/llms.txt` (match its existing markdown style):

```markdown
## Guides & glossary (wiki)

- /en/guide/foreign-ownership — Can foreigners buy a condo in Thailand? 49% quota, freehold vs leasehold, FET money transfer, taxes.
- /en/guide/investment — Bangkok condo investment guide with live median gross-yield-by-area tables (refreshed weekly).
- /en/glossary — Definitions of every metric we publish (Bubble Index, gross yield, flood risk level L1–L5, livability score, foreign quota, MRR) and exactly how each is calculated.
- /en/near/{station} — Per-station pages listing condos within 1 km of each Bangkok rail station with median price/sqm, gross yield, flood risk, and Google ratings.
```

- [ ] **Step 2: Commit**

```bash
git add web/public/llms.txt
git commit -m "docs(llms): list wiki hubs, glossary, and station pages"
```

---

## Final verification (after all tasks)

- [ ] `cd web && npm run typecheck` → PASS.
- [ ] `cd web && npm run build` → PASS; route list includes `near/[station]`, `guide/foreign-ownership`, `guide/investment`, `glossary`, `glossary/[term]`.
- [ ] `curl -s localhost:3000/sitemap.xml | grep -cE '/near/|/glossary/|/guide/'` → large positive count.
- [ ] Spot-check rendered JSON-LD on `/en/near/phrom-phong` (FAQPage + BreadcrumbList), `/en/guide/foreign-ownership` (FAQPage), `/en/glossary/bubble-index` (DefinedTerm), `/en/glossary` (DefinedTermSet) via View Source.
- [ ] Every new page reachable from the footer Guides column or a hub/condo link (zero orphans).

## Self-review notes (against the spec)

- **Spec coverage:** station spokes (Tasks 5–7), hub ① foreign-ownership (9), hub ② investment + live tables (8,10), hub ③ flood enhancement (11), glossary index+terms (3,12,13), JSON-LD FAQPage/Breadcrumb/DefinedTerm (1,2,7,9,10,12,13), internal linking incl. condo→spoke backlink (14) + footer zero-orphan (15), sitemap (16), llms.txt (17), i18n headings-only (4). All Phase-1 spec items mapped.
- **Deviations from spec (data-driven, approved):** station scope is **≤1 km + ≥5 condos (~73 stations)**, single `/near/[station]` namespace (no BTS/MRT split) because the line labels are unreliable and only 1,885 condos carry station data — not the spec's "100+ at ≤500m". Korean/Thai prose for new sections is English-mirrored (th) / partially translated (ko) per the Phase-1 "English-first, Thai-ready structure" rule.
- **Non-goals respected:** no area×intent matrix, no developer pages, no free-form LLM generation.
