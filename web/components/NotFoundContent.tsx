"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, DEFAULT_LANG } from "@/lib/i18n";

// not-found.tsx (root or nested) never receives route params in the App
// Router, so this reads the current /<lang>/... prefix straight off the
// pathname instead — the only way to localize a not-found boundary without
// a params prop. Falls back to DEFAULT_LANG for paths with no lang prefix
// at all (e.g. a raw /admin/* 404).
export function NotFoundContent() {
  const pathname = usePathname();
  const seg = pathname?.split("/")[1];
  const lang = isLang(seg) ? seg : DEFAULT_LANG;
  const t = getDictionary(lang).notFound;

  return (
    <main className="max-w-xl mx-auto p-6 mt-16 text-center space-y-5">
      <p className="text-6xl">🏚️</p>
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-zinc-400 text-sm">{t.body}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm pt-2">
        <Link href={`/${lang}`} className="px-4 py-2 rounded-full bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition">
          ← {t.home}
        </Link>
        <Link href={`/${lang}/yields`} className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          {t.yields}
        </Link>
        <Link href={`/${lang}/ask`} className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          {t.ask}
        </Link>
        <Link href={`/${lang}/inventory`} className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          {t.inventory}
        </Link>
      </div>
    </main>
  );
}
