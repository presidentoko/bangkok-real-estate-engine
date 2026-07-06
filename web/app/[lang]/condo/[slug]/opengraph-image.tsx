import { ImageResponse } from "next/og";
import { getServerSupabase } from "@/lib/supabase";

// Edge runtime is required on Windows: the nodejs runtime hits a @vercel/og
// font path bug ("Invalid URL: .\file:\...noto-sans...ttf"). Documented in
// PROJECTS.md and the bangkok engine memos.
export const runtime = "edge";
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "RealData — Bangkok condo report card";

const FLOOD_COLOR: Record<number, string> = {
  5: "#dc2626",
  4: "#fb923c",
  3: "#facc15",
  2: "#84cc16",
  1: "#10b981",
  0: "#3f3f46",
};

type Lang = "en" | "ko" | "th";

const FLOOD_LABEL: Record<Lang, Record<number, string>> = {
  en: { 5: "Severe", 4: "High", 3: "Moderate", 2: "Low", 1: "Very low", 0: "—" },
  ko: { 5: "심각", 4: "높음", 3: "보통", 2: "낮음", 1: "매우 낮음", 0: "—" },
  th: { 5: "รุนแรง", 4: "สูง", 3: "ปานกลาง", 2: "ต่ำ", 1: "ต่ำมาก", 0: "—" },
};

const LABELS: Record<Lang, {
  tagline: string;
  bubbleHeader: string;
  floodHeader: string;
  bubbleNoData: string;
  bubbleHigh: string;
  bubbleSlightlyHigh: string;
  bubbleLow: string;
  bubbleSlightlyLow: string;
  bubbleFair: string;
  totalUnits: (n: number) => string;
  available: (n: number) => string;
  footer: string;
}> = {
  en: {
    tagline: "powered by data, not influencers",
    bubbleHeader: "PRICE vs DISTRICT",
    floodHeader: "FLOOD RISK",
    bubbleNoData: "no data",
    bubbleHigh: "Bubble suspect",
    bubbleSlightlyHigh: "Slightly above market",
    bubbleLow: "Underpriced",
    bubbleSlightlyLow: "Slightly below market",
    bubbleFair: "Fair value",
    totalUnits: (n) => `${n} units total`,
    available: (n) => `${n} available now`,
    footer: "independent measurement",
  },
  ko: {
    tagline: "powered by data, not influencers",
    bubbleHeader: "가격 (vs 같은 구)",
    floodHeader: "침수 위험",
    bubbleNoData: "데이터 부족",
    bubbleHigh: "거품 의심",
    bubbleSlightlyHigh: "약간 비쌈",
    bubbleLow: "저평가",
    bubbleSlightlyLow: "약간 저렴",
    bubbleFair: "시세 적정",
    totalUnits: (n) => `총 ${n} units`,
    available: (n) => `현재 매물 ${n}`,
    footer: "독립 측정 · 데이터 기반",
  },
  th: {
    tagline: "ใช้ข้อมูล ไม่ใช่อินฟลูเอนเซอร์",
    bubbleHeader: "ราคา (เทียบเขต)",
    floodHeader: "น้ำท่วม",
    bubbleNoData: "ไม่มีข้อมูล",
    bubbleHigh: "ฟองสบู่",
    bubbleSlightlyHigh: "สูงกว่าตลาดเล็กน้อย",
    bubbleLow: "ต่ำกว่ามูลค่า",
    bubbleSlightlyLow: "ต่ำกว่าตลาดเล็กน้อย",
    bubbleFair: "ราคาปกติ",
    totalUnits: (n) => `${n} ยูนิต`,
    available: (n) => `ว่าง ${n}`,
    footer: "ข้อมูลอิสระ · ใช้การวัดของเรา",
  },
};

function isLang(s: string): s is Lang {
  return s === "en" || s === "ko" || s === "th";
}

function bubbleColor(b: number | null): string {
  if (b == null) return "#a1a1aa";
  if (b > 130) return "#dc2626";
  if (b > 110) return "#fb923c";
  if (b < 70) return "#10b981";
  if (b < 90) return "#84cc16";
  return "#a1a1aa";
}

