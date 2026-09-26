// English — primary dictionary. Other locales must mirror this shape;
// TypeScript will catch missing keys via the Dict type.

const dict = {
  brand: {
    name: "RealData",
    tagline: "powered by data, not influencers",
  },
  nav: {
    flood: "Flood",
    inventory: "Inventory",
    reality: "Marketing vs Reality",
    data: "Data",
    blog: "Blog",
    about: "Methodology",
    contact: "Contact",
    retiree: "Retiree",
    home: "Home",
    search: "Search",
    askAi: "Ask AI",
    saved: "Saved",
    yields: "Yields",
    macro: "Macro rates",
    compare: "Compare",
  },
  footer: {
    about:
      "Powered by data, not influencers. We measure every Thai condo we can find across 4 portals — no developer money, and nobody can pay to move a number.",
    sectionsTitle: "Sections",
    sourcesTitle: "Data sources",
    sources: [
      "Listings & price: hipflat, dotproperty, ddproperty, fazwaz",
      "Macro: Bank of Thailand (BTWS_STAT)",
      "Flood: BMA + JICA + 2011 great flood records",
      "Infrastructure & transit: OpenStreetMap (Overpass)",
    ],
    copyright: "Independent measurement · nobody can buy a ranking",
    saved: "Saved",
    underpricedAlerts: "Underpriced alerts",
    rssFeed: "RSS feed",
    guidesTitle: "Guides",
    guideForeignOwnership: "Foreign ownership",
    guideInvestment: "Investment guide",
    guideGlossary: "Glossary",
    legalTitle: "Legal",
    privacy: "Privacy",
    terms: "Terms",
  },
  home: {
    heroPretitle: "Independent measurement · 4 portals · 9 cities",
    heroTitle1: "Buy a Thai condo on",
    heroTitle2Highlight: "evidence",
    heroTitle3: ", not influencers.",
    heroLead:
      "Every for-sale and for-rent condo we can find — yields against the Bank of Thailand mortgage rate, foreign-quota inventory, district flood risk, cross-portal price divergence. Ask anything and we cite the building.",
    ctaFlood: "Ask the data →",
    ctaInventory: "See top-yield condos",
    statsLabels: {
      buildings: "buildings",
      listings: "individual units",
      chartPts: "monthly price datapoints",
      floodMapping: "districts mapped",
    },
    featuresHeader: "What we surface",
    features: [
      {
        href: "/yields",
        emoji: "📈",
        title: "Yield Rankings",
        desc: "Every condo with enough sale + rent data, ranked by gross yield against the current Thai mortgage rate. Spread positive = rent covers the mortgage.",
        badge: "MRR-benchmarked",
      },
      {
        href: "/macro",
        emoji: "🏦",
        title: "Mortgage Macro",
        desc: "Bank of Thailand policy rate, MRR, MLR, MOR, deposit max — the floor on every mortgage product. Updated daily.",
        badge: "BOT daily refresh",
      },
      {
        href: "/flood",
        emoji: "🌊",
        title: "Bangkok Flood Map",
        desc: "Monsoon flood risk for every Bangkok district on a 0–5 scale, with every condo plotted as a dot in its risk colour.",
        badge: "50 districts scored",
      },
      {
        href: "/reality",
        emoji: "❌✅",
        title: "Marketing vs Reality",
        desc: "Influencer / ad claims placed next to our measured data. Bubble Index verdict per building.",
        badge: "Cross-portal verified",
      },
    ],
    featured: {
      superValue: {
        eyebrow: "★ SUPER VALUE",
        title: "Top picks — central + underpriced + maxed-out amenities",
        subtitle: (sv: number, total: number) =>
          `${sv} buildings flagged out of ${total} we scored`,
      },
      bubbleWatch: {
        eyebrow: "❌ BUBBLE WATCH",
        title: "Most-overpriced vs district — verify before buying",
        subtitle: "Same khet, same square meter — these cost 3-4× the local average",
      },
      dryHighGround: {
        eyebrow: "🌊 DRY HIGH GROUND",
        title: "Districts that stayed dry in 2011 + every monsoon since",
        subtitle: "Flood Level 1/5 — central elevated, robust drainage",
      },
    },
    citiesHeader: "Other markets we cover",
    citiesLead: "Same data engine, different cities. Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi, Krabi, Koh Samui, Chiang Rai.",
    inventoryTitle: "Bangkok Condo Inventory",
    inventoryStatsCondos: "buildings",
    inventoryStatsDistricts: "districts",
    inventoryGeoSuffix: "geo-located",
    inventoryFullList: "full list →",
    inventoryHelp:
      "Yellow dots = buildings with lat/lng. Click a dot for the full data report.",
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "What is RealData?",
        a: "Independent measurement of every Thai condo we can find — sale prices, rents, yields, amenities, BTS/MRT distance, flood risk, foreign-quota inventory. Across Bangkok and 8 secondary cities. The message: don't buy because an influencer recommended it. Verify with data first.",
      },
      {
        q: "Where does the data come from?",
        a: "Listings: hipflat, dotproperty, ddproperty, fazwaz (cross-checked). Macro rates: Bank of Thailand BTWS_STAT. Flood: BMA Drainage Department + JICA reports + 2011 great flood inundation records. Infra & transit: OpenStreetMap (Overpass API). Air quality: WAQI. All public data, ToS-compliant.",
      },
      {
        q: "What is the Bubble Index?",
        a: "(building's price-per-sqm ÷ district average price-per-sqm) × 100. 100 = at market. 200 = double the average. Below 80 = underpriced; above 130 = bubble suspect.",
      },
      {
        q: "What is gross rental yield and how is it computed?",
        a: "(12 × median monthly rent ÷ median sale price) × 100%. Only buildings with at least 2 sale and 2 rent listings count. USD-priced rows are converted to THB first. Outliers above 25% are dropped as price-parse errors. Net yield is typically 1.5–3pp lower after CAM, vacancy, and management.",
      },
      {
        q: "Can a foreigner own this condo?",
        a: "Thai law caps foreign ownership at 49% of a building's floor area. The remaining 'foreign quota' varies per project. We surface each FazWaz building's measured foreign-quota inventory share — the % of for-sale units still flagged Foreign Quota — so you can see at a glance whether a building is foreign-buyable.",
      },
      {
        q: "How does RealData make money?",
        a: "Two ways, and neither one can touch a measurement. We carry standard display advertising, served by an ad network that has no access to our data and no say in what it says — the same wall a newspaper keeps between its ad pages and its newsroom. And when a reader asks for an expert opinion via the contact form, we route the lead to one vetted independent broker who knows the sub-market; the broker pays us a flat referral if a deal closes, and the reader pays nothing extra. What we never take is developer money: no paid placement, no sponsored rankings, no building buying its way up a list.",
      },
      {
        q: "How often is the data refreshed?",
        a: "Bangkok listings refresh daily for new inventory. Full Thailand sweep runs weekly across hipflat, dotproperty, ddproperty, fazwaz. Yields and bubble index recompute after every ingest cycle. BOT macro rates refresh daily. Flood layer reviews annually. Each building page shows its own measurement timestamp.",
      },
      {
        q: "What is the typical rental yield for condos in Bangkok?",
        a: "Gross rental yields for Bangkok condos measured by RealData typically range from 3% to 7%, with a median around 4.5–5%. Central districts like Silom and Sukhumvit tend toward 3.5–5% due to higher sale prices, while outer areas like Lat Phrao and Phra Khanong can reach 5–7%. Net yield is typically 1.5–3 percentage points lower after CAM fees, vacancy, and management costs.",
      },
      {
        q: "How much does a condo in Bangkok cost?",
        a: "Bangkok condo prices span a wide range: studios and 1-bedroom units in outer districts start from ฿1.5–3M (≈$40,000–85,000). Mid-market central condos (Asok, Phrom Phong, Ari) run ฿4–10M. Premium high-rise units in Silom or Sukhumvit start from ฿10M and can exceed ฿50M. The Bubble Index on each building page shows whether a specific condo is priced above or below its district average.",
      },
      {
        q: "What is the 49% foreign ownership rule for Thai condos?",
        a: "Thai law (Condominium Act Section 19) caps total foreign ownership in any condo building at 49% of total floor area. This means foreigners can only buy units in the 'foreign quota' — the portion up to 49% — and once full, the building is closed to new foreign purchases. RealData surfaces the measured foreign-quota inventory share per building from FazWaz listings, so buyers can check whether a project still has foreign-eligible units.",
      },
      {
        q: "Which Bangkok districts are best for condo investment?",
        a: "Based on RealData measurements, districts combining low flood risk with above-average yields include Phra Khanong (On Nut / Ekkamai area), Bang Na, and Khlong Toei. Sukhumvit central (Asok to Phrom Phong) has lower yields but strong resale liquidity. For budget buyers, Lat Phrao and Chatuchak offer yield-to-price ratios above the city median. Each district page shows median yield, median sale price, and flood risk for every tracked building.",
      },
    ],
  },
  flood: {
    title: "🌊 Flood Risk Map",
    lead: "Which Bangkok districts flood every monsoon season, which stay dry. Verify before you buy. Built from BMA Drainage Department + JICA reports + 2011 great flood inundation records.",
    whyDistrict: "Why district-level?",
    whyDistrictBody:
      "BMA does not publicly release block-level flood GeoJSON. District-level baseline is enough for macro risk decisions. Within a district, road elevation and drainage still vary — site visits before purchase.",
    refreshTitle: "Refresh cadence",
    refreshBody:
      "Once a year (after BMA monsoon report). New drainage tunnel / pump station news triggers a re-score for that district.",
    statsTotal: "buildings",
    statsDanger: "in Level 4–5 high-risk zones",
    statsSafe: "in Level 1–2 safe zones",
    statsHeader: "Bangkok condo inventory — flood risk distribution",
    statsHeaderInverse: "Conversely, only",
    statsHeaderInverseEnd: "are in Level 1–2 safe zones.",
    statsUnmatched: (n: number) =>
      `* ${n.toLocaleString()} buildings excluded from analysis (khet ↔ flood data unmatched)`,
  },
  floodLegend: {
    title: "Bangkok monsoon flood risk",
    descriptors: {
      0: "None observed",
      1: "Very low — central elevated",
      2: "Low — occasional puddling",
      3: "Moderate — neighborhood-level flooding common",
      4: "High — significant 2011 + recurring waist-deep flooding",
      5: "Severe — repeat full-area inundation in monsoon",
    } as Record<number, string>,
    footnote:
      "Source: BMA Drainage Dept + JICA reports + 2011 great flood. District (khet) baseline, not coordinate level. Local variation exists.",
  },
  floodDistrict: {
    eyebrow: "Bangkok flood check",
    h1: (d: string, level: number) => `Does ${d} flood? Risk level ${level} of 5`,
    altSpelling: (names: string) => `Also written ${names}.`,
    verdictTitle: "The short answer",
    verdict: {
      0: (d: string) =>
        `No monsoon flooding is on record for ${d} in the sources we score against. ` +
        `What remains is a burst main or a blocked soi drain — not seasonal inundation.`,
      1: (d: string) =>
        `${d} is one of the driest khet in Bangkok. Comparatively high ground with BMA ` +
        `drainage that held through the 2011 great flood; street water clears within hours ` +
        `of a heavy storm.`,
      2: (d: string) =>
        `${d} carries low risk. Expect ankle-deep puddling on the smaller sois during a hard ` +
        `monsoon downpour, draining the same day. It was not part of the 2011 inundation zone.`,
      3: (d: string) =>
        `${d} floods at neighbourhood level. Several times a monsoon season individual sois ` +
        `hold water for hours; ground-floor parking and garden units are the exposure. Not a ` +
        `reason to rule the district out — a reason to check the building’s own ground level.`,
      4: (d: string) =>
        `${d} is high risk. It was significantly inundated in the 2011 great flood and still ` +
        `sees recurring waist-deep water in the worst monsoon weeks. Ground-floor and podium ` +
        `units need a hard look, and past water is a question to put to the juristic office.`,
      5: (d: string) =>
        `${d} is among the most flood-exposed khet in Bangkok. Repeat full-area inundation ` +
        `during monsoon season is on record, including weeks of standing water in 2011. Buy ` +
        `here on price, with eyes open — not on the assumption that it stays dry.`,
    } as Record<number, (d: string) => string>,
    rankLine: (rank: number, total: number) =>
      `Ranked ${rank} of ${total} Bangkok districts, riskiest first.`,
    trackedTitle: (d: string) => `Condos we track in ${d}`,
    trackedNote: (n: number, d: string) =>
      `${n} buildings in ${d} inherit this district score. We do not have block-level ` +
      `elevation, so a building’s own ground height still matters.`,
    trackedNone: (d: string) => `We do not yet track a published building in ${d}.`,
    seeAllInDistrict: (d: string) => `All ${d} condos — yields, prices, listings`,
    saferTitle: "Drier districts",
    riskierTitle: "Wetter districts",
    sameTitle: (level: number) => `Other districts at level ${level}`,
    allTitle: "All 50 Bangkok districts by flood risk",
    methodTitle: "How this level is set",
    methodBody:
      "RealData scores each of Bangkok’s 50 khet from 0 to 5 against BMA Drainage Department " +
      "records, JICA flood-frequency reports and 2011 great flood inundation mapping. The layer " +
      "is district-level, not coordinate-level, and is reviewed once a year after the BMA " +
      "monsoon report.",
    faqTitle: (d: string) => `${d} flood risk — frequently asked questions`,
    faq: {
      q1: (d: string) => `Does ${d} flood in Bangkok?`,
      q2: (d: string) => `Was ${d} affected by the 2011 Bangkok flood?`,
      a2high: (d: string) =>
        `Yes. ${d} sits inside the 2011 inundation zone — the flood that reached the northern ` +
        `and eastern khet and held for weeks. Its current level reflects that history.`,
      a2low: (d: string) =>
        `Largely no. ${d} stayed outside the worst of the 2011 inundation, protected by ` +
        `elevation and the King’s Dyke barrier line. Its current level reflects that.`,
      q3: (d: string) => `Is it safe to buy a condo in ${d}?`,
      a3: (d: string) =>
        `Flood level is one input, not a verdict. Check the building itself: ground-floor height ` +
        `above the soi, whether parking is at grade, and what the juristic office says about ` +
        `past water. The ${d} score tells you the baseline you are starting from.`,
    },
  },
  /** /best/[city]/[slug] copy. `chunk` is the noun phrase reused in the H1,
   *  the <title>, the FAQ question and the cross-link chips, so it must read
   *  correctly both standalone and wrapped by bestTitle/bestH1. */
  best: {
    title: (chunk: string) => `Best ${chunk} — RealData`,
    h1: (chunk: string) => `Best ${chunk}`,
    filters: {
      "under-3m": {
        chunk: (c: string) => `condos under ฿3M in ${c}`,
        desc: (c: string) =>
          `Every ${c} condo we measure with average sale price below ฿3,000,000 — ranked by gross rental yield against the Thai mortgage benchmark.`,
      },
      "under-5m": {
        chunk: (c: string) => `condos under ฿5M in ${c}`,
        desc: (c: string) =>
          `${c} condos with average sale price under ฿5,000,000, ranked by yield and spread vs Thai MRR. Cross-portal verified pricing.`,
      },
      "under-10m": {
        chunk: (c: string) => `condos under ฿10M in ${c}`,
        desc: (c: string) =>
          `Mid-tier ${c} condos under ฿10,000,000, yield-ranked. Every figure measured across hipflat, dotproperty, ddproperty, fazwaz.`,
      },
      "under-20m": {
        chunk: (c: string) => `condos under ฿20M in ${c}`,
        desc: (c: string) =>
          `Premium ${c} condos under ฿20,000,000 with measured rental yields and foreign-quota inventory where available.`,
      },
      "top-yield": {
        chunk: (c: string) => `top rental-yield condos in ${c}`,
        desc: (c: string) =>
          `${c} condos with measured gross rental yield ≥5%. Pre-tax, pre-vacancy figures with at least 2 sale + 2 rent listings per building.`,
      },
      "under-5m-top-yield": {
        chunk: (c: string) => `best-yield condos under ฿5M in ${c}`,
        desc: (c: string) =>
          `${c} condos under ฿5,000,000 that hit ≥5% gross rental yield — the entry-tier sweet spot for cashflow buyers.`,
      },
      "under-10m-top-yield": {
        chunk: (c: string) => `best-yield condos under ฿10M in ${c}`,
        desc: (c: string) =>
          `${c} condos under ฿10,000,000 with ≥5% gross yield. Compare against the current Thai MRR mortgage rate.`,
      },
    },
  },
  hover: {
    buildings: "buildings",
    building: "building",
    levelUnknown: "no data",
    geoLocatedSuffix: "geo-located",
  },
  weeklyPost: {
    eyebrow: "RealData weekly",
    numbersTitle: "This week's numbers",
    ctaHeadline: "Want a vetted broker's take on any building in this post?",
    shareTitle: "Found this useful? Share the post",
    footerNote:
      "This post is part of RealData's auto-generated weekly series, drawn from our live measurement of every Thai condo we can find across hipflat, dotproperty, ddproperty, and fazwaz. Every number cited above was re-verified against the live database immediately before publish. See more at",
  },
  blogIndex: {
    title: "RealData Blog",
    lead: "We measure 1,000+ Bangkok condos continuously. Every post is verifiable against our own data — no speculation, just numbers.",
  },
  langSwitcher: {
    label: "Language",
  },
  reportCard: {
    eyebrow: "RealData · Condo Report Card",
    superValueBadge: "Super Value",
    tilePrice: "Price vs district",
    tilePriceDetailNoData: "no pricing data yet",
    tilePriceDetail: (idx: number) => `Bubble Index ${idx} · vs district avg`,
    tileTransit: "Transit",
    tileTransitNoData: "no transit data",
    tileInfra: "Infrastructure",
    tileInfraNoData: "no data",
    tileFlood: "Flood risk",
    tileFloodUnknown: "unknown",
    tileFloodDetail: (lvl: number) => `Level ${lvl}/5 · district baseline`,
    latestListing: "Latest listing",
    tagline1: "powered by data,",
    tagline2: "not influencers",
  },
  dataShowcase: {
    title: "The data — at scale",
    lead: "What 9 cities and 6 months of weekly crawls actually look like. Counts below recompute on every page load; listings refresh daily, full Thailand sweep weekly.",
    statsHeader: "Coverage",
    statBuildings: "buildings tracked",
    statListings: "active listings",
    statChartPoints: "monthly price datapoints",
    statRegions: "sub-areas mapped",
    statCities: "cities",
    statLangs: "languages",
    perCityHeader: "Per-city snapshot",
    perCityCity: "City",
    perCityBuildings: "Buildings",
    perCityScored: "Scored",
    perCityMedianPrice: "Median sale",
    perCityMedianBubble: "Median bubble",
    bubbleHeader: "Bubble Index distribution",
    bubbleNote: "How condos are priced relative to their sub-area median. Tall green = lots of underpriced; tall red = lots of bubble suspects.",
    bubbleBucketLabel: (lo: number, hi: number) =>
      hi >= 9999 ? `${lo}+` : `${lo}–${hi}`,
    topMostExpensiveHeader: "Top 10 most expensive (median sale price)",
    topSuperValueHeader: "Top 10 Super Value picks (underpriced + livable)",
    superValueBadge: "★ Super Value",
    pageCTA: "Click any building → full RealData report",
  },
  stale: {
    title: "Stale Listings",
    lead: "Buildings whose listings have sat unsold for the longest. Long days-on-market without a price reduction = priced too high vs market interest. RealData stamps each listing's first appearance, so we can show this signal hipflat doesn't expose.",
    note: "Days-on-Market data accumulates from each weekly Tier B re-scrape. The longer this site runs, the sharper the signal.",
    table: { rank: "#", condo: "Building", city: "City", listings: "Active", dom: "Median DOM", maxDom: "Longest" },
    domDays: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    empty: "No stale buildings yet — DOM data is still accumulating. Check back next week.",
  },
  developerTable: {
    condo: "Condo", year: "Year", units: "Units", sale: "Sale", yield: "Yield", rating: "Rating", retiree: "Retiree",
  },
  retireeTable: {
    rank: "#", condo: "Condo", district: "District", score: "Score", fq: "FQ %", sale: "Sale", yield: "Yield",
  },
  bestTable: {
    rank: "#", condo: "Condo", district: "District", yield: "Yield", spread: "Spread", sale: "Sale", rent: "Rent", fq: "FQ",
  },
  press: {
    title: "Press kit",
    lead: "RealData covers 1,800+ Thai condos with independent measurement. Below are the assets we share when journalists or analysts ask about specific markets.",
    sections: [
      {
        title: "What RealData is",
        body: "Independent data engine measuring every listed condo across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi, Krabi, Koh Samui, Chiang Rai. Bubble Index per building, BMA flood risk per Bangkok district, OSM-derived livability, days-on-market accumulating since 2026-05.",
      },
      {
        title: "What we don't do",
        body: "No developer money, no influencer placement, no sponsored data, no building buying its way up a ranking. Display advertising is served by a third-party network that never sees the measurements, and the Marketing-vs-Reality slot is labelled paid promotion that never softens the data column.",
      },
    ],
    contactsHeader: "Contact for interviews / data licensing",
    contactsBody: "Message @Bkkbudong_bot on Telegram or use the contact form. We respond within 2 business days.",
    statsHeader: "Headline numbers (live)",
    factsheet: [
      { k: "Buildings tracked", v: "1,800+" },
      { k: "Cities covered", v: "9 (incl. Bangkok, Phuket, Chiang Mai)" },
      { k: "Languages", v: "EN / KO / TH" },
      { k: "Data refresh", v: "Weekly listings, daily DOM tick" },
      { k: "License", v: "Cite RealData with link to source page" },
    ],
  },
  about: {
    title: "Methodology",
    lead: "How RealData measures every Thai condo. Sources, formulas, refresh cadence, and what we deliberately don't do.",
    sectionMission: {
      title: "What we do",
      body: "We measure 1,700+ condos across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, and Chonburi continuously. Every building gets a Bubble Index, livability score, and (in Bangkok) a flood-risk level — independent of the listing source's marketing copy. No developer money, no paid placement, no influencer deals.",
    },
    sectionSources: {
      title: "Where the numbers come from",
      items: [
        { k: "Listings & price", v: "hipflat.co.th, weekly re-crawl. Per-unit listings (sale + rent), area, bedrooms, publisher." },
        { k: "Flood risk (Bangkok)", v: "BMA Drainage Department + JICA reports + 2011 great-flood inundation records. District (khet) baseline, not coordinate-level." },
        { k: "Transit & amenities", v: "OpenStreetMap via Overpass API. BTS/MRT stations + hospitals/schools/supermarkets within 1km." },
        { k: "District boundaries", v: "OSM admin_level=6 polygons. Used for choropleth + per-district aggregations." },
      ],
    },
    sectionFormulas: {
      title: "How we score",
      items: [
        { k: "Bubble Index", v: "(building's median price-per-sqm ÷ district median price-per-sqm) × 100. 100 = at market. 200 = double the local average. <80 = underpriced. >130 = bubble suspect. Districts with fewer than 5 sampled buildings excluded (small-sample noise)." },
        { k: "Livability Score", v: "Weighted aggregate of BTS/MRT distance, hospitals/schools/supermarkets within 1km, and total amenities. 0–100 scale." },
        { k: "Super Value flag", v: "Underpriced (Bubble Index < 90) AND top-quartile livability." },
        { k: "Flood Risk (0–5)", v: "0 = none observed, 1 = very low (central elevated), 2 = occasional puddling, 3 = neighborhood flooding common, 4 = waist-deep recurring, 5 = severe full-area inundation." },
      ],
    },
    sectionWhatWeDont: {
      title: "What we deliberately don't do",
      items: [
        "We don't broker listings. Listing clicks go to the original hipflat page.",
        "We don't take developer money, and no agent can pay to change a number.",
        "We don't let advertising touch the data. Display ads are served by a third-party network that never sees our measurements; Marketing-vs-Reality slots are paid promotion, clearly labeled.",
        "We don't accept influencer placement or 'sponsored content' that shapes our data.",
        "We don't publish bubble_index values above 10× district median — those are data-quality issues, not real prices.",
      ],
    },
    sectionRefresh: {
      title: "Refresh cadence",
      items: [
        { k: "Listings & price", v: "Weekly hipflat re-crawl" },
        { k: "Flood risk", v: "Annual (after BMA monsoon report)" },
        { k: "Transit & amenities", v: "Quarterly review on OSM change detection" },
      ],
      footer: "Each building page surfaces its measurement timestamp.",
    },
    sectionLimits: {
      title: "What we can't see (yet)",
      items: [
        "Block-level flood polygons — BMA does not publish them. We use district-level baselines.",
        "Foreigner-quota availability per building — varies by project office. Confirm before purchase.",
        "Off-plan / pre-construction pipeline — we only measure standing inventory listed on hipflat.",
        "Resale velocity — we have median sale price, but not days-on-market or sale-through ratio yet.",
      ],
    },
    faq: [
      {
        q: "Why should I trust RealData over an agent?",
        a: "Because we publish our methodology, our sources, and our refresh cadence — and we don't get paid by listings. An agent's incentive is closing the sale; ours is being correct. Verify any number we publish against the underlying hipflat page (linked from every condo report).",
      },
      {
        q: "Is RealData affiliated with hipflat?",
        a: "No. We crawl hipflat's public pages within their robots.txt and rate-limit policies, the same way Google or Bing does. We attribute every listing back to its original hipflat URL. We have no revenue share or partnership with them.",
      },
      {
        q: "Why is the Bubble Index missing for some buildings?",
        a: "Three reasons: (1) the building has no listings on hipflat yet, (2) its district has fewer than 5 sampled buildings (peer baseline too thin), or (3) the computed value was implausible (>10× district median, treated as a data-quality issue and dropped).",
      },
      {
        q: "Why is flood risk only available in Bangkok?",
        a: "BMA (Bangkok Metropolitan Administration) is the only authority publishing district-level monsoon flood records. Phuket, Chiang Mai, etc. have provincial-level flood data, but not the per-district granularity needed to score individual buildings. We're researching alternative data sources for those markets.",
      },
    ],
  },
  cityPage: {
    headerSuffix: "condo report",
    statBuildings: "buildings",
    statSubAreas: "sub-areas",
    statGeo: "geo-located",
    statWithBubble: "with Bubble Index",
    mapTitle: (name: string) => `${name} condo map`,
    mapSubtitle: (n: number) => `${n.toLocaleString()} buildings · color = Bubble Index`,
    superValueEyebrow: "★ SUPER VALUE",
    superValueTitle: "Underpriced + amenity-rich picks",
    superValueSubtitle: (sv: number, total: number, city: string) =>
      `${sv} flagged out of ${total} we scored in ${city}`,
    bubbleEyebrow: "❌ BUBBLE WATCH",
    bubbleTitle: "Most-overpriced vs same area",
    bubbleSubtitle:
      "Same sub-area, same square meter — these cost the most premium.",
    districtsTitle: (city: string) => `${city} by sub-area`,
    districtsSubtitle:
      "Every district we measure, with the number of buildings tracked in each. District pages carry the yield table and the full building list.",
    fullInventoryTitle: (city: string) => `All ${city} buildings`,
    fullInventoryStat: (n: number) => `${n.toLocaleString()} tracked`,
    pendingPipeline: "No condos tracked yet. Pipeline running.",
    otherCitiesHeader: "Other cities",
    retireeLensLabel: "Retiree lens",
    retireeLensCta: (city: string) => `Retiree-friendly condos in ${city} →`,
    retireeLensSub: "Ranked by healthcare access, air quality & transit",
    conciergeHeadline: (city: string) => `Looking for a condo in ${city}? Get an expert read.`,
    travelFraming: (city: string) =>
      `Planning a viewing trip to ${city}? Compare flights and hotels in one search.`,
    travelCta: "Find flights + hotels →",
  },
  districtPage: {
    eyebrow: (province: string) => `District · ${province}`,
    intro: (n: number, name: string) =>
      `${n.toLocaleString()} condos in ${name}, measured for yield, price and flood risk. Independent data — no developer pay-for-placement.`,
    statCondos: "Condos",
    statMedianYield: "Median yield",
    statMedianSale: "Median sale",
    statMedianRent: "Median rent",
    vsMrr: "vs MRR",
    perMonth: "/mo",
    topYieldTitle: (name: string) => `Top yielding condos in ${name}`,
    thCondo: "Condo",
    thYield: "Yield",
    thSpread: "Spread",
    thSale: "Sale",
    thRent: "Rent",
    allCondosTitle: (name: string) => `All condos in ${name}`,
    ctaHeadline: (name: string) => `Looking to buy in ${name}? Get an expert read.`,
    source:
      "Source: RealData measurement across hipflat, dotproperty, ddproperty, fazwaz · MRR benchmark from Bank of Thailand · refreshed weekly.",
    faqCount: (name: string) => `How many condo buildings does RealData track in ${name}?`,
    faqCountA: (n: number, name: string, province: string) =>
      `${n} buildings across the ${name} district of ${province}, drawn from hipflat, dotproperty, ddproperty and fazwaz listings.`,
    faqYield: (name: string) => `What is the median gross rental yield in ${name}?`,
    faqSpread: (y: string, spread: string, mrr: string) =>
      `Median yield ${y}% means a ${spread}pp spread versus the current Thai MRR of ${mrr}%.`,
    faqYieldOnly: (y: string) => `Median yield is ${y}%.`,
    faqNoYield:
      "Most buildings in this district do not have enough matched sale + rent listings yet to compute a yield.",
    faqSale: (name: string) => `What is the median sale price for a condo in ${name}?`,
    faqSaleA: (price: string) =>
      `Median sale price is ${price} based on active listings across the four portals we track. Each condo page shows its own price evidence, including per-portal divergence where it exists.`,
    faqRent: (name: string) => `What is the median monthly rent in ${name}?`,
    faqRentA: (price: string, name: string) =>
      `Median monthly rent is ${price} per month for active listings in ${name}.`,
    faqForeign: (name: string) => `Is ${name} a good area for foreign buyers?`,
    faqForeignA: (name: string) =>
      `RealData does not editorialise — the per-building pages surface the legally-binding signal instead: foreign-quota inventory share (the % of for-sale units flagged Foreign Quota and therefore eligible for non-Thai ownership). Use the building list to find condos with measured foreign-quota availability in ${name}.`,
  },
  districtsIndex: {
    title: "Thailand condo districts",
    lead: "Every district we track enough measured buildings in to report on — median sale price, median rent and median gross yield, side by side.",
    thDistrict: "District",
    thProvince: "Province",
    thCondos: "Condos",
    thYield: "Median yield",
    thSale: "Median sale",
    thRent: "Median rent",
    count: (n: number) => `${n} districts`,
    empty: "No districts measured yet.",
    seoTitle: "Condo prices by district in Thailand — median sale, rent and yield",
    seoDesc:
      "Median sale price, median rent and median gross rental yield for every Thai condo district we track, measured from live listings across four portals.",
  },
  reality: {
    title: "Marketing vs Reality",
    lead: "Influencer / advertiser-promoted condos. We place our measured data next to their marketing claims. We don't attack the influencer — only the numbers.",
    note: "This is a paid-promotion slot. Sponsors pay for the marketing claim; we control the data column. Want your condo here? Contact us.",
    emptyState: "No promoted condos yet.",
    promotedBy: "promoted by",
    vsDistrict: "vs district",
    sponsorCta: "Sponsor a slot — your claim, our data →",
    casesHeader: "Auto-flagged: claims a buyer is most likely to hear",
    casesIntro:
      "We pulled the most-overpriced condos by Bubble Index across each market. The marketing positioning column shows the line a buyer hears in agent decks; the RealData column shows the measurement.",
    sponsoredHeader: "Sponsored slots",
    bubbleLabel: "Bubble",
    floodLabel: "Flood",
    marketingLabel: "Marketing positioning",
    realDataLabel: "RealData",
    claimByMarket: {
      bangkok: '"Premium central location · Luxury investment grade"',
      pattaya: '"Beachfront premium · Russian/Chinese demand · Guaranteed yield"',
      phuket: '"Resort lifestyle · Pool villa standard · Hotel-grade rental"',
      huahin: '"Stable retirement market · Low volatility coastal asset"',
      chonburi: '"EEC growth corridor · Industrial-corridor upside"',
      chiangmai: '"Digital nomad capital · Long-stay foreign demand"',
    },
  },
  contact: {
    title: "Contact",
    lead: "Sponsor a verified condo report, license our data, get featured in press, or just say hi. We read every message.",
    form: {
      inquiryType: "What's this about?",
      types: {
        general: "General inquiry",
        promote: "Promote my condo (paid placement)",
        b2b_reports: "License data / B2B market reports",
        press: "Press / interview",
        other: "Other",
      },
      name: "Your name",
      email: "Your email",
      message: "Message",
      submit: "Send",
      submitting: "Sending…",
      success: "Thanks — we'll reply within 2 business days.",
      errorGeneric: "Something went wrong. Message us on Telegram instead.",
      fallbackPrefix: "or message us on Telegram at",
      fallbackHandle: "@Bkkbudong_bot",
    },
    useCases: [
      {
        title: "Promote my condo",
        body: "Buy a Marketing-vs-Reality slot. We do not soften the data — but you control the claim wording. Pay only after we confirm fit.",
      },
      {
        title: "License RealData market reports",
        body: "Quarterly Bangkok-wide bubble / flood / amenity datasets in CSV + dashboard. For agents, REITs, and analysts.",
      },
    ],
  },
  // The site's primary conversion unit. Every label here was an
  // English literal inside components/LeadCaptureCTA.tsx until
  // 2026-08-21, so a Korean reader was being asked to "Request
  // consultation" on a page whose every other word was Korean.
  leadCta: {
    budgetLabels: ["Under ฿3M", "฿3–5M", "฿5–10M", "฿10–20M", "฿20M+"],
    timelineLabels: ["Within 1 month", "1–3 months", "3–6 months", "6–12 months", "Just browsing"],
    purposeLabels: ["Own / live in", "Rent out / yield", "Flip / capital gain", "Not sure yet"],
    doneTitle: "Got it — we’ll be in touch.",
    doneBodyA: "A vetted broker will reach out within 24 hours with a tailored shortlist and an honest read on",
    doneBodyMarket: "the market",
    doneBodyEnd: ". No spam.",
    headlineGeneric: "Want a human read on the Bangkok condo market?",
    sub: "We pair you with a vetted broker who knows the building, the sub-market, and the foreign-quota status. We don’t take commissions from developers; the broker pays us a flat referral.",
    openBtn: "Get expert opinion →",
    emailLabel: "Email",
    emailPh: "you@example.com",
    budgetLabel: "Budget",
    optional: "— optional",
    timelineLabel: "Timeline",
    purposeLabel: "Purpose",
    addMore: "+ Add name / phone / message",
    nameLabel: "Name",
    phoneLabel: "Phone / LINE",
    messageLabel: "Anything specific?",
    optionalPh: "Optional",
    sending: "Sending…",
    submit: "Request consultation",
    followUp: "Broker follows up via email within 24 hours.",
    consentA: "We share your contact with one vetted broker. No spam, no email list resale. Broker pays our referral if a deal closes — you pay nothing extra. See our ",
    consentLink: "privacy policy",
    consentB: " for what we store and how to have it deleted.",
    errEmail: "Please enter a valid email.",
    errSubmit: "Submission failed",
    errNetwork: "Network error",
    headlineCondo: (name: string) => `Considering ${name}? Get an expert opinion.`,
  },

  // /compare, /ask, /saved and /macro never called getDictionary, so they
  // rendered English H1s and lead paragraphs on all three locales.
  tools: {
    compareTitle: "Compare condos",
    compareLeadA: "Head-to-head comparison of up to 3 Bangkok condos. Add condos by clicking ",
    compareCta: "“Compare with…”",
    compareLeadB: " on any condo page, or paste ids into the URL as ",
    compareFootnote: "★ highlights the best value in each row. Yield + spread are pre-tax, pre-vacancy. Foreign quota share = % of currently-listed units tagged Foreign Quota on FazWaz; sold-quota status is not visible — confirm at the sales office.",
    askTitle: "Ask RealData",
    askLead: "Property research grounded in our measured data — every condo we track across hipflat, dotproperty, ddproperty and fazwaz, plus Bank of Thailand macro indicators (MRR, MLR, policy rate). No marketing fluff, no influencer claims — just numbers we measure.",
    savedTitle: "Saved condos",
    savedLead: "Stored locally in your browser. Clearing browser data will remove this list.",
    macroTitle: "Thailand mortgage + macro rates",
  },

  // /best/{city}/{slug} FAQ — ~180 URLs x 3 locales. Was English
  // literals in the page; the answers interpolate live medians so the
  // visible copy is unique per slice, which only helps if it is also in
  // the reader's language.
  bestFaq: {
    countAZero: "Right now zero — either the filter is tight or our coverage in this slice is thin. The /yields page shows the full Thailand ranking.",
    yieldQ: "What is the median gross rental yield among these condos?",
    yieldANoMrr: "Spread is shown wherever the current Bank of Thailand MRR is available.",
    priceQ: "What is the median sale price in this slice?",
    missingA: "A building has to clear two bars to enter this ranking: (1) at least 2 active sale and 2 active rent listings on the same building, so the yield is not a fluke; (2) avg sale price ≥ ฿500,000 and yield ≤ 25%, which filters obvious price-parse outliers. Coverage widens with every weekly ingest cycle.",
    shortlistQ: "How do I shortlist one of these?",
    countQ: (chunk: string) => `How many ${chunk} does RealData currently measure?`,
    countA: (n: string) => `${n} buildings match the filter, drawn from active sale and rent listings across hipflat, dotproperty, ddproperty, and fazwaz.`,
    yieldA: (pct: string, spread: string, mrr: string) =>
      `Median yield in this slice is ${pct}%, a ${spread}pp spread against the current Thai MRR of ${mrr}%.`,
    priceA: (sale: string, rent: string) => `Median sale price is ${sale}. Median monthly rent is ${rent}. Both figures come from active listings on the four portals we track.`,
    missingQ: (city: string) => `Why are some popular ${city} condos missing?`,
    shortlistA: (city: string) => `Each building name links to its full RealData report — yield, foreign-quota inventory, flood risk, days-on-market, cost-of-ownership panel. The bottom of this page has a free expert-opinion request that goes to one vetted independent broker who knows ${city}.`,
  },

  // FAQ bodies for /yields, /macro and the two guides. They were English
  // literals in the pages and became visible on 2026-08-21, so /ko and
  // /th were serving a localized shell over English prose.
  //
  // yields[1] and macro[0] end mid-sentence on purpose: the page appends
  // a live MRR clause to each.
  pageFaq: {
    yields: [
      { q: "How is gross rental yield calculated?", a: "Gross yield = (12 × median monthly rent ÷ median sale price) × 100%, computed per condo building. Only buildings with at least 2 sale and 2 rent listings are included. Listings priced in USD on hipflat are converted to THB before aggregation, and any yield above 25% is dropped as a likely price-parse error." },
      { q: "What is the 'Spread vs MRR' column?", a: "Spread = gross yield minus the current Bank of Thailand Minimum Retail Rate (MRR). A positive spread means the rental income alone covers more than the mortgage interest a Thai bank would charge that day. " },
      { q: "Why does my favourite condo not show up here?", a: "Two reasons. (1) The building doesn't have enough matched sale + rent listings yet — we need at least 2 of each on the same building. (2) The yield landed above 25% or the sale price below ฿500,000, which we filter as a likely outlier. Coverage will widen as we accumulate more weekly snapshots." },
      { q: "Is the yield net of CAM fees and tax?", a: "No — this is a pre-tax, pre-vacancy gross figure. Net yield in Thailand is typically 1.5–3 percentage points lower after CAM (common area fees), sinking fund top-ups, the 15% withholding on rent for foreign owners, vacancy, and management commission. Each individual condo report shows a Cost of Ownership panel that estimates the net step-down." },
      { q: "How current are these numbers?", a: "Listings are refreshed daily for Bangkok and weekly across the full Thailand sweep. Yields are recomputed after each ingest cycle, and the BOT MRR benchmark refreshes daily where the source publishes daily." },
    ],
    macro: [
      { q: "What is Thailand's MRR and why does it matter for condo buyers?", a: "MRR (Minimum Retail Rate) is the reference rate Thai banks attach mortgage products to — e.g. \"MRR-1.5% for the first three years, MRR floating after.\" It is the single most important rate for a Thai home buyer because every floating-rate mortgage moves with it. " },
      { q: "What is the difference between Policy Rate, MRR, MLR, and MOR?", a: "Policy Rate is the BOT's overnight repurchase rate and sets the floor for everything else. MLR (Minimum Lending Rate) is for prime corporate and high-quality retail borrowers and sits below MRR. MRR (Minimum Retail Rate) is the standard reference for retail mortgages. MOR (Minimum Overdraft Rate) governs overdraft facilities and is less relevant for property but tracks broader lending conditions." },
      { q: "How often does RealData refresh these macro numbers?", a: "Daily, where the Bank of Thailand publishes daily — Policy Rate, MRR, MLR, MOR, BIBOR. The household-loan stock series is quarterly. Each card on this page shows its own latest period." },
      { q: "Where does this data come from?", a: "Bank of Thailand BTWS_STAT (series FM_RT_001_S2 for the interest-rate panel and EC_MB_039 for the household-loan series). Free to use under the BOT's standard data conditions; we link the source for every quoted number." },
      { q: "How do I use MRR to judge whether a condo yield is attractive?", a: "Compute spread = condo's gross rental yield − MRR. Positive spread means the rental income alone covers more than the mortgage interest a Thai bank would charge that day on a fully-leveraged purchase. We compute this spread for every condo with enough data on the /yields ranking and on each individual condo report." },
    ],
    guideInvest: [
      { q: "What rental yield can you get on a Bangkok condo?", a: "Gross rental yields in Bangkok typically range from 4% to 7%, varying by area and building age. Older buildings and outer areas tend to show higher gross yields; prime central buildings trade at lower yields but stronger capital appreciation." },
      { q: "Which Bangkok areas have the highest condo yields?", a: "Yields shift with the market; the live table on this page ranks Bangkok areas by current median gross yield from active listings, refreshed weekly." },
      { q: "Is now a good time to buy a Bangkok condo?", a: "Use the Bubble Index to see whether a specific building is priced above or below its district, and check the BOT MRR for financing costs. RealData surfaces both so the decision rests on data, not sentiment." },
    ],
    guideForeign: [
      { q: "Can foreigners buy a condo in Thailand?", a: "Yes. Foreigners can own a condominium unit freehold in their own name, provided the building has not exceeded its 49% foreign-ownership quota and the purchase funds are remitted into Thailand from abroad in foreign currency." },
      { q: "How do I verify a condo building's foreign quota before buying?", a: "Ask the juristic person (the building's management office) for a written foreign-quota letter stating the current foreign-owned share of saleable floor area, and have it confirmed at the Land Department on transfer day — the Land Office will refuse to register a foreign freehold once the 49% is used up. RealData shows the last-scraped foreign-quota status on a condo page wherever a portal reports it; treat that as a lead, not as the legal check." },
      { q: "What happens if a condo's 49% foreign quota is already full?", a: "A foreigner cannot take freehold title in that building. The options are a registered 30-year leasehold (renewable by contract, not by law), waiting for a foreign-owned unit to come up for resale (the quota transfers with the unit), or choosing another building. A Thai company set up purely to hold the unit is treated as a nominee arrangement and carries legal risk." },
      { q: "What is the 49% foreign quota?", a: "Under the Condominium Act B.E. 2522, foreigners may collectively own up to 49% of the total saleable floor area of any condominium. The remaining 51% must be held by Thai nationals or Thai-majority entities." },
      { q: "Can a foreigner own land or a house in Thailand?", a: "Generally no. Foreigners cannot own land outright. Houses and villas are typically secured via a registered leasehold (up to 30 years) or, less commonly, through a Thai company structure — which carries legal risk and should be reviewed by a lawyer." },
      { q: "What taxes and fees apply when buying a condo?", a: "At transfer expect a 2% transfer fee on the appraised value, plus either 3.3% specific business tax (if the seller sells within 5 years) or 0.5% stamp duty, and a withholding tax. Who pays what is negotiable between buyer and seller." },
      { q: "How do I transfer the money correctly?", a: "Funds must enter Thailand in foreign currency and be converted to baht by the receiving Thai bank, which issues a Foreign Exchange Transaction (FET) certificate. The Land Department requires this proof to register foreign freehold ownership." },
    ],
  },

  condoPage: {
    nearbyTitle: "Nearby & metrics",
    shareTitle: "Found this useful? Share the report",
    sourceLabel: "Source:",
    affiliateCta: "Find a hotel near this building →",
    nearStation: (station: string) => `Condos near ${station} station`,
    retireeCity: (city: string) => `More retiree-friendly condos in ${city}`,
    affiliateFraming: (name: string, region: string) =>
      `Planning to inspect ${name} in person? Book a hotel + flight in one search — ${region} stays are usually cheaper than the condo's own short-let pricing.`,
    glossaryLinks: {
      bubbleIndex: "What is the Bubble Index?",
      grossYield: "What is gross yield?",
      resaleLiquidity: "What is the Resale Liquidity Score?",
      retireeSuitability: "Is it good for retirees?",
      floodRisk: "How we score flood risk",
      groundStability: "Is the ground sinking?",
      developerRecord: "What is a developer track record?",
    },
    neighboursTitle: "Projects nearby",
    neighboursInternal: "RealData report",
    neighboursExternal: "Buildings we don’t track yet link out to hipflat.",
    buildingFacts: "Building facts",
    floors: "Floors",
    totalUnits: "Total units",
    completed: "Completed",
    availableNow: "Available now",
    marketSignals: "Market signals (hipflat-published)",
    saleMedian: "Sale · median",
    rentMedian: "Rent · median",
    perSqm: "/sqm",
    perMonth: "/mo",
    perMonthShort: "mo",
    marketActivityTitle: "Listing activity",
    activeListings: "Active listings",
    medianDom: "Median days listed",
    maxDom: "Longest listed",
    domDays: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    domNew: "Just listed",
    domBuilding: "Tracking begins now — RealData stamps each listing's first appearance so you'll see real days-on-market within 1–2 weeks.",
  },
  near: {
    breadcrumb: "Stations",
    titleSuffix: "condos near",
    metaSuffix: "Condos near {station} Station, Bangkok — Yield, Prices & Flood Risk | RealData",
    summaryLead: "Within 1 km of {station} station, Bangkok —",
    statCondos: "condos",
    statMedianPsm: "median $/sqm",
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
      sections: [{"h": "The 49% rule, in plain terms", "p": "Thailand's Condominium Act lets non-Thais collectively own up to 49% of the total unit area of a condominium building. If a building still has room under that quota, a foreigner can buy a unit freehold — outright, in their own name, registered at the Land Office. Once a building hits 49%, the remaining Thai-owned units can only be taken by foreigners on a leasehold basis."}, {"h": "Land and houses", "p": "Foreigners generally cannot own land in Thailand. A villa or landed house is usually structured as a registered lease (a maximum of 30 years per term) or through a Thai company — the latter carries real legal exposure and needs qualified advice. For most overseas buyers, a condo is the only clean route to direct freehold ownership."}, {"h": "Moving the money (FET)", "p": "To register foreign freehold, the purchase funds must arrive in Thailand in foreign currency and be converted to baht by the receiving bank, which issues a Foreign Exchange Transaction (FET) certificate. The Land Office requires this document at transfer — so never bring the money in as baht."}],
      taxTitle: "Taxes and transfer costs",
      taxes: ["Transfer fee: 2% of the appraised value.", "Specific Business Tax: 3.3% if the seller owned the unit under 5 years; otherwise 0.5% stamp duty.", "Withholding tax: progressive for an individual seller, 1% for a company.", "Who pays each of these is negotiable between buyer and seller."],
      stepsTitle: "Buying process, step by step",
      steps: ["Reserve the unit and sign a reservation agreement.", "Confirm the building's remaining foreign quota in writing.", "Due diligence: title deed, encumbrances, juristic-person debts.", "Remit funds from abroad and collect the FET certificate.", "Transfer ownership at the Land Office and pay fees."],
      quotaCta: "How to check the foreign quota — and what to do if it is full",
      disclaimer: "This guide is general information, not legal advice.",
      next: "Next: the Bangkok condo investment guide with live yield data",
    },
    investment: {
      title: "Bangkok Condo Investment Guide 2026",
      lead: "Where the yields are, which areas look overpriced, financing costs, and the data behind a Bangkok buy-to-let decision — refreshed weekly.",
      yieldTableTitle: "Gross rental yield by area",
      colArea: "Area",
      colCondos: "Condos",
      colYield: "Median gross yield",
      colPsm: "Median sale price",
    },
  },
  glossary: {
    breadcrumb: "Glossary",
    title: "Bangkok Real-Estate Glossary",
    lead: "Plain-English definitions of every metric RealData publishes — and exactly how we calculate each one.",
    howWeCalculate: "How we calculate it",
    relatedTitle: "Related terms",
    guideLink: "Read the full guide →",
    backToIndex: "All terms",
  },
  notFound: {
    title: "Page not found",
    body: "The condo, district, or page you're looking for isn't on our index — maybe the URL changed, or maybe we never measured it.",
    home: "Home",
    yields: "Top yields",
    ask: "Ask RealData",
    inventory: "Browse all",
  },
  // Titles and meta descriptions. These used to be English string literals
  // inside each route's generateMetadata(), so /ko and /th shipped English
  // <title> and <meta description> on every page — measured 2026-08-13, a
  // /ko condo page shared 447 of its 478 tokens with the English one, which
  // is what Google was reporting as "Duplicate, Google chose different
  // canonical" (393) and "Alternate page with proper canonical" (1,219)
  // across the 25,840 /ko + /th URLs in the sitemap.
  // Per-condo FAQ. These were English string literals inside
  // condo/[slug]/page.tsx until 2026-08-21, which meant a /ko or /th condo
  // page had a localized <title> and <meta> over a body whose only real
  // prose was English — the exact shape that produced 375 "Duplicate, Google
  // chose different canonical" URLs on district pages (see
  // district/[slug]/page.tsx:47-51). ~9,000 ko/th condo URLs were exposed to
  // it, and the FAQ became visible on 2026-08-21, so it is now the bulk of
  // what a crawler reads on the page.
  //
  // Numbers arrive pre-formatted as strings so every locale prints the same
  // digits, units and sign.
  condoFaq: {
    yieldQ: (name: string) => `What is the gross rental yield at ${name}?`,
    yieldA: (name: string, pct: string, spread: string) =>
      `Gross rental yield at ${name} is ${pct}%, computed as (12 × median ` +
      `monthly rent) ÷ median sale price across our active listings.${spread}` +
      ` This is a pre-tax, pre-vacancy figure — net yield is typically 1.5–3pp lower.`,
    yieldSpread: (mrr: string, signed: string) =>
      ` Versus the current Thai MRR of ${mrr}%, that is a ${signed}pp spread.`,

    bubbleQ: (name: string, region: string) =>
      `Is ${name} overpriced compared to the rest of ${region}?`,
    bubbleVerdict: {
      suspect: "bubble suspect",
      underpriced: "underpriced",
      atMarket: "at-market",
    },
    bubbleA: (
      name: string,
      idx: string,
      absPct: string,
      dir: string,
      region: string,
      verdict: string
    ) =>
      `${name} has a RealData Bubble Index of ${idx} — that is ${absPct}% ` +
      `${dir} the median price-per-sqm of the ${region} district, which we ` +
      `classify as ${verdict}.`,
    above: "above",
    below: "below",

    quotaQ: (name: string) => `Can foreigners buy a unit at ${name}?`,
    quotaA: (name: string, pct: string) =>
      `Across the for-sale inventory we currently observe at ${name}, ${pct}% ` +
      `of the units are flagged "Foreign Quota" — meaning legally eligible for ` +
      `a non-Thai buyer. A higher share = more foreign-eligible inventory still ` +
      `available. Thai law caps foreign ownership at 49% of a building's total ` +
      `floor area, so foreign-quota units sell out faster than Thai-quota units ` +
      `in popular buildings.`,

    floodQ: (name: string) => `What is the monsoon flood risk at ${name}?`,
    floodLabel: {
      l5: "severe",
      l4: "waist-deep recurring",
      l3: "neighborhood-level common",
      l2: "occasional puddling",
      l1: "very low",
      l0: "none observed",
    },
    floodA: (name: string, level: string, label: string) =>
      `${name} sits in a district with a RealData Flood Risk Level of ` +
      `${level}/5 — ${label}. Risk is district-level, drawn from Bangkok ` +
      `Metropolitan Administration Drainage Department records, JICA reports, ` +
      `and the 2011 great-flood inundation map. Individual buildings may still ` +
      `flood ground-level parking even in lower-risk districts.`,

    aqiQ: (name: string) => `How is the air quality at ${name}?`,
    aqiVerdict: {
      unhealthy: "Unhealthy (PM2.5 elevated)",
      sensitive: "Unhealthy for sensitive groups",
      moderate: "Moderate",
      good: "Good",
    },
    aqiA: (name: string, val: string, verdict: string) =>
      `Latest WAQI air quality reading near ${name} is ${val} — ${verdict}. ` +
      `This is the index value from the closest World Air Quality Index ` +
      `station; PM2.5 levels in Bangkok swing seasonally and can spike during ` +
      `burn season (Feb–April).`,

    liqQ: (name: string) => `Is ${name} easy to resell?`,
    liqVerdict: {
      high: "highly liquid — units here tend to find buyers quickly",
      good: "liquid — resale demand is healthy",
      moderate: "moderate — expect a normal marketing period",
      slow: "slow — your exit could take a while",
      illiquid: "illiquid — resale may be difficult",
    },
    liqAbsorb: (pct: string) =>
      ` ${pct}% of the for-sale supply we tracked here cleared the market.`,
    liqSold: (days: string) => ` Listings that sold did so in about ${days} days.`,
    liqA: (name: string, score: string, verdict: string, extra: string) =>
      `${name} has a RealData Resale Liquidity Score of ${score}/100 — ` +
      `${verdict}.${extra} We compute this by tracking every listing from the ` +
      `day it appears to the day it leaves the market, so it reflects how much ` +
      `supply actually clears and how fast — not just the asking price. It is ` +
      `an availability signal, not a guarantee of sale price.`,

    subQ: (name: string) => `Is the ground sinking at ${name}?`,
    subLabel: {
      l5: "severe (coastal subsidence plus sea-level rise)",
      l4: "high (eastern soft-clay belt, documented sinking)",
      l3: "moderate (transitional zone or historical hotspot)",
      l2: "low (largely stabilised)",
      l1: "very low (consolidated inner core, effectively flat today)",
    },
    subA: (name: string, level: string, label: string) =>
      `${name} sits in a district with a RealData Ground Stability ` +
      `(land-subsidence) level of ${level}/5 — ${label}. Bangkok rests on soft ` +
      `marine clay and sank as fast as ~120mm/year in the 1980s from ` +
      `groundwater over-extraction; regulation has since cut inner-city rates ` +
      `to near zero, but the eastern belt and coastal south keep sinking. This ` +
      `is a district-level estimate from published InSAR and ` +
      `groundwater-monitoring studies, and it compounds the same areas' ` +
      `monsoon-flood risk over a 10–20 year horizon — not a per-building survey.`,

    retQ: (name: string) => `Is ${name} a good place to retire?`,
    retVerdict: {
      excellent: "an excellent fit",
      good: "a good fit",
      fair: "a fair fit",
      less: "less suited",
    },
    retHosp: (n: number) =>
      ` There ${n === 1 ? "is" : "are"} ${n} hospital/clinic${n === 1 ? "" : "s"} within 1km`,
    retAqi: (val: string) => `, and the latest air quality reads ${val} AQI`,
    retA: (name: string, score: string, verdict: string, extra: string) =>
      `${name} scores ${score}/100 on RealData's Retiree Suitability Score — ` +
      `${verdict} for a retirement-visa buyer.${extra}. The score weights ` +
      `nearby healthcare and clean air most heavily, then car-free transit ` +
      `access and daily errands — the priorities that matter to retirees rather ` +
      `than young investors.`,

    devQ: (name: string) => `Who is the developer of ${name}?`,
    devTier: {
      established: " — an established developer.",
      experienced: " — an experienced developer.",
      smaller: " — a smaller portfolio.",
      neww: " — a new or single-project developer.",
    },
    devScale: (projects: number, unitsClause: string, tier: string) =>
      ` On FazWaz they list ${projects} project${projects === 1 ? "" : "s"}` +
      `${unitsClause}${tier}`,
    devUnits: (units: string) => ` totalling ${units} units`,
    devA: (name: string, developer: string, scale: string) =>
      `${name} was developed by ${developer}.${scale} Portfolio scale is an ` +
      `experience proxy — a longer delivery record reduces completion risk on ` +
      `off-plan units, though it does not guarantee build quality on any single ` +
      `project.`,

    methodQ: "How does RealData verify the numbers on this page?",
    methodA:
      `Every figure is computed from live listing data we re-crawl across ` +
      `hipflat, dotproperty, ddproperty, and fazwaz (daily for Bangkok, weekly ` +
      `for the full Thailand sweep). District medians come from the same ` +
      `dataset, the mortgage benchmark is Bank of Thailand BTWS_STAT, and ` +
      `flood / livability layers are pinned to government and OpenStreetMap ` +
      `sources. We accept no payment from developers and no building can buy ` +
      `its way up a ranking — advertising on this page is sold by a ` +
      `third-party network that never sees the data.`,
  },

  /** /yield/[city] and /yield/[city]/[district]: one area's rental yield,
   *  answered in the title. Numbers arrive pre-formatted ("7.1"). */
  yieldArea: {
    title: (area: string, median: string, n: number, year: number) =>
      `Rental Yield in ${area} (${year}): ${median}% Median Across ${n} Condos | RealData`,
    desc: (area: string, median: string, n: number, p25: string, p75: string) =>
      `What do condos in ${area} really yield? ${median}% median gross rental yield across ${n} ` +
      `buildings with live sale and rent listings (middle half ${p25}–${p75}%). Yield by price band, ` +
      `the highest-yielding buildings, and the spread over the Thai mortgage rate.`,
    linkLine: (area: string, median: string, n: number) =>
      `Rental yield in ${area}: ${median}% median across ${n} condos`,
    byCityTitle: "Rental yield by city",
    eyebrow: "Rental yield check",
    h1: (area: string, median: string) => `Rental yield in ${area}: ${median}% gross`,
    verdict: (area: string, median: string, n: number, p25: string, p75: string) =>
      `The median condo in ${area} earns ${median}% a year in gross rent on its sale price, measured ` +
      `across ${n} buildings with live sale and rent listings. The middle half of those buildings ` +
      `yield between ${p25}% and ${p75}%.`,
    spread: (spread: string, mrr: string, positive: boolean) =>
      positive
        ? `That is ${spread} points above the ${mrr}% Bank of Thailand MRR: rent alone out-earns the interest a Thai bank would charge on the same price.`
        : `That is ${spread} points against the ${mrr}% Bank of Thailand MRR: rent alone does not cover the interest a Thai bank would charge on the same price.`,
    vsParent: (parent: string, median: string) => `${parent} overall: ${median}%.`,
    thailand: "Thailand",
    statMedian: "Median gross yield",
    statRange: "Middle half",
    statCount: "Buildings measured",
    statSale: "Median sale price",
    statRent: "Median rent / month",
    bandsTitle: (area: string) => `Yield by sale price in ${area}`,
    bandsNote: "A median is shown where at least 3 buildings fall in the band.",
    bands: { under3m: "Under ฿3M", "3to5m": "฿3M–5M", "5to10m": "฿5M–10M", over10m: "฿10M and up" },
    colBand: "Sale price",
    colBuildings: "Buildings",
    colMedian: "Median yield",
    topTitle: (area: string) => `Highest-yielding condos in ${area}`,
    colCondo: "Building",
    colYield: "Gross yield",
    colSale: "Avg sale",
    colRent: "Avg rent / mo",
    districtsTitle: (city: string) => `Rental yield by district in ${city}`,
    colDistrict: "District",
    siblingsTitle: (city: string) => `Other districts in ${city}`,
    citiesTitle: "Rental yield in other cities",
    seeDistrict: (area: string) => `Every condo in ${area}: prices, flood risk, listings`,
    seeCity: (area: string) => `${area} city guide`,
    seeRanking: "All Thailand condos ranked by yield",
    methodTitle: "How this is measured",
    methodBody:
      "Gross yield = 12 × average monthly rent ÷ average sale price, per building, from live listings " +
      "on hipflat, DotProperty, DDProperty and FazWaz. A building counts only with at least 2 sale and " +
      "2 rent listings, a sale price of ฿500,000 or more and a yield no higher than 25% — anything else " +
      "is a parsing error, not a bargain. It is a pre-tax, pre-vacancy figure: net yield after CAM fees, " +
      "vacancy and tax usually lands 1.5–3 points lower. Refreshed weekly.",
    faqTitle: (area: string) => `${area} rental yield — frequently asked questions`,
    faq: {
      q1: (area: string) => `What is the average rental yield for a condo in ${area}?`,
      a1: (area: string, median: string, n: number, p25: string, p75: string) =>
        `${median}% gross — the median of ${n} ${area} buildings we measure from live sale and rent ` +
        `listings. Half of them yield between ${p25}% and ${p75}%. Net yield after common-area fees, ` +
        `vacancy and tax is typically 1.5–3 points lower.`,
      q2: (area: string) => `Is ${area} a good place to buy a condo for rental income?`,
      a2: (area: string, median: string, mrr: string | null, parent: string, parentMedian: string) =>
        `On yield alone, the ${median}% median in ${area} compares with ${parentMedian}% for ${parent}` +
        (mrr ? ` and a ${mrr}% Bank of Thailand MRR.` : ".") +
        ` The area sets the baseline; the building decides the result, which is why the spread between ` +
        `the best and worst buildings here is wider than the gap between areas.`,
      q3: (area: string) => `Which condos in ${area} have the highest rental yield?`,
      a3: (area: string, list: string) =>
        `By gross yield from current listings: ${list}. Each building's page shows the listings the ` +
        `figure comes from.`,
      q4: "How is gross rental yield calculated?",
      a4:
        "Twelve months of rent divided by the purchase price: a ฿3,000,000 condo renting at ฿15,000 a " +
        "month yields 6.0%. We compute it per building from the average of its live rent and sale " +
        "listings, then take the median across the area so a single outlier cannot move the answer.",
    },
  },
  /** /guide/foreign-quota — answers "how to verify a condo's foreign quota"
   *  and "what happens if the 49% is full" in the title, then backs it with
   *  the foreign-quota inventory we measure. */
  foreignQuota: {
    title: "How to Check a Thai Condo's Foreign Quota — and What Happens When the 49% Is Full",
    metaTitle: "How to Check a Thai Condo's Foreign Quota (49% Rule) & What If It's Full | RealData",
    desc:
      "The documents that prove a Thai condo still has foreign quota, who issues them, and what the Land Office " +
      "checks on transfer day — plus your options when a building's 49% is used up. With foreign-quota inventory " +
      "measured across 1,000+ buildings.",
    eyebrow: "Foreign buyer check",
    shortTitle: "The short answer",
    shortVerify:
      "Get a letter from the building's juristic person manager certifying the current foreign-owned share of the " +
      "building. The Land Office reads that ratio on transfer day and will not register a foreign freehold that " +
      "takes it past 49% — so the letter, not the agent's word, is the check.",
    shortFull:
      "If the 49% is used up you cannot take freehold in a unit that is Thai-owned today. You can still buy a unit " +
      "a foreigner already owns (the quota stays with it), take a registered lease of up to 30 years, or wait for " +
      "foreign owners to sell to Thais.",
    verifyTitle: "How to verify the foreign quota, step by step",
    verifySteps: [
      {
        h: "Ask which quota the unit is sold under",
        p: "Every listing is either foreign quota or Thai quota. A unit sold under Thai quota cannot be registered to you freehold, whatever its price. Get the answer in writing from the seller or developer before you pay a reservation fee.",
      },
      {
        h: "Resale: check who owns it now",
        p: "The condo title deed (Or.Chor. 2) names the current owner. If that owner is a foreigner, the unit is already counted inside the 49% and can pass to another foreigner without using new quota. If the owner is Thai, a sale to you uses quota the building must still have.",
      },
      {
        h: "Get the juristic person's foreign-ownership letter",
        p: "The building's juristic person manager issues a letter certifying the foreign-owned share of the building's total unit area. The Land Office asks for it at transfer, together with the debt-free letter for common fees. Request both a few days ahead: a letter that shows the building at or near 49% is the reason to stop.",
      },
      {
        h: "Bring the money in as foreign currency",
        p: "Foreign freehold needs proof the purchase money entered Thailand from abroad in foreign currency. For US$50,000 or more the receiving Thai bank issues a Foreign Exchange Transaction form (Thor Tor 3); for smaller transfers, ask for a credit advice that shows the foreign-currency source. Money that arrives as baht does not count.",
      },
      {
        h: "Transfer at the Land Office",
        p: "The Land Office checks the ratio letter, the FET proof and your passport, then registers the title in your name. This is the only point where the quota is legally confirmed — everything before it is a promise.",
      },
    ],
    fullTitle: "What happens if the 49% foreign quota is already full",
    fullOptions: [
      {
        h: "Buy a unit a foreigner already owns",
        p: "Foreign-owned units stay inside the quota when they change hands between foreigners. In a full building these resale units are the only freehold route, and they tend to carry a premium for it.",
      },
      {
        h: "Take a registered lease",
        p: "A lease registered at the Land Office runs up to 30 years. Renewal clauses are contractual promises, not rights the law guarantees, and may not bind the next owner — price the lease as 30 years, not 90.",
      },
      {
        h: "Wait for quota to free up",
        p: "When a foreign owner sells to a Thai buyer, that area leaves the 49%. In a large building this happens often; the juristic person can tell you the current ratio at any time.",
      },
      {
        h: "Do not use a nominee company",
        p: "A Thai company set up only to hold the unit for a foreigner is a nominee arrangement under the Foreign Business Act. It can be challenged and the unit forfeited. A lawyer who proposes it is not protecting you.",
      },
    ],
    dataTitle: "Foreign-quota inventory we measure",
    dataBody: (n: string, plenty: string, tight: string, month: string | null) =>
      `Across ${n} buildings with at least 5 labelled units for sale, ${plenty} have 60% or more of their listings ` +
      `under foreign quota, and ${tight} have under 10%${month ? ` (as of ${month})` : ""}. We count the Foreign ` +
      `Quota and Thai Quota labels on units currently for sale — a strong sign of how easy freehold is to find, ` +
      `but not the legal ratio. Only the juristic person's letter gives that.`,
    colCity: "City",
    colBuildings: "Buildings",
    colMedian: "Median foreign-quota share",
    colPlenty: "Buildings 60%+ foreign",
    colTight: "Buildings under 10%",
    tableNote:
      "Share = foreign-quota units ÷ all quota-labelled units for sale in a building. Check a specific building on its own page.",
    faqTitle: "Foreign quota — frequently asked questions",
    faq: [
      {
        q: "How do I verify a condo building's foreign quota before buying?",
        a: "Ask the building's juristic person manager for a letter certifying the current foreign-owned share of the total unit area. The Land Office checks that ratio when it registers the transfer and refuses a foreign freehold that would push it past 49%. For a resale unit, also check the title deed: a unit already owned by a foreigner can pass to another foreigner without using new quota.",
      },
      {
        q: "What happens if a condo's 49% foreign quota is already full?",
        a: "You cannot take freehold in a unit that is Thai-owned today. Your options are a unit already owned by a foreigner (the quota stays with it), a registered lease of up to 30 years, or waiting until foreign owners sell to Thai buyers and free up quota. A Thai company set up only to hold the unit is a nominee arrangement and can be challenged.",
      },
      {
        q: "Is a 'foreign quota' listing guaranteed to be registrable to me?",
        a: "No. The label is the seller's statement. The ratio can change between reservation and transfer if other foreign sales complete first, which is why the juristic person's letter should be dated close to your transfer day.",
      },
      {
        q: "Does the 49% count units or floor area?",
        a: "Floor area. The Condominium Act caps foreign ownership at 49% of the total area of all units in the building, so one large penthouse can use as much quota as several studios.",
      },
      {
        q: "Can I buy under foreign quota if my money is already in Thailand?",
        a: "Only if it came in from abroad in foreign currency and you have the bank's proof. Baht earned or held in Thailand does not qualify for foreign freehold registration.",
      },
    ],
    disclaimer:
      "General information, not legal advice. Rules and Land Office practice change; confirm with a Thai property lawyer before you pay a deposit.",
    seeOwnership: "Can foreigners buy a condo in Thailand? The full guide",
  },
  /** /vs/[pair] — one area against another, from measured data. */
  areaVs: {
    metaTitle: (a: string, b: string, year: number) =>
      `${a} vs ${b} (${year}): Condo Prices, Yields & Flood Risk Compared | RealData`,
    desc: (a: string, b: string, n: number) =>
      `${a} or ${b}? Median price per sqm, gross rental yield, flood level and building counts across ` +
      `${n} tracked condos — measured from live listings, not opinion.`,
    eyebrow: "Area comparison",
    h1: (a: string, b: string) => `${a} vs ${b}`,
    verdictTitle: "The short answer",
    cheaper: (winner: string, pct: string, loser: string) =>
      `${winner} is the cheaper entry: its median condo sells for ${pct}% less than in ${loser}.`,
    samePrice: (a: string, b: string) =>
      `Neither side is meaningfully cheaper — the median sale price in ${a} and ${b} is within 5%.`,
    yields: (winner: string, w: string, loser: string, l: string) =>
      `${winner} yields more: a median ${w}% gross against ${l}% in ${loser}.`,
    yieldsOne: (area: string, v: string) =>
      `Only ${area} has enough rent and sale listings to show a yield: ${v}% gross.`,
    floodLine: (drier: string, dl: number, wetter: string, wl: number) =>
      `${drier} is the drier side (flood level ${dl}/5 against ${wl}/5 in ${wetter}).`,
    floodSame: (level: number) => `Both sides carry the same flood level, ${level}/5.`,
    tableTitle: "Side by side",
    rowCondos: "Condos tracked",
    rowSale: "Median sale price",
    rowYield: "Median gross yield",
    rowFlood: "Flood level (0-5)",
    topTitle: (area: string) => `Biggest buildings in ${area}`,
    colCondo: "Building",
    colSale: "Median sale",
    methodTitle: "How this is measured",
    methodBody:
      "Prices and yields are medians across every building we track on each side, from live sale and rent " +
      "listings on hipflat, DotProperty, DDProperty and FazWaz. Yield is gross: 12 x median monthly rent " +
      "divided by median sale price, before tax, vacancy and CAM fees. Flood levels come from the BMA " +
      "Drainage Department layer and only exist for Bangkok khet. Refreshed weekly.",
    stationNote:
      "Both sides are station catchments — every condo within 1 km of the station — because the khet they sit in cannot tell them apart.",
    faqTitle: (a: string, b: string) => `${a} vs ${b} — frequently asked questions`,
    faq: {
      q1: (a: string, b: string) => `Is ${a} or ${b} cheaper for a condo?`,
      q2: (a: string, b: string) => `Which gives a better rental yield, ${a} or ${b}?`,
      q3: (a: string, b: string) => `Does ${a} or ${b} flood more?`,
      a3none: (a: string, b: string) =>
        `We score flood risk for Bangkok khet only, and neither ${a} nor ${b} sits inside that layer. ` +
        `Ask the building juristic office what happened in the last monsoon.`,
      q4: "Which should I buy in?",
      a4: (cheap: string, yieldy: string) =>
        `If the entry price decides it, ${cheap}. If rental income decides it, ${yieldy}. The gap between ` +
        `the best and worst building inside one area is wider than the gap between these two areas, so ` +
        `use this to pick the area, then compare buildings.`,
    },
    seeArea: (area: string) => `${area} rental yield in detail`,
    otherTitle: "Other comparisons",
  },
  /** /guide/buying-costs — "thailand condo transfer fee", "thailand property
   *  tax for foreigners", "leasehold vs freehold thailand". Portals list
   *  units; nobody adds up what the transfer day actually costs. */
  buyingCosts: {
    title: "What a Thai Condo Really Costs a Foreign Buyer: Transfer Fees, Taxes and Annual Charges",
    metaTitle: "Thailand Condo Transfer Fee & Taxes for Foreign Buyers (2026) | RealData",
    desc:
      "Transfer fee, specific business tax, stamp duty, withholding tax, CAM fees and sinking fund — what each one is, " +
      "who normally pays it, and what they add up to on a ฿5M condo. Plus freehold vs leasehold, priced honestly.",
    eyebrow: "Foreign buyer costs",
    shortTitle: "The short answer",
    shortBody:
      "Budget 3-6% of the price on top of the price. The transfer fee alone is 2% of the Land Office appraised value, " +
      "and the seller's tax (3.3% specific business tax, or 0.5% stamp duty after five years of ownership) is " +
      "negotiable — which in practice means it often lands half on the buyer. Then the building charges a monthly " +
      "common-area fee and a one-off sinking-fund contribution at transfer.",
    tableTitle: "One-off costs at transfer",
    colItem: "Cost",
    colRate: "Rate",
    colWho: "Usually paid by",
    colOn: "Charged on",
    rows: [
      {
        item: "Transfer fee",
        rate: "2%",
        who: "Split 50/50 by custom",
        on: "Land Office appraised value, which is usually below the sale price",
      },
      {
        item: "Specific business tax",
        rate: "3.3%",
        who: "Seller",
        on: "Applies when the seller has owned under five years; replaced by stamp duty otherwise",
      },
      {
        item: "Stamp duty",
        rate: "0.5%",
        who: "Seller",
        on: "Instead of specific business tax, after five years of ownership",
      },
      {
        item: "Withholding tax",
        rate: "Progressive, or 1% for a company seller",
        who: "Seller",
        on: "An advance on the seller's income tax, from appraised value and years held",
      },
      {
        item: "Sinking fund",
        rate: "Typically ฿300-฿1,000 per sqm, once",
        who: "Buyer",
        on: "New units from a developer; a resale unit has usually paid it already",
      },
    ],
    exampleTitle: "On a ฿5,000,000 condo",
    exampleBody:
      "If the appraised value is ฿4,000,000, the transfer fee is ฿80,000. Split by custom, the buyer pays ฿40,000. " +
      "The seller's 3.3% business tax is ฿165,000 — but a seller who insists on a net price moves it onto you, so " +
      "agree in writing who pays what before the deposit. A 45 sqm unit's sinking fund at ฿500/sqm is ฿22,500.",
    annualTitle: "What it costs every year",
    annualBody:
      "Common-area (CAM) fees run roughly ฿35-฿90 per sqm per month depending on the building's facilities — on a " +
      "45 sqm unit that is ฿19,000-฿48,000 a year. Land and building tax on a residential condo is 0.02-0.10% of " +
      "appraised value for most owners. If you rent the unit out, rental income is taxable in Thailand, and a " +
      "non-resident landlord is subject to 15% withholding on rent.",
    yieldNote:
      "Our yield figures are gross: 12 x rent divided by price, before any of this. Net yield after CAM, vacancy " +
      "and tax typically lands 1.5-3 points lower, which is why a 6% gross building is not a 6% return.",
    tenureTitle: "Freehold vs leasehold, priced honestly",
    tenureBody:
      "Freehold means your name on the title deed, and it needs the building's foreign quota to have room. Leasehold " +
      "is a registered lease of up to 30 years; renewal clauses are contractual promises, not rights the law " +
      "guarantees. Price a leasehold unit as 30 years of use, not as ownership, and expect it to be cheaper than a " +
      "comparable freehold unit in the same building.",
    faqTitle: "Buying costs — frequently asked questions",
    faq: [
      {
        q: "What is the transfer fee on a Thai condo?",
        a: "2% of the Land Office appraised value, not of the price you agreed. Custom splits it equally between buyer and seller, but it is negotiable and the contract decides.",
      },
      {
        q: "What taxes does a foreigner pay when buying a condo in Thailand?",
        a: "The buyer's own tax bill at transfer is small: the shared half of the 2% transfer fee. The seller owes specific business tax (3.3%) or stamp duty (0.5%) and withholding tax, though a seller quoting a net price is asking you to cover them. Annually, you owe land and building tax of 0.02-0.10% of appraised value, and tax on rental income if you let the unit.",
      },
      {
        q: "How much are condo maintenance fees in Thailand?",
        a: "Common-area fees are charged per sqm per month, typically ฿35-฿90 depending on facilities; a pool, gym and concierge cost more to run than a walk-up. Expect a one-off sinking-fund payment at transfer on a new unit, often ฿300-฿1,000 per sqm.",
      },
      {
        q: "Is leasehold cheaper than freehold in Thailand?",
        a: "It should be. A 30-year registered lease is a right to use, not ownership, and renewals are not guaranteed by law. If a leasehold unit is priced like the freehold unit next door, the discount you are owed has been priced away.",
      },
      {
        q: "Do these costs change if I buy off-plan?",
        a: "The sinking fund and first-year CAM are usually charged by the developer at handover, and transfer fees are sometimes promoted as 'free' — which means the developer absorbs them, so check the contract rather than the brochure.",
      },
    ],
    disclaimer:
      "Rates here are the standard published ones and the customary split; both change with government stimulus measures and neither is legal or tax advice. Confirm with a Thai property lawyer before you pay a deposit.",
    seeQuota: "How to check a building's foreign quota",
    seeYields: "Rental yields by area",
  },
  seo: {
    /** Under a district H1: the sub-areas people actually search that
     *  fall inside this khet (Thonglor and Ekkamai are in Watthana). */
    districtAka: (areas: string) => `Covers ${areas}`,
    yieldLabel: (v: string) => `yield ${v}%`,
    floodLabel: (n: number) => `flood risk L${n}/5`,
    provinceCondo: (p: string) => `${p} condo`,
    built: (y: number) => `built ${y}`,
    units: (n: number) => `${n} units`,
    vsDistrict: (n: number) =>
      n > 0
        ? `priced ${n}% above district avg`
        : n < 0
          ? `priced ${Math.abs(n)}% below district avg`
          : "at district average",
    // Building-name queries are ~94% of this site's impressions and the
    // SERP for them is listing portals with photos. The title has to say
    // what a portal cannot: we checked the price, the yield and the flood
    // risk. Numbers go in where we have them.
    /** The title only advertises checks this building actually has. Until
     *  2026-09-26 every condo title said "Price/sqm, Yield & Flood Risk" even
     *  with no listings, no price and no yield behind it: Sukon Court ranked
     *  9.9 for its own name with 46 impressions and zero clicks. */
    condoTitle: (
      name: string,
      region: string,
      f: { yieldPct: string | null; flood: number | null; listings: number | null; reviews: number | null },
    ) => {
      const parts: string[] = [];
      if (f.listings && f.listings > 0) parts.push(`${f.listings} Listings`);
      if (f.yieldPct) parts.push(`Yield ${f.yieldPct}%`);
      if (f.flood != null) parts.push(`Flood L${f.flood}/5`);
      if (f.reviews && f.reviews >= 3) parts.push("Reviews");
      if (parts.length === 0) parts.push("Building Data & District Prices");
      return `${name}, ${region} — ${parts.join(" · ")} | RealData`;
    },
    condoDesc: (name: string, region: string, province: string, verdict: string | null, facts: string) =>
      `Is ${name} (${region}, ${province}) overpriced? ` +
      `${verdict ? verdict.charAt(0).toUpperCase() + verdict.slice(1) : "Price per sqm vs the district average"}` +
      `${facts ? ` · ${facts}` : ""}. Independent check: listings from 4 portals, ` +
      `13-month price trend, yield vs the mortgage rate, flood risk and amenities.`,
    districtTitle: (district: string, province: string) =>
      `${district} Condos, ${province} — Yields, Prices & Flood Risk | RealData`,
    districtDesc: (district: string, province: string) =>
      `Every condo in ${district}, ${province}: gross rental yields ranked ` +
      `against Thai MRR, sale/rent medians, flood risk levels, and ` +
      `cross-portal price comparison. Independent data — no developer placement.`,
    floodDistrictTitle: (district: string, level: number) =>
      `Does ${district} Flood? Bangkok Flood Risk Level ${level}/5 | RealData`,
    floodDistrictDesc: (district: string, level: number, condos: number) =>
      `${district}, Bangkok is rated flood risk ${level} of 5 — scored against ` +
      `BMA Drainage Department records, JICA flood-frequency reports and 2011 great ` +
      `flood inundation mapping. ${condos} tracked buildings, monsoon history, and how ` +
      `${district} compares with the other 49 khet.`,
    askTitle: "Ask RealData — AI condo research for Thailand",
    askDesc:
      "Ask any question about Bangkok and Thailand condos — yields, prices, comparisons, " +
      "flood risk, mortgage spread. Answers are grounded in measured data across 4 portals " +
      "and Bank of Thailand macro indicators.",
    compareTitle: "Compare Bangkok condos side-by-side — RealData",
    compareDesc:
      "Compare 2-3 Bangkok condos head-to-head: yield, mortgage spread, " +
      "flood risk, transit distance, foreign quota, multi-portal price. " +
      "Independent measurement.",
    nearIndexTitle: "Condos Near Every BTS & MRT Station in Bangkok | RealData",
    nearIndexDesc:
      "Every Bangkok BTS Skytrain and MRT station with condo buildings within 1 km — condo counts, median price per sqm and gross yield per station. Independent data, no developer sponsorships.",
    developerIndexTitle: "Every Thai Condo Developer — Track Records & Projects | RealData",
    developerIndexDesc:
      "An A–Z index of every condo developer in Thailand we track, with project count, units built and the buildings we hold price, yield and livability data on. Independent, no developer sponsorships.",
    developerTitle: (name: string) => `${name} Condos in Thailand — Track Record | RealData`,
    developerDesc: (name: string, projects: string, units: string) =>
      `${projects} projects · ${units} units built. ` +
      `Browse all ${name} condos with yield, price, and retiree score data.`,
    retireeTitle:
      "Best Condos for Retirees in Thailand 2026 — Bangkok, Phuket, Chiang Mai | RealData",
    retireeDesc:
      "Thailand condos ranked for retiree suitability — healthcare access (hospitals within 1km), air quality (AQI), BTS/MRT transit, and daily errands. Bangkok, Phuket, Pattaya, Chiang Mai and more. No developer sponsorships.",
    retireeCityTitle: (city: string) =>
      `Best Condos for Retirees in ${city} — Hospitals, AQI & Transit Ranked | RealData`,
    retireeCityDesc: (city: string) =>
      `${city} condos ranked by retiree suitability score — ` +
      `hospitals within 1 km, air quality (AQI/PM2.5), BTS/MRT transit access, and daily errands. ` +
      `Includes foreign-quota availability and monthly CAM fees. No developer sponsorships.`,
    glossaryTermTitle: (term: string) =>
      `${term} — definition & how it's calculated | RealData`,
    blogIndexTitle:
      "Bangkok Real Estate Blog — Condo Data, Flood Risk & Investment Guides | RealData",
    blogIndexDesc:
      "Data-driven Bangkok real estate analysis — flood risk rankings, bubble index breakdowns, rental yield comparisons, retiree guides, and foreign buyer handbooks. No influencer speculation, just numbers.",
    yieldsTitle:
      "Top Rental Yield Condos in Bangkok & Thailand — Ranked vs Bank of Thailand Rate | RealData",
    yieldsDesc:
      "Bangkok and Thailand condos ranked by gross rental yield (annual rent ÷ sale price). " +
      "Each building compared against the live Bank of Thailand MRR mortgage benchmark — positive spread means rent covers the mortgage. " +
      "Independent measurement across hipflat, dotproperty, ddproperty, fazwaz.",
    inventoryTitle:
      "Bangkok Condo List — All Buildings with Yield, Price & Flood Risk | RealData",
    inventoryDesc:
      "Browse 12,000+ condos across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin and Chonburi. " +
      "Each card shows rental yield, Bubble Index, flood risk, and foreign quota. Filter by city and district.",
    macroTitle: "Thailand mortgage + macro rates (BOT data) — RealData",
    macroDesc:
      "Bank of Thailand benchmark rates: Policy Rate, MRR, MLR, MOR, household debt. " +
      "The macro backdrop every Thai condo buyer needs before signing a loan.",
    floodTitle: "Bangkok Flood Risk Map — All 50 Districts Scored | RealData",
    floodDesc:
      "Which Bangkok districts flood every monsoon season — and which stay dry. All 50 khet scored 0–5 using BMA Drainage Dept, JICA, and 2011 great flood records. Every condo plotted on the risk map.",
    realityTitle:
      "Bangkok Condo Marketing vs Reality — Influencer Claims Fact-Checked | RealData",
    realityDesc:
      "Influencer and advertiser-promoted Bangkok condos placed next to our measured Bubble Index and yield data. We don't attack the influencer — only the numbers. Independent data, no developer money.",
  },
};

export default dict;
export type Dict = typeof dict;
