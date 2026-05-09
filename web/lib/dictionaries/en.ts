// English — primary dictionary. Other locales must mirror this shape;
// TypeScript will catch missing keys via the Dict type.

const dict = {
  brand: {
    name: "RealData",
    tagline: "powered by data, not influencers",
  },
  nav: {
    flood: "Bangkok Flood",
    inventory: "Inventory",
    reality: "Marketing vs Reality",
    blog: "Blog",
    about: "Methodology",
    contact: "Contact",
  },
  footer: {
    about:
      "Powered by data, not influencers. We measure and verify 1,003 Bangkok condos with no paid placement, no influencer deals.",
    sectionsTitle: "Sections",
    sourcesTitle: "Data sources",
    sources: [
      "Listings & price: hipflat.co.th",
      "Flood: BMA + JICA + 2011 great flood records",
      "Infrastructure & transit: OpenStreetMap (Overpass)",
      "District boundaries: OSM admin_level=6",
    ],
    copyright: "Independent measurement · no commissions, no ads",
  },
  home: {
    heroPretitle: "powered by data, not influencers",
    heroTitle1: "The truth about",
    heroTitle2Highlight: "Bangkok condos",
    heroTitle3: ", in numbers",
    heroLead:
      "Influencers and agents won't tell you the price bubble, flood risk, or actual unit state. We measure all 1,003 Bangkok condos. No ads, no commissions.",
    ctaFlood: "See the flood map →",
    ctaInventory: "Browse 1,003 buildings",
    statsLabels: {
      buildings: "buildings",
      listings: "individual units",
      chartPts: "monthly price datapoints",
      floodMapping: "districts mapped",
    },
    featuresHeader: "What we surface",
    features: [
      {
        href: "/flood",
        emoji: "🌊",
        title: "Bangkok Flood Map",
        desc: "Monsoon flood risk for all 50 districts on a 0–5 scale. Every condo plotted as a dot in its risk colour.",
        badge: "1,088 / 1,088 scored",
      },
      {
        href: "/inventory",
        emoji: "🗺️",
        title: "Full Inventory",
        desc: "1,003 buildings × 51 districts. Khet groups + per-building cards. Click into any building for the full RealData report.",
        badge: "1,003 buildings mapped",
      },
      {
        href: "/reality",
        emoji: "❌✅",
        title: "Marketing vs Reality",
        desc: "Influencer / ad claims placed next to our measured data. Bubble vs underpriced verdict.",
        badge: "Bubble Index on 665",
      },
      {
        href: "/blog",
        emoji: "📊",
        title: "Data analysis blog",
        desc: "Top 10 overpriced. Best for foreign investors. Popular condos in flood zones. Every post backed by our own data.",
        badge: "3 longform posts",
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
    citiesLead: "Same data engine, different cities. Pattaya, Phuket, Chiang Mai, Hua Hin, Chonburi.",
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
        a: "We measure 1,003 Bangkok condos — listing prices, amenities, BTS/MRT distance, flood risk — and let you compare them. The message: don't buy because an influencer recommended it. Verify with data first.",
      },
      {
        q: "Where does the data come from?",
        a: "Listings & price: hipflat.co.th. Flood risk: BMA Drainage Department + JICA reports + 2011 great flood inundation records. Infra & transit: OpenStreetMap (Overpass API). District boundaries: OSM admin_level=6. All public data, ToS-compliant.",
      },
      {
        q: "What is the Bubble Index?",
        a: "(building's price-per-sqm ÷ district average price-per-sqm) × 100. 100 = at market. 200 = double the average. Below 80 = underpriced; above 130 = bubble suspect.",
      },
      {
        q: "Can a foreigner own this condo?",
        a: "Thai law limits foreign ownership to 49% of the floor area in any one condo project. The remaining quota varies per building — confirm with the project office or hipflat. RealData verifies price, amenities, and risk only — not legal eligibility.",
      },
      {
        q: "Do you broker listings or run ads?",
        a: "No. Listing clicks go to the original hipflat page. No banner ads, no referral fees, no influencer placement. Future revenue: (a) data-qualified lead generation, (b) B2B market reports, (c) 'Verified by RealData' certification mark.",
      },
      {
        q: "How often is the data refreshed?",
        a: "Listings & price: weekly hipflat re-crawl. Flood: annual (after BMA monsoon report). Infra (hospital/school/transit): on OSM change detection (quarterly review). Each building page shows the measurement timestamp.",
      },
    ],
  },
  flood: {
    title: "🌊 Bangkok Flood Map",
    lead: "Which districts flood every monsoon, which stay dry. Verify before you buy. Built from BMA Drainage Department + JICA reports + 2011 great flood records.",
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
  hover: {
    buildings: "buildings",
    building: "building",
    levelUnknown: "no data",
    geoLocatedSuffix: "geo-located",
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
  about: {
    title: "Methodology",
    lead: "How RealData measures every Thai condo. Sources, formulas, refresh cadence, and what we deliberately don't do.",
    sectionMission: {
      title: "What we do",
      body: "We measure 1,700+ condos across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, and Chonburi continuously. Every building gets a Bubble Index, livability score, and (in Bangkok) a flood-risk level — independent of the listing source's marketing copy. No referral fees, no ad placements, no influencer deals.",
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
        "We don't take referral fees from agents or developers.",
        "We don't run banner ads. Marketing-vs-Reality slots are paid promotion — clearly labeled.",
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
    fullInventoryTitle: (city: string) => `All ${city} buildings`,
    fullInventoryStat: (n: number) => `${n.toLocaleString()} tracked`,
    pendingPipeline: "No condos tracked yet. Pipeline running.",
    otherCitiesHeader: "Other cities",
  },
  reality: {
    title: "Marketing vs Reality",
    lead: "Influencer / advertiser-promoted condos. We place our measured data next to their marketing claims. We don't attack the influencer — only the numbers.",
    note: "This is a paid-promotion slot. Sponsors pay for the marketing claim; we control the data column. Want your condo here? Contact us.",
    emptyState: "No promoted condos yet.",
    promotedBy: "promoted by",
    vsDistrict: "vs district",
    sponsorCta: "Sponsor a slot — your claim, our data →",
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
      errorGeneric: "Something went wrong. Try email instead.",
      fallbackPrefix: "or email us at",
      fallbackEmail: "umma@xx.gg",
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
  condoPage: {
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
  },
};

export default dict;
export type Dict = typeof dict;
