import { TELEGRAM_HANDLE } from "@/lib/contactChannels";

import type { LegalDocumentSet } from "./types";

// Every claim below was checked against the code rather than copied from a
// template, because a policy that describes a different site is worth less
// than no policy at all. The specific things it has to be right about:
//
//   app/api/leads/route.ts:153     lead row: name, email, phone, budget_min,
//                                  budget_max, timeline, purpose, nationality,
//                                  message, condo_id, source_url, referrer,
//                                  user_agent, ip_hash
//   app/api/contact/route.ts:131   same table, fewer columns
//   app/api/alerts/subscribe       email only, alert_subscribers
//   app/api/ask/route.ts:1,18      question text goes to Anthropic's API;
//                                  IP is sha1-hashed in memory for rate
//                                  limiting and never written to the DB
//   middleware.ts:241              `lang` cookie, 1 year
//   lib/saved-condos.ts,
//   lib/compare-queue.ts           localStorage only, never transmitted
//
// Update this file whenever one of those changes.
// Contact for data-subject requests. There is deliberately no email address
// here: the site publishes one channel, the Telegram bot that already
// receives lead notifications, so requests land in an inbox that is actually
// read. See lib/contactChannels.ts.
const EFFECTIVE = "2026-08-21";

const en = {
  title: "Privacy Policy",
  lead:
    "What RealData collects, why, who it goes to, and how to make us delete it. Written against the actual code, not a template.",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "Who we are",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData (passionaryestate.com) is an independent Thai condo measurement site run by a single operator. For anything in this policy, including a request to see or delete your data, message " +
            TELEGRAM_HANDLE +
            " on Telegram or use the contact form. We answer within 2 business days.",
        },
        {
          kind: "p" as const,
          text:
            "You can read every page on this site without giving us anything. We only receive personal data if you choose to send it — by submitting a form, subscribing to alerts, or asking the AI a question.",
        },
      ],
    },
    {
      heading: "What we collect, and why",
      blocks: [
        {
          kind: "dl" as const,
          items: [
            {
              k: "Consultation and contact forms",
              v:
                "Your email, and optionally your name, phone or LINE ID, budget range, timeline, purpose, nationality and message. We also record which page you sent it from, the referring page, your browser's user-agent string, and a one-way hash of your IP address (spam and abuse control — we cannot reverse it back to your IP). We use this only to route your request to one vetted independent broker and to reply to you. Legal basis: your request and your consent, given by submitting the form.",
            },
            {
              k: "Underpriced-listing alerts",
              v:
                "Your email address, nothing else. Used only to send the alerts you asked for. Unsubscribe at any time by writing to us.",
            },
            {
              k: "Ask RealData (the AI answer feature)",
              v:
                "The question you type is sent to Anthropic's API to generate the answer, together with the condo data we retrieve for it. Please do not type personal details into it. We hash your IP address in memory to rate-limit abuse; that hash is never written to our database and disappears when the server instance recycles.",
            },
            {
              k: "Analytics",
              v:
                "Aggregate page views and referrers via Cloudflare Web Analytics, which sets no cookies and does not fingerprint visitors. We cannot identify you from it.",
            },
            {
              k: "Advertising",
              v:
                "This site carries third-party display advertising. Ad networks, including Google, may set cookies or read device identifiers to measure and select ads. See section 4.",
            },
            {
              k: "Server logs",
              v:
                "Our hosting and CDN providers keep short-lived request logs, including IP addresses, as every web host does. We do not build profiles from them.",
            },
          ],
        },
        {
          kind: "p" as const,
          text:
            "We do not buy personal data, we do not sell it, and we do not run email marketing beyond the alerts you explicitly subscribe to.",
        },
      ],
    },
    {
      heading: "Cookies and browser storage",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "lang — remembers which of English, Korean or Thai you chose. One year. Set by us, not shared.",
            "Saved condos and the comparison queue live in your browser's local storage. They never leave your device and we cannot read them.",
            "The Ask page keeps one flag in session storage so it stops re-asking you the same thing in one visit.",
            "admin_session — only ever set for the site operator signing in to the admin area.",
            "Advertising and, where enabled, consent-management cookies set by Google. These are described in section 4 and are subject to your consent choice where the law requires one.",
          ],
        },
      ],
    },
    {
      heading: "Advertising and your choices",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Advertising is sold and served by a third-party network. It has no access to our measurements and no influence on what this site says about any building — that separation is the point, and it is why developer money buys nothing here.",
        },
        {
          kind: "p" as const,
          text:
            "Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this and/or other sites. You can opt out of personalised advertising by visiting Google's Ads Settings, or opt out of a third-party vendor's use of cookies for personalised advertising at aboutads.info.",
        },
        {
          kind: "p" as const,
          text:
            "If you are in the European Economic Area, the United Kingdom or Switzerland, we ask for your consent before any non-essential cookie is set, through a consent management platform certified under the IAB Transparency and Consent Framework. You can change or withdraw that choice at any time from the consent link in the page footer. Choosing not to consent means you see non-personalised ads, not fewer pages — nothing on this site is behind a consent wall.",
        },
      ],
    },
    {
      heading: "Who your data goes to",
      blocks: [
        {
          kind: "p" as const,
          text:
            "We use a small number of service providers, each of which processes data only on our instructions:",
        },
        {
          kind: "ul" as const,
          items: [
            "Supabase — the database that stores leads and alert subscriptions.",
            "Vercel — hosting and content delivery.",
            "Cloudflare — CDN, bot protection and cookieless analytics.",
            "Anthropic — processes the text of Ask questions to produce an answer.",
            "Google — advertising and, where enabled, consent management.",
            "Telegram — receives an internal operations notification when a new lead arrives.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "The one time we share data with someone who is not a processor is the point of the consultation form itself: if you ask for an expert opinion, we pass your enquiry to one vetted independent broker so they can answer it. That is the only reason the form exists, and it is the only onward disclosure we make. We never hand your details to a condo developer.",
        },
        {
          kind: "p" as const,
          text:
            "Some of these providers are outside Thailand and the EEA, so your data may be transferred internationally and processed under those providers' standard contractual protections.",
        },
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "Consultation and contact enquiries: up to 24 months, so we can follow up and resolve disputes, then deleted.",
            "Alert subscriptions: until you unsubscribe.",
            "Ask questions: not stored by us. Anthropic's own retention applies to the text sent to their API.",
            "Provider server logs: per each provider's own retention, typically days to weeks.",
          ],
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Wherever you live, you can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete it, and we will do it. Message " +
            TELEGRAM_HANDLE +
            " on Telegram, or use the contact form. Tell us enough to find your record — the email address you gave us, or roughly when you wrote in.",
        },
        {
          kind: "ul" as const,
          items: [
            "Thailand (PDPA): access, rectification, erasure, restriction, objection, portability, and withdrawal of consent.",
            "EEA / UK (GDPR): the same rights, plus the right to complain to your national data protection authority.",
            "California (CCPA/CPRA): the right to know, delete, correct, and to opt out of sale or sharing. We do not sell personal information. Advertising cookies may count as 'sharing' for cross-context behavioural advertising; the consent controls in section 4 are how you opt out.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "Withdrawing consent does not undo processing we already did lawfully, and we may keep the minimum needed to show we handled a request.",
        },
      ],
    },
    {
      heading: "Children",
      blocks: [
        {
          kind: "p" as const,
          text:
            "This site is aimed at adults evaluating property. It is not directed at children and we do not knowingly collect data from anyone under 16. If you believe a child has sent us something, tell us and we will delete it.",
        },
      ],
    },
    {
      heading: "Security, and what we can honestly promise",
      blocks: [
        {
          kind: "p" as const,
          text:
            "Traffic is encrypted in transit, the database sits behind row-level access rules, and the admin area is behind a signed session. This is a small independent site, so we will not claim certifications we do not hold. Please do not send us documents, identification, or financial details through the forms — nothing on this site needs them.",
        },
      ],
    },
    {
      heading: "Changes to this policy",
      blocks: [
        {
          kind: "p" as const,
          text:
            "If we change what we collect or who it goes to, we update this page and move the date at the top. Material changes will also be noted on the homepage.",
        },
      ],
    },
  ],
};

