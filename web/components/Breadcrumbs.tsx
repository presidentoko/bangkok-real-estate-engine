import Link from "next/link";

export type BreadcrumbItem = { name: string; href: string };

// Visible counterpart to the BreadcrumbList JSON-LD every hub/condo page
// already emits — the JSON-LD alone gives crawlers a path but leaves human
// visitors (the majority, landing from Google) with no way to browse
// upward. Last item renders as plain text (current page, not a link).
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-zinc-500 overflow-x-auto whitespace-nowrap">
      <ol className="flex items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {isLast ? (
                <span className="text-zinc-400 truncate max-w-[200px]" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-zinc-300 hover:underline truncate max-w-[160px]">
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
