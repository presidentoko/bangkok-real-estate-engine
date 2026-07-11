"use client";

// Client half of the /flood page. The server component renders Bangkok's
// full flood map statically (no searchParams read) — Bangkok is the only
// city with a district-level flood model, so every other ?city= value only
// ever showed a static "coming soon" message with NO per-city data fetch
// actually rendered (the original page fetched condos for every city but
// discarded the result unless isBangkok). That means the non-Bangkok branch
// needs zero data — this component just toggles visibility client-side after
// reading ?city= on mount, no new API route required.
//
// City chips (and the "view Bangkok map" link) are plain <a> links (full
// navigation) so a click always lands on the static shell and re-runs the
// mount effect; rel="nofollow" keeps crawlers from treating the ~9 city
// permutations as canonical content.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CITIES, getCity } from "@/lib/cities";

const BANGKOK_NAME: Record<string, string> = {
  en: "Bangkok",
  ko: "방콕",
  th: "กรุงเทพ",
};

type CityInfo = { slug: string; name: string };

function resolveCity(slug: string | undefined | null, lang: string): CityInfo {
  if (!slug || slug === "bangkok") {
    return { slug: "bangkok", name: BANGKOK_NAME[lang] ?? "Bangkok" };
  }
  const city = getCity(slug);
  if (!city) return { slug: "bangkok", name: BANGKOK_NAME[lang] ?? "Bangkok" };
  return { slug: city.slug, name: (city.name as Record<string, string>)[lang] ?? city.name.en };
}

export function FloodCityGate({
  lang,
  lead,
  bangkokTitle,
  children,
}: {
  lang: string;
  lead: string;
  bangkokTitle: string;
  children: React.ReactNode;
}) {
  const [city, setCity] = useState<CityInfo>({
    slug: "bangkok",
    name: BANGKOK_NAME[lang] ?? "Bangkok",
  });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setCity(resolveCity(sp.get("city"), lang));
  }, [lang]);

  const isBangkok = city.slug === "bangkok";

  const cityChips: Array<{ slug: string; name: string; href: string }> = [
    { slug: "bangkok", name: BANGKOK_NAME[lang] ?? "Bangkok", href: `/${lang}/flood` },
    ...CITIES.map((c) => ({
      slug: c.slug,
      name: (c.name as Record<string, string>)[lang] ?? c.name.en,
      href: `/${lang}/flood?city=${c.slug}`,
    })),
  ];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          🌊 {city.name}{" "}
          <span className="text-zinc-500 font-semibold">
            {isBangkok ? bangkokTitle : "flood risk"}
          </span>
        </h1>
        <p className="text-zinc-400 text-sm max-w-2xl">{lead}</p>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {cityChips.map((c) => {
            const active = c.slug === city.slug;
            return (
              <a
                key={c.slug}
                href={c.href}
                rel="nofollow"
                className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${
                  active
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {c.name}
              </a>
            );
          })}
        </div>
      </header>

      {isBangkok ? (
        children
      ) : (
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 max-w-2xl">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">
            Flood risk for {city.name} is coming soon
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We currently map district-level monsoon flood risk for <strong>Bangkok only</strong>.
            BMA (Bangkok Metropolitan Administration) is the only authority publishing
            per-district flood records granular enough to score individual buildings — we’re
            researching equivalent sources for {city.name}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <a
              href={`/${lang}/flood`}
              rel="nofollow"
              className="px-3 py-1.5 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400 transition"
            >
              View Bangkok flood map
            </a>
            <Link
              href={`/${lang}/inventory?city=${city.slug}`}
              className="px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition"
            >
              Browse {city.name} inventory
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
