import { TELEGRAM_HANDLE } from "@/lib/contactChannels";

import type { LegalDocumentSet } from "./types";

// The section that actually matters here is "measurement, not advice". This
// site publishes yields, bubble indices and flood levels that people use to
// decide where to put a few million baht, off listing data scraped from four
// portals that are themselves often wrong or stale. Saying so plainly is
// both the honest thing and the thing that keeps a bad number from becoming
// a liability.
const EFFECTIVE = "2026-08-21";

const en = {
  title: "Terms of Use",
  lead:
    "What RealData is, what its numbers are and are not, and the rules for using them. Short version: everything here is measurement, not advice.",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "Using this site",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData (passionaryestate.com) publishes computed measurements of the Thai condo market. By using the site you accept these terms. If you do not, please do not use it. Reading costs nothing and requires no account.",
        },
      ],
    },
    {
      heading: "Measurement, not advice",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Nothing on this site is investment, legal, tax, or property advice, and nothing on it is an offer to sell or a solicitation to buy anything. The yields, bubble indices, flood levels, livability scores and every other figure here are the output of formulas applied to listing data. They describe what listings said, not what a property is worth, what it will earn, or whether you should buy it.",
        },
        {
          kind: "p" as const,
          text:
            "Before committing money to a Thai property, get independent professional advice and verify every material fact yourself — title, foreign quota, common-area fees, building condition, and the actual asking price — with the seller, the juristic person, and a qualified lawyer. Do not treat a number on this site as a substitute for any of that.",
        },
      ],
    },
    {
      heading: "Where the numbers come from, and how wrong they can be",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Prices, rents and unit counts are derived from public listings on hipflat, dotproperty, ddproperty and fazwaz. Listings are frequently stale, duplicated, mispriced, or mis-typed by whoever posted them, and we inherit every one of those errors. Flood levels are district-level baselines from BMA and JICA sources, not a survey of your building. Amenity and transit data come from OpenStreetMap and are only as current as its contributors.",
        },
        {
          kind: "p" as const,
          text:
            "We publish the methodology and the measurement date on the page so you can judge the number for yourself, and we correct errors when we find them or when you tell us about one. We do not warrant that anything here is accurate, complete or current.",
        },
      ],
    },
    {
      heading: "We are not a broker",
      blocks: [
        {
          kind: "p" as const,
          text:
            "We do not list, sell, let or manage property, and we are not your agent. If you ask for an expert opinion through a form, we pass your enquiry to one vetted independent broker. That broker is not us: any agreement you reach is between you and them, and we are not a party to it and take no responsibility for their advice or conduct. We are paid a flat referral by the broker only if a transaction closes, which we disclose here rather than burying it.",
        },
      ],
    },
    {
      heading: "AI answers",
      blocks: [
        {
          kind: "p" as const,
          text:
            "The Ask feature generates answers from our database using a language model. It can be wrong, can misread its own sources, and can present a stale figure with confidence. Treat its answers as a starting point and check the linked building pages, which show the underlying measurement and its date.",
        },
      ],
    },
    {
      heading: "Citing and reusing our data",
      blocks: [
        {
          kind: "p" as const,
          text:
            "You are welcome to quote our figures — in an article, a report, a forum post, or an AI-generated answer — provided you attribute them to RealData and link the page the number came from, so a reader can audit the measurement and its date. That is the deal, and it is why the site publishes an llms.txt describing every metric.",
        },
        {
          kind: "ul" as const,
          items: [
            "Do not present our measurements as your own or strip the attribution.",
            "Do not bulk-scrape the site or hammer it with automated requests. Rate limits and crawler throttles exist because this runs on a free hosting tier, and circumventing them is not permitted.",
            "Do not republish the database wholesale or resell it. For licensing, ask.",
            "Do not use the site to harass anyone, or to imply that a building or developer endorses you.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "The site's text, design, derived indices and the way the data is compiled belong to us. The underlying listings belong to the portals that host them.",
        },
      ],
    },
    {
      heading: "Advertising and third-party links",
      blocks: [
        {
          kind: "p" as const,
          text:
            "This site carries third-party display advertising and some outbound affiliate links, which are labelled where they appear. Advertisers have no access to our measurements and no influence over them; no building or developer can pay to change a number, a ranking, or a verdict. We are not responsible for the content of any advertisement or any site we link to.",
        },
      ],
    },
    {
      heading: "Availability",
      blocks: [
        {
          kind: "p" as const,
          text:
            "This is a small independent site on free infrastructure. It may be slow, may be down, may throttle automated traffic, and may change or remove any feature at any time without notice. No uptime is promised.",
        },
      ],
    },
    {
      heading: "Liability",
      blocks: [
        {
          kind: "p" as const,
          text:
            "The site is provided 'as is', without warranties of any kind to the fullest extent the law allows. We are not liable for any loss arising from your use of it or reliance on anything in it — including any purchase, sale or rental decision — whether that loss is direct, indirect, financial or otherwise. Nothing here excludes liability that cannot lawfully be excluded.",
        },
      ],
    },
    {
      heading: "Governing law, changes, contact",
      blocks: [
        {
          kind: "p" as const,
          text:
            "These terms are governed by the law of Thailand. We may update them; the date at the top of this page moves when we do, and continuing to use the site means you accept the current version. Questions, corrections and licensing enquiries: message " +
            TELEGRAM_HANDLE +
            " on Telegram, or use the contact form.",
        },
      ],
    },
  ],
};

