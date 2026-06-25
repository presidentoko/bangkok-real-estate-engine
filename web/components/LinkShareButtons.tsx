"use client";

import { useEffect, useState } from "react";

type Props = {
  url: string;
  title: string;
};

export function LinkShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const lineHref = `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${url}`)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;

  const onNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // cancelled or unsupported — no-op
    }
  };

  const onCopy = async () => {
    let success = false;
    try {
      await navigator.clipboard.writeText(url);
      success = true;
    } catch {
      try {
        const el = document.createElement("input");
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        success = true;
      } catch {
        // truly unavailable
      }
    }
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex gap-2">
      {/* LINE — primary share channel in Thailand */}
      <a
        href={lineHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share on LINE: ${title}`}
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.02 2 11c0 3.19 1.72 6.01 4.37 7.73L5.5 22l4.04-1.98C10.31 20.33 11.14 20.5 12 20.5c5.52 0 10-4.02 10-9s-4.48-9-10-9z"/>
        </svg>
        LINE
      </a>

      {/* WhatsApp — expat / international buyers */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share on WhatsApp: ${title}`}
        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebe59] text-white font-semibold text-sm transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.52 3.48A11.93 11.93 0 0012.02 0C5.41 0 .04 5.37.04 12a11.94 11.94 0 001.6 6L0 24l6.24-1.63A11.95 11.95 0 0012.02 24c6.6 0 11.98-5.37 11.98-12 0-3.2-1.24-6.2-3.48-8.52zM12.02 22c-1.77 0-3.5-.47-5.02-1.36l-.36-.21-3.7.97.99-3.62-.24-.37A9.95 9.95 0 012.04 12c0-5.51 4.48-9.99 9.99-9.99 2.67 0 5.18 1.04 7.07 2.93A9.94 9.94 0 0122.01 12c0 5.51-4.48 9.99-9.99 9.99zm5.48-7.48c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.47-2.4-1.49-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17 0-.37-.02-.57-.02s-.52.07-.8.37C8.4 8.3 7.7 9 7.7 10.47s1.02 2.97 1.16 3.17c.15.2 2.01 3.07 4.87 4.3.68.3 1.21.47 1.62.6.68.22 1.3.19 1.79.12.55-.08 1.68-.69 1.92-1.35.24-.66.24-1.23.17-1.35-.07-.12-.27-.19-.57-.34z"/>
        </svg>
        WA
      </a>

      {/* Native share (mobile) or copy link (desktop) */}
      {canNativeShare ? (
        <button
          type="button"
          onClick={onNativeShare}
          aria-label="Share this page"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
      ) : (
        <button
          type="button"
          onClick={onCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition"
        >
          {copied ? (
            <>✓ Copied</>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>
      )}
    </div>
  );
}
