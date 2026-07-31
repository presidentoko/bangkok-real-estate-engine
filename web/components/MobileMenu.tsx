"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CondoSearch } from "@/components/CondoSearch";

export type MobileMenuLink = { href: string; label: string };

export function MobileMenu({
  links,
  lang,
}: {
  links: MobileMenuLink[];
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open so the menu feels modal.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes — the backdrop click was the only way to dismiss without a
  // mouse, which keyboard users don't have.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        // p-2 + 20px icon was 36x36 — below the 44x44 minimum recommended
        // tap target (WCAG 2.5.5); min-w/min-h + centered flex gets there
        // without changing the icon's visual size.
        className="min-w-11 min-h-11 flex items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6L18 18M6 18L18 6" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-14 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
          />
          {/* Menu sheet — role="navigation", not "menu": this is a plain
              link list with no arrow-key roving-tabindex behavior, so the
              menu/menuitem ARIA pattern (which implies that behavior to
              screen readers) was a mismatch. */}
          <nav
            className="fixed inset-x-0 top-14 bg-zinc-950 border-b border-zinc-800 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            aria-label="Mobile navigation"
          >
            <div className="px-4 pt-3 pb-2">
              <CondoSearch lang={lang} />
            </div>
            <div className="px-4 py-2 divide-y divide-zinc-900 border-t border-zinc-900">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block py-3 text-zinc-200 hover:text-white text-base"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
