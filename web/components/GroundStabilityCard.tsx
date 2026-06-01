type Props = {
  level: number | null;
  source: string | null;
};

// Static class strings (no runtime construction) so Tailwind keeps them.
const META: Record<
  number,
  { label: string; blurb: string; tone: string; bar: string }
> = {
  5: {
    label: "Severe",
    blurb:
      "Coastal subsidence compounded by sea-level rise. The highest long-term ground-instability tier in Bangkok.",
    tone: "text-rose-400",
    bar: "bg-rose-400",
  },
  4: {
    label: "High",
    blurb:
      "Eastern soft-clay belt with documented elevated sinking. Watch foundation and drainage disclosures closely.",
    tone: "text-orange-400",
    bar: "bg-orange-400",
  },
  3: {
    label: "Moderate",
    blurb:
      "Transitional outer zone or a historical subsidence hotspot. Rates have eased but are not negligible.",
    tone: "text-amber-400",
    bar: "bg-amber-400",
  },
  2: {
    label: "Low",
    blurb:
      "Outer ring, largely stabilised since groundwater pumping was regulated.",
    tone: "text-lime-400",
    bar: "bg-lime-400",
  },
  1: {
    label: "Very low",
    blurb:
      "Consolidated inner core with long-regulated groundwater — effectively flat today.",
    tone: "text-emerald-400",
    bar: "bg-emerald-400",
  },
};

/**
 * Ground stability (land subsidence) — Bangkok sits on soft marine clay and
 * parts of it are still sinking, which compounds flood exposure. No portal
 * surfaces this; we rate it district-level (0–5) from published InSAR /
 * groundwater-monitoring studies. Hidden when we have no reading.
 */
export function GroundStabilityCard({ level, source }: Props) {
  if (level == null) return null;
  const m = META[level] ?? META[3];

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Ground stability
        </h2>
        <span className="text-xs text-zinc-500">is the land sinking?</span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div className={`text-4xl font-bold tabular-nums ${m.tone}`}>
          L{level}
          <span className="text-lg text-zinc-600 font-normal">/5</span>
        </div>
        <div className={`text-sm font-semibold mb-1 ${m.tone}`}>
          {m.label} subsidence
        </div>
      </div>

      {/* 5-segment scale */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i <= level ? m.bar : "bg-zinc-800"
            }`}
          />
        ))}
      </div>

      <p className="text-zinc-500 text-xs leading-relaxed">
        {m.blurb} District-level estimate from published InSAR and
        groundwater-monitoring studies — a relative long-term signal, not a
        per-building survey. Land subsidence amplifies the same areas&apos;
        monsoon-flood risk over a 10–20 year horizon.
      </p>
    </section>
  );
}
