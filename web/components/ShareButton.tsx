"use client";

import { useState, type RefObject } from "react";

type Props = {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
};

export function ShareButton({ targetRef, filename }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onShare = async () => {
    if (!targetRef.current) return;
    setBusy(true);
    setErr(null);
    try {
      // Lazy-load html-to-image (~70 KB) only when the user actually clicks.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(targetRef.current, {
        pixelRatio: 3,           // ~1080+ for typical card size
        cacheBust: true,
        backgroundColor: "#09090b",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };

      // Mobile: native share sheet (user picks Instagram → Story / Feed)
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Bangkok Condo Report Card",
          text: "Data-verified by RealData",
        });
      } else {
        // Desktop fallback: download PNG
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.click();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "share failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        className="w-full py-3 rounded-2xl bg-pink-500 hover:bg-pink-400 disabled:opacity-50 font-semibold text-white transition"
      >
        {busy ? "Generating image…" : "📸 Share to Instagram"}
      </button>
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <div className="text-xs text-zinc-500 text-center">
        Mobile: opens share sheet (pick Instagram). Desktop: downloads PNG.
      </div>
    </div>
  );
}
