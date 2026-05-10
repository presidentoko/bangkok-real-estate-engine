"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type MobileMenuLink = { href: string; label: string };

export function MobileMenu({ links }: { links: MobileMenuLink[] }) {
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

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
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
          {/* Menu sheet */}
          <nav
            className="fixed inset-x-0 top-14 bg-zinc-950 border-b border-zinc-800 z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            role="menu"
          >
            <div className="px-4 py-2 divide-y divide-zinc-900">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block py-3 text-zinc-200 hover:text-white text-base"
                  role="menuitem"
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
