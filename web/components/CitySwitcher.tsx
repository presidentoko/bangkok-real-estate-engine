"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CITIES } from "@/lib/cities";
import type { Lang } from "@/lib/i18n";

const BANGKOK = {
  slug: "bangkok",
  name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
} as const;

export function CitySwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Detect current city from pathname. /[lang]/city/{slug} → that slug;
  // anything else under /[lang] → Bangkok (the default market).
  const cityMatch = pathname.match(/^\/[a-z]{2}\/city\/([a-z]+)/i);
  const currentSlug = cityMatch?.[1] ?? "bangkok";
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

  const cities: Array<{ slug: string; name: { en: string; ko: string; th: string }; href: string }> = [
    { slug: BANGKOK.slug, name: BANGKOK.name, href: `/${lang}` },
    ...CITIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      href: `/${lang}/city/${c.slug}`,
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
