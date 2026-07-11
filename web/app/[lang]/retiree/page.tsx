import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, cityProvinceSlugs } from "@/lib/cities";
import { isLang, type Lang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Retiree-Friendly Condos in Thailand" };
  const title = "Best Condos for Retirees in Thailand 2026 — Bangkok, Phuket, Chiang Mai | RealData";
  const description =
    "Thailand condos ranked for retiree suitability — healthcare access (hospitals within 1km), air quality (AQI), BTS/MRT transit, and daily errands. Bangkok, Phuket, Pattaya, Chiang Mai and more. No developer sponsorships.";
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/retiree`,
      languages: langAlternates("/retiree"),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/retiree`,
      type: "website",
    },
  };
}

type CityScore = {
  slug: string;
  count: number;
  avgScore: number | null;
  topScore: number | null;
};

const CITY_META: Record<string, {
  tagline: { en: string; ko: string; th: string };
  highlight: { en: string; ko: string; th: string };
  watch: { en: string; ko: string; th: string };
}> = {
  bangkok: {
    tagline: { en: "Hospitals + BTS everywhere", ko: "어디나 병원 + BTS", th: "โรงพยาบาล + BTS ทั่วเมือง" },
    highlight: { en: "Bumrungrad, Samitivej, BNH — all JCI-accredited. BTS/MRT within 500m of most condos.", ko: "범룽랏·사미티벳·BNH 모두 JCI 인증. 대부분 콘도 500m 내 BTS/MRT.", th: "บำรุงราษฎร์ สมิติเวช BNH ล้วน JCI BTS/MRT ห่างจากคอนโดส่วนใหญ่ไม่เกิน 500 เมตร" },
    watch: { en: "Traffic + air quality (PM2.5) peaks Nov–Feb. Choose condos near BTS to avoid car dependency.", ko: "11~2월 교통·공기질(PM2.5) 최악. BTS 근처 콘도로 자가용 의존 방지.", th: "ปัญหาจราจร + PM2.5 พุ่งสูง พ.ย.–ก.พ. เลือกคอนโดใกล้ BTS ลดการพึ่งพารถยนต์" },
  },
  phuket: {
    tagline: { en: "Beach + hospitals", ko: "해변 + 병원", th: "หาด + โรงพยาบาล" },
    highlight: { en: "Bangkok Hospital Phuket (JCI-accredited) + clean sea air", ko: "국제 인증 방콕 병원 푸켓 + 맑은 해양 공기", th: "Bangkok Hospital ภูเก็ต (JCI) + อากาศทะเลสะอาด" },
    watch: { en: "Car-dependent outside Patong. Beach premium adds 30–60% to condo prices.", ko: "빠통 외 자가용 필수. 해변 프리미엄 30~60% 추가.", th: "นอกป่าตองต้องมีรถ ราคาคอนโดบวกพรีเมียมหาด 30–60%" },
  },
  pattaya: {
    tagline: { en: "Biggest expat community", ko: "최대 외국인 커뮤니티", th: "ชุมชนต่างชาติใหญ่สุด" },
    highlight: { en: "Bangkok Hospital Pattaya + 2 hrs to Bangkok by bus for specialist care", ko: "방콕 파타야 병원 + 버스 2시간으로 방콕 전문의 접근", th: "Bangkok Hospital พัทยา + รถบัส 2 ชม. ถึงกรุงเทพ" },
    watch: { en: "Car-dependent city. Central Pattaya nightlife noise — choose condos in Jomtien or North Pattaya.", ko: "자가용 의존. 중심부 유흥가 소음 — 좀티엔이나 북파타야 콘도 추천.", th: "ต้องมีรถ เสียงบันเทิงพัทยากลาง — เลือกคอนโดหาดจอมเทียนหรือพัทยาเหนือ" },
  },
  chiangmai: {
    tagline: { en: "Cheapest + best hospitals", ko: "최저가 + 최고 병원 밀도", th: "ถูกสุด + โรงพยาบาลดีสุด" },
    highlight: { en: "3 major hospitals within the city. Lowest cost of living in Thailand.", ko: "시내 대형 병원 3개. 태국 최저 생활비.", th: "โรงพยาบาลใหญ่ 3 แห่งในเมือง ค่าครองชีพถูกสุดในไทย" },
    watch: { en: "Severe smoke season Jan–Apr. AQI regularly hits 200–300. Plan to travel during this window.", ko: "1~4월 극심한 연무. AQI 200~300 달성. 이 기간엔 여행 계획 필수.", th: "หมอกควันรุนแรง ม.ค.–เม.ย. AQI ถึง 200–300 วางแผนท่องเที่ยวช่วงนี้" },
  },
  huahin: {
    tagline: { en: "Cleanest air + quietest life", ko: "최고 공기 + 가장 조용한 생활", th: "อากาศดีสุด + เงียบสุด" },
    highlight: { en: "Gulf breeze keeps PM2.5 below 30 year-round. Strong Scandinavian retiree community.", ko: "걸프 바람으로 PM2.5 연중 30 이하. 강한 스칸디나비아 은퇴자 커뮤니티.", th: "ลมอ่าวไทยทำ PM2.5 ต่ำกว่า 30 ตลอดปี ชุมชนสแกนดิเนเวียแข็งแกร่ง" },
    watch: { en: "One major hospital only. Complex procedures require a 3-hr trip to Bangkok.", ko: "대형 병원 1개뿐. 복잡한 수술은 방콕 3시간.", th: "โรงพยาบาลใหญ่แห่งเดียว การรักษาซับซ้อนต้องไปกรุงเทพ 3 ชม." },
  },
  chonburi: {
    tagline: { en: "Greater Pattaya zone", ko: "광역 파타야 권역", th: "เขตพัทยาขยาย" },
    highlight: { en: "Industrial corridor with hospital access via Pattaya. Lower prices than central Pattaya.", ko: "파타야 병원 접근 가능한 산업 지역. 파타야 중심보다 저렴.", th: "เขตอุตสาหกรรมเข้าถึงโรงพยาบาลผ่านพัทยา ราคาถูกกว่าพัทยากลาง" },
    watch: { en: "No beach lifestyle. Chosen mainly for work proximity, not retirement quality of life.", ko: "해변 생활 없음. 주로 직장 근접성으로 선택 — 은퇴 삶의 질은 파타야가 나음.", th: "ไม่มีชีวิตชายหาด เลือกเพราะใกล้ที่ทำงาน ไม่ใช่คุณภาพชีวิตผู้เกษียณ" },
  },
};

