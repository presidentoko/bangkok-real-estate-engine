/*
 * Admin leads inbox — list view of every consultation lead with status,
 * filters, and a one-click link to the originating condo (when there is one).
 *
 * Gated by middleware.ts, which verifies the HMAC-signed `admin_session`
 * cookie (see lib/adminSession.ts) before any request reaches this page.
 * Fine for a solo-operator MVP; migrate to NextAuth/Clerk before opening
 * admin access to multiple people.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Leads — RealData" };

type Lead = {
  id: string;
  condo_id: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  budget_min: number | null;
  budget_max: number | null;
  timeline: string | null;
  purpose: string | null;
  message: string | null;
  source_url: string | null;
  status: string;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
  inquiry_type: string | null;
};

type CondoMeta = { id: string; name: string };

const STATUSES = ["new", "contacted", "qualified", "lost", "closed"] as const;

function statusClass(s: string): string {
  switch (s) {
    case "new":        return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
    case "contacted":  return "bg-blue-500/15    border-blue-500/40    text-blue-300";
    case "qualified":  return "bg-violet-500/15  border-violet-500/40  text-violet-300";
    case "closed":     return "bg-zinc-700/30    border-zinc-600       text-zinc-300";
    case "lost":       return "bg-rose-500/15    border-rose-500/40    text-rose-300";
    default:           return "bg-zinc-800       border-zinc-700       text-zinc-300";
  }
}

function fmtBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  const f = (v: number | null) =>
    v == null ? "?" : v >= 1_000_000 ? `฿${(v / 1_000_000).toFixed(1)}M` : `฿${Math.round(v).toLocaleString()}`;
  return `${f(min)}–${f(max)}`;
}

function relAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;

  const supabase = getServerSupabase();
  let q = supabase
    .from("leads")
    .select(
      "id, condo_id, name, email, phone, budget_min, budget_max, " +
      "timeline, purpose, message, source_url, status, assigned_to, " +
      "internal_notes, created_at, inquiry_type",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (statusFilter && (STATUSES as readonly string[]).includes(statusFilter)) {
    q = q.eq("status", statusFilter);
  }

  const { data, error } = await q;
  if (error) throw error;
  const leads = (data ?? []) as unknown as Lead[];

  // Hydrate condo names for the leads that have condo_id
  const condoIds = Array.from(new Set(leads.map((l) => l.condo_id).filter((v): v is string => !!v)));
  let condoMap = new Map<string, string>();
  if (condoIds.length > 0) {
    const { data: condoData } = await supabase
      .from("condos")
      .select("id, name")
      .in("id", condoIds);
    for (const c of (condoData ?? []) as CondoMeta[]) {
      condoMap.set(c.id, c.name);
    }
  }

  // Per-status counts for the filter chips
  const counts: Record<string, number> = {};
  for (const s of STATUSES) counts[s] = 0;
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;

  async function setStatus(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const next = String(formData.get("status") ?? "");
    if (!id || !(STATUSES as readonly string[]).includes(next)) return;
    const supabase = getServerSupabase();
    await supabase.from("leads").update({ status: next }).eq("id", id);
    redirect("/admin/leads" + (statusFilter ? `?status=${statusFilter}` : ""));
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="text-zinc-400 text-sm">
          {leads.length} {statusFilter ? `${statusFilter}` : "total"} (most recent first)
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/leads"
          className={`px-3.5 py-2 rounded-full border transition ${
            !statusFilter
              ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/leads?status=${s}`}
            className={`px-3.5 py-2 rounded-full border transition ${
              statusFilter === s
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s} <span className="text-zinc-600">({counts[s] ?? 0})</span>
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400">
          No leads yet in this filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => {
            const condoName = l.condo_id ? condoMap.get(l.condo_id) : null;
            return (
              <li key={l.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <span className="text-zinc-100 font-semibold">
                        {l.name || "(no name)"}
                      </span>
                      <a
                        href={`mailto:${l.email}`}
                        className="text-emerald-400 text-sm hover:underline break-all"
                      >
                        {l.email}
                      </a>
                      {l.phone && (
                        <span className="text-zinc-500 text-sm">· {l.phone}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400 mb-2">
                      <span>{relAge(l.created_at)}</span>
                      {l.timeline && <span>· timeline: <strong className="text-zinc-300">{l.timeline}</strong></span>}
                      {l.purpose && <span>· purpose: <strong className="text-zinc-300">{l.purpose}</strong></span>}
                      <span>· budget: <strong className="text-zinc-300">{fmtBudget(l.budget_min, l.budget_max)}</strong></span>
                      {l.inquiry_type && l.inquiry_type !== "general" && (
                        <span>· type: <strong className="text-zinc-300">{l.inquiry_type}</strong></span>
                      )}
                    </div>
                    {condoName && (
                      <div className="text-sm mb-2">
                        <Link
                          href={`/en/condo/${l.condo_id}`}
                          target="_blank"
                          className="text-emerald-400 hover:underline"
                        >
                          → {condoName}
                        </Link>
                      </div>
                    )}
                    {l.message && (
                      <p className="text-sm text-zinc-300 mb-2 whitespace-pre-wrap leading-relaxed">
                        {l.message}
                      </p>
                    )}
                    {l.source_url && (
                      <a
                        href={l.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-zinc-500 hover:underline break-all"
                      >
                        ← {l.source_url}
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border self-end ${statusClass(l.status)}`}
                    >
                      {l.status}
                    </span>
                    <form action={setStatus} className="flex gap-1.5">
                      <input type="hidden" name="id" value={l.id} />
                      <select
                        name="status"
                        defaultValue={l.status}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                      >
                        Save
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-zinc-600 leading-relaxed">
        Telegram pings arrive at @Bkkbudong_bot when a new lead lands. This
        page is the source of truth for status. Mark leads <strong>contacted</strong>{" "}
        after the broker partner reaches out, <strong>qualified</strong> when budget /
        timeline are confirmed, <strong>closed</strong> when the deal closes, or{" "}
        <strong>lost</strong> if the lead goes silent or buys elsewhere.
      </p>
    </main>
  );
}
