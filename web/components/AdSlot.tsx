"use client";

import { useEffect, useRef } from "react";

import { ADSENSE_CLIENT, AD_SLOTS, adsEnabled, type AdSlotName } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// A display-ad slot that reserves its height before anything loads.
//
// The reservation is the whole point. AdSense injects an iframe whose height
// is not known until it fills, and an unreserved slot shoves every section
// below it down the page at exactly the moment a reader starts reading —
// which is a Cumulative Layout Shift hit, and CLS feeds Core Web Vitals,
// which feeds ranking, which feeds the traffic the ads are supposed to
// monetise. So the container owns a fixed min-height in every state: before
// fill, after fill, on an unfilled impression, and when ads are switched off
// entirely.
//
// `label` renders above the unit. Google requires paid placements to be
// distinguishable from content, and on a site whose entire pitch is "nobody
// can buy a number" the distinction is worth making loudly rather than
// minimally.
export function AdSlot({
  name,
  className = "",
  minHeight = 280,
}: {
  name: AdSlotName;
  className?: string;
  /** Reserved height in px. Match this to the unit's real rendered height. */
  minHeight?: number;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const slot = AD_SLOTS[name];
  const enabled = adsEnabled() && slot !== "";

  useEffect(() => {
    if (!enabled || pushed.current || !ref.current) return;
    // React 18/19 StrictMode double-invokes effects in development, and
    // pushing the same <ins> twice makes AdSense throw
    // "adsbygoogle.push() error: All ins elements already have ads".
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // A blocked or failed loader must never take the page down with it.
    }
  }, [enabled]);

  if (!adsEnabled()) return null;

  return (
    <aside
      className={`my-6 ${className}`}
      style={{ minHeight }}
      aria-label="Advertisement"
    >
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
        Advertisement
      </div>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block", minHeight: minHeight - 22 }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
