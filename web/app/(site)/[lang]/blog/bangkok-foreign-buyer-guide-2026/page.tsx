import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

const SITE_URL = SEO_SITE_URL;
const SLUG = "bangkok-foreign-buyer-guide-2026";
const PUBLISHED = "2026-05-07";

export const revalidate = 86400;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Bangkok Condo Buyer Guide 2026 — Foreign Investor Handbook | RealData",
    desc:
      "Complete guide to buying a Bangkok condo as a foreigner: 49% quota rule, BTS proximity, central districts, flood risk, taxes, tenant yield. Data-backed.",
    ogTitle: "Bangkok Condo Buyer Guide 2026 — Foreigner's Handbook",
    ogDesc: "49% rule, BTS, districts, flood, taxes — everything in one guide.",
  },
  ko: {
    title: "방콕 콘도 매수 가이드 2026 — 외국인 투자자 완전 핸드북 | RealData",
    desc:
      "외국인이 방콕 콘도 매수할 때 알아야 할 모든 것: 49% 쿼터 규정, BTS 접근성, 중심 구역, 침수 위험, 세금, 임대 수익률. 데이터 기반.",
    ogTitle: "방콕 콘도 매수 가이드 2026 — 외국인 완전 핸드북",
    ogDesc: "49% 규정, BTS, 구역, 침수, 세금 — 한 번에 정리.",
  },
  th: {
    title: "คู่มือซื้อคอนโดกรุงเทพปี 2026 — สำหรับนักลงทุนต่างชาติ | RealData",
    desc:
      "คู่มือฉบับสมบูรณ์สำหรับชาวต่างชาติที่จะซื้อคอนโดกรุงเทพ: กฎโควตา 49% ระยะ BTS เขตกลาง ความเสี่ยงน้ำท่วม ภาษี ผลตอบแทนค่าเช่า อิงข้อมูลจริง",
    ogTitle: "คู่มือซื้อคอนโดกรุงเทพปี 2026 — สำหรับชาวต่างชาติ",
    ogDesc: "โควตา 49% BTS เขต น้ำท่วม ภาษี — ครบในที่เดียว",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const useLang: Lang = isLang(lang) ? lang : "en";
  const m = META[useLang];
  const url = `${SITE_URL}/${useLang}/blog/${SLUG}`;
  return {
    title: m.title,
    description: m.desc,
    keywords: [
      "Bangkok condo buyer guide", "Bangkok condo foreigner", "Thailand condo 49 percent",
      "Bangkok BTS condo guide", "Bangkok central condo districts", "Bangkok condo tax",
      "Bangkok rental yield", "buy Bangkok condo 2026",
      "방콕 콘도 매수 가이드", "방콕 콘도 외국인", "방콕 49% 쿼터", "방콕 BTS 콘도",
      "방콕 부동산 투자", "방콕 콘도 세금",
      "ซื้อคอนโดกรุงเทพ", "คอนโดสำหรับต่างชาติ", "โควตาต่างชาติ 49 เปอร์เซ็นต์",
      "คอนโดติด BTS", "ภาษีคอนโดกรุงเทพ",
    ],
    alternates: {
      canonical: url,
      languages: langAlternates(`/blog/${SLUG}`),
    },
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url,
      type: "article",
      publishedTime: PUBLISHED,
      locale: useLang,
    },
  };
}

