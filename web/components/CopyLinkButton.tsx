"use client";

import { useState } from "react";

type Props = { label?: string };

export function CopyLinkButton({ label = "Copy comparison link" }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    let success = false;
    try {
      await navigator.clipboard.writeText(window.location.href);
      success = true;
    } catch {
      try {
        const el = document.createElement("input");
        el.value = window.location.href;
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
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition"
    >
      {copied ? (
        "✓ Copied!"
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
