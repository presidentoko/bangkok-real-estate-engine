"use client";

import { useState } from "react";

type Props = {
  url: string;   // full canonical URL to share
  title: string; // condo name + region for LINE message text
};

export function LinkShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const lineHref = `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${url}`)}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (non-HTTPS dev env) — silently ignore
    }
  };

  return (
    <div className="flex gap-2">
      <a
        href={lineHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.02 2 11c0 3.19 1.72 6.01 4.37 7.73L5.5 22l4.04-1.98C10.31 20.33 11.14 20.5 12 20.5c5.52 0 10-4.02 10-9s-4.48-9-10-9z"/>
        </svg>
        LINE
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition"
      >
        {copied ? (
          <>✓ Copied</>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
