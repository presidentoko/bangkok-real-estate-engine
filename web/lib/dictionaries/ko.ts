import type { Dict } from "./en";

const dict: Dict = {
  brand: {
    name: "RealData",
    tagline: "powered by data, not influencers",
  },
  nav: {
    flood: "침수",
    inventory: "인벤토리",
    reality: "Marketing vs Reality",
    data: "데이터",
    blog: "Blog",
    about: "방법론",
    contact: "문의",
    retiree: "은퇴자",
    home: "홈",
    search: "검색",
    askAi: "AI에게 묻기",
    saved: "저장됨",
    yields: "수익률",
    macro: "금리",
    compare: "비교",
  },
  footer: {
    about:
      "Powered by data, not influencers. 4개 포털에서 찾을 수 있는 모든 태국 콘도를 직접 측정합니다 — 시행사 돈 안 받고, 돈으로 숫자를 바꿀 수 없습니다.",
    sectionsTitle: "기능",
    sourcesTitle: "데이터 출처",
    sources: [
      "매물·시세: hipflat, dotproperty, ddproperty, fazwaz",
      "거시: 태국중앙은행 (BTWS_STAT)",
      "침수: BMA + JICA + 2011년 대홍수 기록",
      "인프라/교통: OpenStreetMap (Overpass)",
    ],
    copyright: "독립 측정 · 순위는 돈으로 살 수 없습니다",
    saved: "저장됨",
    underpricedAlerts: "저평가 알림",
    rssFeed: "RSS 피드",
    guidesTitle: "가이드",
    guideForeignOwnership: "외국인 소유",
    guideInvestment: "투자 가이드",
    guideGlossary: "용어집",
    legalTitle: "약관·정책",
    privacy: "개인정보처리방침",
    terms: "이용약관",
  },
  home: {
    heroPretitle: "독립 측정 · 4개 포털 · 9개 도시",
    heroTitle1: "태국 콘도는",
    heroTitle2Highlight: "데이터",
    heroTitle3: "로 사세요. 인플루언서 말고.",
    heroLead:
      "찾을 수 있는 모든 매물·임대 콘도 — 태국중앙은행 기준금리 대비 임대수익률, 외국인 쿼터 잔여, 구역 침수 위험, 포털간 가격 차이. 뭐든 물어보면 빌딩 인용해서 답합니다.",
    ctaFlood: "데이터에게 묻기 →",
    ctaInventory: "상위 수익률 콘도 보기",
    statsLabels: {
      buildings: "빌딩",
      listings: "개별 매물",
      chartPts: "월별 가격 데이터",
      floodMapping: "구역 침수 매핑",
    },
    featuresHeader: "무엇을 보여드리나요",
    features: [
      {
        href: "/yields",
        emoji: "📈",
        title: "수익률 랭킹",
        desc: "매매·임대 데이터가 충분한 모든 콘도를 gross yield 기준 정렬. 현재 태국 모기지 금리(MRR)와 spread 비교 — 플러스면 임대료로 이자 충당 가능.",
        badge: "MRR 벤치마크",
      },
      {
        href: "/macro",
        emoji: "🏦",
        title: "모기지 매크로",
        desc: "태국중앙은행 정책금리·MRR·MLR·MOR·예금금리 — 모든 주담대 상품의 기준선. 매일 갱신.",
        badge: "BOT 일일 갱신",
      },
      {
        href: "/flood",
        emoji: "🌊",
        title: "방콕 침수 지도",
        desc: "방콕 모든 구의 우기 침수 위험을 0–5 점수로. 각 콘도가 어느 위험 구역에 있는지 점으로 시각화.",
        badge: "50개 구 채점",
      },
      {
        href: "/reality",
        emoji: "❌✅",
        title: "Marketing vs Reality",
        desc: "인플루언서 / 광고 클레임을 우리 측정 데이터와 나란히 두고 사실 검증. 빌딩별 거품·저평가 판정.",
        badge: "포털 교차검증",
      },
    ],
    featured: {
      superValue: {
        eyebrow: "★ 슈퍼 밸류",
        title: "중심부 + 저평가 + 시설 풀세팅 — 우리가 뽑은 베스트",
        subtitle: (sv: number, total: number) =>
          `${total}채 점수 매긴 것 중 ${sv}채 선정`,
      },
      bubbleWatch: {
        eyebrow: "❌ 거품 경보",
        title: "같은 구 대비 가장 비싼 콘도 — 사기 전에 검증",
        subtitle: "같은 khet, 같은 평수 — 그런데 평균의 3~4배 가격",
      },
      dryHighGround: {
        eyebrow: "🌊 안전 고지대",
        title: "2011 대홍수 + 그 이후 매 우기에도 안 잠긴 구역",
        subtitle: "Flood Level 1/5 — 중심부 고지대, 배수 인프라 견고",
      },
    },
    citiesHeader: "우리가 커버하는 다른 도시",
    citiesLead: "같은 데이터 엔진, 다른 도시. 푸켓, 치앙마이, 파타야, 후아힌, 촌부리, 끄라비, 코사무이, 치앙라이.",
    inventoryTitle: "Bangkok Condo Inventory",
    inventoryStatsCondos: "buildings",
    inventoryStatsDistricts: "districts",
    inventoryGeoSuffix: "geo-located",
    inventoryFullList: "full list →",
    inventoryHelp:
      "노란 점 = lat/lng 매핑된 빌딩. 점 클릭하면 풀 데이터 리포트.",
    faqTitle: "자주 묻는 질문",
    faq: [
      {
        q: "RealData가 뭔가요?",
        a: "찾을 수 있는 모든 태국 콘도(방콕 + 8개 도시)를 독립적으로 측정합니다 — 매매가, 임대료, 수익률, 시설, BTS/MRT 거리, 침수 위험, 외국인 쿼터 잔여. 인플루언서가 추천했다고 사지 말고 데이터로 검증하라는 게 우리 메시지입니다.",
      },
      {
        q: "어떤 데이터를 쓰나요?",
        a: "매물: hipflat, dotproperty, ddproperty, fazwaz (교차검증). 거시 금리: 태국중앙은행 BTWS_STAT. 침수: BMA 배수국 + JICA 보고서 + 2011 대홍수 기록. 인프라/교통: OpenStreetMap. 대기질: WAQI. 모두 공개 데이터, ToS 준수.",
      },
      {
        q: "Bubble Index가 뭔가요?",
        a: "빌딩 매물 가격/면적 ÷ 같은 구(khet) 평균 가격/면적 × 100. 100이면 시세, 200이면 두 배 비싸다는 뜻. 100 미만은 저평가, 130 초과는 거품 의심으로 표기합니다.",
      },
      {
        q: "Gross 임대수익률은 어떻게 계산되나요?",
        a: "(월 임대료 중앙값 × 12 ÷ 매매가 중앙값) × 100%. 같은 빌딩에 매매 2건 + 임대 2건 이상 있어야 계산합니다. USD 표시 매물은 THB로 환산 후 집계. 25% 초과 outlier는 가격 파싱 에러로 보고 제외. CAM·공실·관리비 차감 후 실수익률은 보통 1.5–3pp 낮습니다.",
      },
      {
        q: "외국인이 살 수 있는 콘도인지 어떻게 확인하나요?",
        a: "태국 법상 한 콘도 단지의 외국인 소유는 최대 면적 49%까지. 우리는 FazWaz 매물 기반으로 빌딩별 외국인 쿼터 잔여율(%)을 측정해서 보여드립니다 — 그 빌딩에서 외국인이 살 수 있는 호실이 얼마나 남았는지 한눈에 보입니다.",
      },
      {
        q: "RealData는 어떻게 수익을 내나요?",
        a: "두 가지입니다. 둘 다 측정값을 건드릴 수 없습니다. 첫째, 일반 디스플레이 광고를 십습니다 — 외부 광고 네트워크가 송출하며, 그쪽은 우리 데이터에 접근할 수도, 내용에 괄섭할 수도 없습니다. 신문사가 광고국과 편집국 사이에 두는 방벽과 같은 구조입니다. 둘째, 빌딩 페이지 contact 폼에서 expert opinion을 요청하면 그 sub-market을 아는 검증된 독립 브로커에게 lead를 넘기고, 거래가 성사되면 브로커가 고정 리퍼럴 수수료를 지급합니다. 구매자는 추가 비용을 내지 않습니다. 절대 받지 않는 건 시행사 돈입니다 — 유료 배치 없음, 스폰서 순위 없음, 어떤 빌딩도 돈으로 목록 위로 올라갈 수 없습니다.",
      },
      {
        q: "데이터는 얼마나 자주 갱신되나요?",
        a: "방콕 신규 매물: 매일. 4개 포털 전국 sweep: 주 1회. 수익률·Bubble Index: 매 ingest 이후 재계산. BOT 거시 금리: 매일. 침수 레이어: 연 1회 검토. 빌딩 페이지에 measurement timestamp 표시.",
      },
    ],
  },
  flood: {
    title: "🌊 침수 지도",
    lead: "어느 구가 우기마다 잠기는지, 어느 구가 안전한지. 콘도 사기 전에 반드시 확인. 2011년 대홍수 + BMA 배수국 + JICA 보고서 기반.",
    whyDistrict: "왜 구 단위인가?",
    whyDistrictBody:
      "동네/도로 단위 정밀 침수 GeoJSON은 BMA가 일반 공개하지 않습니다. 구 단위 베이스라인은 거시적 위험도 판단에 충분하며, 같은 구 안에서도 도로 고도/배수 인프라에 따라 차이가 있으니 매수 전 현장 답사 필수.",
    refreshTitle: "데이터 갱신 주기",
    refreshBody:
      "매년 1회 (BMA 우기 결산 발표 후). 신규 배수터널·펌프장 가동 뉴스가 뜨면 해당 구 점수 재평가.",
    statsTotal: "빌딩",
    statsDanger: "Level 4~5 침수 위험 구역",
    statsSafe: "Level 1~2 안전 구역",
    statsHeader: "Bangkok 콘도 인벤토리 — 침수 위험 분포",
    statsHeaderInverse: "반대로 Level 1~2 안전 구역에 있는 빌딩은",
    statsHeaderInverseEnd: "뿐.",
    statsUnmatched: (n: number) =>
      `* khet ↔ 침수 데이터 매칭 안된 빌딩 ${n.toLocaleString()}개 (분석 제외)`,
  },
  floodLegend: {
    title: "방콕 우기 침수 위험도",
    descriptors: {
      0: "안전 (관측 사례 없음)",
      1: "매우 낮음 — 중심 고지대",
      2: "낮음 — 가끔 빗물 고임",
      3: "보통 — 동네 단위 침수 빈번",
      4: "높음 — 2011년 침수, 매년 허리까지",
      5: "심각 — 우기마다 광범위 침수",
    },
    footnote:
      "근거: BMA 배수국 + JICA 보고서 + 2011년 대홍수 침수 범위. 좌표 단위가 아닌 구(khet) 단위 베이스라인. 동네별 차이 있음.",
  },
  hover: {
    buildings: "buildings",
    building: "building",
    levelUnknown: "데이터 없음",
    geoLocatedSuffix: "geo-located",
  },
  blogIndex: {
    title: "RealData Blog",
    lead: "방콕 콘도 1,000+ 채를 끊임없이 측정합니다. 모든 글은 우리 자체 측정 데이터로 검증 가능합니다 — 추측 아님, 데이터.",
  },
  langSwitcher: {
    label: "언어",
  },
  reportCard: {
    eyebrow: "RealData · 콘도 리포트 카드",
    superValueBadge: "Super Value",
    tilePrice: "가격 적정성",
    tilePriceDetailNoData: "가격 데이터 없음",
    tilePriceDetail: (idx: number) => `Bubble Index ${idx} · 같은 구 평균 대비`,
    tileTransit: "교통 편의성",
    tileTransitNoData: "교통 데이터 없음",
    tileInfra: "생활 인프라",
    tileInfraNoData: "데이터 없음",
    tileFlood: "침수 리스크",
    tileFloodUnknown: "알 수 없음",
    tileFloodDetail: (lvl: number) => `Level ${lvl}/5 · 구 단위 베이스라인`,
    latestListing: "최근 매물",
    tagline1: "데이터 기반,",
    tagline2: "인플루언서 아님",
  },
  dataShowcase: {
    title: "데이터 — 진짜 스케일",
    lead: "9개 도시 + 6개월 weekly 크롤이 실제로 어떻게 생겼는지. 아래 숫자는 페이지 로드마다 재계산. 매물은 매일, 태국 전국 sweep 은 주 1회 갱신.",
    statsHeader: "커버리지",
    statBuildings: "추적 빌딩",
    statListings: "활성 매물",
    statChartPoints: "월별 가격 데이터",
    statRegions: "매핑된 sub-area",
    statCities: "도시",
    statLangs: "언어",
    perCityHeader: "도시별 스냅샷",
    perCityCity: "도시",
    perCityBuildings: "빌딩",
    perCityScored: "Scored",
    perCityMedianPrice: "매매 중간가",
    perCityMedianBubble: "거품 중간값",
    bubbleHeader: "Bubble Index 분포",
    bubbleNote: "빌딩이 같은 sub-area 평균 대비 어떻게 가격이 형성됐는지. 녹색이 길면 저평가 많음, 빨강이 길면 거품 의심 많음.",
    bubbleBucketLabel: (lo: number, hi: number) =>
      hi >= 9999 ? `${lo}+` : `${lo}–${hi}`,
    topMostExpensiveHeader: "TOP 10 가장 비싼 (매매 중간가)",
    topSuperValueHeader: "TOP 10 Super Value (저평가 + 생활편의)",
    superValueBadge: "★ Super Value",
    pageCTA: "빌딩 클릭 → 풀 RealData 리포트",
  },
  stale: {
    title: "오래된 매물",
    lead: "매물이 가장 오래 안 팔린 빌딩들. 오랜 기간 가격 인하 없이 떠있는 매물 = 시장 관심 대비 과도한 호가. RealData는 각 매물의 첫 등록 시점을 기록하기에 hipflat이 노출 안 하는 이 시그널을 보여줄 수 있음.",
    note: "DOM 데이터는 매주 Tier B 재크롤마다 누적됨. 사이트 운영 기간이 길수록 시그널 정밀해짐.",
    table: { rank: "#", condo: "빌딩", city: "도시", listings: "활성", dom: "DOM 중간값", maxDom: "최장" },
    domDays: (n: number) => `${n}일`,
    empty: "아직 stale 빌딩 없음 — DOM 데이터 누적 중. 다음 주 다시 확인.",
  },
  developerTable: {
    condo: "콘도", year: "준공년도", units: "세대수", sale: "매매가", yield: "수익률", rating: "평점", retiree: "은퇴 적합도",
  },
  retireeTable: {
    rank: "#", condo: "콘도", district: "지역", score: "점수", fq: "외국인 쿼터 %", sale: "매매가", yield: "수익률",
  },
  bestTable: {
    rank: "#", condo: "콘도", district: "지역", yield: "수익률", spread: "스프레드", sale: "매매가", rent: "임대료", fq: "외국인 쿼터",
  },
  press: {
    title: "Press kit",
    lead: "RealData는 1,800+ 태국 콘도를 독립적으로 측정합니다. 기자/애널리스트가 특정 시장에 대해 문의할 때 공유하는 자료들.",
    sections: [
      {
        title: "RealData가 뭐냐",
        body: "방콕·푸켓·치앙마이·파타야·후아힌·촌부리·끄라비·코사무이·치앙라이의 모든 등재 콘도를 측정하는 독립 데이터 엔진. 빌딩별 Bubble Index, 방콕 구별 BMA 침수 위험, OSM 기반 생활편의 점수, 2026-05부터 누적 중인 days-on-market.",
      },
      {
        title: "안 하는 것",
        body: "시행사 돈 없음, 인플루언서 PPL 없음, 스폰서 데이터 없음 — 어떤 빌딩도 돈으로 순위를 올릴 수 없습니다. 디스플레이 광고는 우리 측정값을 볼 수 없는 외부 네트워크가 송출하며, Marketing-vs-Reality 슬롯은 유료 프로모션으로 명시되고 데이터 칸은 절대 완화하지 않습니다.",
      },
    ],
    contactsHeader: "인터뷰 / 데이터 라이선스 문의",
    contactsBody: "텔레그램 @Bkkbudong_bot 또는 contact 폼. 영업일 2일 내 답변.",
    statsHeader: "Headline 숫자 (라이브)",
    factsheet: [
      { k: "추적 빌딩", v: "1,800+" },
      { k: "커버 도시", v: "9 (방콕·푸켓·치앙마이 포함)" },
      { k: "언어", v: "EN / KO / TH" },
      { k: "갱신 주기", v: "주간 매물, 일간 DOM tick" },
      { k: "라이선스", v: "출처 페이지 링크와 함께 인용 가능" },
    ],
  },
  about: {
    title: "방법론",
    lead: "RealData가 태국 콘도를 어떻게 측정하는지 — 데이터 출처, 공식, 갱신 주기, 그리고 우리가 의도적으로 안 하는 것.",
    sectionMission: {
      title: "우리가 하는 일",
      body: "방콕, 푸켓, 치앙마이, 파타야, 후아힌, 촌부리에 걸쳐 1,700+개 콘도를 지속 측정합니다. 모든 빌딩에 Bubble Index, 생활편의 점수, (방콕은) 침수 위험 등급을 산출합니다 — 매물 출처의 마케팅 카피와 무관하게. 시행사 돈 없음, 유료 배치 없음, 인플루언서 PPL 없음.",
    },
    sectionSources: {
      title: "데이터 출처",
      items: [
        { k: "매물·가격", v: "hipflat.co.th 주 1회 재크롤. 매물별(매매+월세), 면적, 침실 수, 게시자." },
        { k: "침수 위험 (방콕)", v: "BMA 배수국 + JICA 보고서 + 2011년 대홍수 침수 기록. 구(khet) 단위 베이스라인, 좌표 단위 아님." },
        { k: "교통·인프라", v: "OpenStreetMap (Overpass API). BTS/MRT 역 + 1km 내 병원/학교/슈퍼마켓." },
        { k: "구역 경계", v: "OSM admin_level=6 폴리곤. 코로플레스 + 구별 집계용." },
      ],
    },
    sectionFormulas: {
      title: "점수 산출 방법",
      items: [
        { k: "Bubble Index", v: "(빌딩 매물 가격/면적 중간값 ÷ 같은 구 매물 가격/면적 중간값) × 100. 100 = 시세, 200 = 두 배 비쌈, 80 미만 = 저평가, 130 초과 = 거품 의심. 표본 5건 미만 구역은 제외 (작은 표본 노이즈)." },
        { k: "Livability Score", v: "BTS/MRT 거리 + 1km 내 병원/학교/슈퍼마켓 + 시설 합산 가중치. 0~100." },
        { k: "Super Value 플래그", v: "저평가(Bubble Index < 90) AND 생활편의 상위 25%." },
        { k: "침수 위험 (0~5)", v: "0=관측 없음, 1=매우 낮음(중심 고지대), 2=가끔 빗물 고임, 3=동네 단위 침수 빈번, 4=2011년 침수+매년 허리까지, 5=우기마다 광범위 침수." },
      ],
    },
    sectionWhatWeDont: {
      title: "의도적으로 안 하는 것",
      items: [
        "매물 중개 안 합니다. 매물 클릭은 hipflat 원본으로 이동.",
        "시행사 돈 안 받습니다. 에이전트가 돈을 내고 숫자를 바꿀 수 없습니다.",
        "광고가 데이터를 건드리지 못하게 합니다. 디스플레이 광고는 우리 측정값을 볼 수 없는 외부 네트워크가 송출하고, Marketing-vs-Reality 슬롯은 유료 프로모션으로 명시됩니다.",
        "데이터에 영향 주는 인플루언서 PPL/스폰서 컨텐츠 안 받습니다.",
        "구 평균의 10배를 넘는 Bubble Index는 게시 안 합니다 — 데이터 품질 이슈로 취급, drop.",
      ],
    },
    sectionRefresh: {
      title: "갱신 주기",
      items: [
        { k: "매물·가격", v: "주 1회 hipflat 재크롤" },
        { k: "침수 위험", v: "연 1회 (BMA 우기 결산 후)" },
        { k: "교통·인프라", v: "분기 1회 (OSM 변경 감지)" },
      ],
      footer: "각 빌딩 페이지에 측정 시점 표기.",
    },
    sectionLimits: {
      title: "아직 못 보는 것",
      items: [
        "동네/도로 단위 침수 폴리곤 — BMA가 비공개. 구 단위로만 베이스라인.",
        "빌딩별 외국인 quota 잔여 — 단지 사무실에 직접 확인 필요.",
        "분양/공사 중 파이프라인 — hipflat 등재 인벤토리만 측정.",
        "재판매 회전율 — 매매 가격은 있지만 매매 소요일/체결율은 아직 없음.",
      ],
    },
    faq: [
      {
        q: "에이전트 말고 RealData를 왜 믿어야 하나요?",
        a: "방법론, 출처, 갱신 주기를 다 공개하고, 매물 거래 수수료를 안 받기 때문입니다. 에이전트의 인센티브는 거래 성사, 우리의 인센티브는 정확함입니다. 우리가 게시하는 모든 숫자는 hipflat 원본 페이지(콘도 리포트에서 링크됨)와 대조 가능합니다.",
      },
      {
        q: "RealData는 hipflat과 제휴 관계인가요?",
        a: "아닙니다. Google/Bing처럼 hipflat의 robots.txt와 rate-limit 정책을 지키며 공개 페이지를 크롤합니다. 모든 매물에 hipflat 원본 URL을 링크합니다. 수익 분배·파트너십 없음.",
      },
      {
        q: "왜 일부 빌딩은 Bubble Index가 비어있나요?",
        a: "3가지 이유: (1) 그 빌딩에 hipflat 매물이 없거나, (2) 그 구 표본이 5건 미만(피어 베이스라인 부족) 또는 (3) 계산값이 비현실적(구 중간값의 10배 초과 → 데이터 품질 이슈로 drop).",
      },
      {
        q: "왜 침수 위험은 방콕만 있나요?",
        a: "구 단위 우기 침수 기록을 발표하는 기관이 BMA(방콕시청)뿐이기 때문입니다. 푸켓·치앙마이 등은 도/주 단위 침수 데이터는 있지만 빌딩 단위 점수에 필요한 구 단위 정밀도가 없습니다. 다른 데이터 소스 조사 중.",
      },
    ],
  },
  cityPage: {
    headerSuffix: "콘도 리포트",
    statBuildings: "빌딩",
    statSubAreas: "서브 구역",
    statGeo: "지도 매핑",
    statWithBubble: "Bubble Index 산출",
    mapTitle: (name: string) => `${name} 콘도 지도`,
    mapSubtitle: (n: number) => `${n.toLocaleString()}채 · 색상 = Bubble Index`,
    superValueEyebrow: "★ 슈퍼 밸류",
    superValueTitle: "저평가 + 시설 풀세팅",
    superValueSubtitle: (sv: number, total: number, city: string) =>
      `${city}에서 점수 매긴 ${total}채 중 ${sv}채 선정`,
    bubbleEyebrow: "❌ 거품 경보",
    bubbleTitle: "같은 구역 대비 가장 비싼 콘도",
    bubbleSubtitle:
      "같은 서브 구역, 같은 평수 — 그런데 평균보다 가장 높은 프리미엄.",
    fullInventoryTitle: (city: string) => `${city} 전체 빌딩`,
    fullInventoryStat: (n: number) => `${n.toLocaleString()}채 추적 중`,
    pendingPipeline: "아직 추적된 콘도 없음. 파이프라인 진행 중.",
    otherCitiesHeader: "다른 도시",
    retireeLensLabel: "은퇴자 렌즈",
    retireeLensCta: (city: string) => `${city}의 은퇴자 친화적 콘도 보기 →`,
    retireeLensSub: "의료 접근성 · 대기질 · 교통 기준 랭킹",
    conciergeHeadline: (city: string) => `${city}에서 콘도를 찾고 계신가요? 전문가 의견을 받아보세요.`,
    travelFraming: (city: string) =>
      `${city} 답사 여행을 계획 중이신가요? 항공권과 호텔을 한 번에 비교하세요.`,
    travelCta: "항공권 + 호텔 찾기 →",
  },
  districtPage: {
    eyebrow: (province: string) => `구역 · ${province}`,
    intro: (n: number, name: string) =>
      `${name}의 콘도 ${n.toLocaleString()}채를 수익률·가격·침수 위험 기준으로 측정했습니다. 독립 데이터 — 시행사 광고비 없음.`,
    statCondos: "콘도",
    statMedianYield: "중위 수익률",
    statMedianSale: "중위 매매가",
    statMedianRent: "중위 월세",
    vsMrr: "MRR 대비",
    perMonth: "/월",
    topYieldTitle: (name: string) => `${name} 수익률 상위 콘도`,
    thCondo: "콘도",
    thYield: "수익률",
    thSpread: "스프레드",
    thSale: "매매가",
    thRent: "월세",
    allCondosTitle: (name: string) => `${name} 전체 콘도`,
    ctaHeadline: (name: string) => `${name}에서 매수를 고려 중이신가요? 전문가 의견을 받아보세요.`,
    source:
      "출처: hipflat · dotproperty · ddproperty · fazwaz 실측 · MRR 기준금리는 태국 중앙은행 · 주 1회 갱신.",
    faqCount: (name: string) => `RealData는 ${name}에서 콘도 몇 채를 추적하나요?`,
    faqCountA: (n: number, name: string, province: string) =>
      `${province} ${name} 구역의 ${n}채이며, hipflat · dotproperty · ddproperty · fazwaz 매물에서 수집했습니다.`,
    faqYield: (name: string) => `${name}의 중위 총 임대수익률은 얼마인가요?`,
    faqSpread: (y: string, spread: string, mrr: string) =>
      `중위 수익률 ${y}%는 현재 태국 MRR ${mrr}% 대비 ${spread}%p 스프레드입니다.`,
    faqYieldOnly: (y: string) => `중위 수익률은 ${y}%입니다.`,
    faqNoYield:
      "이 구역의 대부분 빌딩은 아직 매매·임대 매물이 함께 잡히지 않아 수익률을 계산할 수 없습니다.",
    faqSale: (name: string) => `${name} 콘도의 중위 매매가는 얼마인가요?`,
    faqSaleA: (price: string) =>
      `추적 중인 4개 포털의 활성 매물 기준 중위 매매가는 ${price}입니다. 각 콘도 페이지에서 포털별 가격 차이를 포함한 근거를 확인할 수 있습니다.`,
    faqRent: (name: string) => `${name}의 중위 월세는 얼마인가요?`,
    faqRentA: (price: string, name: string) =>
      `${name}의 활성 임대 매물 기준 중위 월세는 월 ${price}입니다.`,
    faqForeign: (name: string) => `${name}은 외국인 매수자에게 좋은 지역인가요?`,
    faqForeignA: (name: string) =>
      `RealData는 주관적 평가를 하지 않습니다. 대신 각 빌딩 페이지에서 법적으로 구속력 있는 지표인 외국인 쿼터 재고 비율(매물 중 Foreign Quota로 표시되어 외국인 소유가 가능한 비율)을 보여줍니다. 아래 빌딩 목록에서 ${name}의 외국인 쿼터 잔여 물량을 확인하세요.`,
  },
  districtsIndex: {
    title: "태국 콘도 구역별 시세",
    lead: "측정 가능한 빌딩이 충분한 모든 구역의 중위 매매가·중위 월세·중위 총수익률을 한 표에 모았습니다.",
    thDistrict: "구역",
    thProvince: "주/도",
    thCondos: "콘도",
    thYield: "중위 수익률",
    thSale: "중위 매매가",
    thRent: "중위 월세",
    count: (n: number) => `${n}개 구역`,
    empty: "아직 측정된 구역이 없습니다.",
    seoTitle: "태국 구역별 콘도 시세 — 중위 매매가·월세·수익률",
    seoDesc:
      "추적 중인 태국 콘도 구역 전체의 중위 매매가, 중위 월세, 중위 총 임대수익률. 4개 포털 실매물에서 측정했습니다.",
  },
  reality: {
    title: "Marketing vs Reality",
    lead: "영향력자 / 광고가 미는 콘도들. 마케팅 주장 옆에 우리 데이터를 붙여서 보여줍니다. 인플루언서 이름을 공격하지 않고, 측정값으로만 이야기합니다.",
    note: "유료 프로모션 슬롯입니다. 마케팅 문구는 스폰서가 정하고, 데이터 칸은 우리가 통제합니다. 등록 문의는 Contact.",
    emptyState: "아직 등록된 promoted condo 없음.",
    promotedBy: "프로모션",
    vsDistrict: "구 평균 대비",
    sponsorCta: "여기에 내 콘도 슬롯 — 클레임은 당신, 데이터는 우리 →",
    casesHeader: "자동 추출: 매수자가 가장 자주 듣는 마케팅 vs 실측",
    casesIntro:
      "도시별로 Bubble Index가 가장 높은 콘도들을 뽑았습니다. 왼쪽은 에이전트 자료에서 흔히 듣는 마케팅 포지셔닝, 오른쪽은 RealData 측정값입니다.",
    sponsoredHeader: "스폰서 슬롯",
    bubbleLabel: "거품",
    floodLabel: "침수",
    marketingLabel: "마케팅 포지셔닝",
    realDataLabel: "RealData",
    claimByMarket: {
      bangkok: '"프리미엄 중심부 · 럭셔리 투자급"',
      pattaya: '"해변 프리미엄 · 러시아·중국 수요 · 확정 수익"',
      phuket: '"리조트 라이프스타일 · 풀빌라 스탠다드 · 호텔급 임대"',
      huahin: '"안정적 은퇴 시장 · 변동성 낮은 해안 자산"',
      chonburi: '"EEC 성장 corridor · 산업 라인 상승 여력"',
      chiangmai: '"디지털 노마드 수도 · 장기 체류 외국인 수요"',
    },
  },
  contact: {
    title: "문의",
    lead: "검증된 콘도 리포트 스폰서, 데이터 라이선스, 언론 인터뷰, 그냥 인사 — 모든 메시지를 읽습니다.",
    form: {
      inquiryType: "어떤 용건인가요?",
      types: {
        general: "일반 문의",
        promote: "내 콘도 프로모션 (유료)",
        b2b_reports: "데이터 라이선스 / B2B 시장 리포트",
        press: "언론 / 인터뷰",
        other: "기타",
      },
      name: "이름",
      email: "이메일",
      message: "메시지",
      submit: "보내기",
      submitting: "전송 중…",
      success: "감사합니다 — 영업일 기준 2일 내 답변드리겠습니다.",
      errorGeneric: "전송 실패. 이메일로 보내주세요.",
      fallbackPrefix: "또는 이메일",
      fallbackHandle: "@Bkkbudong_bot",
    },
    useCases: [
      {
        title: "콘도 프로모션",
        body: "Marketing vs Reality 슬롯 구매. 데이터는 절대 완화하지 않지만, 클레임 문구는 직접 통제 가능. 매칭 확인 후 결제.",
      },
      {
        title: "RealData 시장 리포트 라이선스",
        body: "방콕 전체 거품/침수/편의시설 데이터셋 분기 발행 (CSV + 대시보드). 에이전트, 리츠, 애널리스트용.",
      },
    ],
  },
  // The site's primary conversion unit. Every label here was an
  // English literal inside components/LeadCaptureCTA.tsx until
  // 2026-08-21, so a Korean reader was being asked to "Request
  // consultation" on a page whose every other word was Korean.
  leadCta: {
    budgetLabels: ["฿300만 미만", "฿300–500만", "฿500–1,000만", "฿1,000–2,000만", "฿2,000만+"],
    timelineLabels: ["1개월 이내", "1–3개월", "3–6개월", "6–12개월", "그냥 둘러보는 중"],
    purposeLabels: ["실거주", "임대 / 수익", "단기 시세차익", "아직 미정"],
    doneTitle: "접수됐습니다 — 곇 연락드릴게요.",
    doneBodyA: "검증된 브로커가 24시간 이내에 맞춤 추천 목록과 솔직한 의견을 드립니다 — 대상:",
    doneBodyMarket: "시장 전반",
    doneBodyEnd: ". 스팸은 없습니다.",
    headlineGeneric: "방콕 콘도 시장, 사람의 판단이 필요하세요?",
    sub: "해당 빌딩과 그 서브마켓, 외국인 쿼터 현황을 아는 검증된 브로커를 연결해 드립니다. 저희는 시행사로부터 수수료를 받지 않으며, 거래가 성사되면 브로커가 고정 리퍼럴을 지급합니다.",
    openBtn: "전문가 의견 받기 →",
    emailLabel: "이메일",
    emailPh: "you@example.com",
    budgetLabel: "예산",
    optional: "— 선택",
    timelineLabel: "시기",
    purposeLabel: "목적",
    addMore: "+ 이름 / 연락처 / 메시지 추가",
    nameLabel: "이름",
    phoneLabel: "전화 / LINE",
    messageLabel: "특별히 궁금한 점이 있나요?",
    optionalPh: "선택 입력",
    sending: "보내는 중…",
    submit: "상담 요청하기",
    followUp: "브로커가 24시간 이내 이메일로 연락드립니다.",
    consentA: "연락처는 검증된 브로커 1인에게만 전달됩니다. 스팸 없고, 명단을 팔지 않습니다. 거래가 성사되면 브로커가 리퍼럴을 지급하며, 이용자가 추가로 부담하는 비용은 없습니다. 저장 항목과 삭제 방법은 ",
    consentLink: "개인정보처리방침",
    consentB: "을 보세요.",
    errEmail: "올바른 이메일을 입력해 주세요.",
    errSubmit: "전송에 실패했습니다",
    errNetwork: "네트워크 오류",
    headlineCondo: (name: string) => `${name}, 검토 중이신가요? 전문가 의견을 받아보세요.`,
  },

  // /compare, /ask, /saved and /macro never called getDictionary, so they
  // rendered English H1s and lead paragraphs on all three locales.
  tools: {
    compareTitle: "콘도 비교",
    compareLeadA: "방콕 콘도를 최대 3개까지 나란히 비교합니다. 콘도 페이지에서 ",
    compareCta: "“비교하기”",
    compareLeadB: " 를 누르거나, URL에 id를 직접 넣으세요 ",
    compareFootnote: "★ 는 각 항목에서 가장 유리한 값을 표시합니다. 수익률과 스프레드는 세전·공실 반영 전 기준입니다. 외국인 쿼터 비율은 FazWaz에 현재 등록된 매물 중 Foreign Quota로 표시된 비율이며, 이미 소진된 쿼터는 보이지 않습니다 — 분양 사무실에 확인하세요.",
    askTitle: "RealData에게 물어보기",
    askLead: "저희가 직접 측정한 데이터에 근거한 부동산 리서치입니다 — hipflat, dotproperty, ddproperty, fazwaz에서 추적하는 모든 콘도와 태국 중앙은행 거시 지표(MRR, MLR, 기준금리)를 함께 봅니다. 마케팅 문구나 인플루언서 주장 없이, 측정된 숫자만 답합니다.",
    savedTitle: "저장한 콘도",
    savedLead: "브라우저에만 저장됩니다. 브라우저 데이터를 지우면 목록도 사라집니다.",
    macroTitle: "태국 주택담보대출 · 거시 금리",
  },

  condoPage: {
    nearbyTitle: "주변 정보와 지표",
    shareTitle: "도움이 됐나요? 리포트를 공유해 주세요",
    sourceLabel: "출처:",
    affiliateCta: "이 건물 근처 호텔 찾기 →",
    nearStation: (station: string) => `${station}역 인근 콘도`,
    retireeCity: (city: string) => `${city}의 은퇴자 친화 콘도 더보기`,
    affiliateFraming: (name: string, region: string) =>
      `${name}을 직접 보러 가실 계획이신가요? 호텔과 항공권을 한 번에 검색하세요 — ${region} 숙박은 보통 해당 콘도의 단기 임대 가격보다 쌀니다.`,
    glossaryLinks: {
      bubbleIndex: "버블 지수란?",
      grossYield: "총 임대수익률이란?",
      resaleLiquidity: "재매각 유동성 점수란?",
      retireeSuitability: "은퇴자에게 좋은가요?",
      floodRisk: "침수 위험을 어떻게 매기는가",
      groundStability: "지반이 가라앉고 있나요?",
      developerRecord: "시행사 트랙레코드란?",
    },
    neighboursTitle: "주변 단지",
    neighboursInternal: "RealData 리포트",
    neighboursExternal: "아직 추적하지 않는 빌딩은 hipflat 외부 링크로 연결됩니다.",
    buildingFacts: "빌딩 정보",
    floors: "층수",
    totalUnits: "총 unit",
    completed: "준공",
    availableNow: "현재 매물",
    marketSignals: "시장 신호 (hipflat 게시)",
    saleMedian: "매매 · 중간값",
    rentMedian: "월세 · 중간값",
    perSqm: "/sqm",
    perMonth: "/월",
    perMonthShort: "월",
    marketActivityTitle: "매물 활동",
    activeListings: "활성 매물",
    medianDom: "매물 게시 기간(중간값)",
    maxDom: "가장 오래된 매물",
    domDays: (n: number) => `${n}일`,
    domNew: "방금 등록",
    domBuilding: "추적 시작 — RealData가 매물별 첫 등록 시점을 기록합니다. 1~2주 후 실제 days-on-market 시그널이 나옵니다.",
  },
  near: {
    breadcrumb: "역",
    titleSuffix: "역 주변 콘도",
    metaSuffix: "{station} 주변 콘도 — 가격, 수익률, 침수 위험, 평점 | RealData",
    summaryLead: "{station} 반경 1km 내",
    statCondos: "콘도",
    statMedianPsm: "중위 ฿/sqm",
    statMedianYield: "중위 총수익률",
    statAvgFlood: "평균 침수 위험",
    statAvgRating: "평균 구글 평점",
    listTitle: "{station} 주변 콘도",
    faqTitle: "자주 묻는 질문",
    emptyNote: "이 역 주변에 위치 정보가 있는 콘도가 아직 부족합니다.",
    relatedHubs: "관련 가이드",
  },
  guide: {
    breadcrumb: "가이드",
    foreign: {
      title: "외국인의 태국 콘도 구매 가능 여부 (2026 가이드)",
      lead: "가능합니다 — 외국인은 한도 내에서 방콕 콘도를 자유 보유(freehold)할 수 있습니다. 49% 쿼터, freehold와 leasehold, 송금, 세금까지 정확히 정리합니다.",
    },
    investment: {
      title: "방콕 콘도 투자 가이드 2026",
      lead: "어디 수익률이 높은지, 어느 지역이 고평가인지, 금융 비용과 매수 판단의 근거 데이터 — 매주 갱신.",
      yieldTableTitle: "지역별 총 임대 수익률",
      colArea: "지역",
      colCondos: "콘도 수",
      colYield: "중위 총수익률",
      colPsm: "중위 ฿/sqm",
    },
  },
  glossary: {
    breadcrumb: "용어집",
    title: "방콕 부동산 용어집",
    lead: "RealData가 발표하는 모든 지표의 쉬운 정의 — 그리고 우리가 정확히 어떻게 계산하는지.",
    howWeCalculate: "계산 방식",
    relatedTitle: "관련 용어",
    backToIndex: "전체 용어",
  },
  notFound: {
    title: "페이지를 찾을 수 없습니다",
    body: "찾으시는 콘도, 지역, 또는 페이지가 저희 인덱스에 없습니다 — URL이 바뀌었거나, 아직 측정하지 않은 곳일 수 있어요.",
    home: "홈으로",
    yields: "수익률 상위",
    ask: "RealData에 물어보기",
    inventory: "전체 보기",
  },
  // See en.ts's `seo` comment — these exist so /ko stops shipping the
  // English title/description.
  // 빌딩별 FAQ. 2026-08-21까지 condo/[slug]/page.tsx 안에 영어 문자열로
  // 박혀 있었고, 그래서 /ko·/th 콘도 페이지는 제목·메타만 현지어이고 본문
  // 산문은 전부 영어였다 — district 페이지에서 "Duplicate, Google chose
  // different canonical" 375건을 만든 바로 그 형태(district/[slug]/page.tsx:47-51).
  // ko/th 콘도 URL 약 9,000개가 노출돼 있었고, 2026-08-21부터 이 FAQ가 화면에
  // 렌더링되므로 이제 크롤러가 읽는 본문의 대부분을 차지한다.
  //
  // 숫자는 문자열로 미리 포맷해서 넘어온다 — 모든 로케일이 같은 자릿수·단위·부호를 찍도록.
  condoFaq: {
    yieldQ: (name: string) => `${name}의 총 임대수익률은 얼마인가요?`,
    yieldA: (name: string, pct: string, spread: string) =>
      `${name}의 총 임대수익률은 ${pct}%입니다. 활성 매물 기준 (월세 중간값 × 12) ÷ ` +
      `매매가 중간값으로 계산했습니다.${spread}` +
      ` 세전·공실 반영 전 수치이며, 실질 수익률은 보통 1.5~3%p 낮습니다.`,
    yieldSpread: (mrr: string, signed: string) =>
      ` 현재 태국 MRR ${mrr}% 대비 ${signed}%p 스프레드입니다.`,

    bubbleQ: (name: string, region: string) =>
      `${name}은 ${region}의 다른 콘도에 비해 비싼가요?`,
    bubbleVerdict: {
      suspect: "거품 의심",
      underpriced: "저평가",
      atMarket: "시세 수준",
    },
    bubbleA: (
      name: string,
      idx: string,
      absPct: string,
      dir: string,
      region: string,
      verdict: string
    ) =>
      `${name}의 RealData 버블 지수는 ${idx}입니다 — ${region} 구의 ㎡당 가격 ` +
      `중간값보다 ${absPct}% ${dir} 수준이며, 저희는 이를 ${verdict}으로 분류합니다.`,
    above: "높은",
    below: "낮은",

    quotaQ: (name: string) => `외국인이 ${name}의 유닛을 살 수 있나요?`,
    quotaA: (name: string, pct: string) =>
      `현재 확인되는 ${name}의 매도 물량 중 ${pct}%가 "외국인 쿼터(Foreign Quota)"로 ` +
      `표시돼 있습니다 — 즉 태국인이 아닌 매수자도 법적으로 취득 가능한 물량입니다. ` +
      `비율이 높을수록 외국인이 살 수 있는 물량이 많이 남아 있다는 뜻입니다. ` +
      `태국 법은 건물 전체 전용면적의 49%까지만 외국인 소유를 허용하므로, ` +
      `인기 빌딩에서는 외국인 쿼터 물량이 태국인 쿼터보다 빨리 소진됩니다.`,

    floodQ: (name: string) => `${name}의 우기 침수 위험은 어느 정도인가요?`,
    floodLabel: {
      l5: "심각",
      l4: "허리 높이 침수 반복",
      l3: "동네 단위 침수 흔함",
      l2: "간헐적 물고임",
      l1: "매우 낮음",
      l0: "관측된 침수 없음",
    },
    floodA: (name: string, level: string, label: string) =>
      `${name}이 속한 구의 RealData 침수 위험 등급은 ${level}/5 — ${label}입니다. ` +
      `등급은 구(khet) 단위이며 방콕시 배수국 기록, JICA 보고서, 2011년 대홍수 ` +
      `침수 지도를 근거로 산출했습니다. 위험 등급이 낮은 구에서도 개별 건물의 ` +
      `지상 주차장이 침수되는 경우는 있습니다.`,

    aqiQ: (name: string) => `${name}의 공기질은 어떤가요?`,
    aqiVerdict: {
      unhealthy: "나쁨 (PM2.5 상승)",
      sensitive: "민감군 주의",
      moderate: "보통",
      good: "좋음",
    },
    aqiA: (name: string, val: string, verdict: string) =>
      `${name} 인근의 최신 WAQI 공기질 지수는 ${val} — ${verdict}입니다. ` +
      `가장 가까운 World Air Quality Index 관측소 값이며, 방콕의 PM2.5는 계절을 타고 ` +
      `소각철(2~4월)에 급등할 수 있습니다.`,

    liqQ: (name: string) => `${name}은 되팔기 쉬운가요?`,
    liqVerdict: {
      high: "유동성 매우 높음 — 매수자를 빠르게 찾는 편입니다",
      good: "유동성 양호 — 재매각 수요가 건전합니다",
      moderate: "보통 — 통상적인 매도 기간을 예상하세요",
      slow: "느림 — 매도까지 시간이 걸릴 수 있습니다",
      illiquid: "유동성 낮음 — 재매각이 어려울 수 있습니다",
    },
    liqAbsorb: (pct: string) =>
      ` 저희가 추적한 이곳의 매도 물량 중 ${pct}%가 시장에서 소화됐습니다.`,
    liqSold: (days: string) => ` 실제로 팔린 매물은 약 ${days}일이 걸렸습니다.`,
    liqA: (name: string, score: string, verdict: string, extra: string) =>
      `${name}의 RealData 재매각 유동성 점수는 ${score}/100 — ${verdict}.${extra} ` +
      `모든 매물을 등록된 날부터 시장에서 사라진 날까지 추적해 산출하므로, ` +
      `호가가 아니라 실제로 얼마나 그리고 얼마나 빨리 소화되는지를 반영합니다. ` +
      `매도 가능성 신호이지 매도가를 보장하는 값은 아닙니다.`,

    subQ: (name: string) => `${name} 지반이 가라앉고 있나요?`,
    subLabel: {
      l5: "심각 (해안 지반침하 + 해수면 상승)",
      l4: "높음 (동부 연약 점토대, 침하 기록됨)",
      l3: "보통 (전이 지대 또는 과거 침하 지역)",
      l2: "낮음 (대체로 안정화)",
      l1: "매우 낮음 (다져진 도심 코어, 현재는 사실상 평탄)",
    },
    subA: (name: string, level: string, label: string) =>
      `${name}이 속한 구의 RealData 지반 안정성(지반침하) 등급은 ${level}/5 — ` +
      `${label}입니다. 방콕은 연약한 해성 점토 위에 있고 1980년대에는 지하수 ` +
      `과다 취수로 연 120mm까지 가라앉았습니다. 이후 규제로 도심 침하율은 거의 0에 ` +
      `가까워졌지만 동부 벨트와 남부 해안은 계속 가라앉고 있습니다. 공개된 InSAR ` +
      `및 지하수 관측 연구에 기반한 구 단위 추정치이며, 10~20년 시계에서 같은 지역의 ` +
      `우기 침수 위험을 가중시킵니다. 건물별 실측이 아닙니다.`,

    retQ: (name: string) => `${name}은 은퇴 거주지로 적합한가요?`,
    retVerdict: {
      excellent: "매우 적합",
      good: "적합",
      fair: "무난",
      less: "덜 적합",
    },
    retHosp: (n: number) => ` 반경 1km 내 병원·의원이 ${n}곳 있고`,
    retAqi: (val: string) => `, 최신 공기질은 ${val} AQI입니다`,
    retA: (name: string, score: string, verdict: string, extra: string) =>
      `${name}은 RealData 은퇴 적합도 점수 ${score}/100 — 은퇴 비자 매수자에게 ` +
      `${verdict}합니다.${extra}. 이 점수는 인근 의료와 깨끗한 공기에 가장 큰 ` +
      `가중치를 두고, 그다음으로 차 없이 이동 가능한 대중교통과 생활 편의를 봅니다 — ` +
      `젊은 투자자가 아니라 은퇴자에게 중요한 우선순위입니다.`,

    devQ: (name: string) => `${name}의 시행사는 어디인가요?`,
    devTier: {
      established: " — 규모 있는 시행사입니다.",
      experienced: " — 경험 있는 시행사입니다.",
      smaller: " — 포트폴리오가 작은 편입니다.",
      neww: " — 신생 또는 단일 프로젝트 시행사입니다.",
    },
    devScale: (projects: number, unitsClause: string, tier: string) =>
      ` FazWaz 기준 ${projects}개 프로젝트를 등록했고${unitsClause}${tier}`,
    devUnits: (units: string) => `, 총 ${units}세대 규모이며`,
    devA: (name: string, developer: string, scale: string) =>
      `${name}의 시행사는 ${developer}입니다.${scale} 포트폴리오 규모는 경험의 ` +
      `대리 지표입니다 — 준공 이력이 길수록 선분양 물건의 미완공 위험이 줄지만, ` +
      `개별 프로젝트의 시공 품질을 보장하지는 않습니다.`,

    methodQ: "RealData는 이 페이지의 숫자를 어떻게 검증하나요?",
    methodA:
      `모든 수치는 hipflat, dotproperty, ddproperty, fazwaz를 재크롤링해 얻은 실시간 ` +
      `매물 데이터로 계산합니다(방콕은 매일, 태국 전역 스윕은 매주). 구 중간값도 같은 ` +
      `데이터셋에서 나오고, 금리 기준은 태국 중앙은행 BTWS_STAT이며, 침수·생활편의 ` +
      `레이어는 정부 자료와 OpenStreetMap에 고정돼 있습니다. 저희는 시행사 돈을 받지 ` +
      `않고 어떤 빌딩도 돈으로 순위를 올릴 수 없습니다 — 이 페이지의 광고는 데이터를 ` +
      `볼 수 없는 외부 네트워크가 판매·송출합니다.`,
  },

  seo: {
    yieldLabel: (v: string) => `수익률 ${v}%`,
    floodLabel: (n: number) => `침수 위험 L${n}/5`,
    provinceCondo: (p: string) => `${p} 콘도`,
    built: (y: number) => `${y}년 준공`,
    units: (n: number) => `${n}세대`,
    vsDistrict: (n: number) =>
      n > 0
        ? `지역 평균 대비 ${n}% 비쌈`
        : n < 0
          ? `지역 평균 대비 ${Math.abs(n)}% 저렴`
          : "지역 평균 수준",
    condoTitle: (name: string, region: string, suffix: string) =>
      `${name}, ${region} — ${suffix} | RealData`,
    condoDesc: (name: string, region: string, province: string, facts: string) =>
      `${province} ${region}의 ${name}. ${facts}. 매물, 13개월 시세 추이, ` +
      `수익률 계산, 침수 위험, 편의시설을 확인하세요.`,
    districtTitle: (district: string, province: string) =>
      `${district} 콘도 시세 — 수익률·가격·침수 위험 | RealData`,
    districtDesc: (district: string, province: string) =>
      `${province} ${district}의 모든 콘도: 태국 MRR 기준 총 임대수익률 순위, ` +
      `매매·월세 중간값, 침수 위험 등급, 포털 간 가격 비교. ` +
      `시행사 광고비 없는 독립 데이터입니다.`,
    yieldsTitle:
      "방콕·태국 콘도 임대수익률 순위 — 태국 중앙은행 금리와 비교 | RealData",
    yieldsDesc:
      "방콕과 태국 콘도를 총 임대수익률(연 임대료 ÷ 매매가) 기준으로 순위화했습니다. " +
      "건물마다 태국 중앙은행 MRR 대출 금리와 비교 — 스프레드가 플러스면 임대료가 대출 이자를 감당한다는 뜻입니다. " +
      "hipflat·dotproperty·ddproperty·fazwaz 교차 측정.",
    inventoryTitle:
      "방콕 콘도 전체 목록 — 수익률·가격·침수 위험 | RealData",
    inventoryDesc:
      "방콕, 푸켓, 치앙마이, 파타야, 후아힌, 촌부리의 콘도 12,000곳 이상. " +
      "카드마다 임대수익률, 버블 지수, 침수 위험, 외국인 쿼터를 표시합니다. 도시·지역별 필터 제공.",
    macroTitle: "태국 주택담보대출·거시 금리 (중앙은행 데이터) | RealData",
    macroDesc:
      "태국 중앙은행 기준 금리: 정책금리, MRR, MLR, MOR, 가계부채. " +
      "태국 콘도 구매자가 대출에 서명하기 전에 알아야 할 거시 배경입니다.",
    floodTitle: "방콕 침수 위험 지도 — 50개 구 전체 등급화 | RealData",
    floodDesc:
      "우기마다 잠기는 구와 끝까지 마른 구를 가릅니다. 방콕 50개 구를 BMA 배수국, JICA, 2011년 대홍수 기록으로 0~5등급 채점했습니다. 모든 콘도를 위험 지도 위에 표시합니다.",
    realityTitle: "방콕 콘도 광고 vs 실제 — 인플루언서 주장 팩트체크 | RealData",
    realityDesc:
      "인플루언서와 광고가 밀어주는 방콕 콘도를 저희가 측정한 버블 지수·수익률 옆에 나란히 놓습니다. 사람을 공격하지 않고 숫자만 봅니다. 시행사 돈 안 받는 독립 데이터입니다.",
  },
};

export default dict;
