"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CITIES } from "@/lib/cities";
import type { Lang } from "@/lib/i18n";

const BANGKOK = {
  slug: "bangkok",
  name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
} as const;

// Pages that should accept ?city=<slug> instead of switching to /city/<slug>.
// On these pages, switching cities keeps the user on the same page (flood map
// stays a flood map, inventory stays inventory) — only the city scope changes.
const CITY_SCOPED_PAGES = ["flood", "inventory"] as const;

export function CitySwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Which kind of route are we on?
  //   - /[lang]/city/<slug>     → city landing
  //   - /[lang]/flood           → scoped page (uses ?city=)
  //   - /[lang]/inventory       → scoped page (uses ?city=)
  //   - everything else         → assume Bangkok
  const cityMatch = pathname.match(/^\/[a-z]{2}\/city\/([a-z]+)/i);
  const scopedMatch = pathname.match(/^\/[a-z]{2}\/(flood|inventory)\b/i);
  const scopedPage = scopedMatch?.[1] as (typeof CITY_SCOPED_PAGES)[number] | undefined;

  const currentSlug = cityMatch?.[1]
    ?? (scopedPage ? searchParams?.get("city") ?? "bangkok" : "bangkok");
  const current =
    currentSlug === "bangkok"
      ? BANGKOK
      : CITIES.find((c) => c.slug === currentSlug) ?? BANGKOK;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function hrefFor(slug: string): string {
    if (scopedPage) {
      // Stay on flood/inventory; just swap the ?city= scope.
      return slug === "bangkok"
        ? `/${lang}/${scopedPage}`
        : `/${lang}/${scopedPage}?city=${slug}`;
    }
    return slug === "bangkok" ? `/${lang}` : `/${lang}/city/${slug}`;
  }

  const cities: Array<{ slug: string; name: { en: string; ko: string; th: string }; href: string }> = [
    { slug: BANGKOK.slug, name: BANGKOK.name, href: hrefFor("bangkok") },
    ...CITIES.filter((c) => c.slug !== "bangkok").map((c) => ({
      slug: c.slug,
      name: c.name,
      href: hrefFor(c.slug),
    })),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs font-medium px-1.5 py-0.5 rounded hover:bg-zinc-900 transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{current.name[lang]}</span>
        <span className={`text-[9px] transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 min-w-[150px] bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl shadow-black/40 overflow-hidden z-50"
        >
          {cities.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className={`block px-3 py-2 text-sm hover:bg-zinc-900 transition ${
                c.slug === currentSlug
                  ? "text-blue-300 font-semibold"
                  : "text-zinc-300"
              }`}
              role="menuitem"
            >
              {c.name[lang]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
