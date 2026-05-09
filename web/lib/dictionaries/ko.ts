import type { Dict } from "./en";

const dict: Dict = {
  brand: {
    name: "RealData",
    tagline: "powered by data, not influencers",
  },
  nav: {
    flood: "침수 지도",
    inventory: "인벤토리",
    reality: "Marketing vs Reality",
    blog: "Blog",
    contact: "문의",
  },
  footer: {
    about:
      "Powered by data, not influencers. 인플루언서 마케팅 없이 1,003개 방콕 콘도를 측정·검증합니다.",
    sectionsTitle: "기능",
    sourcesTitle: "데이터 출처",
    sources: [
      "매물·시세: hipflat.co.th",
      "침수: BMA + JICA + 2011년 대홍수 기록",
      "인프라/교통: OpenStreetMap (Overpass)",
      "구역 경계: OSM admin_level=6",
    ],
    copyright: "독립 측정, 의뢰·광고 없음",
  },
  home: {
    heroPretitle: "powered by data, not influencers",
    heroTitle1: "방콕 콘도의",
    heroTitle2Highlight: "민낯",
    heroTitle3: "을 데이터로 보여드립니다",
    heroLead:
      "인플루언서·에이전트가 안 알려주는 가격 거품, 침수 위험, 실제 매물 상태를 1,003개 방콕 콘도 전체에 대해 측정합니다. 광고 없음, 의뢰 없음.",
    ctaFlood: "침수 지도 보기 →",
    ctaInventory: "빌딩 1,003채 보기",
    statsLabels: {
      buildings: "빌딩",
      listings: "개별 매물",
      chartPts: "월별 가격 데이터",
      floodMapping: "구역 침수 매핑",
    },
    featuresHeader: "무엇을 보여드리나요",
    features: [
      {
        href: "/flood",
        emoji: "🌊",
        title: "방콕 침수 지도",
        desc: "50개 구의 우기 침수 위험을 0–5 점수로. 어느 빌딩이 어느 위험 구역에 있는지 점으로 시각화.",
        badge: "1,088 / 1,088 채점",
      },
      {
        href: "/inventory",
        emoji: "🗺️",
        title: "전체 인벤토리",
        desc: "1,003개 빌딩 × 51개 구 분포. khet별 그룹 + 빌딩 카드 리스트. 클릭하면 풀 RealData 리포트.",
        badge: "1,003 빌딩 매핑",
      },
      {
        href: "/reality",
        emoji: "❌✅",
        title: "Marketing vs Reality",
        desc: "인플루언서 / 광고 클레임을 우리 측정 데이터와 나란히 두고 사실 검증. 거품·저평가 판정.",
        badge: "Bubble Index 665채",
      },
      {
        href: "/blog",
        emoji: "📊",
        title: "데이터 분석 블로그",
        desc: "거품 TOP 10, 외국인 BEST, 침수 위험 인기 콘도. 모든 글은 자체 측정 데이터 기반.",
        badge: "3 longform posts",
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
    citiesLead: "같은 데이터 엔진, 다른 도시. 파타야, 푸켓, 치앙마이, 후아힌, 촌부리.",
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
        a: "방콕 콘도 1,003채를 매물 가격, 시설, BTS/MRT 거리, 침수 위험까지 측정해서 비교 가능하게 만든 사이트입니다. 인플루언서가 추천했다고 사지 말고, 데이터로 검증하라는 게 우리 메시지입니다.",
      },
      {
        q: "어떤 데이터를 쓰나요?",
        a: "매물·가격: hipflat.co.th. 침수 위험: BMA 배수국 + JICA 보고서 + 2011년 대홍수 기록. 인프라/교통: OpenStreetMap (Overpass API). 구역 경계: OSM admin_level=6. 모두 공개 데이터, ToS 준수.",
      },
      {
        q: "Bubble Index가 뭔가요?",
        a: "빌딩 매물 가격/면적 ÷ 같은 구(khet) 평균 가격/면적 × 100. 100이면 시세, 200이면 두 배 비싸다는 뜻. 100 미만은 저평가, 130 초과는 거품 의심으로 표기합니다.",
      },
      {
        q: "외국인이 살 수 있는 콘도인지 어떻게 확인하나요?",
        a: "태국 법상 외국인은 한 콘도 단지의 최대 49% 면적까지 소유 가능합니다. 빌딩별 외국인 쿼터 잔여 정보는 hipflat 페이지나 부동산 에이전트로 확인이 필요합니다 — RealData는 가격/시설/위험도까지만 검증합니다.",
      },
      {
        q: "이 사이트는 매물 중개·광고를 하나요?",
        a: "안 합니다. 매물 클릭은 hipflat 원본으로 이동합니다. 광고 배너 없음, 추천 수수료 없음, 인플루언서 PPL 없음. 향후 수익 모델은 (a) 데이터 기반 리드 제너레이션, (b) B2B 시장 리포트 구독, (c) 'Verified by RealData' 인증 마크입니다.",
      },
      {
        q: "데이터는 얼마나 자주 갱신되나요?",
        a: "매물·가격: 주 1회 hipflat 재크롤. 침수: 연 1회 (BMA 우기 결산 후). 인프라(병원/학교/교통): OSM 변경 감지 시 (분기 1회 정기). 빌딩 페이지에 measurement timestamp 표기.",
      },
    ],
  },
  flood: {
    title: "🌊 방콕 침수 지도",
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
  reality: {
    title: "Marketing vs Reality",
    lead: "영향력자 / 광고가 미는 콘도들. 마케팅 주장 옆에 우리 데이터를 붙여서 보여줍니다. 인플루언서 이름을 공격하지 않고, 측정값으로만 이야기합니다.",
    emptyState: "아직 등록된 promoted condo 없음.",
    promotedBy: "프로모션",
    vsDistrict: "구 평균 대비",
    sponsorCta: "여기에 내 콘도 슬롯 — 클레임은 당신, 데이터는 우리 →",
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
      fallbackEmail: "umma@xx.gg",
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
  condoPage: {
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
  },
};

export default dict;
