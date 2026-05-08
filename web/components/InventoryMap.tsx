"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];
const GEOJSON_URL = "/bangkok-districts.geojson";

export type KhetCount = { name: string; count: number };
export type CondoPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  url?: string | null;
};

// Bridge OSM canonical names ("Huai Khwang") with hipflat-derived slugs
// ("huai-khwang") so the same khet doesn't end up as two map regions.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

export function InventoryMap({
  khetCounts,
  points = [],
  totalBuildings,
  condoLinkPrefix = "/condo/",
}: {
  khetCounts: KhetCount[];
  points?: CondoPoint[];
  totalBuildings?: number;
  condoLinkPrefix?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ name: string; count: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const countByNorm = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of khetCounts) {
      const key = normalize(k.name);
      m.set(key, (m.get(key) ?? 0) + k.count);
    }
    return m;
  }, [khetCounts]);

  // GeoJSON for the point overlay — recomputed only when `points` changes.
  const pointsGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          properties: { id: p.id, name: p.name, url: p.url ?? "" },
        })),
    }),
    [points]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: BANGKOK_CENTER,
      zoom: 10,
      attributionControl: { compact: true },
    });

    map.on("load", async () => {
      try {
        const res = await fetch(GEOJSON_URL);
        if (!res.ok) {
          throw new Error(
            `district geojson not found (${res.status}). Run: python scripts/fetch_district_geojson.py`
          );
        }
        const geojson = await res.json();

        for (const f of geojson.features ?? []) {
          const name = f.properties?.name ?? "";
          const c = countByNorm.get(normalize(String(name))) ?? 0;
          f.properties = { ...(f.properties ?? {}), building_count: c };
        }

        map.addSource("districts", { type: "geojson", data: geojson });

        map.addLayer({
          id: "districts-fill",
          type: "fill",
          source: "districts",
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "building_count"],
              0, "#1f2937",
              1, "#1e3a5f",
              5, "#1d4ed8",
              20, "#3b82f6",
              50, "#60a5fa",
              80, "#bfdbfe",
            ],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.95,
              0.72,
            ],
          },
        });

        map.addLayer({
          id: "districts-outline",
          type: "line",
          source: "districts",
          paint: { "line-color": "#0a0a0a", "line-width": 1 },
        });

        // Building points (Phase 2 enrichment). Drawn ABOVE choropleth so they
        // are visible against the district fill. Empty source if no points yet
        // — the map still renders the choropleth.
        map.addSource("buildings", { type: "geojson", data: pointsGeoJson });

        map.addLayer({
          id: "buildings-points",
          type: "circle",
          source: "buildings",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9, 1.5,
              13, 3,
              16, 6,
            ],
            "circle-color": "#fbbf24",
            "circle-opacity": 0.85,
            "circle-stroke-width": 0.5,
            "circle-stroke-color": "#78350f",
          },
        });

        // Click → navigate to the RealData condo report. The hipflat source
        // link lives at the bottom of that page for users who want it.
        map.on("click", "buildings-points", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const id = String(f.properties?.id ?? "");
          if (id) window.location.href = `${condoLinkPrefix}${id}`;
        });
        map.on("mouseenter", "buildings-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "buildings-points", () => {
          map.getCanvas().style.cursor = "";
        });

        let hoverId: number | string | null = null;
        const onMove = (e: MapMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["districts-fill"],
          });
          if (features.length === 0) {
            if (hoverId != null) {
              map.setFeatureState(
                { source: "districts", id: hoverId },
                { hover: false }
              );
              hoverId = null;
            }
            setHover(null);
            map.getCanvas().style.cursor = "";
            return;
          }
          const f = features[0];
          if (f.id != null && f.id !== hoverId) {
            if (hoverId != null) {
              map.setFeatureState(
                { source: "districts", id: hoverId },
                { hover: false }
              );
            }
            hoverId = f.id;
            map.setFeatureState(
              { source: "districts", id: hoverId },
              { hover: true }
            );
          }
          const props = f.properties ?? {};
          setHover({
            name: String(props.name ?? "?"),
            count: Number(props.building_count ?? 0),
          });
          map.getCanvas().style.cursor = "pointer";
        };
        map.on("mousemove", "districts-fill", onMove);
        map.on("mouseleave", "districts-fill", () => {
          if (hoverId != null) {
            map.setFeatureState(
              { source: "districts", id: hoverId },
              { hover: false }
            );
            hoverId = null;
          }
          setHover(null);
          map.getCanvas().style.cursor = "";
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      map.remove();
    };
  }, [countByNorm, pointsGeoJson, condoLinkPrefix]);

  return (
    <div className="relative w-full h-[70vh] min-h-[480px] rounded-2xl overflow-hidden border border-zinc-800">
      <div ref={containerRef} className="absolute inset-0" />

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

      {error && (
        <div className="absolute inset-x-3 top-3 bg-red-950/90 border border-red-800 text-red-200 text-sm rounded-xl p-3">
          {error}
        </div>
      )}
    </div>
  );
}
