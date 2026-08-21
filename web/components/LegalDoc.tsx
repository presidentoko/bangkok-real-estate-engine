import type { LegalDocument } from "@/lib/legal/types";

// Renders a policy document. Deliberately plain: no cards, no accent colours,
// no accordions. A privacy policy that hides half its text behind a toggle is
// worse than one nobody reads, and a reviewer checking whether the page is
// real should be able to see the whole thing in one scroll.
export default function LegalDoc({ doc }: { doc: LegalDocument }) {
  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-8">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {doc.title}
        </h1>
        <p className="text-zinc-400 mt-3 leading-relaxed">{doc.lead}</p>
        <p className="text-xs text-zinc-500 mt-4 tabular-nums">
          Last updated {doc.effective}
        </p>
      </header>

      <div className="space-y-8">
        {doc.sections.map((s, i) => (
          <section key={s.heading} id={`s${i + 1}`}>
            <h2 className="text-lg sm:text-xl font-bold mb-3">
              <span className="text-zinc-600 tabular-nums mr-2">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="space-y-3">
              {s.blocks.map((b, j) => {
                if (b.kind === "p") {
                  return (
                    <p key={j} className="text-zinc-300 leading-relaxed">
                      {b.text}
                    </p>
                  );
                }
                if (b.kind === "ul") {
                  return (
                    <ul
                      key={j}
                      className="list-disc pl-5 space-y-1.5 text-zinc-300 leading-relaxed marker:text-zinc-600"
                    >
                      {b.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <dl key={j} className="space-y-2">
                    {b.items.map((it) => (
                      <div
                        key={it.k}
                        className="py-2 border-b border-zinc-900 last:border-0"
                      >
                        <dt className="text-zinc-100 text-sm font-semibold">
                          {it.k}
                        </dt>
                        <dd className="text-zinc-400 text-sm mt-1 leading-relaxed">
                          {it.v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
