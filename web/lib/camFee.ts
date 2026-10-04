/**
 * Which CAM-fee readings are safe to show.
 *
 * `condos.cam_fee_per_month` comes from a FazWaz unit chip ("CAM Fee: ฿X"),
 * and the chip is not always a monthly fee for a unit. Measured across the
 * 3,076 buildings that carry a value (2026-10-04):
 *
 *     < ฿200       106 rows   a ฿/sqm rate (35, 70) or junk (1, 3)
 *     ฿200-60,000  2,896 rows a monthly fee for one unit — what we want
 *     > ฿60,000    74 rows    a parse error; the worst reads ฿20,199,600/mo
 *
 * The top of the band is deliberately generous: a Phuket pool villa really
 * can run ฿40,000 a month. Nothing above it is a fee.
 *
 * Used by the condo page's cost card, the retiree ranking and the /fees
 * pages, so one bad row cannot move a median or print a nonsense number on a
 * building page. src/scrapers/fazwaz.py drops the same range at capture.
 */
export const CAM_FEE_MIN = 200;
export const CAM_FEE_MAX = 60_000;

export function plausibleCamFee(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < CAM_FEE_MIN || n > CAM_FEE_MAX) return null;
  return n;
}
