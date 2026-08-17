import Link from "next/link";

export type NeighbourLink = {
  slug: string;
  name: string;
  /** Our own /condo/<slug> when we track this building too, else null. */
  internalSlug: string | null;
  externalUrl: string;
};

/**
 * "Projects nearby", from hipflat's own nearby-projects block.
 *
 * Until 2026-08-17 every entry here was a `target="_blank"` link straight to
 * hipflat.co.th with no `rel="nofollow"` — so the one module on a condo page
 * whose entire job is "here is the next building to look at" was sending the
 * reader, and a share of the page's link equity, to the listing portal we
 * are trying to be an alternative to. On ~12k condo pages.
 *
 * We already have our own page for 58% of these buildings (measured across
 * all 18,879 neighbour rows), so those now resolve to an internal link.
 * The rest keep the external link — it is still useful to a reader — but
 * carry rel="nofollow" so they stop passing ranking signal outward.
 */
export function CondoNeighbours({
  neighbours,
  lang,
  title,
  internalNote,
  externalNote,
}: {
  neighbours: NeighbourLink[];
  lang: string;
  title: string;
  internalNote: string;
  externalNote: string;
}) {
  const internalCount = neighbours.filter((n) => n.internalSlug).length;
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">
        {title} <span className="text-zinc-500 text-xs">({neighbours.length})</span>
      </h2>
      <ul className="grid sm:grid-cols-2 gap-2 text-sm">
        {neighbours.map((n) => {
          const body = (
            <>
              <div className="font-medium text-zinc-100 truncate">{n.name}</div>
              <div className="text-zinc-500 text-xs truncate mt-0.5">
                {n.internalSlug ? internalNote : `hipflat.co.th/.../${n.slug}`}
              </div>
            </>
          );
          const className =
            "block bg-zinc-950 hover:bg-zinc-800 rounded-lg p-3 border border-zinc-800 transition";
          return (
            <li key={n.slug}>
              {n.internalSlug ? (
                <Link href={`/${lang}/condo/${n.internalSlug}`} className={className}>
                  {body}
                </Link>
              ) : (
                <a
                  href={n.externalUrl}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className={className}
                >
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {internalCount < neighbours.length && (
        <div className="text-[10px] text-zinc-600 mt-3">{externalNote}</div>
      )}
    </section>
  );
}
