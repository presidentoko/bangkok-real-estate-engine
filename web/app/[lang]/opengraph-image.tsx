import { ImageResponse } from "next/og";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "RealData — Bangkok condo buildings mapped, no influencer marketing";

export default async function OG() {
  // Best-effort live count; fall back to a hardcoded floor if DB is offline.
  let total = 1088;
  try {
    const supabase = getServerSupabase();
    const { count } = await supabase
      .from("condos_published")
      .select("id", { count: "exact", head: true })
      .eq("source", "hipflat");
    if (typeof count === "number" && count > 0) total = count;
  } catch {
    /* keep fallback */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)",
          color: "white",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: "#60a5fa",
            letterSpacing: -1,
          }}
        >
          RealData
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            marginTop: 32,
          }}
        >
          <div style={{ fontSize: 168, fontWeight: 900, letterSpacing: -6, lineHeight: 1 }}>
            {total.toLocaleString()}
          </div>
          <div style={{ fontSize: 42, color: "#a1a1aa", fontWeight: 600 }}>
            condo buildings
          </div>
        </div>

        <div
          style={{
            fontSize: 38,
            color: "#e4e4e7",
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          mapped across Bangkok
        </div>

        <div
          style={{
            fontSize: 26,
            color: "#52525b",
            marginTop: 56,
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          no influencer marketing · no paid placement
        </div>
      </div>
    ),
    { ...size }
  );
}
