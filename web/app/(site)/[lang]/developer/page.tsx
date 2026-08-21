import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { getServerSupabase } from "@/lib/supabase";

// The developer index. Added 2026-08-21 alongside /near for the same
// internal-linking hole /districts fixed on 2026-08-17: sitemap-areas.xml
// publishes a /developer/<slug> URL for every developer_slug in
// condos_published, but the only inbound link to any of them is
// components/DeveloperCard.tsx on individual condo detail pages — which are
// 503'd for most crawlers by the hosting-budget throttle in middleware.ts
// until 2026-09-13, and ~70% noindex besides. Sitemap-only URLs with no
// crawlable path in are orphans; this page is the path.
export const revalidate = 604800;

type DevRow = {
  developer_slug: string | null;
  slug: string | null;
  developer: string | null;
  developer_project_count: number | null;
  developer_unit_count: number | null;
};

export type DeveloperSummary = {
  slug: string;
  name: string;
  /** Buildings we publish a condo page for. */
  listed: number;
  /** Developer's own track record, from compute_developer_stats.py. */
  projects: number | null;
  units: number | null;
};

async function fetchDevelopers(): Promise<DeveloperSummary[]> {
  const supabase = getServerSupabase();

  // Same source, same filter and same pagination as sitemap-areas.xml's
  // devSlugSet loop (PostgREST caps every response at 1000 rows regardless
  // of .limit(), so a single wide select silently truncates) — reusing it
  // keeps the index and the sitemap from ever disagreeing about which
  // developer pages exist.
  const rows: DevRow[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data } = await supabase
      .from("condos_published")
      .select(
        "developer_slug, slug, developer, developer_project_count, developer_unit_count",
      )
      .not("developer_slug", "is", null)
      .order("id")
      .range(offset, offset + page - 1);
    const chunk = (data ?? []) as unknown as DevRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }

  const bySlug = new Map<string, DeveloperSummary>();
  for (const r of rows) {
    if (!r.developer_slug) continue;
    // developer/[slug]/page.tsx drops slugless condos and then notFound()s
    // when nothing is left, because `/condo/<uuid>` is only a meta-refresh
    // hop Google files under "Page with redirect". A developer whose every
    // building is still slugless therefore has a 404, not a profile — so it
    // is counted here but not linked. This is the one place the index is
    // deliberately a subset of the sitemap rather than an exact mirror.
    if (!r.slug) continue;
    const existing = bySlug.get(r.developer_slug);
    if (existing) {
      existing.listed += 1;
      continue;
    }
    bySlug.set(r.developer_slug, {
      slug: r.developer_slug,
      name: r.developer ?? r.developer_slug,
      listed: 1,
      projects: r.developer_project_count ?? null,
      units: r.developer_unit_count ?? null,
    });
  }

  return [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/** A–Z bucket key; anything not starting with a Latin letter lands in "#". */
function letterOf(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

const SEO_TITLE = "Every Thai Condo Developer — Track Records & Projects | RealData";
const SEO_DESC =
  "An A–Z index of every condo developer in Thailand we track, with project count, units built and the buildings we hold price, yield and livability data on. Independent, no developer sponsorships.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: SEO_TITLE,
    description: SEO_DESC,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/developer`,
      languages: langAlternates("/developer"),
    },
    openGraph: ogFor(lang, {
      title: SEO_TITLE,
      description: SEO_DESC,
      url: `${SEO_SITE_URL}/${lang}/developer`,
    }),
  };
}

export default async function DeveloperIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const developers = await fetchDevelopers();

  // Alphabetical sections with a jump nav — hundreds of names in one flat
  // list is not scannable, and a reader arriving here almost always has a
  // specific brand in mind.
  const groups = new Map<string, DeveloperSummary[]>();
  for (const d of developers) {
    const k = letterOf(d.name);
    const list = groups.get(k);
    if (list) list.push(d);
    else groups.set(k, [d]);
  }
  const letters = [...groups.keys()].sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b),
  );

  // The biggest portfolios first, as a shortcut above the A–Z body.
  const topByPortfolio = [...developers].sort((a, b) => b.listed - a.listed).slice(0, 12);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: SEO_TITLE,
    numberOfItems: developers.length,
    itemListElement: developers.slice(0, 100).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: `${SEO_SITE_URL}/${lang}/developer/${d.slug}`,
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "RealData", href: `/${lang}` },
          { name: "Developers", href: `/${lang}/developer` },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Thai condo developers</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Every developer with at least one building in our database. Each profile
          shows that developer&rsquo;s completed projects, average gross yield,
          resident ratings and price history — the track record before you buy off
          plan.
        </p>
        <p className="text-zinc-500 text-xs">
          {developers.length} developers covered
        </p>
      </header>

      {developers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
          <p className="text-zinc-400 text-sm">
            Developer profiles are rebuilding — none are published right now.
          </p>
          <Link
            href={`/${lang}/inventory`}
            className="inline-block text-sm text-blue-400 hover:underline"
          >
            Browse all condos &rarr;
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-100">
              Largest portfolios
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {topByPortfolio.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/${lang}/developer/${d.slug}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 hover:border-zinc-700 hover:bg-zinc-900/60 transition"
                  >
                    <span className="text-zinc-100 text-sm font-medium leading-snug">
                      {d.name}
                    </span>
                    <span className="text-zinc-500 text-xs tabular-nums shrink-0">
                      {d.listed} condos
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <nav
            aria-label="Jump to letter"
            className="flex flex-wrap gap-1.5 border-y border-zinc-900 py-3"
          >
            {letters.map((l) => (
              <a
                key={l}
                href={`#dev-${l === "#" ? "other" : l}`}
                className="px-2 py-1 rounded-md text-xs font-semibold text-zinc-400 bg-zinc-900 hover:bg-zinc-800 hover:text-zinc-100 transition"
              >
                {l}
              </a>
            ))}
          </nav>

          {letters.map((l) => (
            <section
              key={l}
              id={`dev-${l === "#" ? "other" : l}`}
              className="space-y-3 scroll-mt-6"
            >
              <h2 className="text-lg font-semibold text-zinc-100">
                {l}{" "}
                <span className="text-zinc-500 font-normal text-sm tabular-nums">
                  ({groups.get(l)!.length})
                </span>
              </h2>
              <ul className="divide-y divide-zinc-900 rounded-2xl border border-zinc-800 bg-zinc-950">
                {groups.get(l)!.map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/${lang}/developer/${d.slug}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-900/60 transition"
                    >
                      <span className="text-zinc-100 text-sm font-medium leading-snug">
                        {d.name}
                      </span>
                      <span className="text-zinc-500 text-xs tabular-nums">
                        {d.listed} condos
                        {d.projects != null && <> · {d.projects} projects</>}
                        {d.units != null && (
                          <> · {d.units.toLocaleString("en-US")} units</>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <nav
        aria-label="Related indexes"
        className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-900 pt-4"
      >
        <span className="text-zinc-600">Browse another way:</span>
        <Link href={`/${lang}/districts`} className="hover:text-zinc-300 hover:underline">
          By district
        </Link>
        <Link href={`/${lang}/near`} className="hover:text-zinc-300 hover:underline">
          By BTS/MRT station
        </Link>
        <Link href={`/${lang}/inventory`} className="hover:text-zinc-300 hover:underline">
          All condos
        </Link>
      </nav>
    </main>
  );
}