export default async function RetireeLanding({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();

  // Fetch retiree score stats per city
  const cityStats = await Promise.all(
    CITIES.map(async (city) => {
      const { data } = await supabase
        .from("condos_published")
        .select("retiree_score")
        .in("province", cityProvinceSlugs(city.slug))
        .gte("retiree_score", 55)
        .order("retiree_score", { ascending: false })
        .limit(60);

      const rows = data ?? [];
      if (rows.length === 0) return { slug: city.slug, count: 0, avgScore: null, topScore: null };
      const scores = rows.map((r) => r.retiree_score as number);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        slug: city.slug,
        count: rows.length,
        avgScore: Math.round(avg * 10) / 10,
        topScore: scores[0],
      } as CityScore;
    }),
  );

  const activeCities = cityStats.filter((c) => c.count >= 3);
  const comingSoon = cityStats.filter((c) => c.count < 3);

  const gradeLabel = (score: number | null) => {
    if (!score) return null;
    if (score >= 75) return { label: "Excellent", color: "text-emerald-400" };
    if (score >= 55) return { label: "Good", color: "text-emerald-300" };
    return null;
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-10">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {lang === "ko" ? "태국 은퇴자 친화 콘도" : lang === "th" ? "คอนโดสำหรับผู้เกษียณในไทย" : "Retiree-Friendly Condos in Thailand"}
          </h1>
          <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
            {lang === "ko"
              ? "의료(40%) · 공기질(25%) · 교통(20%) · 생활 편의(15%) 4가지 기준으로 0~100점 채점. 55점 이상(Good 이상) 콘도만 표시."
              : lang === "th"
              ? "ให้คะแนน 0–100 จาก 4 ปัจจัย: การแพทย์ (40%) คุณภาพอากาศ (25%) ขนส่ง (20%) ความสะดวก (15%) แสดงเฉพาะคอนโดที่ได้ ≥55"
              : "Every condo scored 0–100 on four factors: healthcare access (40%), air quality (25%), transit (20%), and daily errands (15%). Only condos scoring ≥ 55 (Good or better) appear below."}
          </p>
        </div>
        <Link
          href={`/${lang}/blog/thailand-best-cities-for-retirees-2026`}
          className="inline-block text-xs text-blue-400 hover:text-blue-300"
        >
          {lang === "ko" ? "→ 도시별 데이터 비교 읽기" : lang === "th" ? "→ อ่านบทวิเคราะห์เปรียบเทียบเมือง" : "→ Read our city comparison guide"}
        </Link>
      </header>

      {/* Score legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { label: "Excellent", range: "≥ 75", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
          { label: "Good", range: "≥ 55", color: "bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20" },
          { label: "Fair", range: "≥ 35", color: "bg-zinc-800 text-zinc-400 border-zinc-700" },
          { label: "Weak", range: "< 35", color: "bg-zinc-900 text-zinc-500 border-zinc-800" },
        ].map((g) => (
          <div key={g.label} className={`px-3 py-1.5 rounded-full border ${g.color}`}>
            {g.label} {g.range}
          </div>
        ))}
      </div>

      {/* Active cities */}
      {activeCities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {lang === "ko" ? "은퇴자 데이터 있는 도시" : lang === "th" ? "เมืองที่มีข้อมูลผู้เกษียณ" : "Cities with retiree data"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {activeCities.map((c) => {
              const cityObj = CITIES.find((x) => x.slug === c.slug);
              if (!cityObj) return null;
              const grade = gradeLabel(c.topScore);
              return (
                <Link
                  key={c.slug}
                  href={`/${lang}/retiree/${c.slug}`}
                  className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-lg font-semibold group-hover:text-emerald-400 transition">
                      {cityObj.name[lang as Lang]}
                    </h3>
                    {grade && (
                      <span className={`text-xs font-semibold shrink-0 ${grade.color}`}>
                        {grade.label}
                      </span>
                    )}
                  </div>
                  {/* City tagline */}
                  {CITY_META[c.slug] && (
                    <div className="text-xs text-zinc-500 mb-3">
                      {CITY_META[c.slug].tagline[lang as Lang]}
                    </div>
                  )}
                  <div className="flex gap-5 text-sm mb-3">
                    <div>
                      <div className="text-zinc-500 text-xs">
                        {lang === "ko" ? "≥55점 콘도" : lang === "th" ? "คอนโด ≥55" : "≥55 condos"}
                      </div>
                      <div className="font-bold tabular-nums">{c.count}</div>
                    </div>
                    {c.avgScore && (
                      <div>
                        <div className="text-zinc-500 text-xs">
                          {lang === "ko" ? "평균" : lang === "th" ? "เฉลี่ย" : "Avg"}
                        </div>
                        <div className="font-bold tabular-nums text-emerald-400">{c.avgScore}</div>
                      </div>
                    )}
                    {c.topScore && (
                      <div>
                        <div className="text-zinc-500 text-xs">
                          {lang === "ko" ? "최고" : lang === "th" ? "สูงสุด" : "Top"}
                        </div>
                        <div className="font-bold tabular-nums text-emerald-300">{c.topScore}</div>
                      </div>
                    )}
                  </div>
                  {/* Highlight + watch */}
                  {CITY_META[c.slug] && (
                    <div className="space-y-1.5 border-t border-zinc-800 pt-3">
                      <div className="text-xs text-zinc-400 flex gap-1.5">
                        <span className="text-emerald-400 shrink-0">+</span>
                        {CITY_META[c.slug].highlight[lang as Lang]}
                      </div>
                      <div className="text-xs text-zinc-400 flex gap-1.5">
                        <span className="text-yellow-400 shrink-0">!</span>
                        {CITY_META[c.slug].watch[lang as Lang]}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-zinc-500 group-hover:text-zinc-400 transition">
                    {lang === "ko" ? "랭킹 콘도 보기 →" : lang === "th" ? "ดูคอนโดทั้งหมด →" : "View ranked condos →"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Coming soon */}
      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {lang === "ko" ? "준비 중 — 데이터 매일 밤 업데이트" : lang === "th" ? "เร็วๆ นี้ — อัปเดตทุกคืน" : "Coming soon — data updating nightly"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {comingSoon.map((c) => {
              const cityObj = CITIES.find((x) => x.slug === c.slug);
              if (!cityObj) return null;
              return (
                <div
                  key={c.slug}
                  className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-500"
                >
                  {cityObj.name.en}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Methodology note */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400 space-y-2">
        <h2 className="text-zinc-200 font-semibold">How the score works</h2>
        <ul className="space-y-1 text-xs leading-relaxed">
          <li>🏥 <span className="text-zinc-300">Healthcare (40%)</span> — hospitals within 1 km via OpenStreetMap</li>
          <li>💨 <span className="text-zinc-300">Air quality (25%)</span> — annual average AQI from monitoring stations</li>
          <li>🚇 <span className="text-zinc-300">Transit (20%)</span> — distance to nearest BTS / MRT station</li>
          <li>🛒 <span className="text-zinc-300">Daily errands (15%)</span> — supermarkets within 1 km</li>
        </ul>
        <p className="text-xs text-zinc-500">
          Scores update nightly as new livability data is processed. Bangkok data is most complete;
          other cities are being back-filled.
        </p>
      </section>
    </main>
  );
}
