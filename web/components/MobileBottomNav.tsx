"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSavedCount } from "@/lib/saved-condos";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}

// active param unused — search icon is the same either way
function SearchIcon(_: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  );
}

function TrendIcon(_: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  );
}

export function MobileBottomNav({ lang }: { lang: string }) {
  const pathname = usePathname();
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const update = () => setSavedCount(getSavedCount());
    update();
    window.addEventListener("realdata-saved-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("realdata-saved-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const isActive = (href: string) => {
    if (href === `/${lang}`) return pathname === `/${lang}`;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const nav = [
    { href: `/${lang}`,           label: "Home",     Icon: HomeIcon },
    { href: `/${lang}/inventory`, label: "Search",   Icon: SearchIcon },
    { href: `/${lang}/ask`,       label: "Ask AI",   Icon: ChatIcon },
    { href: `/${lang}/saved`,     label: "Saved",    Icon: HeartIcon, badge: savedCount },
    { href: `/${lang}/yields`,    label: "Yields",   Icon: TrendIcon },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950 border-t border-zinc-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile navigation"
    >
      <div className="flex h-14">
        {nav.map(({ href, label, Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active ? "text-blue-400" : "text-zinc-500 active:text-zinc-200"
              }`}
            >
              <Icon active={active} />
              <span className="text-[10px] font-medium">{label}</span>
              {badge != null && badge > 0 && (
                <span
                  aria-label={`${badge} saved`}
                  className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
