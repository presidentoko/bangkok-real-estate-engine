export function CondoFacilities({
  amenities,
  parkingFacts,
}: {
  amenities: string[];
  parkingFacts: { fact_key: string; fact_value: string | null }[];
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid sm:grid-cols-2 gap-6">
      {amenities.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">
            Facilities
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <li
                key={a}
                className="bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1 rounded-full"
              >
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {parkingFacts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">
            Parking & Lifts
          </h2>
          <dl className="space-y-1 text-sm">
            {parkingFacts.map((p) => (
              <div key={p.fact_key} className="flex justify-between gap-3">
                <dt className="text-zinc-400">{p.fact_key}</dt>
                <dd className="text-zinc-100 font-medium">
                  {p.fact_value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