export default async function ForeignBuyerGuide({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: META[lang].ogTitle,
    inLanguage: lang,
    datePublished: PUBLISHED,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { "@id": `${SITE_URL}/#org` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: POST_URL,
    description: META[lang].desc,
    about: { "@type": "Thing", name: "Bangkok real estate market" },
  };

  const faqJsonLd = buildFaqJsonLd([
    {
      q: "Can foreigners legally own condos in Bangkok?",
      a: "Yes. Under the Thai Condominium Act, foreigners may purchase condo units in freehold title (chanote) as long as foreign ownership in the building does not exceed 49% of total units. The buyer's funds must be transferred from abroad in foreign currency and converted to Thai baht (documented via a Foreign Exchange Transaction Form). Land ownership requires different legal structures.",
    },
    {
      q: "What does the 49% quota rule mean for Bangkok condo buyers?",
      a: "In any Thai condo project, a maximum of 49% of total units may be held in foreign names on the title deed. Buildings popular with foreign buyers (especially Sukhumvit and Sathorn) may have little or no remaining quota — verify directly with the project juristic office or via hipflat before making an offer.",
    },
    {
      q: "What taxes do foreigners pay when buying a Bangkok condo resale?",
      a: "Buying a Bangkok condo resale involves: Transfer fee (2% of appraised value); Specific Business Tax at 3.3% if seller held under 5 years; Stamp Duty at 0.5% if SBT exempt; and seller's Withholding Tax (1–3%). Buyers should budget approximately 3–4% of purchase price in total transaction costs.",
    },
  ]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(blogBreadcrumbs(lang, SLUG, META[lang].title)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      <article>
        <header className="mb-6">
          <Link href={`/${lang}/blog`} className="text-zinc-500 text-xs hover:text-zinc-300">
            ← Blog
          </Link>
          <Body lang={lang} />
          <div className="max-w-xs mt-4">
            <LinkShareButtons url={POST_URL} title={META[lang].ogTitle} />
          </div>
        </header>
      </article>
    </main>
  );
}

function Body({ lang }: { lang: Lang }) {
  const flood = (
    <Link href={`/${lang}/flood`} className="underline">
      {lang === "ko" ? "방콕 침수 지도" : lang === "th" ? "แผนที่น้ำท่วมกรุงเทพ" : "Bangkok flood map"}
    </Link>
  );
  const inv = (
    <Link href={`/${lang}/inventory`} className="underline">
      {lang === "ko" ? "전체 인벤토리" : lang === "th" ? "รายการอาคาร" : "full inventory"}
    </Link>
  );
  const overpriced = (
    <Link href={`/${lang}/blog/bangkok-overpriced-top10`} className="underline">
      {lang === "ko" ? "거품 TOP 10" : lang === "th" ? "10 อันดับราคาเกิน" : "overpriced top 10"}
    </Link>
  );

  if (lang === "en") {
    return (
      <>
        <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
          Bangkok Condo Buyer Guide 2026 — Foreigner&apos;s Handbook
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          <time>{PUBLISHED}</time> · RealData reference
        </p>

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <p>
            Bangkok is one of the few Asian capitals where foreigners can hold
            freehold title to a condo unit. This guide collects what every
            foreign buyer should verify before signing — the legal limits, the
            district economics, the risks influencers and agents skip over, and
            the data we publish to ground every decision.
          </p>

          <h2 className="text-xl font-bold mt-8">1. The 49% rule (foreign quota)</h2>
          <p>
            Thai law caps foreign ownership at <strong>49% of the saleable floor
            area</strong> in any single condominium project. Once that quota is
            full, a foreign buyer can&apos;t register additional units in their
            own name in that building — common workarounds (Thai company,
            30-year lease) are legally valid but add complexity.
          </p>
          <p>
            Always confirm the remaining foreign quota with the project&apos;s
            juristic office or hipflat&apos;s listing detail before paying any
            deposit. Quota is a per-building number, not per-developer.
          </p>

          <h2 className="text-xl font-bold mt-8">2. Central vs outer districts</h2>
          <p>
            Bangkok&apos;s &ldquo;central&rdquo; districts most foreign buyers
            target are <strong>Pathum Wan, Vadhana, Bang Rak, Sathon, and
            Khlong Toei</strong> — the BTS Sukhumvit/Silom corridor and Phrom
            Phong / Asok / Thonglor stations. These have:
          </p>
          <ul>
            <li>Highest condo prices ($/m² 2-4× outer districts)</li>
            <li>Best transit access (BTS/MRT walking distance)</li>
            <li>Lowest flood risk (mostly Level 1-2 on our map)</li>
            <li>Strongest rental demand (expat tenants)</li>
          </ul>
          <p>
            Outer districts (Bang Khae, Bueng Kum, Don Mueang, Lat Krabang) are
            cheaper per square meter, but also concentrate flood risk and
            require longer commutes — see the {flood} for the full district
            breakdown.
          </p>

          <h2 className="text-xl font-bold mt-8">3. BTS / MRT proximity</h2>
          <p>
            Walkable transit is the single biggest premium factor in Bangkok
            condo pricing. A unit within 300m of a BTS station typically sells
            for 30-50% more than the same building 1km away from any rail. We
            measure this at building level (OpenStreetMap haversine to nearest
            station) and surface it on every {" "}
            <Link href={`/${lang}/condo/`} className="underline">condo report</Link>.
          </p>

          <h2 className="text-xl font-bold mt-8">4. Flood risk by district</h2>
          <p>
            Bangkok&apos;s monsoon flood pattern is district-stable across years.
            The 2011 great flood inundation map plus BMA Drainage Department
            annual reports give a per-district 0-5 risk score. Level 4-5
            districts (Don Mueang, Lak Si, Sai Mai, Bang Khen, Min Buri,
            Khlong Sam Wa, Nong Chok, Lat Krabang, Bang Khun Thian) regularly
            see waist-deep water in the rainy season. See {flood}.
          </p>

          <h2 className="text-xl font-bold mt-8">5. Watch for price bubble</h2>
          <p>
            Some Bangkok condos are priced 3-4× above their district median for
            $/m². Sometimes the premium is justified (Four Seasons, 98 Wireless
            tier), often it&apos;s influencer-driven hype on a mid-tier
            building. We compute a Bubble Index per building — see the {overpriced}.
          </p>

          <h2 className="text-xl font-bold mt-8">6. Taxes and fees</h2>
          <ul>
            <li>Transfer fee: 2% of appraised value (typically split 50/50 with seller, but negotiable)</li>
            <li>Specific Business Tax (SBT) or Stamp Duty: paid by seller normally</li>
            <li>Withholding tax: 1% of declared value (corporate seller)</li>
            <li>Annual property tax (Land &amp; Buildings Tax 2020): 0.02-0.30% depending on use</li>
            <li>Rental income tax: progressive 0-35% on net rental income</li>
          </ul>

          <h2 className="text-xl font-bold mt-8">7. Rental yield reality</h2>
          <p>
            Long-term rental yields in central Bangkok run <strong>3-5% gross</strong>
            for foreign-friendly condos — net of management fees, vacancy, and
            tax it&apos;s closer to 2-3.5%. Short-term (Airbnb) yields are
            higher but are increasingly restricted by building bylaws and Thai
            hotel licensing rules. Verify each building&apos;s short-let policy
            before underwriting Airbnb projections.
          </p>

          <h2 className="text-xl font-bold mt-8">8. The data we publish</h2>
          <p>
            Every building in our database has a public report at{" "}
            <code className="text-zinc-400">/condo/&lt;id&gt;</code> with: price
            history (13 months), per-unit listings, full amenity list, BTS/MRT
            distance (real OSM measurement), 1km hospital/school/supermarket
            counts, BMA flood level, and a Bubble Index vs the district median.
            Browse the {inv} or filter by district.
          </p>

          <p className="text-xs text-zinc-500 mt-6">
            This guide is informational, not legal or financial advice. Always
            consult a Thai-licensed lawyer and accountant before purchase.
          </p>
        </section>
      </>
    );
  }

  if (lang === "ko") {
    return (
      <>
        <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
          방콕 콘도 매수 가이드 2026 — 외국인 완전 핸드북
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          <time>{PUBLISHED}</time> · RealData 레퍼런스
        </p>

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <p>
            방콕은 외국인이 콘도를 자기 명의로 합법 매수할 수 있는 몇 안 되는 아시아
            수도 중 하나입니다. 이 가이드는 외국인 매수자가 계약 전에 반드시
            확인해야 할 것들을 모았습니다 — 법적 제약, 구역별 시장 차이,
            인플루언서·에이전트가 안 알려주는 리스크, 그리고 우리가 모든
            의사결정의 근거로 공개하는 데이터.
          </p>

          <h2 className="text-xl font-bold mt-8">1. 49% 규정 (외국인 쿼터)</h2>
          <p>
            태국 법은 한 콘도 단지에서 외국인이 소유할 수 있는 면적을{" "}
            <strong>전체 매도 가능 면적의 49%</strong>로 제한합니다. 그 쿼터가
            다 차면 외국인은 자기 명의로 추가 매수가 불가능합니다 — 흔한 우회
            방법(태국 법인 설립, 30년 임대권)은 합법이지만 복잡도가 올라갑니다.
          </p>
          <p>
            어떤 빌딩이든 보증금 내기 전에 잔여 외국인 쿼터를 프로젝트
            관리사무소나 hipflat 매물 상세에서 확인하세요. 쿼터는 빌딩 단위지,
            시행사 단위가 아닙니다.
          </p>

          <h2 className="text-xl font-bold mt-8">2. 중심부 vs 외곽</h2>
          <p>
            외국인 매수자가 주로 보는 &ldquo;중심부&rdquo; 구역은{" "}
            <strong>Pathum Wan, Vadhana, Bang Rak, Sathon, Khlong Toei</strong>{" "}
            — BTS Sukhumvit/Silom 라인의 Phrom Phong / Asok / Thonglor 역
            주변입니다. 이 구역의 특징:
          </p>
          <ul>
            <li>방콕 최고가 (m²당 외곽 대비 2-4배)</li>
            <li>BTS/MRT 도보 접근 가능</li>
            <li>침수 위험 가장 낮음 (대부분 Level 1-2)</li>
            <li>임대 수요 가장 강함 (외국인 거주자)</li>
          </ul>
          <p>
            외곽 구역(Bang Khae, Bueng Kum, Don Mueang, Lat Krabang)은
            m²당 가격이 싸지만 침수 위험과 통근 시간이 큽니다. 구별 분석은{" "}
            {flood} 참고.
          </p>

          <h2 className="text-xl font-bold mt-8">3. BTS / MRT 접근성</h2>
          <p>
            방콕 콘도 가격 결정에서 가장 큰 단일 프리미엄 요인은 도보 거리
            교통입니다. BTS 역에서 300m 이내 unit은 같은 빌딩이라도 1km 떨어진
            것보다 30-50% 더 비싼 게 보통. 우리는 빌딩 단위로 OpenStreetMap에서
            가장 가까운 역까지 haversine 거리를 측정해{" "}
            <Link href={`/${lang}/condo/`} className="underline">콘도 리포트</Link>{" "}
            마다 표시합니다.
          </p>

          <h2 className="text-xl font-bold mt-8">4. 구역별 침수 위험</h2>
          <p>
            방콕의 우기 침수 패턴은 구 단위로 매우 안정적입니다. 2011년 대홍수
            침수 범위와 BMA 배수국 연례 보고서를 합쳐 구별 0-5 위험 점수를
            만들었습니다. Level 4-5 구역(Don Mueang, Lak Si, Sai Mai, Bang Khen,
            Min Buri, Khlong Sam Wa, Nong Chok, Lat Krabang, Bang Khun Thian)은
            우기마다 허리까지 잠깁니다. {flood} 참고.
          </p>

          <h2 className="text-xl font-bold mt-8">5. 가격 거품 주의</h2>
          <p>
            방콕 일부 콘도는 같은 구의 m²당 중간값 대비 3-4배 비쌉니다. 럭셔리
            브랜드(Four Seasons, 98 Wireless 등)면 정당화 가능하지만, 인플루언서
            홍보로 가격이 부풀려진 중급 빌딩도 많습니다. 우리는 빌딩별 Bubble
            Index를 계산합니다 — {overpriced} 참고.
          </p>

          <h2 className="text-xl font-bold mt-8">6. 세금과 수수료</h2>
          <ul>
            <li>이전 수수료: 감정가의 2% (보통 매도자와 50/50 분담, 협상 가능)</li>
            <li>특별사업세 또는 인지세: 매도자 부담</li>
            <li>원천징수세: 신고가의 1% (법인 매도자 경우)</li>
            <li>보유세 (토지·건물세 2020): 0.02-0.30% (용도에 따라)</li>
            <li>임대 소득세: 순임대 수익에 대해 누진 0-35%</li>
          </ul>

          <h2 className="text-xl font-bold mt-8">7. 임대 수익률 현실</h2>
          <p>
            방콕 중심부 외국인 친화 콘도의 장기 임대 수익률은{" "}
            <strong>총 3-5%</strong> 수준이고, 관리비·공실·세금 빼면 순 2-3.5%에
            가깝습니다. 단기 임대(Airbnb) 수익률은 더 높지만, 빌딩 규약과 태국
            호텔법 적용으로 점점 제한됩니다. Airbnb 가정으로 underwriting
            전에 빌딩별 단기임대 정책 확인 필수.
          </p>

          <h2 className="text-xl font-bold mt-8">8. 우리가 공개하는 데이터</h2>
          <p>
            DB에 있는 모든 빌딩은{" "}
            <code className="text-zinc-400">/condo/&lt;id&gt;</code>에 공개
            리포트가 있습니다: 가격 추이(13개월), unit별 매물, 시설 전체 목록,
            BTS/MRT 거리(실측 OSM), 1km 내 병원·학교·슈퍼마켓 수, BMA 침수
            레벨, 구역 중간값 대비 Bubble Index. {inv}에서 검색·필터하세요.
          </p>

          <p className="text-xs text-zinc-500 mt-6">
            이 가이드는 정보 제공용이며 법무·세무 자문이 아닙니다. 매수 전 태국
            라이선스 변호사와 회계사 상담은 필수입니다.
          </p>
        </section>
      </>
    );
  }

  // th
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
        คู่มือซื้อคอนโดกรุงเทพปี 2026 — สำหรับชาวต่างชาติ
      </h1>
      <p className="text-zinc-400 mt-2 text-sm">
        <time>{PUBLISHED}</time> · ข้อมูลอ้างอิงโดย RealData
      </p>

      <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
        <p>
          กรุงเทพเป็นหนึ่งในไม่กี่เมืองหลวงเอเชียที่ชาวต่างชาติสามารถถือกรรมสิทธิ์
          คอนโดในชื่อตนเองได้ คู่มือนี้รวบรวมสิ่งที่ผู้ซื้อต่างชาติต้องตรวจสอบก่อน
          เซ็น — ขีดจำกัดทางกฎหมาย เศรษฐกิจของแต่ละเขต ความเสี่ยงที่อินฟลูเอนเซอร์
          และเอเจนต์มักไม่พูด รวมถึงข้อมูลที่เราเผยแพร่เพื่อใช้ตัดสินใจ
        </p>

        <h2 className="text-xl font-bold mt-8">1. กฎ 49% (โควตาต่างชาติ)</h2>
        <p>
          กฎหมายไทยจำกัดการถือครองของชาวต่างชาติให้อยู่ที่{" "}
          <strong>49% ของพื้นที่ขายในแต่ละโครงการคอนโด</strong>{" "}
          เมื่อโควตาเต็มแล้ว ผู้ซื้อต่างชาติไม่สามารถจดทะเบียนยูนิตเพิ่มในชื่อ
          ตนเองได้ในอาคารนั้น วิธีอ้อม (บริษัทไทย, สัญญาเช่า 30 ปี) ทำได้ตาม
          กฎหมายแต่ซับซ้อนขึ้น
        </p>
        <p>
          ก่อนวางมัดจำ ตรวจสอบโควตาต่างชาติคงเหลือกับนิติบุคคลโครงการหรือ
          รายละเอียดประกาศบน hipflat โควตาเป็นรายอาคาร ไม่ใช่รายผู้พัฒนา
        </p>

        <h2 className="text-xl font-bold mt-8">2. เขตกลางกับเขตรอบนอก</h2>
        <p>
          เขต &ldquo;กลางเมือง&rdquo; ที่ผู้ซื้อต่างชาติส่วนใหญ่นิยม ได้แก่{" "}
          <strong>ปทุมวัน วัฒนา บางรัก สาทร คลองเตย</strong>{" "}
          — แนว BTS สุขุมวิท/สีลม สถานี พร้อมพงษ์ / อโศก / ทองหล่อ
          จุดเด่น:
        </p>
        <ul>
          <li>ราคาคอนโดสูงสุด (ราคา/ตร.ม. สูงกว่าเขตรอบนอก 2-4 เท่า)</li>
          <li>เดินถึง BTS/MRT</li>
          <li>ความเสี่ยงน้ำท่วมต่ำสุด (ส่วนใหญ่ Level 1-2)</li>
          <li>ความต้องการเช่าสูง (ผู้เช่าต่างชาติ)</li>
        </ul>
        <p>
          เขตรอบนอก (บางแค บึงกุ่ม ดอนเมือง ลาดกระบัง) ราคาต่อ ตร.ม. ถูกกว่า
          แต่มีความเสี่ยงน้ำท่วมและการเดินทางที่ใช้เวลา ดูรายเขตที่ {flood}
        </p>

        <h2 className="text-xl font-bold mt-8">3. ระยะ BTS / MRT</h2>
        <p>
          ระยะเดินถึงสถานีคือปัจจัยพรีเมียมที่ใหญ่ที่สุดในการตั้งราคาคอนโดกรุงเทพ
          ห้องในระยะ 300 ม. จากสถานี BTS ขายได้แพงกว่าอาคารเดียวกันที่อยู่ห่าง
          1 กม. ราว 30-50% เราวัดที่ระดับอาคาร (Haversine จาก OpenStreetMap)
          และแสดงในรายงาน{" "}
          <Link href={`/${lang}/condo/`} className="underline">คอนโดทุกแห่ง</Link>
        </p>

        <h2 className="text-xl font-bold mt-8">4. ความเสี่ยงน้ำท่วมรายเขต</h2>
        <p>
          รูปแบบน้ำท่วมหน้าฝนของกรุงเทพค่อนข้างคงที่ในระดับเขต แผนที่น้ำท่วมใหญ่
          ปี 2554 รวมกับรายงานสำนักการระบายน้ำ กทม. ให้คะแนนเสี่ยง 0-5 รายเขต
          เขต Level 4-5 (ดอนเมือง หลักสี่ สายไหม บางเขน มีนบุรี คลองสามวา หนองจอก
          ลาดกระบัง บางขุนเทียน) น้ำสูงระดับเอวเป็นประจำ ดู {flood}
        </p>

        <h2 className="text-xl font-bold mt-8">5. ระวังฟองสบู่ราคา</h2>
        <p>
          คอนโดบางแห่งราคาสูงกว่าค่ามัธยฐาน/ตร.ม. ของเขตเดียวกัน 3-4 เท่า บางครั้ง
          พรีเมียมคุ้มค่า (Four Seasons, 98 Wireless) แต่บ่อยครั้งเป็นกระแส
          อินฟลูเอนเซอร์บนอาคารระดับกลาง เราคำนวณ Bubble Index ต่ออาคาร —
          ดู {overpriced}
        </p>

        <h2 className="text-xl font-bold mt-8">6. ภาษีและค่าธรรมเนียม</h2>
        <ul>
          <li>ค่าธรรมเนียมการโอน: 2% ของราคาประเมิน (ปกติแบ่ง 50/50 กับผู้ขาย ต่อรองได้)</li>
          <li>ภาษีธุรกิจเฉพาะ หรือ อากรแสตมป์: ผู้ขายจ่าย</li>
          <li>ภาษีหัก ณ ที่จ่าย: 1% ของราคาประเมิน (กรณีนิติบุคคลขาย)</li>
          <li>ภาษีที่ดินและสิ่งปลูกสร้าง 2563: 0.02-0.30% ตามการใช้งาน</li>
          <li>ภาษีรายได้จากค่าเช่า: ก้าวหน้า 0-35% บนรายได้สุทธิ</li>
        </ul>

        <h2 className="text-xl font-bold mt-8">7. ผลตอบแทนค่าเช่าจริง</h2>
        <p>
          ผลตอบแทนเช่าระยะยาวในกลางกรุงเทพอยู่ที่ <strong>3-5% gross</strong>
          สำหรับคอนโดที่เหมาะกับชาวต่างชาติ หักค่าจัดการ ห้องว่าง และภาษีแล้ว
          เหลือสุทธิราว 2-3.5% ผลตอบแทนระยะสั้น (Airbnb) สูงกว่าแต่ถูกจำกัดมากขึ้น
          จากระเบียบอาคารและกฎหมายโรงแรม ตรวจสอบนโยบายปล่อยเช่าระยะสั้นของ
          แต่ละอาคารก่อนคำนวณ Airbnb
        </p>

        <h2 className="text-xl font-bold mt-8">8. ข้อมูลที่เราเผยแพร่</h2>
        <p>
          ทุกอาคารในฐานข้อมูลของเรามีรายงานสาธารณะที่{" "}
          <code className="text-zinc-400">/condo/&lt;id&gt;</code>: ประวัติราคา
          (13 เดือน) ประกาศรายห้อง รายการสิ่งอำนวย ระยะ BTS/MRT (วัด OSM จริง)
          จำนวน รพ./โรงเรียน/ซูเปอร์ในรัศมี 1 กม. ระดับน้ำท่วม กทม. และ Bubble
          Index เทียบมัธยฐานเขต ค้นหาที่ {inv}
        </p>

        <p className="text-xs text-zinc-500 mt-6">
          คู่มือนี้เป็นข้อมูลเท่านั้น ไม่ใช่คำปรึกษาทางกฎหมายหรือการเงิน
          ปรึกษาทนายและนักบัญชีที่มีใบอนุญาตในไทยก่อนทำการซื้อ
        </p>
      </section>
    </>
  );
}
