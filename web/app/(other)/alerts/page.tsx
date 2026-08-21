import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getOtherLang } from "@/components/OtherShell";

type Row = {
  id: string;
  condo_id: string;
  slug: string | null;
  name: string;
  url: string | null;
  region_name: string | null;
  bubble_index: number;
  price: number | null;
  price_per_sqm: number | null;
  region_avg_pps: number | null;
  detected_at: string;
};

// This page used to be ISR (`revalidate = 21600`). Resolving the locale from
// the `lang` cookie makes it dynamic, so the 6h window moved onto the query
// itself — one Supabase read per 6h, not one per request. The error is
// thrown rather than returned so a failed read never gets cached for the
// next six hours.
const fetchRecentAlerts = unstable_cache(
  async (): Promise<Row[]> => {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("v_recent_alerts")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as Row[]) ?? [];
  },
  ["alerts:recent"],
  { revalidate: 21600, tags: ["alerts"] },
);

function formatTHB(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AlertsPage() {
  const lang = await getOtherLang();

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await fetchRecentAlerts();
  } catch (err) {
    // Supabase error strings carry table, column and RLS policy details —
    // they go to the Vercel logs, never to the page.
    console.error("[alerts] v_recent_alerts query failed", err);
    failed = true;
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">🚨 Underpriced Alerts</h1>
          <Link
            href="/alerts/subscribe"
            className="text-sm bg-pink-500 hover:bg-pink-400 text-white px-3 py-2 rounded-lg font-semibold"
          >
            Subscribe
          </Link>
        </div>
        <p className="text-zinc-400 text-sm">
          Listings priced ≥20% below their district average — last 14 days.
          Get them in real-time via Telegram.
        </p>
      </header>

      {failed ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
          <p className="text-2xl mb-2">📡</p>
          <p className="mb-1">The alert feed is temporarily unavailable.</p>
          <p className="text-sm text-zinc-500">
            Nothing is wrong on your side — the list will be back shortly.
          </p>
          <Link
            href={`/${lang}/inventory`}
            className="mt-4 inline-block text-sm text-blue-400 hover:underline"
          >
            Browse the full inventory →
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
          <p className="text-2xl mb-2">🔍</p>
          <p className="mb-1">No listing is ≥20% under its district average.</p>
          <p className="text-sm text-zinc-500">
            Nothing has cleared that bar in the last 14 days — these are rare
            by design. Subscribe and the next one reaches you the hour it
            appears.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <Link
              href="/alerts/subscribe"
              className="px-4 py-2 rounded-full bg-pink-500 text-white font-semibold hover:bg-pink-400 transition"
            >
              Get alerts on Telegram
            </Link>
            <Link
              href={`/${lang}/yields`}
              className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition"
            >
              Highest-yield condos
            </Link>
            <Link
              href={`/${lang}/inventory`}
              className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition"
            >
              Full inventory
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const discount = Math.max(0, 100 - r.bubble_index);
            return (
              <li
                key={r.id}
                className="rounded-xl bg-zinc-900 border border-zinc-800 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${lang}/condo/${r.slug ?? r.condo_id}`}
                        className="font-semibold text-zinc-100 hover:underline truncate"
                      >
                        {r.name}
                      </Link>
                      <span className="text-xs text-zinc-500 shrink-0">
                        · {r.region_name ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {formatRelative(r.detected_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-emerald-400 font-bold text-lg leading-none">
                      −{discount.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      vs district avg
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-500">Listed</div>
                    <div className="font-mono">{formatTHB(r.price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-zinc-500">฿/m²</div>
                    <div className="font-mono">
                      {r.price_per_sqm
                        ? `฿${Math.round(r.price_per_sqm).toLocaleString()}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-zinc-500">
                      District avg
                    </div>
                    <div className="font-mono text-zinc-400">
                      {r.region_avg_pps
                        ? `฿${Math.round(r.region_avg_pps).toLocaleString()}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block mt-3 text-xs text-zinc-400 hover:text-zinc-200 truncate"
                  >
                    ↗ {r.url}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
