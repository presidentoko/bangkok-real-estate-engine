export function CondoNeighbours({
  neighbours,
}: {
  neighbours: { neighbour_slug: string; neighbour_url: string; neighbour_name: string | null }[];
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">
        Projects nearby{" "}
        <span className="text-zinc-500 text-xs">({neighbours.length})</span>
      </h2>
      <ul className="grid sm:grid-cols-2 gap-2 text-sm">
        {neighbours.map((n) => (
          <li key={n.neighbour_slug}>
            <a
              href={n.neighbour_url}
              target="_blank"
              rel="noreferrer noopener"
              className="block bg-zinc-950 hover:bg-zinc-800 rounded-lg p-3 border border-zinc-800 transition"
            >
              <div className="font-medium text-zinc-100 truncate">
                {n.neighbour_name ?? n.neighbour_slug}
              </div>
              <div className="text-zinc-500 text-xs truncate mt-0.5">
                hipflat.co.th/.../{n.neighbour_slug}
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-zinc-600 mt-3">
        From hipflat&apos;s &ldquo;Projects nearby&rdquo; section. External links.
      </div>
    </section>
  );
}
