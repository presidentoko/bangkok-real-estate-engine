"use client";

import { useMemo, useState } from "react";

type ChartPoint = {
  period: string;
  metric: string;
  currency: string | null;
  year_month: string;
  value: number;
};

type Series = {
  period: "rent" | "sale";
  metric: "price" | "per_sqm";
  currency: string | null;
  points: { date: string; value: number }[];
};

const PERIOD_LABELS: Record<string, string> = {
  sale: "For sale",
  rent: "For rent",
};
const METRIC_LABELS: Record<string, string> = {
  price: "Median price",
  per_sqm: "Price / sqm",
};

const SERIES_COLORS: Record<string, string> = {
  "sale-price": "#f97316",
  "sale-per_sqm": "#fb923c",
  "rent-price": "#3b82f6",
  "rent-per_sqm": "#60a5fa",
};

function formatMonth(ym: string): string {
  // ym is "2025-04-01" → "Apr '25"
  const d = new Date(ym + "T00:00:00Z");
  if (isNaN(d.getTime())) return ym;
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) +
    ` '${String(d.getUTCFullYear()).slice(-2)}`;
}

export function PriceChart({ points }: { points: ChartPoint[] }) {
  // Group into series
  const series: Series[] = useMemo(() => {
    const m = new Map<string, Series>();
    for (const p of points) {
      const k = `${p.period}-${p.metric}`;
      let s = m.get(k);
      if (!s) {
        s = {
          period: p.period as "rent" | "sale",
          metric: p.metric as "price" | "per_sqm",
          currency: p.currency,
          points: [],
        };
        m.set(k, s);
      }
      s.points.push({ date: p.year_month, value: Number(p.value) });
    }
    return Array.from(m.values()).map((s) => ({
      ...s,
      points: s.points.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [points]);

  const periods = useMemo(() => {
    const set = new Set(series.map((s) => s.period));
    return Array.from(set);
  }, [series]);

  const [activePeriod, setActivePeriod] = useState<"rent" | "sale">(
    () => (periods.includes("sale") ? "sale" : "rent") as "rent" | "sale"
  );
  const [activeMetric, setActiveMetric] = useState<"price" | "per_sqm">("price");

  const visible = series.find(
    (s) => s.period === activePeriod && s.metric === activeMetric
  );

  if (!visible) return null;

  const W = 720;
  const H = 240;
  const PAD = { l: 56, r: 16, t: 16, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xs = visible.points.map((p) => p.date);
  const ys = visible.points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || yMax * 0.1 || 1;
  const yScaleMin = Math.max(0, yMin - yPad);
  const yScaleMax = yMax + yPad;
  const xStep = xs.length > 1 ? innerW / (xs.length - 1) : innerW;

  const xAt = (i: number) => PAD.l + i * xStep;
  const yAt = (v: number) =>
    PAD.t + innerH - ((v - yScaleMin) / (yScaleMax - yScaleMin)) * innerH;

  const path = visible.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.value)}`)
    .join(" ");
  const areaPath =
    path +
    ` L ${xAt(visible.points.length - 1)} ${PAD.t + innerH}` +
    ` L ${xAt(0)} ${PAD.t + innerH} Z`;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    yScaleMin + (i / yTicks) * (yScaleMax - yScaleMin)
  );

  const seriesKey = `${activePeriod}-${activeMetric}`;
  const stroke = SERIES_COLORS[seriesKey] ?? "#3b82f6";

  const first = visible.points[0];
  const last = visible.points[visible.points.length - 1];
  const change = last.value - first.value;
  const changePct = first.value > 0 ? (change / first.value) * 100 : 0;
  const changePos = change > 0;

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">
          Price trend · 13 months
        </h2>
        <div className="flex gap-1 text-xs">
          {periods.length > 1 &&
            periods.map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p as "rent" | "sale")}
                className={`px-2 py-1 rounded transition ${
                  activePeriod === p
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          {(["price", "per_sqm"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-2 py-1 rounded transition ${
                activeMetric === m
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-2">
        <div className="text-2xl font-bold tabular-nums">
          {visible.currency ?? "USD"} {Math.round(last.value).toLocaleString()}
        </div>
        <div
          className={`text-xs font-semibold ${
            changePos ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-zinc-400"
          }`}
        >
          {changePos ? "▲" : change < 0 ? "▼" : "—"}{" "}
          {Math.abs(changePct).toFixed(1)}% (vs {formatMonth(first.date)})
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${seriesKey}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y-axis grid + labels */}
        {tickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="#27272a"
              strokeDasharray="2 4"
            />
            <text
              x={PAD.l - 6}
              y={yAt(v) + 3}
              fill="#71717a"
              fontSize="10"
              textAnchor="end"
            >
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        ))}

        {/* x-axis labels (first, mid, last) */}
        {[0, Math.floor(xs.length / 2), xs.length - 1].map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 8}
            fill="#71717a"
            fontSize="10"
            textAnchor={i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle"}
          >
            {formatMonth(xs[i])}
          </text>
        ))}

        <path d={areaPath} fill={`url(#grad-${seriesKey})`} />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" />

        {/* dots on each point */}
        {visible.points.map((p, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r="2.5" fill={stroke} />
        ))}
      </svg>
    </section>
  );
}
