"use client";

import { usePathname, useRouter } from "next/navigation";
import { LANGS, LANG_LABELS, type Lang } from "@/lib/i18n";

export function LangSwitcher({ current }: { current: Lang }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(lang: Lang) {
    // Replace the first segment (current lang) with the chosen one.
    const parts = pathname.split("/");
    parts[1] = lang;
    document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(parts.join("/") || `/${lang}`);
  }

  return (
    <div className="flex items-center gap-0.5 ml-1 border border-zinc-800 rounded-md text-[11px]">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`px-1.5 py-0.5 rounded transition ${
            l === current
              ? "bg-zinc-100 text-zinc-900 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          aria-current={l === current ? "true" : undefined}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
