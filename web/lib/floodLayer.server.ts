/** Server-side access to the Bangkok district flood layer
 *  (public/bangkok-districts.geojson): the polygons /flood draws, and which
 *  khet a building's coordinates fall in.
 *
 *  Why this exists (2026-11-10): /flood used to fetch its own geojson over
 *  HTTP from SEO_SITE_URL at render time, with `.catch(() => ({features:
 *  []}))`. In production that request came back without features, the error
 *  was swallowed, and the page published "0 buildings in Level 4-5", empty
 *  level bars, no district polygons on the map and "1,296 buildings
 *  excluded" -- for a page whose whole point is those numbers. Reading the
 *  file from disk removes the network hop (and the self-request through
 *  Cloudflare), and a malformed layer now throws, which fails the build or
 *  keeps the last good ISR page instead of publishing zeros.
 *
 *  Why point-in-polygon rather than regions.name: the region attached to a
 *  hipflat condo disagrees with the polygon its own coordinates fall in for
 *  ~25% of Bangkok buildings (e.g. "Lumpini Place Taopoon Interchange" in
 *  Bang Sue is filed under pathum-wan). The polygon a dot is drawn inside is
 *  the district it is coloured as, and it agrees with the address-derived
 *  risk_factors level on the building report card for ~96% of buildings,
 *  against ~83% for regions.name. regions.name stays as the fallback for a
 *  building with no coordinates or one that falls outside every polygon. */
import fs from "node:fs";
import path from "node:path";
import { findFloodDistrict, type FloodDistrict } from "./floodDistricts.ts";

/** Date the flood levels in the layer were last revised -- the git date of
 *  the last change to `flood_risk_level` in public/bangkok-districts.geojson
 *  (and src/data/flood_districts.py, which carries the same levels). Bump it
 *  whenever the layer is re-scored; the page prints it as "levels last
 *  revised", so it must not be the build date. */
export const FLOOD_LAYER_REVISED = "2026-05-08";

type Ring = number[][];
type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type FloodLayerFeature = {
  type: "Feature";
  properties: { name?: string; name_th?: string; flood_risk_level?: number | null };
  geometry: Geometry;
};

type Indexed = {
  district: FloodDistrict;
  polygons: Ring[][];
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
};

export type FloodLayer = {
  features: FloodLayerFeature[];
  /** The khet whose polygon contains (lat, lng), or null if none does. */
  locate: (lat: number, lng: number) => FloodDistrict | null;
};

let cached: FloodLayer | null = null;

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(x, y, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) if (inRing(x, y, rings[h])) return false;
  return true;
}

export function loadFloodLayer(): FloodLayer {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "bangkok-districts.geojson");
  const geo = JSON.parse(fs.readFileSync(file, "utf8")) as { features?: FloodLayerFeature[] };
  const features = geo.features ?? [];

  const indexed: Indexed[] = [];
  for (const f of features) {
    const name = f.properties?.name ?? "";
    const district = findFloodDistrict(name);
    // The layer and FLOOD_DISTRICTS are generated from each other
    // (scripts/gen_flood_districts.py); a name or level that does not line
    // up means one was edited without the other, and every count on /flood
    // would be wrong. Refuse to render rather than publish it.
    if (!district) throw new Error(`flood layer: "${name}" is not in FLOOD_DISTRICTS`);
    if (f.properties?.flood_risk_level !== district.level) {
      throw new Error(
        `flood layer: ${name} is L${f.properties?.flood_risk_level} in the geojson but L${district.level} in FLOOD_DISTRICTS`,
      );
    }
    const polygons =
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polygons)
      for (const [x, y] of poly[0] ?? []) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    indexed.push({ district, polygons, bbox: [minX, minY, maxX, maxY] });
  }
  if (indexed.length !== 50) {
    throw new Error(`flood layer: expected 50 Bangkok khet, read ${indexed.length} from ${file}`);
  }

  const locate = (lat: number, lng: number): FloodDistrict | null => {
    for (const d of indexed) {
      const [minX, minY, maxX, maxY] = d.bbox;
      if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
      for (const poly of d.polygons) if (inPolygon(lng, lat, poly)) return d.district;
    }
    return null;
  };

  cached = { features, locate };
  return cached;
}
