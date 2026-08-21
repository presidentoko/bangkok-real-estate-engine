import Link from "next/link";
import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";

// Chrome for the public pages of the (other) route group. Deliberately
// lighter than (site)/[lang]/layout.tsx: no dictionary, no search, no
// switchers, no analytics beacon — this group is English-only by design and
// nothing here may pull in the i18n machinery.

// The (other) group has no [lang] route param, so the `lang` cookie is the
// only locale signal a visitor arriving from a /ko or /th footer carries.
// middleware.ts sets it on every localized request and
// components/LangSwitcher.tsx rewrites it client-side; absent or unknown
// values fall back to EN. Reading it opts the calling route out of static
// rendering — see app/(other)/alerts/page.tsx for how the DB read is kept
// cached anyway.
export async function getOtherLang(): Promise<Lang> {
  const value = (await cookies()).get("lang")?.value;
  return value && isLang(value) ? value : DEFAULT_LANG;
}

export async function OtherShell({ children }: { children: React.ReactNode }) {
  const lang = await getOtherLang();

  return (
    <>
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <nav className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href={`/${lang}`} className="font-black text-lg tracking-tight">
            <span className="text-blue-400">Real</span>Data
          </Link>
          <div className="flex items-center gap-1 sm:gap-3 text-sm">
            <Link
              href="/alerts"
              className="px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              Alerts
            </Link>
            <Link
              href={`/${lang}/inventory`}
              className="px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              Inventory
            </Link>
            <Link
              href={`/${lang}/yields`}
              className="hidden sm:block px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              Yields
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-12 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-sm">
          <div className="font-black tracking-tight mb-3">
            <span className="text-blue-400">Real</span>Data
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-zinc-500">
            <li>
              <Link href={`/${lang}`} className="hover:text-zinc-300">
                Home
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/inventory`} className="hover:text-zinc-300">
                Inventory
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/yields`} className="hover:text-zinc-300">
                Yields
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/districts`} className="hover:text-zinc-300">
                Districts
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/contact`} className="hover:text-zinc-300">
                Contact
              </Link>
            </li>
          </ul>
          <p className="mt-6 text-xs text-zinc-600">
            © {new Date().getFullYear()} RealData · Alerts are English-only.
          </p>
        </div>
      </footer>
    </>
  );
}
