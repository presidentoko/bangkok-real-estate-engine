# Retention & Viral Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OG image sharing, LINE share button, favorites watchlist, and compare-from-condo-page to improve user retention and viral sharing.

**Architecture:** localStorage for all user state (no login required). New `lib/saved-condos.ts` and `lib/compare-queue.ts` as pure localStorage wrappers. Client components (`SaveButton`, `CompareButton`, `CompareTray`) import from those libs. A new `/api/condos/batch` route serves the saved-page data fetch.

**Tech Stack:** Next.js App Router (server + client components), Tailwind CSS, localStorage, Supabase (for batch fetch), existing `BuildingCard` component.

---

## File Map

**New files:**
- `lib/saved-condos.ts` — pure localStorage helpers: `getSaved()`, `toggleSaved(id)`, `isSaved(id)`, `getSavedCount()`
- `lib/compare-queue.ts` — pure localStorage helpers: `getQueue()`, `toggleQueue(id)`, `isQueued(id)`, `clearQueue()`
- `components/SaveButton.tsx` — client heart-toggle button (reads/writes `lib/saved-condos`)
- `components/CompareButton.tsx` — client compare-toggle button (reads/writes `lib/compare-queue`)
- `components/CompareTray.tsx` — fixed bottom bar, appears when ≥1 condo queued for compare
- `components/LinkShareButtons.tsx` — LINE share + copy-URL buttons (separate from existing Instagram ShareButton)
- `app/[lang]/saved/page.tsx` — saved condos page (server shell + client content)
- `app/[lang]/saved/SavedContent.tsx` — client component: reads localStorage → fetches → renders BuildingCards
- `app/api/condos/batch/route.ts` — GET `?ids=id1,id2,...` → returns `CondoSummary[]` JSON

**Modified files:**
- `app/[lang]/condo/[id]/page.tsx` — add OG images + yield to metadata; add `SaveButton`, `CompareButton`, `LinkShareButtons` to JSX
- `app/[lang]/layout.tsx` — add "Saved" nav link with count badge; add `CompareTray` to layout body
- `app/[lang]/compare/page.tsx` — add "Copy link" button

---

## Task 1: Fix OG image metadata + add yield to description

**Files:**
- Modify: `app/[lang]/condo/[id]/page.tsx:61-126`

The `generateMetadata()` function builds `openGraph` but does NOT add `images`, so the beautifully-rendered `opengraph-image.tsx` card is never included in the `<meta og:image>` tag. Also, yield is not in the OG description.

- [ ] **Step 1: Fetch yield in `generateMetadata()`**

In `generateMetadata()`, the current query fetches `condos_published` + `value_scores` + `risk_factors`. Add `gross_yield_pct` to the condos_published select and add it to the type cast:

```typescript
// line 68-76 — change the condos query select string:
supabase
  .from("condos_published")
  .select("name, regions(name), market_sale_median, market_summary_currency, total_units, completion_year, gross_yield_pct")
  .eq("id", id)
  .maybeSingle(),
```

And update the type cast at line 78:

```typescript
const c = condo as unknown as {
  name: string;
  regions: { name: string } | { name: string }[] | null;
  market_sale_median: number | null;
  market_summary_currency: string | null;
  total_units: number | null;
  completion_year: number | null;
  gross_yield_pct: number | null;   // ADD THIS
};
```

- [ ] **Step 2: Add yield to OG description**

After the `floodTxt` declaration (line 97-99), add:

```typescript
const yieldTxt =
  c.gross_yield_pct != null ? `yield ${c.gross_yield_pct.toFixed(2)}%` : null;
```

Then add `yieldTxt` to the `.filter(Boolean).join(" · ")` array (line 103-110):

```typescript
[
  c.completion_year ? `built ${c.completion_year}` : null,
  c.total_units ? `${c.total_units} units` : null,
  yieldTxt,
  aboveTxt,
  floodTxt,
]
```

- [ ] **Step 3: Add `images` to the `openGraph` object**

Replace the current `openGraph` block (lines 119-124):

