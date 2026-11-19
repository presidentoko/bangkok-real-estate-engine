/**
 * Memo for the Cloudflare condo export build (CONDO_STATIC_BUILD=1) only.
 *
 * The export renders /<lang>/condo/<slug> once per locale, and every render
 * used to run its own ~9 Supabase reads for the same building: the same rows
 * three times, only the translated text differs. This keeps the first result
 * per key so the second and third locale read nothing.
 *
 *  - in memory: a bounded Map of promises (also de-duplicates concurrent
 *    renders in one process);
 *  - on disk when CONDO_STATIC_DATA_CACHE names a directory: `next build`
 *    renders in several worker processes, so a file is the only memo they
 *    share. The workflow points it at a per-job temp dir; unset locally, so
 *    a developer build can never serve yesterday's rows.
 *
 * It is a pass-through when the flag is off, so Vercel's request-time
 * rendering is untouched. Failed reads (a PostgREST `error`, or null) are
 * never kept.
 */
export type ExportMemoOptions = { enabled: boolean; dir?: string; maxEntries?: number };

const defaultOk = (v: unknown): boolean =>
  v != null && !(typeof v === "object" && (v as { error?: unknown }).error);

export function makeExportMemo(opts: ExportMemoOptions) {
  const max = opts.maxEntries ?? 400;
  const mem = new Map<string, Promise<unknown>>();

  return async function exportMemo<T>(
    key: string,
    load: () => PromiseLike<T> | T,
    ok: (v: T) => boolean = defaultOk,
  ): Promise<T> {
    if (!opts.enabled) return await load();
    const hit = mem.get(key);
    if (hit) return (await hit) as T;

    const p = (async (): Promise<T> => {
      let file: string | null = null;
      if (opts.dir) {
        const path = await import("node:path");
        file = path.join(opts.dir, `${key.replace(/[^a-zA-Z0-9_.-]/g, "_")}.json`);
        try {
          const fs = await import("node:fs/promises");
          return JSON.parse(await fs.readFile(file, "utf8")) as T;
        } catch {
          /* not on disk yet */
        }
      }
      const value = await load();
      if (file && ok(value)) {
        try {
          const fs = await import("node:fs/promises");
          await fs.mkdir(opts.dir as string, { recursive: true });
          const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
          await fs.writeFile(tmp, JSON.stringify(value));
          await fs.rename(tmp, file);
        } catch {
          /* disk is an optimisation only */
        }
      }
      if (!ok(value)) mem.delete(key);
      return value;
    })();

    mem.set(key, p);
    p.catch(() => mem.delete(key));
    while (mem.size > max) {
      const oldest = mem.keys().next().value;
      if (oldest === undefined) break;
      mem.delete(oldest);
    }
    return await p;
  };
}

export const exportMemo = makeExportMemo({
  enabled: process.env.CONDO_STATIC_BUILD === "1",
  dir: process.env.CONDO_STATIC_DATA_CACHE || undefined,
});
