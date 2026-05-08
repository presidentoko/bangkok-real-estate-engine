import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

type Row = {
  promotion_id: string;
  condo_id: string;
  name: string;
  region_name: string | null;
  promoted_by: string;
  platform: string | null;
  claim: string | null;
  bubble_index: number | null;
  added_at: string;
};

export default async function RealityIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("v_promoted_condos")
    .select(
      "promotion_id, condo_id, name, region_name, promoted_by, platform, claim, bubble_index, added_at"
    )
    .order("added_at", { ascending: false })
    .limit(50);

  const rows: Row[] = data ?? [];

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t.reality.title}</h1>
        <p className="text-zinc-400 text-sm max-w-xl">{t.reality.lead}</p>
      </header>

      {error && (
        <div className="text-red-400 text-sm mb-3">DB error: {error.message}</div>
      )}

      {rows.length === 0 ? (
        <div className="text-zinc-500 text-sm">{t.reality.emptyState}</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const above =
              r.bubble_index != null ? r.bubble_index - 100 : null;
            return (
              <li key={r.promotion_id}>
                <Link
                  href={`/${lang}/reality/${r.promotion_id}`}
                  className="block p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {r.region_name ?? "—"} · {t.reality.promotedBy} {r.promoted_by} (
                        {r.platform ?? "?"})
                      </div>
                      {r.claim && (
                        <div className="text-sm text-zinc-300 italic mt-2">
                          &ldquo;{r.claim}&rdquo;
                        </div>
                      )}
                    </div>
                    {above != null && (
                      <div
                        className={`text-right shrink-0 font-bold ${
                          above > 15
                            ? "text-red-400"
                            : above < -15
                            ? "text-emerald-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {above > 0 ? `+${above.toFixed(1)}%` : `${above.toFixed(1)}%`}
                        <div className="text-[10px] text-zinc-500 font-normal">
                          {t.reality.vsDistrict}
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
