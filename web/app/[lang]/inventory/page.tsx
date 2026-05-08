import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryGrid } from "@/components/InventoryGrid";
import { isLang } from "@/lib/i18n";
import { fetchAllCondos } from "@/lib/queries/condos";

export const revalidate = 3600;

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const condos = await fetchAllCondos();

  // Distinct districts (collapse canonical/slug variants)
  const labelByNorm = new Map<string, string>();
  for (const c of condos) {
    const r = c.region;
    if (!r) continue;
    const norm = r.toLowerCase().replace(/[\s\-_]+/g, "");
    const existing = labelByNorm.get(norm);
    if (!existing || (/[A-Z]/.test(r) && !/[A-Z]/.test(existing))) {
      labelByNorm.set(norm, r);
    }
  }
  const districts = [...labelByNorm.values()].sort();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <Link
          href={`/${lang}`}
          className="text-zinc-500 hover:text-zinc-300 text-sm inline-block"
        >
          ← back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
          Inventory
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {condos.length.toLocaleString()} hipflat-tracked Bangkok condo buildings
        </p>
      </header>

      <InventoryGrid
        condos={condos}
        hrefPrefix={`/${lang}/condo/`}
        districts={districts}
      />
    </main>
  );
}