const ko = {
  title: "이용약관",
  lead:
    "RealData가 무엇이고, 여기 숫자가 무엇이며 무엇이 아닌지, 그리고 사용 규칙. 한 줄 요약: 이 사이트의 모든 것은 측정값이지 자문이 아닙니다.",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "사이트 이용",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData(passionaryestate.com)는 태국 콘도 시장의 계산된 측정값을 게시합니다. 사이트를 이용하시면 본 약관에 동의하신 것으로 봅니다. 동의하지 않으시면 이용을 중단해 주세요. 열람은 무료이며 계정이 필요하지 않습니다.",
        },
      ],
    },
    {
      heading: "측정값이지 자문이 아닙니다",
      blocks: [
        {
          kind: "p" as const,
          text:
            "이 사이트의 어떤 내용도 투자·법률·세무·부동산 자문이 아니며, 매도 청약이나 매수 권유가 아닙니다. 수익률, 버블 지수, 침수 등급, 생활편의 점수를 비롯한 모든 수치는 매물 데이터에 공식을 적용한 결과물입니다. 이는 매물이 무엇이라고 표시했는지를 설명할 뿐, 해당 부동산의 가치나 미래 수익, 매수 여부의 타당성을 말해주지 않습니다.",
        },
        {
          kind: "p" as const,
          text:
            "태국 부동산에 자금을 투입하기 전에 독립적인 전문가 자문을 받고, 등기·외국인 쿼터·공용관리비·건물 상태·실제 호가 등 모든 중요한 사실을 매도인, 관리단(juristic person), 자격 있는 변호사를 통해 직접 확인하세요. 이 사이트의 숫자를 그 절차의 대체물로 삼지 마십시오.",
        },
      ],
    },
    {
      heading: "숫자의 출처와 오차 범위",
      blocks: [
        {
          kind: "p" as const,
          text:
            "가격·임대료·세대수는 hipflat, dotproperty, ddproperty, fazwaz의 공개 매물에서 산출됩니다. 매물 정보는 오래되었거나, 중복이거나, 가격이 잘못 기재되었거나, 등록자가 잘못 입력한 경우가 흔하며 저희는 그 오류를 그대로 물려받습니다. 침수 등급은 BMA·JICA 자료에 기반한 구(khet) 단위 기준선이며 특정 건물을 실측한 값이 아닙니다. 편의시설·교통 데이터는 OpenStreetMap에서 오며 기여자들이 갱신한 만큼만 최신입니다.",
        },
        {
          kind: "p" as const,
          text:
            "직접 판단하실 수 있도록 각 페이지에 산출 방법과 측정 시점을 함께 게시하며, 오류를 발견하거나 제보받으면 정정합니다. 다만 여기 있는 어떤 정보의 정확성·완전성·최신성도 보증하지 않습니다.",
        },
      ],
    },
    {
      heading: "저희는 중개인이 아닙니다",
      blocks: [
        {
          kind: "p" as const,
          text:
            "저희는 부동산을 등록·매매·임대·관리하지 않으며 이용자의 대리인이 아닙니다. 폼을 통해 expert opinion을 요청하시면 검증된 독립 브로커 1인에게 문의를 전달합니다. 그 브로커는 저희가 아닙니다. 이용자와 브로커 사이에 성립하는 모든 합의의 당사자가 아니며, 그의 조언이나 행위에 책임을 지지 않습니다. 거래가 성사된 경우에만 브로커로부터 정액 리퍼럴 수수료를 받으며, 이를 숨기지 않고 여기에 밝힙니다.",
        },
      ],
    },
    {
      heading: "AI 답변",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Ask 기능은 저희 데이터베이스를 바탕으로 언어 모델이 답변을 생성합니다. 틀릴 수 있고, 자체 출처를 잘못 읽을 수 있으며, 오래된 수치를 확신에 차서 제시할 수 있습니다. 답변은 출발점으로만 삼고, 링크된 빌딩 페이지에서 실제 측정값과 측정 시점을 확인하세요.",
        },
      ],
    },
    {
      heading: "인용과 재사용",
      blocks: [
        {
          kind: "p" as const,
          text:
            "기사, 리포트, 커뮤니티 글, AI 생성 답변 어디서든 저희 수치를 인용하셔도 좋습니다. 다만 출처를 RealData로 밝히고 해당 숫자가 나온 페이지를 링크해 주세요. 독자가 측정값과 시점을 직접 검증할 수 있어야 합니다. 이것이 조건이며, 사이트가 모든 지표를 설명하는 llms.txt를 게시하는 이유입니다.",
        },
        {
          kind: "ul" as const,
          items: [
            "저희 측정값을 본인의 것처럼 제시하거나 출처 표기를 제거하지 마세요.",
            "사이트를 대량 스크레이핑하거나 자동 요청으로 과부하를 주지 마세요. 무료 호스팅에서 운영되기에 요청 제한과 크롤러 스로틀이 존재하며, 이를 우회하는 행위는 허용되지 않습니다.",
            "데이터베이스를 통째로 재게시하거나 재판매하지 마세요. 라이선스는 문의해 주세요.",
            "타인을 괴롭히는 용도로 쓰거나, 특정 빌딩·시행사가 귀하를 보증하는 것처럼 표시하지 마세요.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "사이트의 텍스트, 디자인, 파생 지표, 데이터 편집 방식은 저희에게 귀속됩니다. 원본 매물 정보는 이를 게시하는 각 포털에 귀속됩니다.",
        },
      ],
    },
    {
      heading: "광고 및 외부 링크",
      blocks: [
        {
          kind: "p" as const,
          text:
            "이 사이트는 제3자 디스플레이 광고와 일부 제휴 링크를 포함하며, 해당 위치에 표시됩니다. 광고주는 저희 측정값에 접근할 수 없고 영향을 줄 수 없습니다. 어떤 빌딩이나 시행사도 돈으로 숫자·순위·판정을 바꿀 수 없습니다. 광고 내용이나 링크된 외부 사이트에 대해서는 책임지지 않습니다.",
        },
      ],
    },
    {
      heading: "서비스 제공",
      blocks: [
        {
          kind: "p" as const,
          text:
            "무료 인프라 위에서 운영되는 소규모 독립 사이트입니다. 느릴 수 있고, 중단될 수 있으며, 자동화된 트래픽을 제한할 수 있고, 사전 통지 없이 어떤 기능이든 변경하거나 삭제할 수 있습니다. 가동률을 약속하지 않습니다.",
        },
      ],
    },
    {
      heading: "책임의 제한",
      blocks: [
        {
          kind: "p" as const,
          text:
            "이 사이트는 법이 허용하는 최대 범위에서 어떠한 보증도 없이 '있는 그대로' 제공됩니다. 사이트 이용이나 게시 내용에 대한 신뢰로부터 발생하는 손해 — 매수·매도·임대 결정을 포함하여 직접·간접·금전적 손해 일체 — 에 대해 책임지지 않습니다. 법률상 배제할 수 없는 책임은 배제되지 않습니다.",
        },
      ],
    },
    {
      heading: "준거법, 변경, 문의",
      blocks: [
        {
          kind: "p" as const,
          text:
            "본 약관은 태국법을 준거법으로 합니다. 약관을 변경할 수 있으며, 변경 시 이 페이지 상단의 날짜가 갱신됩니다. 계속 이용하시면 현행 약관에 동의하신 것으로 봅니다. 문의·정정 요청·라이선스 문의: 텔레그램 " +
            TELEGRAM_HANDLE +
            " 또는 문의 폼을 이용해 주세요.",
        },
      ],
    },
  ],
};

