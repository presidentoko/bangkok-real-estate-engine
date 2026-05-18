import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Schema for auto-generated weekly posts. The Python generator
 * (scripts/generate_weekly_post.py) writes one JSON file per post into
 * web/content/weekly/{slug}.json. The dynamic route at
 * /[lang]/blog/weekly/[slug] reads + renders it.
 *
 * Every numeric claim in the post should be carried as a `factBullet`
 * with an explicit condo_id (where applicable) + metric + expected
 * value, so the generator can re-query the DB before publish and refuse
 * to ship a post whose numbers no longer match.
 */
export type WeeklyFactBullet = {
  /** Free-text label rendered in the bullet list. */
  label: string;
  /** Free-text value rendered after the label (e.g. "5.10%", "+0.7pp"). */
  value: string;
  /** Optional condo UUID for deep-link. */
  condo_id?: string | null;
  /** The DB column this number was sourced from (e.g. gross_yield_pct). */
  metric?: string | null;
  /** The number we expect when re-querying (used by the verifier). */
  expected?: number | null;
};

export type WeeklySection = {
  heading: string;
  /** Paragraphs of body text. Plain Markdown — links + bold supported. */
  body: string;
};

export type WeeklyPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date string (YYYY-MM-DD). */
  published_at: string;
  /** Lead paragraph rendered under the H1. Plain Markdown. */
  lead: string;
  sections: WeeklySection[];
  fact_bullets: WeeklyFactBullet[];
  /** Optional categorical tag — e.g. "yield-movers", "macro-shift". */
  topic?: string | null;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "weekly");

export async function listWeeklyPosts(): Promise<WeeklyPost[]> {
  let files: string[];
  try {
    files = await fs.readdir(CONTENT_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: WeeklyPost[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CONTENT_DIR, f), "utf8");
      out.push(JSON.parse(raw) as WeeklyPost);
    } catch {
      // Skip malformed post files instead of breaking the whole blog
      // index — auto-generation can occasionally land a corrupt file.
    }
  }
  // Newest first.
  out.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  return out;
}

export async function getWeeklyPost(slug: string): Promise<WeeklyPost | null> {
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, `${slug}.json`), "utf8");
    return JSON.parse(raw) as WeeklyPost;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
