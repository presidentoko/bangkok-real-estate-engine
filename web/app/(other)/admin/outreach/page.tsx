/*
 * Admin outreach queue — the drafts scripts/outreach_scout.py wrote, and the
 * two buttons that close the loop.
 *
 * The person working this page is not the site owner: they open a draft, edit
 * it into their own voice, post it from their own account, and paste the
 * resulting URL back. That URL is the only way we learn which communities are
 * worth the time — scripts/outreach_scout.py --verify re-checks them weekly.
 *
 * Nothing here posts anything. See supabase/migrations/020_outreach_tasks.sql.
 *
 * Gated by middleware.ts, same HMAC-signed admin_session cookie as the other
 * admin pages.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import { isSafeMarkdownUrl } from "@/lib/markdownLinkSafety";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Outreach — RealData" };

type Task = {
  id: string;
  kind: string;
  source: string;
  source_url: string;
  source_title: string | null;
  source_excerpt: string | null;
  draft_body: string;
  topic: string | null;
  status: string;
  result_url: string | null;
  skip_reason: string | null;
  link_alive: boolean | null;
  link_checked_at: string | null;
  created_at: string;
};

const STATUSES = ["new", "posted", "skipped"] as const;

function statusClass(s: string): string {
  if (s === "posted") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (s === "skipped") return "bg-zinc-800 text-zinc-400 border-zinc-700";
  return "bg-amber-500/10 text-amber-300 border-amber-500/30";
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(status ?? "") ? status! : "new";

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("outreach_tasks")
    .select(
      "id, kind, source, source_url, source_title, source_excerpt, draft_body, topic, " +
        "status, result_url, skip_reason, link_alive, link_checked_at, created_at",
    )
    .eq("status", filter)
    .order("created_at", { ascending: false })
    .limit(100);
  // The table is created by migration 020; Supabase types it loosely here.
  const tasks = (data ?? []) as unknown as Task[];

  const { count: liveLinks } = await supabase
    .from("outreach_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "posted")
    .eq("link_alive", true);

  async function markPosted(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const url = String(formData.get("result_url") ?? "").trim();
    if (!id || !/^https?:\/\//i.test(url)) return;
    const sb = getServerSupabase();
    await sb
      .from("outreach_tasks")
      .update({ status: "posted", result_url: url, handled_at: new Date().toISOString() })
      .eq("id", id);
    redirect(`/admin/outreach?status=${filter}`);
  }

  async function markSkipped(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const reason = String(formData.get("skip_reason") ?? "").slice(0, 300);
    if (!id) return;
    const sb = getServerSupabase();
    await sb
      .from("outreach_tasks")
      .update({
        status: "skipped",
        skip_reason: reason || null,
        handled_at: new Date().toISOString(),
      })
      .eq("id", id);
    redirect(`/admin/outreach?status=${filter}`);
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Outreach</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          {tasks.length} {filter}. {liveLinks ?? 0} posted links confirmed live.
        </p>
        <p className="text-zinc-500 text-xs leading-relaxed max-w-2xl">
          Edit the draft into your own words before posting — a reply that reads as a
          template is what gets a domain banned. Answer the question first, keep the one
          link as the source, and say plainly that the site is ours. Then paste the URL of
          your comment back here.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/outreach?status=${s}`}
            className={`px-3.5 py-2 rounded-full border transition ${
              filter === s
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      {tasks.length === 0 && (
        <p className="text-zinc-500 text-sm">
          Nothing {filter}. The scout runs daily and writes at most three drafts a day.
        </p>
      )}

      <ul className="space-y-4">
        {tasks.map((t) => (
          <li key={t.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">
                  {t.source}
                  {t.topic ? ` · ${t.topic}` : ""} · {t.created_at.slice(0, 10)}
                </div>
                <h2 className="font-semibold text-zinc-100 truncate">
                  {t.source_title ?? t.source_url}
                </h2>
                {isSafeMarkdownUrl(t.source_url) && (
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-emerald-400 hover:underline break-all"
                  >
                    open the thread →
                  </a>
                )}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${statusClass(t.status)}`}>
                {t.status}
              </span>
            </div>

            {t.source_excerpt && (
              <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{t.source_excerpt}</p>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{t.draft_body}</p>
              <CopyButton text={t.draft_body} label="Copy draft" />
            </div>

            {t.status === "new" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <form action={markPosted} className="flex gap-2 flex-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    name="result_url"
                    type="url"
                    required
                    placeholder="URL of your comment"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
                  />
                  <button
                    type="submit"
                    className="text-sm px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                  >
                    Posted
                  </button>
                </form>
                <form action={markSkipped} className="flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    name="skip_reason"
                    placeholder="why not"
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400"
                  />
                  <button
                    type="submit"
                    className="text-sm px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  >
                    Skip
                  </button>
                </form>
              </div>
            )}

            {t.status === "posted" && t.result_url && (
              <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
                {isSafeMarkdownUrl(t.result_url) && (
                  <a
                    href={t.result_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-emerald-400 hover:underline break-all"
                  >
                    {t.result_url}
                  </a>
                )}
                <span>
                  {t.link_checked_at
                    ? t.link_alive
                      ? `link live (checked ${t.link_checked_at.slice(0, 10)})`
                      : `link gone (checked ${t.link_checked_at.slice(0, 10)})`
                    : "not checked yet"}
                </span>
              </div>
            )}

            {t.status === "skipped" && t.skip_reason && (
              <p className="text-xs text-zinc-500">skipped: {t.skip_reason}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
