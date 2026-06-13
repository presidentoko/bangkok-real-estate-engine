"use client";

import { useEffect, useState } from "react";
import { toggleSaved, isSaved } from "@/lib/saved-condos";

type Props = {
  id: string;
  name: string;
};

export function SaveButton({ id, name }: Props) {
  const [saved, setSaved] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    setSaved(isSaved(id));
  }, [id]);

  const onClick = () => {
    const next = toggleSaved(id);
    setSaved(next.includes(id));
    // Dispatch storage event so other tabs / the SavedCount badge update.
    window.dispatchEvent(new Event("realdata-saved-change"));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={saved ? `Remove ${name} from saved` : `Save ${name}`}
      aria-label={saved ? "Remove from saved" : "Save condo"}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl font-semibold text-sm transition border ${
        saved
          ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