const ko = {
  title: "개인정보처리방침",
  lead:
    "RealData가 무엇을 수집하고, 왜 수집하며, 누구에게 전달되고, 어떻게 삭제를 요청하는지. 템플릿이 아니라 실제 코드를 기준으로 작성했습니다.",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "운영 주체",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData(passionaryestate.com)는 1인이 운영하는 독립 태국 콘도 측정 사이트입니다. 본 방침과 관련한 모든 문의, 열람·삭제 요청은 텔레그램 " +
            TELEGRAM_HANDLE +
            " 또는 문의 폼으로 보내주세요. 영업일 2일 내에 답변합니다.",
        },
        {
          kind: "p" as const,
          text:
            "이 사이트의 모든 페이지는 아무것도 제공하지 않고 열람할 수 있습니다. 개인정보는 이용자가 직접 보낼 때 — 폼을 제출하거나, 알림을 구독하거나, AI에 질문할 때 — 만 저희에게 전달됩니다.",
        },
      ],
    },
    {
      heading: "수집 항목과 목적",
      blocks: [
        {
          kind: "dl" as const,
          items: [
            {
              k: "상담·문의 폼",
              v:
                "이메일, 그리고 선택 입력하신 이름·전화번호 또는 LINE ID·예산 범위·시점·목적·국적·메시지. 함께 폼을 보낸 페이지 주소, 유입 경로, 브라우저 User-Agent 문자열, IP 주소의 단방향 해시(스팸·남용 방지용이며 원래 IP로 되돌릴 수 없습니다)를 기록합니다. 이 정보는 요청을 검증된 독립 브로커 1인에게 전달하고 회신하는 목적으로만 사용합니다. 근거: 이용자의 요청 및 폼 제출로 표시된 동의.",
            },
            {
              k: "저평가 매물 알림",
              v: "이메일 주소만 수집합니다. 신청하신 알림 발송에만 사용하며, 연락 주시면 언제든 해지합니다.",
            },
            {
              k: "Ask RealData (AI 답변 기능)",
              v:
                "입력하신 질문은 답변 생성을 위해 검색된 콘도 데이터와 함께 Anthropic API로 전송됩니다. 개인정보는 입력하지 말아 주세요. 남용 방지를 위해 IP를 메모리상에서 해시하지만, 이 값은 데이터베이스에 저장되지 않으며 서버 인스턴스가 재기동되면 사라집니다.",
            },
            {
              k: "분석",
              v:
                "Cloudflare Web Analytics로 집계된 페이지뷰와 유입 경로만 봅니다. 쿠키를 설정하지 않고 방문자 지문도 수집하지 않으므로 개인을 식별할 수 없습니다.",
            },
            {
              k: "광고",
              v:
                "이 사이트는 제3자 디스플레이 광고를 게재합니다. Google을 포함한 광고 네트워크가 광고 측정·선택을 위해 쿠키를 설정하거나 기기 식별자를 읽을 수 있습니다. 4항을 참고하세요.",
            },
            {
              k: "서버 로그",
              v:
                "호스팅·CDN 제공자가 다른 모든 웹 호스트와 마찬가지로 IP를 포함한 단기 요청 로그를 보관합니다. 저희는 이것으로 프로필을 만들지 않습니다.",
            },
          ],
        },
        {
          kind: "p" as const,
          text:
            "개인정보를 구매하지 않고, 판매하지 않으며, 명시적으로 구독하신 알림 외에 이메일 마케팅을 하지 않습니다.",
        },
      ],
    },
    {
      heading: "쿠키와 브라우저 저장소",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "lang — 선택하신 언어(한국어·영어·태국어)를 기억합니다. 1년. 저희가 설정하며 외부와 공유하지 않습니다.",
            "저장한 콘도와 비교 목록은 브라우저 로컬 저장소에만 있습니다. 기기를 벗어나지 않으며 저희는 읽을 수 없습니다.",
            "Ask 페이지는 한 번의 방문에서 같은 요청을 반복하지 않도록 세션 저장소에 플래그 하나를 둡니다.",
            "admin_session — 운영자가 관리자 영역에 로그인할 때만 설정됩니다.",
            "광고 쿠키 및 (적용 지역에서) 동의 관리 쿠키는 Google이 설정합니다. 4항에서 설명하며, 법이 요구하는 지역에서는 이용자의 동의 선택을 따릅니다.",
          ],
        },
      ],
    },
    {
      heading: "광고와 선택권",
      blocks: [
        {
          kind: "p" as const,
          text:
            "광고는 제3자 네트워크가 판매·송출합니다. 이들은 저희 측정값에 접근할 수 없고, 이 사이트가 특정 빌딩에 대해 말하는 내용에 영향을 줄 수 없습니다. 이 분리가 핵심이며, 시행사 돈으로 이곳에서 아무것도 살 수 없는 이유입니다.",
        },
        {
          kind: "p" as const,
          text:
            "Google을 포함한 제3자 공급업체는 이용자가 이 사이트 또는 다른 사이트를 방문한 이력을 기반으로 광고를 게재하기 위해 쿠키를 사용합니다. Google의 광고 쿠키 사용을 통해 Google과 그 파트너는 이용자의 방문 기록에 기반한 광고를 게재할 수 있습니다. 개인 맞춤 광고는 Google 광고 설정에서, 제3자 공급업체의 맞춤 광고 쿠키 사용은 aboutads.info에서 거부할 수 있습니다.",
        },
        {
          kind: "p" as const,
          text:
            "유럽경제지역·영국·스위스에 계신 경우, 필수가 아닌 쿠키를 설정하기 전에 IAB Transparency and Consent Framework 인증 동의 관리 플랫폼을 통해 동의를 요청합니다. 페이지 하단의 동의 링크에서 언제든 변경하거나 철회할 수 있습니다. 동의하지 않으시면 맞춤 광고 대신 비맞춤 광고가 표시될 뿐이며, 볼 수 있는 페이지가 줄어들지 않습니다 — 이 사이트에는 동의를 조건으로 잠긴 콘텐츠가 없습니다.",
        },
      ],
    },
    {
      heading: "제공 및 위탁",
      blocks: [
        {
          kind: "p" as const,
          text: "저희 지시에 따라서만 데이터를 처리하는 소수의 서비스 제공자를 이용합니다:",
        },
        {
          kind: "ul" as const,
          items: [
            "Supabase — 리드와 알림 구독을 저장하는 데이터베이스.",
            "Vercel — 호스팅 및 콘텐츠 전송.",
            "Cloudflare — CDN, 봇 차단, 쿠키 없는 분석.",
            "Anthropic — Ask 질문 텍스트를 처리해 답변을 생성.",
            "Google — 광고 및 (적용 지역에서) 동의 관리.",
            "Telegram — 새 리드 도착 시 내부 운영 알림 수신.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "위탁이 아닌 제3자 제공은 상담 폼의 목적 그 자체인 경우 한 건뿐입니다: expert opinion을 요청하시면 답변할 수 있도록 검증된 독립 브로커 1인에게 문의 내용을 전달합니다. 폼이 존재하는 유일한 이유이자 저희가 하는 유일한 제3자 제공입니다. 콘도 시행사에게는 절대 전달하지 않습니다.",
        },
        {
          kind: "p" as const,
          text:
            "일부 제공자는 태국·EEA 밖에 있으므로 데이터가 국외로 이전되어 해당 제공자의 표준계약 보호 아래 처리될 수 있습니다.",
        },
      ],
    },
    {
      heading: "보유 기간",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "상담·문의: 후속 연락과 분쟁 해결을 위해 최대 24개월 보관 후 삭제.",
            "알림 구독: 해지하실 때까지.",
            "Ask 질문: 저희는 저장하지 않습니다. API로 전송된 텍스트에는 Anthropic의 자체 보관 정책이 적용됩니다.",
            "제공자 서버 로그: 각 제공자의 보관 정책에 따르며 통상 수일~수주.",
          ],
        },
      ],
    },
    {
      heading: "이용자의 권리",
      blocks: [
        {
          kind: "p" as const,
          text:
            "거주 국가와 무관하게, 저희가 보유한 정보의 사본 요청·정정·삭제를 요청하실 수 있으며 저희는 이행합니다. 텔레그램 " +
            TELEGRAM_HANDLE +
            " 으로 메시지를 보내시거나 문의 폼을 이용해 주세요. 기록을 찾을 수 있도록 알려주셨던 이메일 주소나 문의 시점을 함께 적어주세요.",
        },
        {
          kind: "ul" as const,
          items: [
            "태국 (PDPA): 열람, 정정, 삭제, 처리 제한, 반대, 이동, 동의 철회.",
            "EEA / 영국 (GDPR): 위와 동일한 권리 및 자국 개인정보 감독기구에 민원을 제기할 권리.",
            "캘리포니아 (CCPA/CPRA): 알 권리, 삭제, 정정, 판매·공유 거부. 저희는 개인정보를 판매하지 않습니다. 광고 쿠키는 교차 맥락 행동 광고 목적의 '공유'에 해당할 수 있으며, 4항의 동의 설정이 거부 수단입니다.",
          ],
        },
        {
          kind: "p" as const,
          text:
            "동의 철회는 이미 적법하게 이루어진 처리를 소급해 무효로 하지 않으며, 요청 처리 사실을 입증하기 위한 최소한의 기록은 보관할 수 있습니다.",
        },
      ],
    },
    {
      heading: "아동",
      blocks: [
        {
          kind: "p" as const,
          text:
            "이 사이트는 부동산을 검토하는 성인을 대상으로 합니다. 아동을 대상으로 하지 않으며 만 16세 미만의 정보를 알고서 수집하지 않습니다. 아동이 정보를 보냈다고 판단되면 알려주세요. 삭제하겠습니다.",
        },
      ],
    },
    {
      heading: "보안, 그리고 정직하게 약속할 수 있는 것",
      blocks: [
        {
          kind: "p" as const,
          text:
            "전송 구간은 암호화되고, 데이터베이스는 행 수준 접근 규칙 뒤에 있으며, 관리자 영역은 서명된 세션으로 보호됩니다. 소규모 독립 사이트이므로 보유하지 않은 인증을 주장하지 않겠습니다. 폼을 통해 신분증·서류·금융 정보를 보내지 말아 주세요. 이 사이트의 어떤 기능도 그것을 필요로 하지 않습니다.",
        },
      ],
    },
    {
      heading: "방침 변경",
      blocks: [
        {
          kind: "p" as const,
          text:
            "수집 항목이나 제공처가 바뀌면 이 페이지를 갱신하고 상단 날짜를 옮깁니다. 중대한 변경은 홈페이지에도 안내합니다.",
        },
      ],
    },
  ],
};

