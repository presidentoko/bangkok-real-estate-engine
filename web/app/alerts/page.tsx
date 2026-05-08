import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 600;

type Row = {
  id: string;
  condo_id: string;
  name: string;
  url: string | null;
  region_name: string | null;
  bubble_index: number;
  price: number | null;
  price_per_sqm: number | null;
  region_avg_pps: number | null;
  detected_at: string;
};

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
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("v_recent_alerts")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(50);

  const rows: Row[] = data ?? [];

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

      {error && (
        <div className="text-red-400 text-sm mb-4">DB error: {error.message}</div>
      )}

      {rows.length === 0 ? (
        <div className="text-zinc-500 text-sm">
          No active alerts. Run the pipeline to refresh.
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
                        href={`/condo/${r.condo_id}`}
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
