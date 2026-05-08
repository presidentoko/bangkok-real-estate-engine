"use client";

import { useRef } from "react";
import { ShareButton } from "./ShareButton";

type Promotion = {
  id: string;
  promoted_by: string;
  promotion_url: string | null;
  platform: string | null;
  claim: string | null;
  promoted_at: string | null;
};

type Condo = {
  id: string;
  name: string;
  developer: string | null;
  url: string | null;
  regions?: { name: string } | { name: string }[] | null;
};

type Signals = {
  bubble_index: number | null;
  is_super_value: boolean | null;
  livability_score: number | null;
  bts_distance_m: number | null;
  flood_risk_level: number | null;
  hospitals: number;
  schools: number;
  supermarkets: number;
  price_drop_count: number;
  price_drop_total_pct: number | null;
  list_price: number | null;
  list_pps: number | null;
  region_avg_pps: number | null;
};

type Verdict = "contradicts" | "supports" | "neutral" | "unknown";

type SignalRow = {
  label: string;
  marketing: string;
  data: string;
  verdict: Verdict;
};

const VERDICT_COLORS: Record<Verdict, string> = {
  contradicts: "bg-red-500 text-red-50",
  supports: "bg-emerald-500 text-emerald-50",
  neutral: "bg-zinc-500 text-zinc-50",
  unknown: "bg-zinc-700 text-zinc-300",
};

const VERDICT_ICON: Record<Verdict, string> = {
  contradicts: "❌",
  supports: "✅",
  neutral: "⚖️",
  unknown: "—",
};