const th = {
  title: "นโยบายความเป็นส่วนตัว",
  lead:
    "RealData เก็บข้อมูลอะไร เพื่ออะไร ส่งต่อให้ใคร และคุณจะขอให้ลบได้อย่างไร เขียนขึ้นจากโค้ดจริงของเว็บไซต์ ไม่ใช่แม่แบบสำเร็จรูป",
  effective: EFFECTIVE,
  sections: [
    {
      heading: "เราคือใคร",
      blocks: [
        {
          kind: "p" as const,
          text:
            "RealData (passionaryestate.com) เป็นเว็บไซต์วัดข้อมูลคอนโดไทยอิสระ ดำเนินการโดยผู้ดูแลคนเดียว หากมีคำถามเกี่ยวกับนโยบายนี้ รวมถึงการขอดูหรือขอลบข้อมูลของคุณ กรุณาทักหาเราที่ Telegram " +
            TELEGRAM_HANDLE +
            " หรือใช้แบบฟอร์มติดต่อ เราตอบกลับภายใน 2 วันทำการ",
        },
        {
          kind: "p" as const,
          text:
            "คุณอ่านทุกหน้าในเว็บไซต์นี้ได้โดยไม่ต้องให้ข้อมูลใดๆ เราได้รับข้อมูลส่วนบุคคลก็ต่อเมื่อคุณเลือกส่งมาเอง — โดยกรอกแบบฟอร์ม สมัครรับการแจ้งเตือน หรือถามคำถามกับ AI",
        },
      ],
    },
    {
      heading: "เราเก็บอะไร และเพื่ออะไร",
      blocks: [
        {
          kind: "dl" as const,
          items: [
            {
              k: "แบบฟอร์มปรึกษาและติดต่อ",
              v:
                "อีเมลของคุณ และหากคุณกรอก ชื่อ เบอร์โทรหรือ LINE ID ช่วงงบประมาณ กรอบเวลา วัตถุประสงค์ สัญชาติ และข้อความ เราบันทึกด้วยว่าคุณส่งมาจากหน้าไหน หน้าที่อ้างอิงมา สตริง User-Agent ของเบราว์เซอร์ และค่าแฮชทางเดียวของหมายเลข IP (เพื่อป้องกันสแปมและการใช้งานในทางมิชอบ เราย้อนกลับเป็น IP เดิมไม่ได้) เราใช้ข้อมูลนี้เพื่อส่งคำขอของคุณให้นายหน้าอิสระที่ผ่านการคัดเลือกหนึ่งรายและเพื่อตอบกลับคุณเท่านั้น ฐานทางกฎหมาย: คำขอของคุณและความยินยอมที่แสดงโดยการส่งแบบฟอร์ม",
            },
            {
              k: "การแจ้งเตือนประกาศราคาต่ำกว่าตลาด",
              v: "เฉพาะอีเมลเท่านั้น ใช้ส่งการแจ้งเตือนที่คุณขอไว้เท่านั้น ยกเลิกได้ทุกเมื่อโดยติดต่อเรา",
            },
            {
              k: "Ask RealData (ฟีเจอร์ตอบคำถามด้วย AI)",
              v:
                "คำถามที่คุณพิมพ์จะถูกส่งไปยัง API ของ Anthropic พร้อมข้อมูลคอนโดที่เราดึงมาประกอบ เพื่อสร้างคำตอบ กรุณาอย่าพิมพ์ข้อมูลส่วนบุคคลลงไป เราแฮชหมายเลข IP ไว้ในหน่วยความจำเพื่อจำกัดอัตราการใช้งาน ค่าดังกล่าวไม่ถูกบันทึกลงฐานข้อมูลและหายไปเมื่อเซิร์ฟเวอร์รีสตาร์ท",
            },
            {
              k: "การวิเคราะห์",
              v:
                "ยอดเข้าชมและแหล่งที่มาแบบรวมผ่าน Cloudflare Web Analytics ซึ่งไม่ตั้งคุกกี้และไม่เก็บลายนิ้วมือดิจิทัล เราจึงระบุตัวคุณไม่ได้",
            },
            {
              k: "โฆษณา",
              v:
                "เว็บไซต์นี้แสดงโฆษณาดิสเพลย์จากบุคคลที่สาม เครือข่ายโฆษณารวมถึง Google อาจตั้งคุกกี้หรืออ่านตัวระบุอุปกรณ์เพื่อวัดผลและเลือกโฆษณา ดูข้อ 4",
            },
            {
              k: "บันทึกเซิร์ฟเวอร์",
              v:
                "ผู้ให้บริการโฮสติ้งและ CDN เก็บบันทึกคำขอระยะสั้นซึ่งรวมหมายเลข IP เช่นเดียวกับเว็บโฮสต์ทุกราย เราไม่นำมาสร้างโปรไฟล์",
            },
          ],
        },
        {
          kind: "p" as const,
          text:
            "เราไม่ซื้อข้อมูลส่วนบุคคล ไม่ขาย และไม่ทำการตลาดทางอีเมลนอกเหนือจากการแจ้งเตือนที่คุณสมัครไว้อย่างชัดแจ้ง",
        },
      ],
    },
    {
      heading: "คุกกี้และพื้นที่จัดเก็บในเบราว์เซอร์",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "lang — จำภาษาที่คุณเลือก (อังกฤษ เกาหลี ไทย) อายุ 1 ปี ตั้งโดยเรา ไม่แบ่งปันให้ผู้ใด",
            "คอนโดที่บันทึกไว้และรายการเปรียบเทียบอยู่ใน local storage ของเบราว์เซอร์เท่านั้น ไม่ออกจากอุปกรณ์ของคุณและเราอ่านไม่ได้",
            "หน้า Ask เก็บค่าสถานะหนึ่งค่าใน session storage เพื่อไม่ถามคุณซ้ำในการเข้าชมครั้งเดียวกัน",
            "admin_session — ตั้งเฉพาะตอนผู้ดูแลเว็บไซต์เข้าสู่ระบบส่วนผู้ดูแลเท่านั้น",
            "คุกกี้โฆษณาและคุกกี้จัดการความยินยอม (ในพื้นที่ที่บังคับใช้) ตั้งโดย Google อธิบายไว้ในข้อ 4 และเป็นไปตามการเลือกให้ความยินยอมของคุณตามที่กฎหมายกำหนด",
          ],
        },
      ],
    },
    {
      heading: "โฆษณาและสิทธิ์เลือกของคุณ",
      blocks: [
        {
          kind: "p" as const,
          text:
            "โฆษณาขายและให้บริการโดยเครือข่ายภายนอก ซึ่งไม่มีสิทธิ์เข้าถึงข้อมูลที่เราวัดและไม่มีอิทธิพลต่อสิ่งที่เว็บไซต์นี้ระบุเกี่ยวกับอาคารใด การแยกส่วนนี้คือหัวใจ และเป็นเหตุผลว่าทำไมเงินจากดีเวลลอปเปอร์ซื้ออะไรที่นี่ไม่ได้",
        },
        {
          kind: "p" as const,
          text:
            "ผู้ให้บริการบุคคลที่สามรวมถึง Google ใช้คุกกี้เพื่อแสดงโฆษณาตามประวัติการเข้าชมเว็บไซต์นี้หรือเว็บไซต์อื่นของคุณ การใช้คุกกี้โฆษณาของ Google ช่วยให้ Google และพาร์ทเนอร์แสดงโฆษณาแก่คุณตามการเข้าชมของคุณ คุณเลือกไม่รับโฆษณาที่ปรับตามบุคคลได้ที่การตั้งค่าโฆษณาของ Google หรือเลือกไม่รับการใช้คุกกี้ของผู้ให้บริการบุคคลที่สามได้ที่ aboutads.info",
        },
        {
          kind: "p" as const,
          text:
            "หากคุณอยู่ในเขตเศรษฐกิจยุโรป สหราชอาณาจักร หรือสวิตเซอร์แลนด์ เราจะขอความยินยอมก่อนตั้งคุกกี้ที่ไม่จำเป็น ผ่านแพลตฟอร์มจัดการความยินยอมที่ได้รับการรับรองตามกรอบ IAB Transparency and Consent Framework คุณเปลี่ยนหรือถอนความยินยอมได้ทุกเมื่อจากลิงก์ความยินยอมที่ท้ายหน้า การไม่ให้ความยินยอมหมายถึงคุณเห็นโฆษณาที่ไม่ปรับตามบุคคล ไม่ใช่เห็นเนื้อหาน้อยลง — ไม่มีเนื้อหาใดในเว็บไซต์นี้ถูกล็อกไว้หลังความยินยอม",
        },
      ],
    },
    {
      heading: "ข้อมูลของคุณไปถึงใคร",
      blocks: [
        {
          kind: "p" as const,
          text: "เราใช้ผู้ให้บริการจำนวนน้อยราย ซึ่งแต่ละรายประมวลผลข้อมูลตามคำสั่งของเราเท่านั้น:",
        },
        {
          kind: "ul" as const,
          items: [
            "Supabase — ฐานข้อมูลที่เก็บ lead และการสมัครรับการแจ้งเตือน",
            "Vercel — โฮสติ้งและการส่งมอบเนื้อหา",
            "Cloudflare — CDN การป้องกันบอท และการวิเคราะห์แบบไม่ใช้คุกกี้",
            "Anthropic — ประมวลผลข้อความคำถาม Ask เพื่อสร้างคำตอบ",
            "Google — โฆษณา และการจัดการความยินยอมในพื้นที่ที่บังคับใช้",
            "Telegram — รับการแจ้งเตือนภายในเมื่อมี lead ใหม่เข้ามา",
          ],
        },
        {
          kind: "p" as const,
          text:
            "การเปิดเผยให้ผู้ที่ไม่ใช่ผู้ประมวลผลมีเพียงกรณีเดียว ซึ่งคือวัตถุประสงค์ของแบบฟอร์มปรึกษาเอง: หากคุณขอ expert opinion เราจะส่งคำถามของคุณให้นายหน้าอิสระที่ผ่านการคัดเลือกหนึ่งรายเพื่อตอบคุณ นี่คือเหตุผลเดียวที่แบบฟอร์มนี้มีอยู่ และเป็นการเปิดเผยต่อบุคคลภายนอกเพียงอย่างเดียวที่เราทำ เราไม่ส่งข้อมูลของคุณให้ดีเวลลอปเปอร์คอนโดเด็ดขาด",
        },
        {
          kind: "p" as const,
          text:
            "ผู้ให้บริการบางรายอยู่นอกประเทศไทยและนอก EEA ข้อมูลของคุณจึงอาจถูกโอนไปต่างประเทศและประมวลผลภายใต้ข้อสัญญามาตรฐานของผู้ให้บริการเหล่านั้น",
        },
      ],
    },
    {
      heading: "เราเก็บไว้นานแค่ไหน",
      blocks: [
        {
          kind: "ul" as const,
          items: [
            "คำขอปรึกษาและติดต่อ: ไม่เกิน 24 เดือน เพื่อการติดตามและระงับข้อพิพาท จากนั้นลบทิ้ง",
            "การสมัครรับการแจ้งเตือน: จนกว่าคุณจะยกเลิก",
            "คำถาม Ask: เราไม่จัดเก็บ ข้อความที่ส่งไปยัง API อยู่ภายใต้นโยบายการเก็บรักษาของ Anthropic เอง",
            "บันทึกเซิร์ฟเวอร์ของผู้ให้บริการ: ตามนโยบายของแต่ละราย โดยทั่วไปไม่กี่วันถึงไม่กี่สัปดาห์",
          ],
        },
      ],
    },
    {
      heading: "สิทธิของคุณ",
      blocks: [
        {
          kind: "p" as const,
          text:
            "ไม่ว่าคุณอยู่ที่ใด คุณขอสำเนาข้อมูลที่เราเก็บ ขอแก้ไข หรือขอให้ลบได้ และเราจะดำเนินการให้ ทักหาเราที่ Telegram " +
            TELEGRAM_HANDLE +
            " หรือใช้แบบฟอร์มติดต่อ กรุณาระบุอีเมลที่เคยให้ไว้หรือช่วงเวลาที่ติดต่อมา เพื่อให้เราค้นหาข้อมูลของคุณเจอ",
        },
        {
          kind: "ul" as const,
          items: [
            "ประเทศไทย (PDPA): สิทธิเข้าถึง แก้ไข ลบ จำกัดการประมวลผล คัดค้าน โอนย้าย และถอนความยินยอม",
            "EEA / สหราชอาณาจักร (GDPR): สิทธิเดียวกัน พร้อมสิทธิร้องเรียนต่อหน่วยงานคุ้มครองข้อมูลของประเทศคุณ",
            "แคลิฟอร์เนีย (CCPA/CPRA): สิทธิที่จะทราบ ลบ แก้ไข และปฏิเสธการขายหรือการแบ่งปัน เราไม่ขายข้อมูลส่วนบุคคล คุกกี้โฆษณาอาจนับเป็นการ 'แบ่งปัน' เพื่อโฆษณาพฤติกรรมข้ามบริบท การตั้งค่าความยินยอมในข้อ 4 คือวิธีปฏิเสธ",
          ],
        },
        {
          kind: "p" as const,
          text:
            "การถอนความยินยอมไม่ทำให้การประมวลผลที่ชอบด้วยกฎหมายซึ่งเกิดขึ้นแล้วเป็นโมฆะ และเราอาจเก็บข้อมูลขั้นต่ำไว้เพื่อแสดงว่าได้ดำเนินการตามคำขอแล้ว",
        },
      ],
    },
    {
      heading: "เด็ก",
      blocks: [
        {
          kind: "p" as const,
          text:
            "เว็บไซต์นี้มุ่งเป้าไปที่ผู้ใหญ่ที่กำลังพิจารณาอสังหาริมทรัพย์ ไม่ได้มุ่งเป้าไปที่เด็ก และเราไม่เก็บข้อมูลจากผู้มีอายุต่ำกว่า 16 ปีโดยรู้เห็น หากคุณเชื่อว่าเด็กส่งข้อมูลมาให้เรา กรุณาแจ้ง เราจะลบทิ้ง",
        },
      ],
    },
    {
      heading: "ความปลอดภัย และสิ่งที่เราสัญญาได้อย่างตรงไปตรงมา",
      blocks: [
        {
          kind: "p" as const,
          text:
            "การรับส่งข้อมูลเข้ารหัส ฐานข้อมูลอยู่หลังกฎการเข้าถึงระดับแถว และส่วนผู้ดูแลอยู่หลังเซสชันที่ลงลายเซ็น นี่เป็นเว็บไซต์อิสระขนาดเล็ก เราจึงจะไม่อ้างการรับรองที่เราไม่มี กรุณาอย่าส่งเอกสาร บัตรประจำตัว หรือข้อมูลทางการเงินผ่านแบบฟอร์ม ไม่มีฟีเจอร์ใดในเว็บไซต์นี้ต้องใช้สิ่งเหล่านั้น",
        },
      ],
    },
    {
      heading: "การเปลี่ยนแปลงนโยบาย",
      blocks: [
        {
          kind: "p" as const,
          text:
            "หากเราเปลี่ยนสิ่งที่เก็บหรือผู้ที่ได้รับข้อมูล เราจะปรับปรุงหน้านี้และเลื่อนวันที่ด้านบน การเปลี่ยนแปลงที่มีนัยสำคัญจะแจ้งไว้ที่หน้าแรกด้วย",
        },
      ],
    },
  ],
};

export const PRIVACY: LegalDocumentSet = { en, ko, th };