function bubbleLabel(b: number | null, t: typeof LABELS["en"]): string {
  if (b == null) return t.bubbleNoData;
  if (b > 130) return t.bubbleHigh;
  if (b > 110) return t.bubbleSlightlyHigh;
  if (b < 70) return t.bubbleLow;
  if (b < 90) return t.bubbleSlightlyLow;
  return t.bubbleFair;
}

const UUID_RE_OG =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OG({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang: langParam } = await params;
  const lang: Lang = isLang(langParam) ? langParam : "en";
  const t = LABELS[lang];

  let name = "Bangkok Condo";
  let region = "Bangkok";
  let bubble: number | null = null;
  let flood: number | null = null;
  let units: number | null = null;
  let avail: number | null = null;
  try {
    const supabase = getServerSupabase();
    // Support both legacy UUID params and new slug params.
    const condoQuery = UUID_RE_OG.test(slug)
      ? supabase.from("condos_published").select("id, name, regions(name), total_units, available_units_count").eq("id", slug).maybeSingle()
      : supabase.from("condos_published").select("id, name, regions(name), total_units, available_units_count").eq("slug", slug).maybeSingle();
    const { data: condoData } = await condoQuery;
    const id = (condoData as unknown as { id: string } | null)?.id ?? slug;
    const [{ data: condo }, { data: score }, { data: risk }] = await Promise.all([
      Promise.resolve({ data: condoData }),
      supabase.from("value_scores").select("bubble_index").eq("condo_id", id).maybeSingle(),
      supabase.from("risk_factors").select("flood_risk_level").eq("condo_id", id).maybeSingle(),
    ]);
    if (condo) {
      const c = condo as unknown as {
        name: string;
        regions: { name: string } | { name: string }[] | null;
        total_units: number | null;
        available_units_count: number | null;
      };
      name = c.name;
      region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "Bangkok";
      units = c.total_units;
      avail = c.available_units_count;
    }
    if (score?.bubble_index != null) bubble = Number(score.bubble_index);
    if (risk?.flood_risk_level != null) flood = Number(risk.flood_risk_level);
  } catch {
    /* fall back to defaults */
  }

  const above = bubble != null ? Math.round(bubble - 100) : null;
  const aboveTxt =
    above == null ? "—" : above > 0 ? `+${above}%` : above < 0 ? `${above}%` : "0%";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 64px",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #111827 60%, #0a0a0a 100%)",
          color: "white",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#60a5fa",
              letterSpacing: -0.5,
            }}
          >
            RealData
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#71717a" }}>
            {t.tagline}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa", letterSpacing: 0.5 }}>
            {region}, Bangkok
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.05,
              marginTop: 4,
              maxWidth: 1080,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 48 }}>
          {/* Bubble Index card */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "26px 30px",
              borderRadius: 22,
              background: "#18181b",
              border: "1px solid #27272a",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 16,
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                fontWeight: 700,
              }}
            >
              {t.bubbleHeader}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 84,
                  fontWeight: 900,
                  letterSpacing: -3,
                  lineHeight: 1,
                  color: bubbleColor(bubble),
                }}
              >
                {aboveTxt}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#e4e4e7",
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              {bubbleLabel(bubble, t)}
            </div>
          </div>

          {/* Flood card */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "26px 30px",
              borderRadius: 22,
              background: "#18181b",
              border: "1px solid #27272a",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 16,
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: 1.2,
                fontWeight: 700,
              }}
            >
              {t.floodHeader}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 84,
                  fontWeight: 900,
                  letterSpacing: -3,
                  lineHeight: 1,
                  color: flood != null ? FLOOD_COLOR[flood] : "#a1a1aa",
                }}
              >
                L{flood ?? "—"}
              </div>
              <div style={{ display: "flex", fontSize: 32, color: "#71717a", fontWeight: 600 }}>
                / 5
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#e4e4e7",
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              {flood != null ? FLOOD_LABEL[lang][flood] : "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "auto",
            paddingTop: 24,
            color: "#52525b",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            {units != null && <span>{t.totalUnits(units)}</span>}
            {avail != null && <span>{t.available(avail)}</span>}
          </div>
          <div style={{ display: "flex" }}>{t.footer}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
