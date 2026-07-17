"use client";

import { useRef } from "react";
import { getDictionary } from "@/lib/getDictionary";
import {
  GRADE_BG,
  GRADE_FG,
  gradeFromBubble,
  gradeFromFlood,
  gradeFromInfra,
  gradeFromTransit,
  type Grade,
} from "@/lib/grading";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";
import type { Condo, LatestListing, Livability, Risk, ValueScore } from "@/lib/types";
import { ShareButton } from "./ShareButton";

type Props = {
  condo: Condo;
  score: ValueScore | null;
  liv: Livability | null;
  risk: Risk | null;
  latest: LatestListing | null;
  lang?: string;
};

function formatTHB(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
}

function GradeTile({
  label,
  grade,
  detail,
}: {
  label: string;
  grade: Grade;
  detail: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${GRADE_BG[grade]} ${GRADE_FG[grade]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
        {label}
      </div>
      <div className="text-6xl font-black mt-1 leading-none">{grade}</div>
      <div className="text-[11px] mt-2 opacity-90 leading-tight">{detail}</div>
    </div>
  );
}

export function ReportCard({ condo, score, liv, risk, latest, lang }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const region = condo.regions?.name ?? "Bangkok";
  const useLang: Lang = lang && isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDictionary(useLang).reportCard;

  const gPrice = gradeFromBubble(score?.bubble_index);
  const gTransit = gradeFromTransit(
    liv?.nearest_bts_distance_m ?? null,
    liv?.nearest_mrt_distance_m ?? null
  );
  const gInfra = gradeFromInfra(
    liv?.hospitals_within_1km ?? 0,
    liv?.schools_within_1km ?? 0,
    liv?.supermarkets_within_1km ?? 0
  );
  const gFlood = gradeFromFlood(risk?.flood_risk_level);

  const closestStation =
    liv?.nearest_bts_distance_m != null &&
    (liv?.nearest_mrt_distance_m == null ||
      liv.nearest_bts_distance_m <= liv.nearest_mrt_distance_m)
      ? `BTS ${liv.nearest_bts_station ?? ""}`.trim()
      : liv?.nearest_mrt_station
      ? `MRT ${liv.nearest_mrt_station}`
      : "—";
  const closestMetres = [liv?.nearest_bts_distance_m, liv?.nearest_mrt_distance_m]
    .filter((d): d is number => d != null);

  return (
    <div className="space-y-4">
      <div
        ref={cardRef}
        className="w-full max-w-[540px] bg-zinc-950 p-6 rounded-3xl border border-zinc-800"
      >
        <div className="flex flex-col h-full">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-widest">
                  {t.eyebrow}
                </div>
                <h1 className="text-2xl font-bold mt-1 leading-tight">
                  {condo.name}
                </h1>
                <div className="text-zinc-400 text-sm mt-0.5">{region}</div>
              </div>
              {score?.is_super_value && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-emerald-950 rounded-full px-2 py-1">
                  {t.superValueBadge}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 flex-1">
              <GradeTile
                label={t.tilePrice}
                grade={gPrice}
                detail={
                  score?.bubble_index != null
                    ? t.tilePriceDetail(score.bubble_index)
                    : t.tilePriceDetailNoData
                }
              />
              <GradeTile
                label={t.tileTransit}
                grade={gTransit}
                detail={
                  closestMetres.length
                    ? `${closestStation} · ${Math.min(...closestMetres)} m`
                    : t.tileTransitNoData
                }
              />
              <GradeTile
                label={t.tileInfra}
                grade={gInfra}
                detail={
                  liv
                    ? `🏥 ${liv.hospitals_within_1km ?? 0} · 🏫 ${
                        liv.schools_within_1km ?? 0
                      } · 🛒 ${liv.supermarkets_within_1km ?? 0}`
                    : t.tileInfraNoData
                }
              />
              <GradeTile
                label={t.tileFlood}
                grade={gFlood}
                detail={
                  risk?.flood_risk_level != null
                    ? t.tileFloodDetail(risk.flood_risk_level)
                    : t.tileFloodUnknown
                }
              />
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-baseline justify-between">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t.latestListing}
                </div>
                <div className="font-bold mt-0.5">
                  {formatTHB(latest?.price)}
                  {latest?.area_sqm ? (
                    <span className="text-zinc-400 font-normal text-sm">
                      {" "}
                      · {latest.area_sqm} m² · ฿
                      {Math.round(latest?.price_per_sqm ?? 0).toLocaleString()}/m²
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-[10px] text-zinc-600 text-right leading-tight">
                passionaryestate.com
                <br />
                {t.tagline1}
                <br />
                {t.tagline2}
              </div>
            </div>
          </div>
        </div>

      <ShareButton
        targetRef={cardRef}
        filename={`${condo.name.replace(/\s+/g, "-").toLowerCase()}-report.png`}
      />
    </div>
  );
}
