type Props = {
  name: string | null;
  slug: string | null;
  projectCount: number | null;
  unitCount: number | null;
};

/**
 * Developer track record — who built this, and how big is their book. Buyers
 * of off-plan / new condos care a lot about builder reputation; portals just
 * print the name. We show the developer's FazWaz portfolio (projects + units)
 * as a scale/experience proxy, with a verdict. Hidden when unknown.
 */
export function DeveloperCard({ name, slug, projectCount, unitCount }: Props) {
  if (!name) return null;

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

  const profileUrl = slug
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

      <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
        Portfolio scale is an experience proxy — a larger book usually means a
        longer delivery track record, though it is not a guarantee of build
        quality on any single project.
        {profileUrl && (
          <>
            {" "}
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-400 hover:underline"
            >
              See all their projects →
            </a>
          </>
        )}
      </p>
    </section>
  );
}
