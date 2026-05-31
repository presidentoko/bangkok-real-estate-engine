"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { colorForLevel, descriptorForLevel } from "@/lib/floodColors";

export type FloodPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  level: number | null;
  url?: string | null;
};

type DistrictFeature = {
  type: "Feature";
  properties: { name?: string; flood_risk_level?: number | null };
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

export function FloodMapSvg({
  districts,
  points = [],
  condoLinkPrefix = "/condo/",
  fallbackCenter,
  ariaLabel = "Bangkok flood risk choropleth",
}: {
  districts: DistrictsGeoJson;
  points?: FloodPoint[];
  condoLinkPrefix?: string;
  /** Used when districts is empty (non-Bangkok cities) — falls back to point
   *  bbox, then to a small box around this center coordinate [lng, lat]. */
  fallbackCenter?: [number, number];
  ariaLabel?: string;
}) {
  const features = (districts.features ?? []) as unknown as DistrictFeature[];

  // Compute bounding box from all district polygons; project lat/lng linearly
  // to the SVG viewport. Bangkok is small enough that simple equirectangular
  // projection with lat/lng aspect correction looks correct.
  // When districts is empty (non-Bangkok cities), fall back to the point bbox
  // and finally to a 0.4°-wide box around `fallbackCenter`.
  const { project, paths, dots } = useMemo(() => {
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
    if (!Number.isFinite(minLng)) {
      for (const p of points) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }
      // Pad point bbox by ~5% so dots don't sit on the edge.
      if (Number.isFinite(minLng)) {
        const padLng = Math.max(0.01, (maxLng - minLng) * 0.05);
        const padLat = Math.max(0.01, (maxLat - minLat) * 0.05);
        minLng -= padLng; maxLng += padLng;
        minLat -= padLat; maxLat += padLat;
      }
    }
    if (!Number.isFinite(minLng) && fallbackCenter) {
      const [clng, clat] = fallbackCenter;
      minLng = clng - 0.2; maxLng = clng + 0.2;
      minLat = clat - 0.2; maxLat = clat + 0.2;
    }
    if (!Number.isFinite(minLng)) {
      // Final fallback: Bangkok bbox so we never NaN-out the SVG.
      minLng = 100.3; maxLng = 100.9;
      minLat = 13.5;  maxLat = 14.0;
    }
    // Aspect-correct: at Bangkok ~13.7° lat, lng° spans ~0.97× lat°.
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
      const y = VIEW_H - ((lat - minLat) * s + offY); // SVG y-axis is flipped
      return [x, y];
    };

    const paths = features.map((f, i) => {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      const d = polys
        .map((rings) => ringsToPath(rings, project))
        .join(" ");
      const lvl =
        typeof f.properties?.flood_risk_level === "number"
          ? f.properties.flood_risk_level
          : null;
      return {
        key: `${i}-${f.properties?.name ?? ""}`,
        d,
        name: f.properties?.name ?? "?",
        level: lvl,
        color: colorForLevel(lvl),
      };
    });

    const dots = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const [x, y] = project(p.lng, p.lat);
        return {
          id: p.id,
          name: p.name,
          x,
          y,
          color: colorForLevel(p.level),
          url: p.url ?? null,
        };
      });

    return { project, paths, dots };
  }, [features, points]);

  void project; // satisfy lint; project lives in the closure above.

  const [hover, setHover] = useState<{ name: string; level: number | null } | null>(null);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={ariaLabel}
      >
        <rect width={VIEW_W} height={VIEW_H} fill="#0f172a" />
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill={p.color}
            fillOpacity={hover?.name === p.name ? 0.9 : 0.65}
            stroke="#18181b"
            strokeWidth={0.6}
            onMouseEnter={() => setHover({ name: p.name, level: p.level })}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          />
        ))}
        {dots.map((d) => {
          const circle = (
            <circle
              cx={d.x}
              cy={d.y}
              r={2.2}
              fill={d.color}
              stroke="#fafafa"
              strokeWidth={0.4}
              opacity={0.95}
            />
          );
          return d.url ? (
            <Link key={d.id} href={`${condoLinkPrefix}${d.id}`}>
              {circle}
            </Link>
          ) : (
            <g key={d.id}>{circle}</g>
          );
        })}
      </svg>

      {hover && (
        <div className="absolute top-3 right-3 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl p-3 max-w-[220px] pointer-events-none">
          <div className="font-bold text-zinc-100">{hover.name}</div>
          <div className="text-xs mt-1 flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded shrink-0"
              style={{ backgroundColor: colorForLevel(hover.level) }}
            />
            <span className="text-zinc-300">
              {hover.level != null ? `Level ${hover.level}/5 — ` : ""}
              {descriptorForLevel(hover.level)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
