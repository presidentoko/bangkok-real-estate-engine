"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colorForLevel, descriptorForLevel } from "@/lib/floodColors";

const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];
const GEOJSON_URL = "/bangkok-districts.geojson";

type DistrictHover = {
  name: string;
  level: number | null;
  descriptor: string;
};

export type FloodPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  level: number | null;
  url?: string | null;
};

export function FloodMap({
  points = [],
  condoLinkPrefix = "/condo/",
}: {
  points?: FloodPoint[];
  condoLinkPrefix?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<DistrictHover | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pointsGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          properties: {
            id: p.id,
            name: p.name,
            level: p.level,
            url: p.url ?? "",
          },
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

    map.on("error", (e) => {
      const msg = e.error?.message || String(e.error) || "unknown map error";
      setError(msg);
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

        // Promote a stable feature id so setFeatureState's hover highlight
        // sticks per-district. Without this maplibre rejects the call silently.
        let nextId = 1;
        for (const f of geojson.features ?? []) {
          if (f.id == null) f.id = nextId++;
        }

        map.addSource("districts", { type: "geojson", data: geojson });

        map.addLayer({
          id: "districts-fill",
          type: "fill",
          source: "districts",
          paint: {
            "fill-color": [
              "match",
              ["get", "flood_risk_level"],
              5, "#dc2626",
              4, "#fb923c",
              3, "#facc15",
              2, "#84cc16",
              1, "#10b981",
              0, "#1f2937",
              "#3f3f46",
            ],
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.85,
              0.6,
            ],
          },
        });

        map.addLayer({
          id: "districts-outline",
          type: "line",
          source: "districts",
          paint: { "line-color": "#18181b", "line-width": 1 },
        });

        // Building points coloured by their host district's flood level.
        // White ring for visibility against any underlying choropleth colour.
        map.addSource("buildings", { type: "geojson", data: pointsGeoJson });
        map.addLayer({
          id: "buildings-points",
          type: "circle",
          source: "buildings",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              9, 1.5, 13, 3, 16, 6,
            ],
            "circle-color": [
              "match",
              ["get", "level"],
              5, "#dc2626",
              4, "#fb923c",
              3, "#facc15",
              2, "#84cc16",
              1, "#10b981",
              "#a1a1aa",
            ],
            "circle-stroke-width": 0.7,
            "circle-stroke-color": "#fafafa",
            "circle-opacity": 0.95,
          },
        });

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
          const level =
            typeof props.flood_risk_level === "number"
              ? props.flood_risk_level
              : null;
          setHover({
            name: String(props.name ?? "?"),
            level,
            descriptor: descriptorForLevel(level),
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

        // Defensive resize on the next frame — covers the case where the
        // container's final size is computed after maplibre's initial layout.
        requestAnimationFrame(() => map.resize());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      map.remove();
    };
  }, [pointsGeoJson, condoLinkPrefix]);

  return (
    <div className="relative w-full h-[70vh] min-h-[480px] rounded-2xl overflow-hidden border border-zinc-800">
      <div ref={containerRef} className="absolute inset-0" />

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
              {hover.descriptor}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-3 bg-red-950/90 border border-red-800 text-red-200 text-sm rounded-xl p-3">
          {error}
        </div>
      )}
    </div>
  );
}
