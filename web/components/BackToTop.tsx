"use client";

import { useEffect, useState } from "react";
import { getQueue } from "@/lib/compare-queue";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // CompareTray is a full-width fixed bar at z-50; this button sat inside its
  // band at z-30, so once a compare queue existed the button was there but
  // unclickable. Track the same queue and step clear of the bar instead of
  // stacking on top of it (which would cover the tray's own buttons).
  useEffect(() => {
    const update = () => setTrayOpen(getQueue().length > 0);
    update();
    window.addEventListener("realdata-compare-change", update);
    return () => window.removeEventListener("realdata-compare-change", update);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      // On mobile: sits above the bottom nav bar (h-14 = 56px), and above the
      // compare tray on top of that when one is open.
      className={`fixed right-4 z-30 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white flex items-center justify-center shadow-lg transition-all ${
        trayOpen ? "bottom-[140px] sm:bottom-[80px]" : "bottom-[76px] sm:bottom-6"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  );
}
