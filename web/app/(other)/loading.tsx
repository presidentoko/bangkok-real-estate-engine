export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="h-8 w-2/3 rounded-lg bg-zinc-900 animate-pulse" />
      <div className="h-4 w-full rounded bg-zinc-900 animate-pulse" />
      <div className="h-4 w-5/6 rounded bg-zinc-900 animate-pulse" />
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        <div className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />
        <div className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />
        <div className="h-24 rounded-2xl bg-zinc-900 animate-pulse" />
      </div>
      <div className="h-64 rounded-2xl bg-zinc-900 animate-pulse mt-4" />
    </main>
  );
}
