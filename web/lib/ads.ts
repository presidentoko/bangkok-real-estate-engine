// Ad configuration, in one place, behind one environment variable.
//
// NEXT_PUBLIC_ADSENSE_CLIENT holds the publisher ID in its full form,
// "ca-pub-0000000000000000". While it is unset — which is the state until
// AdSense actually approves the site — every ad surface renders nothing, the
// loader script is not emitted, and /ads.txt 404s. Nothing about the page
// changes. That is deliberate: shipping an empty <ins class="adsbygoogle">
// or an ads.txt naming a publisher who has not approved us is the kind of
// thing that gets an application rejected before a human ever looks at it.
//
// To go live after approval: set the variable in Vercel (Production), then
// redeploy. To pull ads immediately: unset it and redeploy. There is no
// second switch to remember.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export const adsEnabled = (): boolean => /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);

// Slot IDs come from the AdSense UI, one per unit, and are set alongside the
// client ID. A slot with no ID configured stays reserved but empty rather
// than rendering a broken unit.
//
// The placement rules these encode, and why:
//   - Nothing above the fold. The hero is the LCP element on every page type
//     here, and an ad that pushes it down costs more in Core Web Vitals (and
//     therefore ranking, and therefore traffic) than the unit earns.
//   - Nothing inside a table. The wide tables on /yields, /district and
//     /inventory scroll horizontally on mobile; an ad in a row breaks the
//     column alignment the whole page is for.
//   - Nothing in the same block as the Trip.com affiliate card or a lead
//     capture CTA — lib/affiliates.ts:9-12 already sets the no-double-
//     monetise rule and it applies here too.
export const AD_SLOTS = {
  /** Condo detail, after the building-facts section. */
  condoMid: process.env.NEXT_PUBLIC_AD_SLOT_CONDO_MID ?? "",
  /** Condo detail, after the metrics card stack. */
  condoLower: process.env.NEXT_PUBLIC_AD_SLOT_CONDO_LOWER ?? "",
  /** Below the main table/list on a hub page. */
  hubBelow: process.env.NEXT_PUBLIC_AD_SLOT_HUB_BELOW ?? "",
  /** In-article, for blog posts and guides. */
  article: process.env.NEXT_PUBLIC_AD_SLOT_ARTICLE ?? "",
} as const;

export type AdSlotName = keyof typeof AD_SLOTS;