```typescript
openGraph: {
  title,
  description: desc,
  url: `${SITE_URL}/${lang}/condo/${id}`,
  type: "article",
  images: [
    {
      url: `${SITE_URL}/${lang}/condo/${id}/opengraph-image`,
      width: 1200,
      height: 630,
      alt: `${c.name} — RealData Bangkok condo report`,
    },
  ],
},
```

- [ ] **Step 4: Verify build compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

Visit any condo page. Open DevTools → Elements → search for `og:image`. Confirm the meta tag value ends with `/opengraph-image`. Also verify the description contains yield %.

- [ ] **Step 6: Commit**

```bash
git add app/[lang]/condo/[id]/page.tsx
git commit -m "feat(seo): link opengraph-image card to condo metadata + add yield to OG description"
```

---

## Task 2: LINE share + copy-URL buttons

**Files:**
- Create: `components/LinkShareButtons.tsx`
- Modify: `app/[lang]/condo/[id]/page.tsx` (add the component)

The existing `ShareButton` does Instagram screenshot sharing and is fine as-is. This task adds two lighter-weight share actions: LINE deep link and clipboard copy.

- [ ] **Step 1: Create `components/LinkShareButtons.tsx`**

```typescript
"use client";

import { useState } from "react";

type Props = {
  url: string;   // full canonical URL to share
  title: string; // condo name + region for LINE message text
};

export function LinkShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const lineHref = `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${url}`)}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (non-HTTPS dev env) — silently ignore
    }
  };

  return (
    <div className="flex gap-2">
      <a
        href={lineHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-sm transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.02 2 11c0 3.19 1.72 6.01 4.37 7.73L5.5 22l4.04-1.98C10.31 20.33 11.14 20.5 12 20.5c5.52 0 10-4.02 10-9s-4.48-9-10-9z"/>
        </svg>
        LINE
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition"
      >
        {copied ? (
          <>✓ Copied</>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy link
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add `LinkShareButtons` to the condo page**

In `app/[lang]/condo/[id]/page.tsx`, import `LinkShareButtons` at the top with other imports:

```typescript
import { LinkShareButtons } from "@/components/LinkShareButtons";
```

Find the ShareButton section in the JSX (search for `ShareButton` — it may be present but unused). Add `LinkShareButtons` near the top of the page, right after the opening `<main>` tag and before `ReportCard`. Look for the `data-speakable="report-card"` div (around line 569) and add above it:

```typescript
{/* Share row — LINE deeplink + copy URL */}
<div className="px-4 sm:px-6 pt-4">
  <LinkShareButtons
    url={`${SITE_URL}/${lang}/condo/${condoRaw.id}`}
    title={`${condoRaw.name} (${region}) — RealData report`}
  />
</div>
```

- [ ] **Step 3: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

Visit a condo page on mobile. Tap LINE button — should open LINE app with condo name + URL pre-filled. Tap Copy link — should show "✓ Copied" for 2 seconds.

- [ ] **Step 5: Commit**

```bash
git add components/LinkShareButtons.tsx app/[lang]/condo/[id]/page.tsx
git commit -m "feat(share): add LINE deeplink + copy-URL buttons to condo pages"
```

---

## Task 3: localStorage helpers — saved condos

**Files:**
- Create: `lib/saved-condos.ts`

Pure functions over localStorage. No React imports — usable anywhere (components, hooks, utils).

- [ ] **Step 1: Create `lib/saved-condos.ts`**

```typescript
const KEY = "realdata_saved";
const MAX = 50;

export function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function isSaved(id: string): boolean {
  return getSaved().includes(id);
}

export function getSavedCount(): number {
  return getSaved().length;
}

