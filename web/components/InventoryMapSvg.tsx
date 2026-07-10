"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type KhetCount = { name: string; count: number };
export type CondoPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type DistrictFeature = {
  type: "Feature";
  properties: { name?: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

type DistrictsGeoJson = {
  type: string;
  features: Array<Record<string, unknown>>;
};

const VIEW_W = 800;
const VIEW_H = 600;
const PAD = 12;

// Choropleth scale: more buildings = brighter blue. Matches the previous
// maplibre interpolate stops so the visual identity is preserved.
function colorForCount(count: number): string {
  if (count <= 0) return "#1f2937";
  if (count < 5) return "#1e3a5f";
  if (count < 20) return "#1d4ed8";
  if (count < 50) return "#3b82f6";
  if (count < 80) return "#60a5fa";
  return "#bfdbfe";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

function ringsToPath(
  rings: number[][][],
  project: (lng: number, lat: number) => [number, number]
): string {
  return rings
    .map((ring) => {
      let d = "";
      for (let i = 0; i < ring.length; i++) {
        const [lng, lat] = ring[i];
        const [x, y] = project(lng, lat);
        d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
      }
      return d + "Z";
    })
    .join(" ");
}

export function InventoryMapSvg({
  khetCounts,
  points = [],
  totalBuildings,
  condoLinkPrefix = "/condo/",
  districts,
}: {
  khetCounts: KhetCount[];
  points?: CondoPoint[];
  totalBuildings?: number;
  condoLinkPrefix?: string;
  districts: DistrictsGeoJson;
}) {
  const features = (districts.features ?? []) as unknown as DistrictFeature[];

  const countByNorm = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of khetCounts) {
      m.set(normalize(k.name), (m.get(normalize(k.name)) ?? 0) + k.count);
    }
    return m;
  }, [khetCounts]);

  const { paths, dots } = useMemo(() => {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const f of features) {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          for (const [lng, lat] of ring) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
    }
    const midLat = (minLat + maxLat) / 2;
    const lngFactor = Math.cos((midLat * Math.PI) / 180);
    const wLng = (maxLng - minLng) * lngFactor;
    const hLat = maxLat - minLat;
    const sx = (VIEW_W - 2 * PAD) / wLng;
    const sy = (VIEW_H - 2 * PAD) / hLat;
    const s = Math.min(sx, sy);
    const offX = (VIEW_W - wLng * s) / 2;
    const offY = (VIEW_H - hLat * s) / 2;
    const project = (lng: number, lat: number): [number, number] => {
      const x = (lng - minLng) * lngFactor * s + offX;
      const y = VIEW_H - ((lat - minLat) * s + offY);
      return [x, y];
    };

    const paths = features.map((f, i) => {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      const d = polys.map((rings) => ringsToPath(rings, project)).join(" ");
      const name = f.properties?.name ?? "?";
      const count = countByNorm.get(normalize(name)) ?? 0;
      return { key: `${i}-${name}`, d, name, count, color: colorForCount(count) };
    });

    const dots = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const [x, y] = project(p.lng, p.lat);
        // Round to 1dp — plenty of precision at this viewBox scale, and
        // shaves the long float tails off every point's SSR'd markup.
        return { id: p.id, name: p.name, x: +x.toFixed(1), y: +y.toFixed(1) };
      });

    return { paths, dots };
  }, [features, countByNorm, points]);

  const [hover, setHover] = useState<{ name: string; count: number } | null>(null);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Bangkok condo inventory by district"
      >
        <rect width={VIEW_W} height={VIEW_H} fill="#0f172a" />
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill={p.color}
            fillOpacity={hover?.name === p.name ? 0.95 : 0.72}
            stroke="#0a0a0a"
            strokeWidth={0.6}
            onMouseEnter={() => setHover({ name: p.name, count: p.count })}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          />
        ))}
        {dots.map((d) => (
          // Every published condo has a /condo/[id] page, so always link the dot.
          <Link key={d.id} href={`${condoLinkPrefix}${d.id}`}>
            <circle
              cx={d.x}
              cy={d.y}
              r={1.8}
              fill="#fbbf24"
              stroke="#78350f"
              strokeWidth={0.3}
              opacity={0.9}
            />
          </Link>
        ))}
      </svg>

      {hover && (
        <div className="absolute top-3 right-3 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl p-3 max-w-[240px] pointer-events-none">
          <div className="font-bold text-zinc-100">{hover.name}</div>
          <div className="text-zinc-300 text-sm mt-1">
            {hover.count.toLocaleString()}{" "}
            {hover.count === 1 ? "building" : "buildings"}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl p-3 text-xs text-zinc-300 min-w-[180px]">
        <div className="font-semibold mb-1.5 text-zinc-100">Top khet</div>
        {khetCounts.slice(0, 5).map((k) => (
          <div key={k.name} className="flex justify-between gap-3 leading-5">
            <span className="truncate">{k.name}</span>
            <span className="text-zinc-500 tabular-nums">{k.count}</span>
          </div>
        ))}
        {points.length > 0 && (
          <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-900" />
            <span className="text-zinc-400">
              {points.length.toLocaleString()}
              {totalBuildings ? ` / ${totalBuildings.toLocaleString()}` : ""}{" "}
              geo-located
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
