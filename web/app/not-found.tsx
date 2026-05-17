import Link from "next/link";

export const metadata = { title: "Not found — RealData" };

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto p-6 mt-16 text-center space-y-5">
      <p className="text-6xl">🏚️</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-zinc-400 text-sm">
        The condo, district, or page you&apos;re looking for isn&apos;t on our
        index — maybe the URL changed, or maybe we never measured it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm pt-2">
        <Link href="/en" className="px-4 py-2 rounded-full bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition">
          ← Home
        </Link>
        <Link href="/en/yields" className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          Top yields
        </Link>
        <Link href="/en/ask" className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          Ask RealData
        </Link>
        <Link href="/en/inventory" className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition">
          Browse all
        </Link>
      </div>
    </main>
  );
}