function formatTHB(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(n).toLocaleString()}`;
}

function buildSignals(s: Signals): SignalRow[] {
  const rows: SignalRow[] = [];

  // 1. Investment value vs district
  if (s.bubble_index == null) {
    rows.push({
      label: "Investment value",
      marketing: "Best investment in the area",
      data: "no pricing data yet — run the pipeline",
      verdict: "unknown",
    });
  } else {
    const above = s.bubble_index - 100;
    if (above > 15) {
      rows.push({
        label: "Investment value",
        marketing: "Best investment, prices only going up",
        data: `Priced ${above.toFixed(1)}% ABOVE district average (Bubble Index ${s.bubble_index})`,
        verdict: "contradicts",
      });
    } else if (above < -15) {
      rows.push({
        label: "Investment value",
        marketing: "Premium pricing reflects premium quality",
        data: `Priced ${Math.abs(above).toFixed(1)}% BELOW district average — actually under-valued (Bubble Index ${s.bubble_index})`,
        verdict: "supports",
      });
    } else {
      rows.push({
        label: "Investment value",
        marketing: "Best investment in the area",
        data: `Priced near district average (Bubble Index ${s.bubble_index})`,
        verdict: "neutral",
      });
    }
  }

  // 2. Price stability
  if (s.price_drop_count > 0) {
    rows.push({
      label: "Price stability",
      marketing: "Strong demand, prices firming up",
      data: `Listing dropped price ${s.price_drop_count}× (total ${s.price_drop_total_pct?.toFixed(1) ?? "?"}%)`,
      verdict: "contradicts",
    });
  } else if (s.list_price != null) {
    rows.push({
      label: "Price stability",
      marketing: "Strong demand, prices firming up",
      data: "No price drops observed in our window",
      verdict: "supports",
    });
  }

  // 3. Transit
  if (s.bts_distance_m != null) {
    if (s.bts_distance_m <= 500) {
      rows.push({
        label: "Transit",
        marketing: "Walking distance to BTS/MRT",
        data: `${s.bts_distance_m} m to nearest station`,
        verdict: "supports",
      });
    } else if (s.bts_distance_m > 1200) {
      rows.push({
        label: "Transit",
        marketing: "Walking distance to BTS/MRT",
        data: `${s.bts_distance_m} m to nearest station — not walkable`,
        verdict: "contradicts",
      });
    } else {
      rows.push({
        label: "Transit",
        marketing: "Convenient access to public transport",
        data: `${s.bts_distance_m} m to nearest station`,
        verdict: "neutral",
      });
    }
  }

  // 4. Flood risk
  if (s.flood_risk_level != null) {
    if (s.flood_risk_level >= 4) {
      rows.push({
        label: "Flood / monsoon",
        marketing: "Safe, dry, well-drained location",
        data: `District flood risk Level ${s.flood_risk_level}/5 — heavy 2011 + recurring monsoon flooding`,
        verdict: "contradicts",
      });
    } else if (s.flood_risk_level <= 1) {
      rows.push({
        label: "Flood / monsoon",
        marketing: "Safe, dry, well-drained location",
        data: `District flood risk Level ${s.flood_risk_level}/5 — central elevated, well-drained`,
        verdict: "supports",
      });
    } else {
      rows.push({
        label: "Flood / monsoon",
        marketing: "Safe location",
        data: `District flood risk Level ${s.flood_risk_level}/5 — moderate`,
        verdict: "neutral",
      });
    }
  }

  // 5. Amenity density
  const amenityTotal = s.hospitals + s.schools + s.supermarkets;
  if (s.bubble_index != null) {
    if (amenityTotal === 0) {
      rows.push({
        label: "Amenities",
        marketing: "Surrounded by amenities, lifestyle hub",
        data: "0 hospitals / schools / supermarkets within 1 km (OSM)",
        verdict: "contradicts",
      });
    } else if (amenityTotal >= 12) {
      rows.push({
        label: "Amenities",
        marketing: "Surrounded by amenities, lifestyle hub",
        data: `🏥 ${s.hospitals} · 🏫 ${s.schools} · 🛒 ${s.supermarkets} within 1 km`,
        verdict: "supports",
      });
    } else {
      rows.push({
        label: "Amenities",
        marketing: "Convenient surroundings",
        data: `🏥 ${s.hospitals} · 🏫 ${s.schools} · 🛒 ${s.supermarkets} within 1 km`,
        verdict: "neutral",
      });
    }
  }

  // 6. Independent verification flag
  if (s.is_super_value === true) {
    rows.push({
      label: "Independent rating",
      marketing: "Top pick, expert-recommended",
      data: "✓ RealData Super Value flag — top 5% on price + livability",
      verdict: "supports",
    });
  } else if (s.is_super_value === false && s.bubble_index != null) {
    rows.push({
      label: "Independent rating",
      marketing: "Top pick, expert-recommended",
      data: "Not flagged as Super Value by our independent scoring",
      verdict: "contradicts",
    });
  }

  return rows;
}

export function RealityCard({
  condo,
  promotion,
  signals,
}: {
  condo: Condo;
  promotion: Promotion;
  signals: Signals;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const region =
    Array.isArray(condo.regions) ? condo.regions[0]?.name : condo.regions?.name;
  const rows = buildSignals(signals);
  const contradictCount = rows.filter((r) => r.verdict === "contradicts").length;
  const supportCount = rows.filter((r) => r.verdict === "supports").length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-2 px-2">
        <div
          ref={cardRef}
          className="mx-auto bg-zinc-950 p-6 rounded-3xl border border-zinc-800"
          style={{ width: 600, minHeight: 750 }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-pink-400 text-[10px] uppercase tracking-widest font-bold">
                Marketing vs Reality
              </div>
              <h1 className="text-2xl font-bold mt-1 leading-tight">{condo.name}</h1>
              <div className="text-zinc-400 text-sm">{region ?? "Bangkok"}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Verdict
              </div>
              <div className="font-bold mt-0.5">
                <span className="text-red-400">{contradictCount}</span>
                <span className="text-zinc-500"> ❌ </span>
                <span className="text-emerald-400">{supportCount}</span>
                <span className="text-zinc-500"> ✅</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 mb-4 border-l-4 border-pink-500">
            <div className="text-[10px] uppercase tracking-wider text-pink-400 font-semibold">
              Promoted by {promotion.promoted_by} · {promotion.platform ?? "?"}
            </div>
            {promotion.claim ? (
              <div className="mt-1 text-zinc-200 italic">
                &ldquo;{promotion.claim}&rdquo;
              </div>
            ) : (
              <div className="mt-1 text-zinc-500 text-sm">
                (No claim recorded — testing generic marketing claims below)
              </div>
            )}
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="bg-zinc-900 rounded-xl p-3 border border-zinc-800"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                    {r.label}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${VERDICT_COLORS[r.verdict]}`}
                  >
                    {VERDICT_ICON[r.verdict]} {r.verdict}
                  </span>
                </div>
                <div className="text-sm text-zinc-300">
                  <span className="text-zinc-500">Marketing: </span>
                  &ldquo;{r.marketing}&rdquo;
                </div>
                <div className="text-sm text-zinc-100 font-medium mt-1">
                  <span className="text-zinc-500 font-normal">Data: </span>
                  {r.data}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-baseline justify-between text-[10px] text-zinc-500">
            <div>
              {signals.list_price != null && (
                <>
                  Listing: {formatTHB(signals.list_price)}
                  {signals.list_pps != null && (
                    <> · ฿{Math.round(signals.list_pps).toLocaleString()}/m²</>
                  )}
                  {signals.region_avg_pps != null && (
                    <>
                      {" "}· District avg ฿
                      {Math.round(signals.region_avg_pps).toLocaleString()}/m²
                    </>
                  )}
                </>
              )}
            </div>
            <div className="text-right leading-tight">
              realdata.bkk
              <br />
              powered by data,
              <br />
              not influencers
            </div>
          </div>
        </div>
      </div>

      <ShareButton
        targetRef={cardRef}
        filename={`${condo.name.replace(/\s+/g, "-").toLowerCase()}-reality.png`}
      />
    </div>
  );
}
