import type { Lang } from "@/lib/i18n";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "dl"; items: { k: string; v: string }[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  /** Meta description and the page's lead paragraph. */
  lead: string;
  /** Rendered as "Last updated {effective}". ISO date. */
  effective: string;
  sections: LegalSection[];
};

export type LegalDocumentSet = Record<Lang, LegalDocument>;
