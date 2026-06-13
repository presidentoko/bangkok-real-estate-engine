"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSavedCount } from "@/lib/saved-condos";

export function SavedNavLink({ lang }: { lang: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getSavedCount());
    update();
    window.addEventListener("realdata-saved-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("realdata-saved-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <Link
      href={`/${lang}/saved`}
      className="relative px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
    >
      Saved
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
