"use client";

import Link from "next/link";
import { useMemo } from "react";

export type CityPoint = {
  id: string;
  slug?: string | null;
  name: string;
  lat: number;
  lng: number;
  bubbleIndex: number | null;
  url?: string | null;
};

const VIEW_W = 800;
const VIEW_H = 500;
const PAD = 24;

/** Color a building dot by its bubble index. Green = underpriced, red = bubble. */
function dotColor(b: number | null): string {
  if (b == null) return "#a1a1aa";
  if (b > 200) return "#dc2626";
  if (b > 130) return "#fb923c";
  if (b > 90) return "#facc15";
  return "#10b981";
}

export function CityMapSvg({
  points,
  fallbackCenter,
  condoLinkPrefix = "/condo/",
  cityName,
}: {
  points: CityPoint[];
  fallbackCenter: [number, number];
  condoLinkPrefix?: string;
  cityName: string;
}) {
  const dots = useMemo(() => {
    const pts = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    if (pts.length === 0) return [];

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const p of pts) {
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }
    // Single-point or near-collapsed bbox: pad around the centroid so we don't
    // divide by zero and the dot doesn't sit at the corner.
    const wLng = Math.max(maxLng - minLng, 0.05);
    const hLat = Math.max(maxLat - minLat, 0.05);
    if (maxLng - minLng < 0.01) {
      const cx = (minLng + maxLng) / 2 || fallbackCenter[0];
      minLng = cx - wLng / 2;
      maxLng = cx + wLng / 2;
    }
    if (maxLat - minLat < 0.01) {
      const cy = (minLat + maxLat) / 2 || fallbackCenter[1];
      minLat = cy - hLat / 2;
      maxLat = cy + hLat / 2;
    }
    const midLat = (minLat + maxLat) / 2;
    const lngFactor = Math.cos((midLat * Math.PI) / 180);
    const W = (maxLng - minLng) * lngFactor;
    const H = maxLat - minLat;
    const sx = (VIEW_W - 2 * PAD) / W;
    const sy = (VIEW_H - 2 * PAD) / H;
    const s = Math.min(sx, sy);
    const offX = (VIEW_W - W * s) / 2;
    const offY = (VIEW_H - H * s) / 2;

    return pts.map((p) => {
      const x = (p.lng - minLng) * lngFactor * s + offX;
      const y = VIEW_H - ((p.lat - minLat) * s + offY);
      return {
        id: p.id,
        slug: p.slug ?? null,
        name: p.name,
        x,
        y,
        color: dotColor(p.bubbleIndex),
        url: p.url ?? null,
      };
    });
  }, [points, fallbackCenter]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`${cityName} condo locations`}
      >
        <rect width={VIEW_W} height={VIEW_H} fill="#0f172a" />
        {dots.map((d) => {
          const circle = (
            <circle
              cx={d.x}
              cy={d.y}
              r={3}
              fill={d.color}
              stroke="#fafafa"
              strokeWidth={0.5}
              opacity={0.95}
            />
          );
          return d.url ? (
            <Link key={d.id} href={`${condoLinkPrefix}${d.slug ?? d.id}`}>
              {circle}
            </Link>
          ) : (
            <g key={d.id}>{circle}</g>
          );
        })}
      </svg>

      <div className="absolute bottom-3 left-3 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl p-3 text-[11px] text-zinc-300 leading-5">
        <div className="font-semibold text-zinc-100 mb-1">Bubble Index</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span>≤ 90 — underpriced</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
          <span>91 – 130 — at market</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
          <span>131 – 200 — premium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
          <span>{">"} 200 — bubble</span>
        </div>
      </div>
    </div>
  );
}
