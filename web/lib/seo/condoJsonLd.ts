/**
 * Schema.org JSON-LD generators for condo detail pages.
 *
 * Kept separate from the page file so the 500+ line route component stays
 * navigable. The ApartmentComplex schema is tuned for AI Overviews and
 * Perplexity citation: bubble_index, flood_risk_level, transit distances,
 * etc. land as additionalProperty entries so the verdicts (not just
 * marketing metadata) get quoted.
 */

type CondoLite = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  total_units: number | null;
  available_units_count: number | null;
};

type AnalyticalSignals = {
  bubble_index?: number | null;
  flood_risk_level?: number | null;
  nearest_bts_distance_m?: number | null;
  hospitals_within_1km?: number | null;
  gross_yield_pct?: number | null;
  aqi_score?: number | null;
  foreign_quota_inventory_pct?: number | null;
  resale_liquidity_score?: number | null;
  retiree_suitability_score?: number | null;
  subsidence_level?: number | null;
};

type Args = {
  condo: CondoLite;
  region: string;
  amenities: string[];
  signals: AnalyticalSignals;
  siteUrl: string;
  lang: string;
};

export function buildCondoJsonLd(args: Args): Record<string, unknown> {
  const { condo, region, amenities, signals, siteUrl, lang } = args;

  const additionalProps: Array<{
    "@type": "PropertyValue";
    name: string;
    value: string | number;
  }> = [];

  if (signals.bubble_index != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Bubble Index (district avg = 100)",
      value: signals.bubble_index,
    });
  }
  if (signals.flood_risk_level != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Flood Risk (0-5)",
      value: signals.flood_risk_level,
    });
  }
  if (signals.nearest_bts_distance_m != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Distance to nearest BTS (m)",
      value: signals.nearest_bts_distance_m,
    });
  }
  if (signals.hospitals_within_1km != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Hospitals within 1km",
      value: signals.hospitals_within_1km,
    });
  }
  if (signals.gross_yield_pct != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Gross rental yield (%)",
      value: signals.gross_yield_pct,
    });
  }
  if (signals.aqi_score != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Air Quality Index (WAQI)",
      value: signals.aqi_score,
    });
  }
  if (signals.foreign_quota_inventory_pct != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Foreign-quota inventory share (%)",
      value: signals.foreign_quota_inventory_pct,
    });
  }
  if (signals.resale_liquidity_score != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Resale Liquidity Score (0-100)",
      value: signals.resale_liquidity_score,
    });
  }
  if (signals.retiree_suitability_score != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Retiree Suitability Score (0-100)",
      value: signals.retiree_suitability_score,
    });
  }
  if (signals.subsidence_level != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Ground Stability / land-subsidence level (0-5)",
      value: signals.subsidence_level,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: condo.name,
    url: `${siteUrl}/${lang}/condo/${condo.id}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: region,
      addressRegion: "Bangkok",
      addressCountry: "TH",
    },
    ...(condo.latitude != null && condo.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: condo.latitude,
            longitude: condo.longitude,
          },
        }
      : {}),
    ...(condo.total_units != null
      ? {
          numberOfAccommodationUnits: {
            "@type": "QuantitativeValue",
            value: condo.total_units,
          },
        }
      : {}),
    ...(condo.available_units_count != null
      ? {
          numberOfAvailableAccommodationUnits: {
            "@type": "QuantitativeValue",
            value: condo.available_units_count,
          },
        }
      : {}),
    ...(amenities.length
      ? {
          amenityFeature: amenities.map((a) => ({
            "@type": "LocationFeatureSpecification",
            name: a,
          })),
        }
      : {}),
    ...(additionalProps.length ? { additionalProperty: additionalProps } : {}),
  };
}

export function buildBreadcrumbsJsonLd(args: {
  siteUrl: string;
  lang: string;
  condoId: string;
  condoName: string;
  region: string;
}): Record<string, unknown> {
  const { siteUrl, lang, condoId, condoName, region } = args;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "RealData", item: `${siteUrl}/${lang}` },
      { "@type": "ListItem", position: 2, name: "Inventory", item: `${siteUrl}/${lang}/inventory` },
      { "@type": "ListItem", position: 3, name: region, item: `${siteUrl}/${lang}/inventory` },
      { "@type": "ListItem", position: 4, name: condoName, item: `${siteUrl}/${lang}/condo/${condoId}` },
    ],
  };
}

/**
 * WebPage schema with SpeakableSpecification pointing at the sections of
 * the condo report most suitable for a voice readout (and therefore most
 * likely to be quoted by ChatGPT/Claude voice + Google Assistant).
 *
 * Selectors target stable `data-speakable` attributes added to the page —
 * the ReportCard's verdict tiles and the headline fact bullets. Keep the
 * markup attribute names in sync.
 */
export function buildCondoSpeakableJsonLd(args: {
  siteUrl: string;
  lang: string;
  condoId: string;
  condoName: string;
}): Record<string, unknown> {
  const { siteUrl, lang, condoId, condoName } = args;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${condoName} — RealData report`,
    url: `${siteUrl}/${lang}/condo/${condoId}`,
    inLanguage: lang,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [
        "[data-speakable='report-card']",
        "[data-speakable='building-facts']",
        "[data-speakable='headline-signals']",
      ],
    },
  };
}
