# User Retention & Viral Growth — Design Spec
**Date:** 2026-06-13  
**Target users:** Expats considering relocation (B) + Thai locals tracking the market (C)  
**User behavior:** Go deep into individual condo pages; no way to save or share research

---

## Problem

Users research condos thoroughly but the site has no memory. Closing a tab loses all research. No way to save a shortlist, no easy share path, no "Add to compare" on the page that matters.

---

## Scope (4 features, ~3-4 days total)

### 1. OG Image Fix + LINE Share Button (30 min)

**What:** `generateMetadata()` in `/app/[lang]/condo/[id]/page.tsx` doesn't reference the existing `opengraph-image.tsx`. Fix: add `images` array to metadata. Also add yield% to OG description. Add LINE share button next to existing ShareButton (LINE deeplink: `https://line.me/R/msg/text/?{encoded_url}`).

**Why:** OG image card (bubble index + flood risk) already renders beautifully — it just isn't linked. LINE is primary sharing channel for Thai users.

**Files:** `app/[lang]/condo/[id]/page.tsx`, `components/ShareButton.tsx`

---

### 2. Favorites / Watchlist (2 days)

**What:** Heart button on every condo page + card. Saves condo IDs to `localStorage["realdata_saved"]`. New `/saved` page lists saved condos using the existing inventory grid/card components.

**Architecture:**
- `lib/saved-condos.ts` — pure functions: `getSaved()`, `toggleSaved(id)`, `isSaved(id)` (localStorage wrapper)
- `components/SaveButton.tsx` — heart icon, reads/writes via lib, client component
- `app/[lang]/saved/page.tsx` — fetches condo summaries for saved IDs from Supabase, renders using existing `CondoCard`
- Nav link to `/saved` showing count badge

**No login required.** localStorage only. Max 50 saved condos (soft cap, warn at 45).

**Why:** Users comparing 3-10 condos before deciding. Losing research = no return visit.

---

### 3. "Add to Compare" Button + Compare Share (1 day)

**What:** "Compare" button on condo pages and cards. Manages up to 3 condos in localStorage. Floating compare tray at bottom of screen shows selected count + "View comparison" CTA. Compare page gets a "Copy link" button.

**Architecture:**
- `lib/compare-queue.ts` — `getQueue()`, `toggleQueue(id)`, `clearQueue()` (localStorage, max 3)
- `components/CompareButton.tsx` — "Compare" toggle button, reads from lib
- `components/CompareTray.tsx` — fixed bottom bar, appears when 1+ condos queued, links to `/compare?a=...&b=...&c=...`
- Compare page: add "Copy link" button (copies `window.location.href`)

**Why:** Compare page already has shareable URL format (`?a=ID&b=ID&c=ID`), just missing the entry point from condo pages.

---

## What's NOT in scope

- User accounts / cloud sync (localStorage is sufficient for v1)
- BTS data (already fully implemented)
- Push notifications
- Social login

---

## Success criteria

- Condo page sharing on LINE shows the OG image card (bubble + flood)
- User can save a shortlist and return to it next visit
- User can queue 2-3 condos from individual pages and jump to comparison
- Compare URL is copyable and shareable
