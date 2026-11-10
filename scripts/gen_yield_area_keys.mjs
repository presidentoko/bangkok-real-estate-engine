// Regenerate web/public/u/yield-areas.json -- which /yield/<city>/<district>
// pages currently qualify (enough measured buildings, lib/yieldAreas.ts
// MIN_AREA_CONDOS).
//
// Why: a district whose measured-building count drops below the minimum
// stops being an area page (2026-11-10: Lat Phrao fell from 8 to 7 after the
// polygon district repair). The page route is ISR, and an ISR page cannot
// send a real 3xx (see web/middleware.ts on legacy uuid URLs), so the 301 to
// the city page is issued by middleware, which reads this file from the
// repo's `main` branch on raw.githubusercontent.com -- the same pattern as
// the uuid map in this directory. It lives in public/u so that a commit
// touching only this file skips the Vercel build, like the uuid shards.
//
// Uses buildYieldAreaIndex() itself, not a copy of its rules, so the list
// is exactly the set of districts the pages and sitemap-areas.xml publish.
//
//     node scripts/gen_yield_area_keys.mjs            (Node >= 23)
//     node scripts/gen_yield_area_keys.mjs --check    exit 1 if stale
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildYieldAreaIndex, MIN_AREA_CONDOS } from "../web/lib/yieldAreas.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web", "public", "u", "yield-areas.json");

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const base = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!base || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set");
  process.exit(2);
}

// Same eligibility filter as web/lib/queries/yieldAreas.ts, but only the
// columns the index needs (~90KB for ~1,100 rows).
const params = new URLSearchParams({
  select: "id,province,gross_yield_pct,avg_sale_price,regions(name)",
  gross_yield_pct: "gt.0",
  avg_sale_price: "gte.500000",
  yield_sample_sale: "gte.2",
  yield_sample_rent: "gte.2",
  is_active: "eq.true",
  published: "eq.true",
  slug: "not.is.null",
  order: "id",
});
params.append("gross_yield_pct", "lte.25");

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${base}/rest/v1/condos?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) {
    console.error(`supabase ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const page = await res.json();
  for (const r of page) {
    const rg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
    rows.push({
      id: r.id, slug: "x", name: "", province: r.province, region: rg?.name ?? null,
      gross_yield_pct: Number(r.gross_yield_pct), avg_sale_price: r.avg_sale_price, avg_monthly_rent: null,
    });
  }
  if (page.length < 1000) break;
}

const index = buildYieldAreaIndex(rows);
const cities = Object.fromEntries(
  index.cities
    .map((c) => [c.city, c.districts.map((d) => d.district).sort()])
    .sort(([a], [b]) => a.localeCompare(b)),
);
const body = JSON.stringify({ minCondos: MIN_AREA_CONDOS, cities }, null, 1) + "\n";

if (process.argv.includes("--check")) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (cur !== body) {
    console.error(`${OUT} is stale`);
    process.exit(1);
  }
  console.log("up to date");
} else {
  fs.writeFileSync(OUT, body);
  const n = Object.values(cities).reduce((s, d) => s + d.length, 0);
  console.log(`wrote ${OUT}: ${Object.keys(cities).length} cities, ${n} districts from ${rows.length} rows`);
}
