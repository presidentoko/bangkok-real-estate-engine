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
  /** Optional keyword slug for deep-link (preferred over condo_id when present). */
  slug?: string | null;
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

/** The translatable surface of a post. English lives on the post itself
 *  (it is what the verifier checked); ko/th live under `i18n`, written by
 *  scripts/localize_weekly_post.py, which also audits that a translation
 *  introduces no number the English does not contain. Bullets carry only
 *  label/value here — condo_id/slug/metric/expected stay on the English
 *  bullet at the same index. */
export type WeeklyLocalized = {
  title: string;
  description: string;
  lead: string;
  sections: WeeklySection[];
  fact_bullets?: Array<Pick<WeeklyFactBullet, "label" | "value">>;
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
  /** Korean / Thai bodies. Absent on posts that predate localisation or
   *  whose translation failed the number audit — those render English. */
  i18n?: Partial<Record<"ko" | "th", WeeklyLocalized>>;
};

/** The post as it should read in `lang`: translated fields when present,
 *  English otherwise, with the English bullets' link/metric metadata kept. */
export function localizeWeeklyPost(post: WeeklyPost, lang: string): WeeklyPost {
  const loc = lang === "ko" || lang === "th" ? post.i18n?.[lang] : undefined;
  if (!loc) return post;
  const bullets =
    loc.fact_bullets && loc.fact_bullets.length === post.fact_bullets.length
      ? post.fact_bullets.map((b, i) => ({ ...b, ...loc.fact_bullets![i] }))
      : post.fact_bullets;
  return {
    ...post,
    title: loc.title,
    description: loc.description,
    lead: loc.lead,
    sections: loc.sections.length === post.sections.length ? loc.sections : post.sections,
    fact_bullets: bullets,
  };
}

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

const SLUG_RE = /^[a-z0-9-]+$/;

export async function getWeeklyPost(slug: string): Promise<WeeklyPost | null> {
  // `slug` is joined straight into a filesystem path below — reject
  // anything that isn't a plain slug (blocks "../" traversal etc.).
  if (!SLUG_RE.test(slug)) return null;
  try {
    const raw = await fs.readFile(path.join(CONTENT_DIR, `${slug}.json`), "utf8");
    return JSON.parse(raw) as WeeklyPost;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
