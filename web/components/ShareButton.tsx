"use client";

import { useState, type RefObject } from "react";

type Props = {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
  /** Pin the target to this pixel width (and optional min-height) for the
   *  duration of the capture only. The shared PNG has to be a fixed,
   *  deterministic size — an Instagram card that reflows with the phone's
   *  viewport is useless — but the on-screen element must stay fluid or it
   *  forces a sideways scroll on a 360px phone. Applying the fixed size
   *  here, inline, for the ~1s the export runs gives both. */
  captureWidth?: number;
  captureMinHeight?: number;
};

export function ShareButton({
  targetRef,
  filename,
  captureWidth,
  captureMinHeight,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onShare = async () => {
    const el = targetRef.current;
    if (!el) return;
    setBusy(true);
    setErr(null);

    // Save whatever inline sizing the element had so the restore below is a
    // true no-op when captureWidth isn't passed.
    const prev = {
      width: el.style.width,
      minWidth: el.style.minWidth,
      maxWidth: el.style.maxWidth,
      minHeight: el.style.minHeight,
    };
    if (captureWidth != null) {
      const px = `${captureWidth}px`;
      // All three, because the element's own classes may set max-width /
      // w-full, which would otherwise win over a bare `width`.
      el.style.width = px;
      el.style.minWidth = px;
      el.style.maxWidth = px;
      if (captureMinHeight != null) el.style.minHeight = `${captureMinHeight}px`;
      // Force a synchronous reflow so html-to-image measures the pinned box
      // (it reads offsetWidth/offsetHeight off the live node) rather than the
      // pre-resize one, which would clip the export.
      void el.offsetHeight;
    }

    try {
      // Lazy-load html-to-image (~70 KB) only when the user actually clicks.
      const { toPng } = await import("html-to-image");
      let dataUrl: string;
      try {
        dataUrl = await toPng(el, {
          pixelRatio: 3,           // ~1080+ for typical card size
          cacheBust: true,
          backgroundColor: "#09090b",
        });
      } finally {
        // Restore as soon as the pixels are taken — the share sheet below can
        // stay open for many seconds and the card must not sit pinned wide
        // (and sideways-scrolling) behind it.
        el.style.width = prev.width;
        el.style.minWidth = prev.minWidth;
        el.style.maxWidth = prev.maxWidth;
        el.style.minHeight = prev.minHeight;
      }
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
