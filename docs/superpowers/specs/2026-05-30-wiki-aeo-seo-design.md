# Wiki-Style Data Pages for AEO/SEO Dominance — Design

**Date:** 2026-05-30
**Status:** Approved (design); pending implementation plan
**Goal:** Maximize organic **traffic** and rank #1 for "Bangkok real estate" queries by turning our unique dataset into a comprehensive, citable wiki — winning both classic SEO long-tail and AI answer-engine (AEO) citations.

## Context

The site (Next.js App Router, i18n en/ko/th) already has: `city`, `district`, `condo/[id]`, `best/[city]/[slug]`, `blog`, `compare`, `flood`, `yields`, `macro`, `ask` (RAG answer engine), `inventory`. Existing AEO/SEO infra we reuse: `lib/seo/condoJsonLd.ts` (ApartmentComplex schema tuned for AI Overviews/Perplexity), `lib/seo/faqJsonLd.ts` (FAQPage), `public/llms.txt`, RSS.

**Data moat** (per condo, ~14k buildings): price/sqm, gross yield, bubble_index (vs district avg), flood_risk_level, livability (nearest BTS/MRT station + distance, hospitals/schools/supermarkets within 1km), completion_year, total_units, 4-portal listings, **Google rating + review_count** (being enriched now), plus macro (BOT MRR) and price history. Local Thai portals don't expose this analytically — that's the differentiator.

## Strategic Decisions (locked)

1. **Goal = traffic / rank #1**, not just leads. Breadth + authority.
2. **Market: English first, Thai analytical second.** English investor queries map 1:1 to our data, competition is beatable, AEO is English-dominant. Thai portals (DDproperty/Hipflat/Baania) are too entrenched for head-on programmatic; auto-translated Thai hurts helpful-content. Thai gets only the high-value analytical pages, native-polished, in Phase 2. Korean stays niche (as-is).
3. **Approach = Hybrid hub-and-spoke (pillar-cluster).** Hubs win head/AEO and distribute authority; spokes capture long-tail and link back up.
4. **i18n: numbers/tables/charts are language-agnostic** (zero translation); only headings + summary prose are localized. Build English; structure stays Thai-ready.

## Scope — Phase 1 (this spec)

### Page types & routes

| Type | Route | Count | Role |
|---|---|---|---|
| Station spoke | `/[lang]/near/[station]` | BTS+MRT ≈ 100+ | Long-tail engine: condos near a station + price/yield/flood/rating |
| Hub ① | `/[lang]/guide/foreign-ownership` | 1 | "Can foreigners buy a condo in Thailand?" — AEO core |
| Hub ② | `/[lang]/guide/investment` | 1 | "Bangkok condo investment guide 2026" + live yield-by-area tables |
| Hub ③ (enhance) | `/[lang]/flood` (existing) | 1 | Promote existing flood page to pillar (ranking table + prose) |
| Glossary wiki | `/[lang]/glossary` + `/[lang]/glossary/[term]` | 10–15 | Definition queries (AEO) + internal-link anchors |

Station list is **derived from data** (distinct `nearest_bts_station` / `nearest_mrt_station` values on condos) — no new station table.

### Content per page type (anti-thin-content rule)

**Core principle: prose is templated from data, never free-LLM-generated** — prevents hallucination and thin/duplicate content.

- **Station spoke:** data-templated summary (e.g., "23 condos within 500m of Asok, median ฿182k/sqm, median gross yield 5.1%, avg flood risk L2, avg Google rating 4.1…") → condo list (reuse existing `BuildingCard`) → FAQ. Real per-station numbers make each page unique.
- **Hub ① foreign-ownership:** human-written authority content (49% foreign quota, leasehold vs freehold, taxes, process) + `FaqItem[]` → FAQPage JSON-LD. Primary AI-citation target.
- **Hub ② investment guide:** human-written skeleton + **live data tables** (yield/bubble by area; reuse existing queries). Auto-fresh from weekly scrape.
- **Hub ③ flood:** existing `FloodMapSvg` + flood-risk ranking table by area + strengthened explanatory prose.
- **Glossary:** per term — definition + "how we calculate it" + links to condos/pages using it. `DefinedTerm` JSON-LD.

### Internal linking (authority flow)

- Hub → relevant station spokes + glossary (downward authority).
- Station spoke → member condos + related hubs + glossary terms.
- Condo detail (`condo/[id]`) → its station spoke + glossary (back-link so existing 14k pages feed authority into spokes).
- Glossary → hubs/spokes that use the metric.
- Every page reachable via footer/hub static links — **zero orphan pages**.

### Structured data (JSON-LD)

- Station/hub: `FAQPage` (reuse `faqJsonLd.ts`) + `BreadcrumbList`.
- Condo detail: keep `condoJsonLd.ts` (ApartmentComplex) + geo `Place` strengthening.
- Glossary: `DefinedTerm` + `DefinedTermSet`.
- All pages: `BreadcrumbList` for hierarchy → richer AI Overview / rich-result eligibility.

### Crawl ingestion

- Add all new routes to `sitemap.xml`.
- Static links from footer + hubs (no JS-only discovery).
- Extend `public/llms.txt` with the new hubs/glossary so answer engines map the site.

## Non-Goals (Phase 1)

- Area × intent matrix pages (e.g., "best yield condos in Sukhumvit") → Phase 2.
- Developer/brand pages → Phase 2.
- Thai/Korean localized prose → Phase 2 (structure is Thai-ready now).
- No free-form LLM page generation.

## Phase 2 (separate spec, later)

Area×intent programmatic matrix, developer pages, Thai native-polished port of analytical pages (hubs + glossary).

## Assumptions to verify during planning

- Exact table/view exposing livability (`nearest_bts_station`, distances) to the web layer — check how `condo/[id]/page.tsx` currently reads these signals; reuse the same source.
- Station-name normalization (spelling/casing variants across sources) before deriving slugs.
- Distance threshold for "near a station" (start: ≤500m, with a ≤1km fallback when sparse).
- City scope: Bangkok-first for stations (multi-city station pages deferred).

## Success metrics (90 days)

- ≥90% of new routes indexed (Search Console).
- Rising impressions/clicks on station + glossary queries.
- Our domain appearing as a citation in AI answer engines (Perplexity/ChatGPT) for Bangkok-condo questions.
- Zero thin/duplicate-content flags (each page carries unique data).
