"use client";

import { useState } from "react";

/** Copy-to-clipboard for the outreach queue: the person working it pastes
 *  the draft into a forum, so the whole flow hangs on one reliable button. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
    >
      {done ? "Copied" : label}
    </button>
  );
}
