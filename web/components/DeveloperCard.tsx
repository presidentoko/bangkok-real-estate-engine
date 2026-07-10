import Link from "next/link";

type Props = {
  name: string | null;
  slug: string | null;
  /** Current page's language, used to build the internal /{lang}/developer/{slug} link. */
  lang: string;
  projectCount: number | null;
  unitCount: number | null;
  /** Roll-up across the condos WE track for this developer (developers table). */
  trackedBuildings?: number | null;
  avgYield?: number | null;
  avgForeignQuota?: number | null;
};

/**
 * Developer track record — who built this, and how big is their book. Buyers
 * of off-plan / new condos care a lot about builder reputation; portals just
 * print the name. We show the developer's FazWaz portfolio (projects + units)
 * as a scale/experience proxy, with a verdict. Hidden when unknown.
 */
export function DeveloperCard({
  name,
  slug,
  lang,
  projectCount,
  unitCount,
  trackedBuildings,
  avgYield,
  avgForeignQuota,
}: Props) {
  if (!name) return null;

  const showRollup =
    (trackedBuildings ?? 0) >= 2 &&
    (avgYield != null || avgForeignQuota != null);

  const verdict =
    projectCount == null
      ? null
      : projectCount >= 20
        ? { label: "Established developer", tone: "text-emerald-400" }
        : projectCount >= 5
          ? { label: "Experienced developer", tone: "text-lime-400" }
          : projectCount >= 2
            ? { label: "Smaller portfolio", tone: "text-amber-400" }
            : { label: "New / single-project developer", tone: "text-orange-400" };

  // Primary CTA points at our own developer page (internal linking — was
  // sending "see all projects" traffic straight to competitor FazWaz).
  // FazWaz stays as a small secondary source citation below.
  const profileUrl = slug ? `/${lang}/developer/${slug}` : null;
  const fazwazUrl = slug
    ? `https://www.fazwaz.com/property-developers/${slug}`
    : null;

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">Developer</h2>
        <span className="text-xs text-zinc-500">who built this?</span>
      </div>

      <div className="text-xl font-bold text-zinc-100 mb-1">{name}</div>
      {verdict && (
        <div className={`text-sm font-semibold mb-3 ${verdict.tone}`}>
          {verdict.label}
        </div>
      )}

      {(projectCount != null || unitCount != null) && (
        <dl className="grid grid-cols-2 gap-3 text-sm mb-1">
          {projectCount != null && (
            <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
              <dt className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                Projects
              </dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">
                {projectCount.toLocaleString()}
              </dd>
            </div>
          )}
          {unitCount != null && (
            <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
              <dt className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                Total units
              </dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">
                {unitCount.toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      )}

      {showRollup && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs text-zinc-400 mb-2">
            Across {trackedBuildings} of their buildings we track:
          </div>
          <div className="flex gap-6 text-sm">
            {avgYield != null && (
              <div>
                <div className="text-zinc-100 font-semibold tabular-nums">
                  {avgYield.toFixed(1)}%
                </div>
                <div className="text-zinc-500 text-xs">avg gross yield</div>
              </div>
            )}
            {avgForeignQuota != null && (
              <div>
                <div className="text-zinc-100 font-semibold tabular-nums">
                  {avgForeignQuota.toFixed(0)}%
                </div>
                <div className="text-zinc-500 text-xs">avg foreign quota</div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
        Portfolio scale is an experience proxy — a larger book usually means a
        longer delivery track record, though it is not a guarantee of build
        quality on any single project.
        {profileUrl && (
          <>
            {" "}
            <Link href={profileUrl} className="text-blue-400 hover:underline">
              See all their projects →
            </Link>
          </>
        )}
        {fazwazUrl && (
          <>
            {" "}
            (source:{" "}
            <a
              href={fazwazUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              FazWaz
            </a>
            )
          </>
        )}
      </p>
    </section>
  );
}
