// Supported UI languages. EN is default — Bangkok real-estate market lingua
// franca. TH for locals, KO for the founder's home market (fuckinfluencer.com
// audience). Order matters for fallback (EN tried first, then KO, then TH).

export const LANGS = ["en", "ko", "th"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

export const LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  ko: "한국어",
  th: "ไทย",
};

export function isLang(s: string): s is Lang {
  return (LANGS as readonly string[]).includes(s);
}
