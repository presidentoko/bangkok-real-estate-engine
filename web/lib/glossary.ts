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
    slug: "resale-liquidity",
    term: "Resale Liquidity Score",
    definition:
      "RealData's Resale Liquidity Score (0–100) estimates how easily a unit in a building can be re-sold — higher means buyers are found faster and more of the supply clears.",
    howCalculated:
      "We track every for-sale listing in a building from the day it appears to the day it leaves the market. The score blends how much of recent supply actually cleared (absorption), how fast it cleared, and how long current unsold inventory has been sitting. Buildings with too few tracked listings show no score rather than a misleading one. Stored as value_scores.liquidity_score. It is an availability signal, not a guarantee of sale price.",
    related: ["bubble-index", "days-on-market"],
  },
  {
    slug: "retiree-suitability",
    term: "Retiree Suitability Score",
    definition:
      "RealData's Retiree Suitability Score (0–100) rates how well a building's location suits a retiree, weighting nearby healthcare and clean air ahead of car-free transit and daily errands.",
    howCalculated:
      "We blend healthcare proximity (hospitals/clinics within 1km), air quality (WAQI AQI), distance to the nearest BTS/MRT, and supermarkets within 1km — weighted toward the factors that matter most to Thailand's retirement-visa (O-A/O-X) buyers rather than young investors. Buildings without location data show no score.",
    related: ["livability-score", "flood-risk-level"],
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
    related: ["livability-score", "ground-stability"],
  },
  {
    slug: "ground-stability",
    term: "Ground Stability (Land Subsidence, L1–L5)",
    definition:
      "Ground Stability rates how much a location is sinking due to land subsidence, on a five-step scale from L1 (very low) to L5 (severe), because Bangkok sits on soft marine clay.",
    howCalculated:
      "We assign each building its district's subsidence level (risk_factors.subsidence_level) from published InSAR and groundwater-monitoring studies. Bangkok sank as fast as ~120mm/year in the 1980s; groundwater regulation cut inner-city rates to near zero, but the eastern soft-clay belt and coastal south keep sinking, which compounds monsoon-flood risk over a 10–20 year horizon. District-level estimate, not a per-building survey.",
    related: ["flood-risk-level"],
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
