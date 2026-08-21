"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LANGS, LANG_LABELS, type Lang } from "@/lib/i18n";

function LangSwitcherInner({ current }: { current: Lang }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTo(lang: Lang) {
    // Replace the first segment (current lang) with the chosen one, keeping
    // the query string: usePathname() drops it, so switching language on
    // /en/yields?province=phuket&sort=spread — a URL the app links to itself
    // — used to land on the unfiltered default.
    const parts = pathname.split("/");
    parts[1] = lang;
    const base = parts.join("/") || `/${lang}`;
    const qs = searchParams?.toString() ?? "";
    document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(qs ? `${base}?${qs}` : base);
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center ml-1 border border-zinc-800 rounded-md text-[11px]"
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          // px-1.5 py-0.5 was ~30x18 — well under the 44x44 minimum tap
          // target (WCAG 2.5.5). Same fix as MobileMenu: min-w/min-h plus a
          // centered flex box, which leaves the label's visual size alone.
          className={`min-w-11 min-h-11 px-1.5 flex items-center justify-center rounded transition ${
            l === current
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          aria-pressed={l === current}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

export function LangSwitcher({ current }: { current: Lang }) {
  // useSearchParams() without a Suspense boundary forces every page under the
  // layout that renders this out of static rendering (see the CitySwitcher
  // note in app/(site)/[lang]/layout.tsx). The boundary lives here so callers
  // can't forget it.
  return (
    <Suspense fallback={null}>
      <LangSwitcherInner current={current} />
    </Suspense>
  );
}
