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