const th = {
  title: "ข้อกำหนดการใช้งาน",
  lead:
    "RealData คืออะไร ตัวเลขในเว็บไซต์นี้คืออะไรและไม่ใช่อะไร และกฎการนำไปใช้ สรุปสั้น: ทุกอย่างที่นี่คือค่าที่วัดได้ ไม่ใช่คำแนะนำ",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "การใช้เว็บไซต์นี้",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData (passionaryestate.com) เผยแพร่ค่าที่คำนวณได้จากตลาดคอนโดไทย การใช้เว็บไซต์ถือว่าคุณยอมรับข้อกำหนดนี้ หากไม่ยอมรับ กรุณาอย่าใช้งาน การอ่านไม่มีค่าใช้จ่ายและไม่ต้องสมัครบัญชี",
        },
      ],
    },
    {
      heading: "เป็นค่าที่วัดได้ ไม่ใช่คำแนะนำ",
      blocks: [
        {
          kind: "p" as const,
          text:
            "ไม่มีสิ่งใดในเว็บไซต์นี้เป็นคำแนะนำด้านการลงทุน กฎหมาย ภาษี หรืออสังหาริมทรัพย์ และไม่ใช่การเสนอขายหรือชักชวนให้ซื้อ ผลตอบแทน Bubble Index ระดับน้ำท่วม Livability Score และตัวเลขอื่นทั้งหมดคือผลลัพธ์ของสูตรที่ใช้กับข้อมูลประกาศ ตัวเลขเหล่านี้อธิบายว่าประกาศระบุอะไรไว้ ไม่ได้บอกว่าทรัพย์มีมูลค่าเท่าใด จะให้ผลตอบแทนเท่าใด หรือคุณควรซื้อหรือไม่",
        },
        {
          kind: "p" as const,
          text:
            "ก่อนนำเงินไปลงกับอสังหาริมทรัพย์ไทย กรุณาขอคำแนะนำจากผู้เชี่ยวชาญอิสระ และตรวจสอบข้อเท็จจริงสำคัญทุกข้อด้วยตนเอง — โฉนด โควตาต่างชาติ ค่าส่วนกลาง สภาพอาคาร และราคาเสนอขายจริง — กับผู้ขาย นิติบุคคลอาคารชุด และทนายความที่มีคุณสมบัติ อย่าใช้ตัวเลขในเว็บไซต์นี้แทนขั้นตอนเหล่านั้น",
        },
      ],
    },
    {
      heading: "ตัวเลขมาจากไหน และผิดพลาดได้แค่ไหน",
      blocks: [
        {
          kind: "p" as const,
          text:
            "ราคา ค่าเช่า และจำนวนยูนิตคำนวณจากประกาศสาธารณะบน hipflat, dotproperty, ddproperty และ fazwaz ประกาศมักล้าสมัย ซ้ำซ้อน ตั้งราคาผิด หรือผู้ลงประกาศพิมพ์ผิด และเรารับข้อผิดพลาดเหล่านั้นมาทั้งหมด ระดับน้ำท่วมเป็นค่าพื้นฐานระดับเขตจากแหล่ง BMA และ JICA ไม่ใช่การสำรวจอาคารของคุณ ข้อมูลสิ่งอำนวยความสะดวกและระบบขนส่งมาจาก OpenStreetMap ซึ่งใหม่เท่าที่ผู้ร่วมแก้ไขอัปเดตไว้",
        },
        {
          kind: "p" as const,
          text:
            "เราเผยแพร่วิธีคำนวณและวันที่วัดไว้บนหน้าเว็บเพื่อให้คุณตัดสินตัวเลขได้เอง และเราแก้ไขข้อผิดพลาดเมื่อพบหรือเมื่อคุณแจ้ง แต่เราไม่รับประกันว่าข้อมูลใดถูกต้อง ครบถ้วน หรือเป็นปัจจุบัน",
        },
      ],
    },
    {
      heading: "เราไม่ใช่นายหน้า",
      blocks: [
        {
          kind: "p" as const,
          text:
            "เราไม่ลงประกาศ ไม่ขาย ไม่ปล่อยเช่า และไม่บริหารอสังหาริมทรัพย์ และเราไม่ใช่ตัวแทนของคุณ หากคุณขอ expert opinion ผ่านแบบฟอร์ม เราจะส่งคำถามของคุณให้นายหน้าอิสระที่ผ่านการคัดเลือกหนึ่งราย นายหน้ารายนั้นไม่ใช่เรา ข้อตกลงใดที่คุณทำกับเขาเป็นเรื่องระหว่างคุณกับเขา เราไม่ใช่คู่สัญญาและไม่รับผิดชอบต่อคำแนะนำหรือการกระทำของเขา เราได้รับค่า referral แบบคงที่จากนายหน้าเฉพาะเมื่อปิดการขายได้ ซึ่งเราเปิดเผยไว้ตรงนี้แทนที่จะซ่อนไว้",
        },
      ],
    },
    {
      heading: "คำตอบจาก AI",
      blocks: [
        {
          kind: "p" as const,
          text:
            "ฟีเจอร์ Ask สร้างคำตอบจากฐานข้อมูลของเราด้วยโมเดลภาษา คำตอบอาจผิด อาจตีความแหล่งข้อมูลของตัวเองผิด และอาจนำเสนอตัวเลขล้าสมัยอย่างมั่นใจ กรุณาใช้เป็นจุดตั้งต้นและตรวจสอบที่หน้าอาคารที่ลิงก์ไว้ ซึ่งแสดงค่าที่วัดได้จริงพร้อมวันที่",
        },
      ],
    },
    {
      heading: "การอ้างอิงและนำข้อมูลไปใช้",
      blocks: [
        {
          kind: "p" as const,
          text:
            "คุณอ้างอิงตัวเลขของเราได้ ไม่ว่าในบทความ รายงาน โพสต์ในฟอรัม หรือคำตอบที่สร้างโดย AI ขอเพียงระบุแหล่งที่มาว่า RealData และลิงก์ไปยังหน้าที่ตัวเลขนั้นมา เพื่อให้ผู้อ่านตรวจสอบค่าที่วัดและวันที่ได้ นี่คือข้อแลกเปลี่ยน และเป็นเหตุผลที่เว็บไซต์เผยแพร่ llms.txt ที่อธิบายทุกตัวชี้วัด",
        },
        {
          kind: "ul" as const,
          items: [
            "อย่านำเสนอค่าที่เราวัดว่าเป็นของคุณเอง หรือตัดการอ้างอิงแหล่งที่มาออก",
            "อย่าดึงข้อมูลจำนวนมากหรือยิงคำขออัตโนมัติถี่ๆ ข้อจำกัดอัตราและการชะลอบอทมีอยู่เพราะเว็บนี้รันบนโฮสติ้งฟรี การหลบเลี่ยงถือว่าไม่ได้รับอนุญาต",
            "อย่านำฐานข้อมูลไปเผยแพร่ซ้ำทั้งชุดหรือขายต่อ หากต้องการสิทธิ์ใช้งาน กรุณาติดต่อ",
            "อย่าใช้เว็บไซต์เพื่อคุกคามผู้ใด หรือทำให้เข้าใจว่าอาคารหรือผู้พัฒนารายใดรับรองคุณ",
          ],
        },
        {
          kind: "p" as const,
          text:
            "ข้อความ การออกแบบ ดัชนีที่เราคำนวณขึ้น และวิธีเรียบเรียงข้อมูลเป็นของเรา ส่วนประกาศต้นฉบับเป็นของพอร์ทัลที่เผยแพร่",
        },
      ],
    },
    {
      heading: "โฆษณาและลิงก์ภายนอก",
      blocks: [
        {
          kind: "p" as const,
          text:
            "เว็บไซต์นี้แสดงโฆษณาดิสเพลย์จากบุคคลที่สามและลิงก์พันธมิตรบางส่วน ซึ่งระบุไว้ ณ ตำแหน่งที่ปรากฏ ผู้ลงโฆษณาไม่มีสิทธิ์เข้าถึงและไม่มีอิทธิพลต่อค่าที่เราวัด ไม่มีอาคารหรือผู้พัฒนารายใดจ่ายเงินเพื่อเปลี่ยนตัวเลข อันดับ หรือคำตัดสินได้ เราไม่รับผิดชอบต่อเนื้อหาโฆษณาหรือเว็บไซต์ที่เราลิงก์ไป",
        },
      ],
    },
    {
      heading: "ความพร้อมใช้งาน",
      blocks: [
        {
          kind: "p" as const,
          text:
            "นี่เป็นเว็บไซต์อิสระขนาดเล็กบนโครงสร้างพื้นฐานฟรี อาจช้า อาจล่ม อาจจำกัดทราฟฟิกอัตโนมัติ และอาจเปลี่ยนหรือถอดฟีเจอร์ใดก็ได้โดยไม่แจ้งล่วงหน้า เราไม่รับประกันเวลาให้บริการ",
        },
      ],
    },
    {
      heading: "ความรับผิด",
      blocks: [
        {
          kind: "p" as const,
          text:
            "เว็บไซต์ให้บริการ 'ตามสภาพ' โดยไม่มีการรับประกันใดๆ เท่าที่กฎหมายอนุญาต เราไม่รับผิดต่อความเสียหายใดที่เกิดจากการใช้งานหรือการเชื่อถือเนื้อหาในเว็บไซต์ รวมถึงการตัดสินใจซื้อ ขาย หรือเช่า ไม่ว่าจะเป็นความเสียหายทางตรง ทางอ้อม ทางการเงิน หรืออื่นใด ทั้งนี้ไม่ยกเว้นความรับผิดที่กฎหมายไม่อนุญาตให้ยกเว้น",
        },
      ],
    },
    {
      heading: "กฎหมายที่ใช้บังคับ การเปลี่ยนแปลง และการติดต่อ",
      blocks: [
        {
          kind: "p" as const,
          text:
            "ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย เราอาจปรับปรุงข้อกำหนด โดยวันที่ด้านบนของหน้านี้จะเปลี่ยนตาม และการใช้งานต่อถือว่าคุณยอมรับฉบับปัจจุบัน คำถาม การขอแก้ไข และการขอสิทธิ์ใช้งานข้อมูล: ทักหาเราที่ Telegram " +
            TELEGRAM_HANDLE +
            " หรือใช้แบบฟอร์มติดต่อ",
        },
      ],
    },
  ],
};

export const TERMS: LegalDocumentSet = { en, ko, th };
