import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryGrid } from "@/components/InventoryGrid";
import { CITIES } from "@/lib/cities";
import { isLang } from "@/lib/i18n";
import { fetchAllCondos } from "@/lib/queries/condos";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Inventory — RealData" };
  return {
    title: "Thailand Condo Inventory — every building, mapped | RealData",
    description:
      "Every hipflat-tracked condo across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi. Filter by city + district, browse cards, click for the full report.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/inventory`,
      languages: langAlternates("/inventory"),
    },
  };
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();
  const [condos, cityCountsRaw] = await Promise.all([
    fetchAllCondos(),
    // Per-city counts so the header can show the breakdown.
    Promise.all([
      supabase.from("condos_published").select("id", { count: "exact", head: true }).eq("province", "bangkok"),
      ...CITIES.map((c) =>
        supabase.from("condos_published").select("id", { count: "exact", head: true }).eq("province", c.slug)
      ),
    ]),
  ]);
  const bangkokCount = cityCountsRaw[0].count ?? 0;
  const cityChips: Array<{ slug: string; name: string; count: number; href: string }> = [
    { slug: "bangkok", name: "Bangkok", count: bangkokCount, href: `/${lang}` },
    ...CITIES.map((c, i) => ({
      slug: c.slug,
      name: c.name[lang],
      count: cityCountsRaw[i + 1].count ?? 0,
      href: `/${lang}/city/${c.slug}`,
    })),
  ];

  // Distinct districts (collapse canonical/slug variants)
  const labelByNorm = new Map<string, string>();
  for (const c of condos) {
    const r = c.region;
    if (!r) continue;
    const norm = r.toLowerCase().replace(/[\s\-_]+/g, "");
    const existing = labelByNorm.get(norm);
    if (!existing || (/[A-Z]/.test(r) && !/[A-Z]/.test(existing))) {
      labelByNorm.set(norm, r);
    }
  }
  const districts = [...labelByNorm.values()].sort();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <Link
          href={`/${lang}`}
          className="text-zinc-500 hover:text-zinc-300 text-sm inline-block"
        >
          ← back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
          Inventory
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {condos.length.toLocaleString()} hipflat-tracked condo buildings across Thailand
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cityChips.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-full px-3 py-1 text-xs transition"
            >
              <span className="text-zinc-200 font-medium">{c.name}</span>
              <span className="text-zinc-500 tabular-nums">{c.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </header>

      <InventoryGrid
        condos={condos}
        hrefPrefix={`/${lang}/condo/`}
        districts={districts}
      />
    </main>
  );
}
