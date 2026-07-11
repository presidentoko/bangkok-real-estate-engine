import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { isLang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getWeeklyPost, listWeeklyPosts, type WeeklyPost } from "@/lib/weeklyPost";

// Content only changes on deploy (auto-blog publishes via git push), so a
// daily revalidate is plenty — the deploy itself rebuilds the page anyway.
export const revalidate = 86400;

export async function generateStaticParams() {
  const posts = await listWeeklyPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const post = await getWeeklyPost(slug);
  if (!post || !isLang(lang)) {
    return { title: "Weekly post — RealData" };
  }
  return {
    title: `${post.title} — RealData`,
    description: post.description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`,
      languages: langAlternates(`/blog/weekly/${slug}`),
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`,
      type: "article",
      publishedTime: post.published_at,
    },
  };
}

export default async function WeeklyPostPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  if (!isLang(lang)) notFound();
  const post = await getWeeklyPost(slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    // No dedicated OG image route for weekly posts — Next.js resolves
    // og:image up to the nearest ancestor's opengraph-image.tsx, which is
    // the site-wide one at app/[lang]/opengraph-image.tsx.
    image: `${SEO_SITE_URL}/${lang}/opengraph-image`,
    datePublished: post.published_at,
    dateModified: post.published_at,
    author: { "@type": "Organization", name: "RealData", url: SEO_SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "RealData",
      url: SEO_SITE_URL,
    },
    inLanguage: lang,
    url: `${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`,
    mainEntityOfPage: `${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`,
  };
  const breadcrumbsJsonLd = blogBreadcrumbs(lang, `weekly/${slug}`, post.title);
  // Synthesise a short FAQ from the lead + first section so AI Overviews
  // have something quotable even if the generator didn't produce one.
  const faqJsonLd = buildFaqJsonLd([
    {
      q: `What is "${post.title}" about?`,
      a: post.description,
    },
    ...(post.sections.slice(0, 2).map((s) => ({
      q: s.heading,
      a: stripMarkdown(s.body).slice(0, 500),
    })) ?? []),
  ]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="space-y-3">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          RealData weekly · {post.published_at}
          {post.topic && (
            <span className="text-zinc-600"> · {post.topic}</span>
          )}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {post.title}
        </h1>
        <p className="text-zinc-300 text-base leading-relaxed">
          <InlineMd text={post.lead} />
        </p>
        <div className="max-w-xs pt-1">
          <LinkShareButtons
            url={`${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`}
            title={`${post.title} — RealData`}
          />
        </div>
      </header>

      {post.fact_bullets.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
            This week&apos;s numbers
          </h2>
          <ul className="space-y-1.5 text-sm">
            {post.fact_bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 flex-wrap"
              >
                <span className="text-zinc-300 flex-1 min-w-0">
                  {(b.slug ?? b.condo_id) ? (
                    <Link
                      href={`/${lang}/condo/${b.slug ?? b.condo_id}`}
                      className="hover:text-emerald-400 hover:underline"
                    >
                      {b.label}
                    </Link>
                  ) : (
                    b.label
                  )}
                </span>
                <span className="text-zinc-100 font-semibold tabular-nums whitespace-nowrap">
                  {b.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {post.sections.map((s, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-xl font-semibold text-zinc-100">{s.heading}</h2>
          {s.body
            .split(/\n\n+/)
            .map((p, j) => (
              <p key={j} className="text-zinc-300 leading-relaxed">
                <InlineMd text={p} />
              </p>
            ))}
        </section>
      ))}

      <LeadCaptureCTA
        headline="Want a vetted broker's take on any building in this post?"
      />

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-300">Found this useful? Share the post</div>
        <LinkShareButtons
          url={`${SEO_SITE_URL}/${lang}/blog/weekly/${slug}`}
          title={`${post.title} — RealData`}
        />
      </div>

      <section className="border-t border-zinc-800 pt-6 text-xs text-zinc-500">
        <p>
          This post is part of RealData&apos;s auto-generated weekly series,
          drawn from our live measurement of every Thai condo we can find
          across hipflat, dotproperty, ddproperty, and fazwaz. Every number
          cited above was re-verified against the live database immediately
          before publish. See more at{" "}
          <Link href={`/${lang}/blog`} className="text-emerald-400 hover:underline">
            /blog
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

/**
 * Very tiny inline-markdown helper: bold, links, code. No paragraphs or
 * lists — those are handled by the splitter on \n\n above. We escape
 * untrusted text first so a generator typo can't inject HTML.
 */
function InlineMd({ text }: { text: string }) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" class="text-emerald-400 hover:underline">$1</a>',
    )
    .replace(/`([^`]+)`/g, '<code class="text-emerald-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-50">$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type _Touch = WeeklyPost; // keeps the import warning-free under noUnusedLocals