// Returns the updated list after toggling.
export function toggleSaved(id: string): string[] {
  const current = getSaved();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : current.length < MAX
      ? [...current, id]
      : current; // silently refuse at cap
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSaved(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/saved-condos.ts
git commit -m "feat(saved): add localStorage helpers for saved condos"
```

---

## Task 4: SaveButton component

**Files:**
- Create: `components/SaveButton.tsx`

Client component. Reads `isSaved(id)` on mount (SSR returns false, hydration fixes it). Toggles on click with optimistic UI.

- [ ] **Step 1: Create `components/SaveButton.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { toggleSaved, isSaved } from "@/lib/saved-condos";

type Props = {
  id: string;
  name: string;
};

export function SaveButton({ id, name }: Props) {
  const [saved, setSaved] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    setSaved(isSaved(id));
  }, [id]);

  const onClick = () => {
    const next = toggleSaved(id);
    setSaved(next.includes(id));
    // Dispatch storage event so other tabs / the SavedCount badge update.
    window.dispatchEvent(new Event("realdata-saved-change"));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={saved ? `Remove ${name} from saved` : `Save ${name}`}
      aria-label={saved ? "Remove from saved" : "Save condo"}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl font-semibold text-sm transition border ${
        saved
          ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SaveButton.tsx
git commit -m "feat(saved): add SaveButton client component with localStorage toggle"
```

---

## Task 5: Saved condos page

**Files:**
- Create: `app/api/condos/batch/route.ts`
- Create: `app/[lang]/saved/SavedContent.tsx`
- Create: `app/[lang]/saved/page.tsx`

The page shell is a server component (for metadata). `SavedContent` is a client component that reads localStorage then fetches the batch API.

- [ ] **Step 1: Create `app/api/condos/batch/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { encodeCompact } from "@/lib/condo-compact";
import type { CondoSummary } from "@/lib/queries/condos";

// GET /api/condos/batch?ids=id1,id2,id3
// Returns compact condo summaries for explicit IDs (max 50).
// Used by the saved-condos page to hydrate localStorage IDs server-side.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ v: 1, count: 0, id: [], name: [], region: [], hero: [], bubble: [], superValue: [], flood: [], units: [], sale: [], rent: [], currency: [], type: [], source: [] });
  }

  const supabase = getServerSupabase();
  const [{ data: condoRows }, { data: scoreRows }, { data: riskRows }] = await Promise.all([
    supabase
      .from("condos_published")
      .select(
        "id, name, url, province, hero_image_url, " +
        "total_units, available_units_count, " +
        "market_sale_median, market_rent_median, market_summary_currency, " +
        "property_type, source, is_super_value, regions(name)"
      )
      .in("id", ids),
    supabase
      .from("value_scores")
      .select("condo_id, bubble_index")
      .in("condo_id", ids),
    supabase
      .from("risk_factors")
      .select("condo_id, flood_risk_level")
      .in("condo_id", ids),
  ]);

  const bubbleMap = new Map<string, number | null>();
  for (const s of (scoreRows ?? []) as Array<{ condo_id: string; bubble_index: number | null }>) {
    bubbleMap.set(s.condo_id, s.bubble_index);
  }
  const floodMap = new Map<string, number | null>();
  for (const r of (riskRows ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>) {
    floodMap.set(r.condo_id, r.flood_risk_level);
  }

  // Preserve saved order (ids array order)
  const rows: CondoSummary[] = ids
    .map((id) => {
      const c = (condoRows ?? []).find((r) => (r as { id: string }).id === id);
      if (!c) return null;
      const raw = c as unknown as {
        id: string; name: string; url: string | null; province: string | null;
        hero_image_url: string | null; total_units: number | null;
        available_units_count: number | null; market_sale_median: number | null;
        market_rent_median: number | null; market_summary_currency: string | null;
        property_type: string; source: string; is_super_value: boolean | null;
        regions: { name: string } | { name: string }[] | null;
        latitude: number | null; longitude: number | null;
      };
      const region = (Array.isArray(raw.regions) ? raw.regions[0] : raw.regions)?.name ?? null;
      return {
        id: raw.id, name: raw.name, url: raw.url, province: raw.province ?? "",
        region, latitude: null, longitude: null,
        hero_image_url: raw.hero_image_url,
        bubble_index: bubbleMap.get(raw.id) ?? null,
        is_super_value: raw.is_super_value,
        flood_risk_level: floodMap.get(raw.id) ?? null,
        total_units: raw.total_units, available_units_count: raw.available_units_count,
        market_sale_median: raw.market_sale_median,
        market_rent_median: raw.market_rent_median,
        market_summary_currency: raw.market_summary_currency,
        property_type: raw.property_type as CondoSummary["property_type"],
        source: raw.source,
      } satisfies CondoSummary;
    })
    .filter((r): r is CondoSummary => r !== null);

  const compact = encodeCompact(rows);
  // Strip lat/lng (not needed in saved list, saves bandwidth)
  const { lat: _lat, lng: _lng, ...slim } = compact;
  return NextResponse.json(slim, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
```

- [ ] **Step 2: Create `app/[lang]/saved/SavedContent.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildingCard } from "@/components/BuildingCard";
import { decodeCompact, isCompact } from "@/lib/condo-compact";
import { getSaved, clearSaved } from "@/lib/saved-condos";
import type { CondoSummary } from "@/lib/queries/condos";

type Props = { lang: string };

export function SavedContent({ lang }: Props) {
  const [condos, setCondos] = useState<CondoSummary[] | null>(null); // null = loading

  useEffect(() => {
    const ids = getSaved();
    if (ids.length === 0) {
      setCondos([]);
      return;
    }
    fetch(`/api/condos/batch?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        setCondos(isCompact(data) ? decodeCompact(data) : []);
      })
      .catch(() => setCondos([]));
  }, []);

  const onClear = () => {
    clearSaved();
    setCondos([]);
  };

  if (condos === null) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl aspect-[5/4] animate-pulse" />
        ))}
      </div>
    );
  }

  if (condos.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
        <p className="text-2xl mb-2">🤍</p>
        <p className="mb-1">No saved condos yet.</p>
        <p className="text-sm text-zinc-500">
          Tap the{" "}
          <span className="text-rose-300 font-medium">Save</span> button on any
          condo page to add it here.
        </p>
        <Link
          href={`/${lang}/inventory`}
          className="mt-4 inline-block text-sm text-blue-400 hover:underline"
        >
          Browse condos →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{condos.length} saved condo{condos.length !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-rose-400 transition"
        >
          Clear all
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/[lang]/saved/page.tsx`**

```typescript
import type { Metadata } from "next";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { SavedContent } from "./SavedContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Saved condos — RealData" };
  return {
    title: "Saved condos — RealData",
    description: "Your saved Bangkok condo shortlist.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/saved`,
      languages: langAlternates("/saved"),
    },
    robots: { index: false },
  };
}

export default async function SavedPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Saved condos</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Stored locally in your browser. Clearing browser data will remove this list.
        </p>
      </header>
      <SavedContent lang={isLang(lang) ? lang : "en"} />
    </div>
  );
}
```

- [ ] **Step 4: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

Navigate to `/en/saved`. Should see empty state with "No saved condos yet." message and link to inventory.

- [ ] **Step 6: Commit**

```bash
git add app/api/condos/batch/route.ts app/[lang]/saved/SavedContent.tsx app/[lang]/saved/page.tsx
git commit -m "feat(saved): add saved condos page + batch API route"
```

---

## Task 6: Add SaveButton to condo page + Saved link in nav

**Files:**
- Modify: `app/[lang]/condo/[id]/page.tsx`
- Modify: `app/[lang]/layout.tsx`

- [ ] **Step 1: Add `SaveButton` import + render in condo page**

Add import to `app/[lang]/condo/[id]/page.tsx` (with other imports at top):

```typescript
import { SaveButton } from "@/components/SaveButton";
```

In the JSX, find the `LinkShareButtons` div added in Task 2 and extend it to include `SaveButton` in the same row:

```typescript
{/* Action row: save + share */}
<div className="px-4 sm:px-6 pt-4 space-y-2">
  <div className="flex gap-2">
    <SaveButton id={condoRaw.id} name={condoRaw.name} />
    {/* CompareButton will be added in Task 9 */}
  </div>
  <LinkShareButtons
    url={`${SITE_URL}/${lang}/condo/${condoRaw.id}`}
    title={`${condoRaw.name} (${region}) — RealData report`}
  />
</div>
```

- [ ] **Step 2: Add "Saved" link to nav in `app/[lang]/layout.tsx`**

The `NAV` array is defined at line 84-92. Add a "Saved" entry. The count badge must be client-only (localStorage is not available server-side), so create a small client component inline or as a separate file.

Add a new file `components/SavedNavLink.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSavedCount } from "@/lib/saved-condos";

export function SavedNavLink({ lang }: { lang: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getSavedCount());
    update();
    window.addEventListener("realdata-saved-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("realdata-saved-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <Link
      href={`/${lang}/saved`}
      className="relative px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
    >
      Saved
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
```

Then in `app/[lang]/layout.tsx`, add the import and render `SavedNavLink` inside the desktop nav section:

```typescript
import { SavedNavLink } from "@/components/SavedNavLink";
```

In the desktop nav (`<div className="hidden sm:flex items-center gap-1 sm:gap-3">`), add after the mapped NAV links:

```typescript
<SavedNavLink lang={lang} />
```

Also update `MobileMenu` — check `components/MobileMenu.tsx` and add a plain link to `/saved` there too if it accepts a `links` array (it already receives `links={NAV}` — add a saved entry to NAV or handle separately if MobileMenu renders it differently).

- [ ] **Step 3: Check MobileMenu component**

Read `components/MobileMenu.tsx`. If it renders the `links` prop array, add saved to the NAV array:

```typescript
const NAV = [
  { href: `/${lang}/flood`, label: t.nav.flood },
  { href: `/${lang}/inventory`, label: t.nav.inventory },
  { href: `/${lang}/reality`, label: t.nav.reality },
  { href: `/${lang}/data`, label: t.nav.data },
  { href: `/${lang}/blog`, label: t.nav.blog },
  { href: `/${lang}/about`, label: t.nav.about },
  { href: `/${lang}/contact`, label: t.nav.contact },
  { href: `/${lang}/saved`, label: "Saved" },
];
```

(The count badge is desktop-only; mobile just shows the text link.)

- [ ] **Step 4: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

1. Visit any condo page. Confirm "Save" button appears.
2. Click it. Button should turn rose-colored and show "Saved".
3. Navigate to `/en/saved`. The condo should appear in the grid.
4. The nav should show a "1" badge on "Saved".
5. Click "Save" again → button resets, condo disappears from `/saved`.

- [ ] **Step 6: Commit**

```bash
git add components/SaveButton.tsx components/SavedNavLink.tsx app/[lang]/condo/[id]/page.tsx app/[lang]/layout.tsx
git commit -m "feat(saved): wire SaveButton to condo page and add Saved nav link with count badge"
```

---

## Task 7: localStorage helpers — compare queue

**Files:**
- Create: `lib/compare-queue.ts`

- [ ] **Step 1: Create `lib/compare-queue.ts`**

```typescript
const KEY = "realdata_compare";
const MAX = 3;

export function getQueue(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function isQueued(id: string): boolean {
  return getQueue().includes(id);
}

export function getQueueCount(): number {
  return getQueue().length;
}

// Returns { next: string[], added: boolean }
// added=false when already at max and the id is not already in queue.
export function toggleQueue(id: string): { next: string[]; added: boolean } {
  const current = getQueue();
  if (current.includes(id)) {
    const next = current.filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
    return { next, added: false };
  }
  if (current.length >= MAX) {
    return { next: current, added: false }; // at cap
  }
  const next = [...current, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  return { next, added: true };
}

export function clearQueue(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/compare-queue.ts
git commit -m "feat(compare): add localStorage helpers for compare queue"
```

---

## Task 8: CompareButton component

**Files:**
- Create: `components/CompareButton.tsx`

- [ ] **Step 1: Create `components/CompareButton.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { toggleQueue, isQueued, getQueueCount } from "@/lib/compare-queue";

type Props = {
  id: string;
  name: string;
};

export function CompareButton({ id, name }: Props) {
  const [queued, setQueued] = useState(false);
  const [atCap, setAtCap] = useState(false);

  useEffect(() => {
    const update = () => {
      setQueued(isQueued(id));
      setAtCap(getQueueCount() >= 3 && !isQueued(id));
    };
    update();
    window.addEventListener("realdata-compare-change", update);
    return () => window.removeEventListener("realdata-compare-change", update);
  }, [id]);

  const onClick = () => {
    const { next } = toggleQueue(id);
    setQueued(next.includes(id));
    setAtCap(next.length >= 3 && !next.includes(id));
    window.dispatchEvent(new Event("realdata-compare-change"));
  };

  const disabled = atCap;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        queued
          ? `Remove ${name} from compare`
          : atCap
            ? "Compare is full (max 3). Remove one first."
            : `Add ${name} to compare`
      }
      aria-label={queued ? "Remove from compare" : "Add to compare"}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl font-semibold text-sm transition border disabled:opacity-40 disabled:cursor-not-allowed ${
        queued
          ? "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="2" y="3" width="6" height="18" rx="1"/>
        <rect x="9" y="3" width="6" height="18" rx="1"/>
        <rect x="16" y="3" width="6" height="18" rx="1"/>
      </svg>
      {queued ? "In compare" : "Compare"}
    </button>
  );
}
```

- [ ] **Step 2: Add `CompareButton` to condo page**

In `app/[lang]/condo/[id]/page.tsx`, add import:

```typescript
import { CompareButton } from "@/components/CompareButton";
```

In the action row added in Task 6, add `CompareButton` next to `SaveButton`:

```typescript
<div className="flex gap-2">
  <SaveButton id={condoRaw.id} name={condoRaw.name} />
  <CompareButton id={condoRaw.id} name={condoRaw.name} />
</div>
```

- [ ] **Step 3: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/CompareButton.tsx app/[lang]/condo/[id]/page.tsx
git commit -m "feat(compare): add CompareButton client component to condo pages"
```

---

## Task 9: CompareTray (persistent bottom bar)

**Files:**
- Create: `components/CompareTray.tsx`
- Modify: `app/[lang]/layout.tsx`

The tray lives in the layout so it persists across all pages. It's fixed to the bottom, only visible when ≥1 condo is in the compare queue.

- [ ] **Step 1: Create `components/CompareTray.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getQueue, clearQueue } from "@/lib/compare-queue";

export function CompareTray() {
  const [queue, setQueue] = useState<string[]>([]);
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) ?? "en";

  useEffect(() => {
    const update = () => setQueue(getQueue());
    update();
    window.addEventListener("realdata-compare-change", update);
    return () => window.removeEventListener("realdata-compare-change", update);
  }, []);

  if (queue.length === 0) return null;

  const compareHref = `/${lang}/compare?${queue.map((id, i) => `${"abc"[i]}=${id}`).join("&")}`;

  const onClear = () => {
    clearQueue();
    setQueue([]);
    window.dispatchEvent(new Event("realdata-compare-change"));
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 sm:px-6">
      <div className="text-sm text-zinc-300">
        <span className="font-semibold text-white">{queue.length}</span>
        {" / 3 condos selected for comparison"}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => router.push(compareHref)}
          disabled={queue.length < 2}
          title={queue.length < 2 ? "Select at least 2 condos to compare" : ""}
          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
        >
          Compare {queue.length < 2 ? "(need 2+)" : "→"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `CompareTray` to layout**

In `app/[lang]/layout.tsx`, add the import:

```typescript
import { CompareTray } from "@/components/CompareTray";
```

In the `return` JSX, add `<CompareTray />` right before the `<footer>` closing tag (so it overlays the page content from the bottom without pushing content up):

```typescript
      <main className="flex-1">{children}</main>

      <CompareTray />

      <footer className="mt-12 border-t border-zinc-900 bg-zinc-950">
```

- [ ] **Step 3: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. Visit a condo page. Click "Compare". Bottom tray appears: "1 / 3 condos selected for comparison".
2. Visit another condo page. Click "Compare". Tray shows "2 / 3…".
3. "Compare →" button becomes enabled. Click it. Should navigate to `/en/compare?a=ID&b=ID`.
4. Compare page loads with both condos in the table.
5. Click "Clear" in tray — queue clears, tray disappears.

- [ ] **Step 5: Commit**

```bash
git add components/CompareTray.tsx app/[lang]/layout.tsx
git commit -m "feat(compare): add persistent CompareTray bottom bar to layout"
```

---

## Task 10: Copy link button on compare page

**Files:**
- Modify: `app/[lang]/compare/page.tsx`

Small addition: a "Copy comparison link" button at the top of the compare results section, so users can share a multi-condo comparison via URL.

- [ ] **Step 1: Create `components/CopyLinkButton.tsx`**

```typescript
"use client";

import { useState } from "react";

type Props = { label?: string };

export function CopyLinkButton({ label = "Copy comparison link" }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition"
    >
      {copied ? (
        "✓ Copied!"
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Add `CopyLinkButton` to compare page header**

In `app/[lang]/compare/page.tsx`, add import:

```typescript
import { CopyLinkButton } from "@/components/CopyLinkButton";
```

In the `<header>` section (lines 115-123 of compare page), add the button after the `<p>` description:

```typescript
<header className="space-y-2">
  <h1 className="text-3xl font-bold">Compare condos</h1>
  <p className="text-zinc-400 text-sm max-w-2xl">
    Head-to-head comparison of up to 3 Bangkok condos. Add condos by
    clicking <strong className="text-zinc-300">&quot;Compare with…&quot;</strong> on any
    condo page, or paste ids into the URL as{" "}
    <code className="text-zinc-300">?a=ID&amp;b=ID&amp;c=ID</code>.
  </p>
  {condos.length >= 2 && <CopyLinkButton />}
</header>
```

- [ ] **Step 3: Build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

Navigate to `/en/compare?a=ID&b=ID`. Header should show "Copy comparison link" button. Click → shows "✓ Copied!". Paste in a new tab → loads the same comparison.

- [ ] **Step 5: Commit**

```bash
git add components/CopyLinkButton.tsx app/[lang]/compare/page.tsx
git commit -m "feat(compare): add copy-link button to compare page header"
```

---

## Task 11: Deploy

- [ ] **Step 1: Final build check**

```bash
cd web && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 2: Push to main (triggers Vercel deploy)**

```bash
git push origin main
```

Expected: Vercel builds the `web/` root directory (Ignored Build Step confirms `web/` changed → exit 0 → BUILD proceeds).

- [ ] **Step 3: Smoke test on production**

1. Visit any condo page on production. Confirm:
   - "Save" + "Compare" buttons visible
   - LINE + Copy link buttons visible
   - Sharing on LINE shows the OG image card
2. Visit `/en/saved` — empty state page loads.
3. Save 2 condos → compare tray appears → click "Compare →" → compare table loads → "Copy comparison link" shows.

---

## Self-Review

**Spec coverage:**
- ✅ OG image fix + yield in description — Task 1
- ✅ LINE share button — Task 2
- ✅ Favorites/Watchlist (localStorage, no login) — Tasks 3, 4, 5, 6
- ✅ "Add to compare" button on condo pages — Tasks 7, 8, 9
- ✅ Compare page share button — Task 10

**Placeholder scan:** No TBDs or incomplete steps. All code is complete.

**Type consistency:**
- `getSaved()` / `isSaved()` / `toggleSaved()` / `clearSaved()` / `getSavedCount()` — used consistently in SaveButton, SavedNavLink, SavedContent
- `getQueue()` / `isQueued()` / `toggleQueue()` / `clearQueue()` / `getQueueCount()` — used consistently in CompareButton, CompareTray
- `CondoSummary` type from `@/lib/queries/condos` — used in batch route and SavedContent
- `decodeCompact` / `isCompact` from `@/lib/condo-compact` — used in SavedContent
- `BuildingCard` takes `{ condo: CondoSummary; hrefPrefix?: string }` — correct in SavedContent
