/**
 * How the Bank of Thailand MRR benchmark is printed next to a yield.
 *
 * The figure comes from macro_indicators (scripts/ingest_bot.py), whose source
 * page (BOT BTWS_STAT report 223) stopped publishing after 2025-07: a fresh
 * ingest on 2026-11-17 still returned 2025-07 as the newest month. Every
 * spread on the site was nonetheless worded as "the current Thai MRR" (data
 * audit H4). The rate is therefore always printed with the month it is
 * from, so a reader can see how old the benchmark is. No rate is invented.
 */
import type { Lang } from "./i18n";

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ko: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
};

/** "Jul 2025" / "2025년 7월" / "ก.ค. 2025" from a YYYY-MM-DD period. */
export function mrrMonth(period: string | null | undefined, lang: Lang = "en"): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(period ?? "");
  if (!m) return null;
  const month = MONTHS[lang][Number(m[2]) - 1];
  if (!month) return null;
  return lang === "ko" ? `${m[1]}년 ${month}` : `${month} ${m[1]}`;
}

/** "7.10% (Jul 2025)" -- the rate with its as-of month. */
export function mrrLabel(rate: number, period: string | null | undefined, lang: Lang = "en"): string {
  const month = mrrMonth(period, lang);
  const asOf = month == null ? "" : lang === "ko" ? ` (${month} 기준)` : lang === "th" ? ` (ณ ${month})` : ` (as of ${month})`;
  return `${rate.toFixed(2)}%${asOf}`;
}
