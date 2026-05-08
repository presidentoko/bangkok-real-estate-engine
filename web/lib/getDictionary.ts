import en from "./dictionaries/en";
import ko from "./dictionaries/ko";
import th from "./dictionaries/th";
import { type Lang } from "./i18n";

const DICTIONARIES = { en, ko, th };

export function getDictionary(lang: Lang) {
  return DICTIONARIES[lang] ?? DICTIONARIES.en;
}
