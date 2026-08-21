import type { FaqItem } from "@/lib/seo/faqJsonLd";

/**
 * Visible FAQ block.
 *
 * Google requires that any Q&A emitted as FAQPage JSON-LD is also visible on
 * the page. Render this from the SAME array that is passed to
 * `buildFaqJsonLd()` so the two can never drift apart. A `<details>` accordion
 * counts as visible content for Google, so collapsing the answers is fine.
 */
export default function FaqSection({
  items,
  heading,
  className = "",
  headingClassName = "text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4",
}: {
  items: readonly FaqItem[];
  heading: string;
  className?: string;
  headingClassName?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className}>
      <h2 className={headingClassName}>{heading}</h2>
      <div className="space-y-3">
        {items.map((f, i) => (
          <details
            key={i}
            className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 [&_summary]:cursor-pointer"
          >
            <summary className="font-semibold list-none flex items-baseline justify-between gap-3">
              <span>{f.q}</span>
              <span className="text-zinc-500 group-open:rotate-180 transition shrink-0">▾</span>
            </summary>
            <p className="text-zinc-400 text-sm mt-3 leading-relaxed whitespace-pre-line">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
