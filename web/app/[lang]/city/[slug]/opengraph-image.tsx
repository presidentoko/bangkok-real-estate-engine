import { ImageResponse } from "next/og";
import { getCity } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "edge";
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "RealData — independent condo data report";

export default async function CityOG({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  const city = getCity(slug);
  if (!city) {
    return new ImageResponse(<div>RealData</div>, { ...size });
  }

  let total = 0;
  let bubbleCount = 0;
  try {
    const supabase = getServerSupabase();
    const totalRes = await supabase
      .from("condos_published")
      .select("id", { count: "exact", head: true })
      .eq("province", slug);
    total = totalRes.count ?? 0;

    // bubble_index coverage = how many of those have a value_score row.
    const ids = await supabase
      .from("condos_published")
      .select("id")
      .eq("province", slug)
      .limit(1000);
    const idList = (ids.data ?? []).map((r) => r.id as string);
    if (idList.length) {
      let scored = 0;
      for (let i = 0; i < idList.length; i += 200) {
        const chunk = idList.slice(i, i + 200);
        const r = await supabase
          .from("value_scores")
          .select("condo_id", { count: "exact", head: true })
          .in("condo_id", chunk);
        scored += r.count ?? 0;
      }
      bubbleCount = scored;
    }
  } catch {
    /* fall through with zeros */
  }

  const langKey = (lang === "ko" || lang === "th" ? lang : "en") as "en" | "ko" | "th";
  const cityName = city.name[langKey];
  const tagline = city.tagline[langKey];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)",
          color: "white",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        {/* Top: brand + city pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#60a5fa",
              letterSpacing: -1,
            }}
          >
            RealData
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#52525b",
              borderLeft: "2px solid #27272a",
              paddingLeft: 16,
              fontWeight: 500,
            }}
          >
            {cityName}
          </div>
        </div>

        {/* Middle: city + stats */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 144,
              fontWeight: 900,
              letterSpacing: -6,
              lineHeight: 1,
              background: "linear-gradient(180deg, #fafafa 0%, #a1a1aa 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {cityName}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a1a1aa",
              marginTop: 18,
              fontWeight: 500,
              maxWidth: 1000,
              lineHeight: 1.3,
            }}
          >
            {tagline}
          </div>
        </div>

        {/* Bottom: stat bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
              {total.toLocaleString()}
            </div>
            <div style={{ fontSize: 18, color: "#71717a", marginTop: 4 }}>
              condo buildings
            </div>
          </div>
          {bubbleCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: "#34d399" }}>
                {bubbleCount.toLocaleString()}
              </div>
              <div style={{ fontSize: 18, color: "#71717a", marginTop: 4 }}>
                with Bubble Index
              </div>
            </div>
          )}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 18,
              color: "#52525b",
              fontWeight: 500,
              letterSpacing: 0.5,
            }}
          >
            no influencer marketing · no paid placement
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
