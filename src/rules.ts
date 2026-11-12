/**
 * 대출 판정 규칙 데이터.
 *
 * - 모든 금액 단위는 "만원"이에요. (예: 6억원 = 60000)
 * - 비율은 퍼센트 숫자예요. (예: LTV 70% = 70)
 * - 정책이 바뀌면 이 파일만 고치고, 테스트(`npm test`)로 영향을 확인해요.
 * - 각 섹션의 `source`는 아래 `SOURCES`의 id를 가리켜요.
 */

export interface Source {
  id: string;
  title: string;
  url: string;
  /** 내용을 마지막으로 확인한 날짜 */
  checkedAt: string;
}

export const SOURCES: Source[] = [
  {
    id: "didimdol-official",
    title: "주택도시기금 내집마련 디딤돌대출 상품안내",
    url: "https://www.myhome.go.kr/hws/portal/cont/selectSteppingStoneLoanView.do",
    checkedAt: "2026-11-12",
  },
  {
    id: "didimdol-one-person",
    title: "KB국민은행 내집마련디딤돌대출 상품 변경내역 (신혼 1인 소득 심사, 2026.10.19 시행)",
    url: "https://obank.kbstar.com/quics?page=C060283&cc=b028364%3Ab061618&%EB%B8%8C%EB%9E%9C%EB%93%9C%EC%83%81%ED%92%88%EC%BD%94%EB%93%9C=LN20000300&QSL=F",
    checkedAt: "2026-11-12",
  },
  {
    id: "bogeum-official",
    title: "한국주택금융공사 보금자리론 상품소개",
    url: "https://www.hf.go.kr/ko/sub01/sub01_01_01.do",
    checkedAt: "2026-11-12",
  },
  {
    id: "policy-1015",
    title: "10·15 부동산 대책 (규제지역 LTV 40%, 수도권 주담대 한도 6/4/2억, 스트레스 금리 3%)",
    url: "https://mobile.newsis.com/view/NISX20251015_0003363513",
    checkedAt: "2026-11-12",
  },
];

export interface Region {
  id: string;
  name: string;
  /** 수도권 여부 */
  metro: boolean;
  /** 규제지역(투기과열지구·조정대상지역) 여부 */
  regulated: boolean;
}

export interface RateRow {
  /** 부부합산 소득 상한 (만원, 이하) */
  upTo: number;
  /** 만기(년) → 연 금리(%) */
  byTerm: Record<10 | 15 | 20 | 30, number>;
}

export interface RuleSet {
  asOf: string;
  regions: Region[];
  general: {
    source: string;
    ltv: {
      regulated: number;
      nonRegulated: number;
      firstHomeMetroOrRegulated: number;
      firstHomeLocal: number;
      multiHomeRegulated: number;
      multiHomeNonRegulated: number;
    };
    /** 수도권·규제지역 주택구입 주담대 금액 상한 (시가 구간별) */
    cap: { upTo: number; max: number }[];
    dsr: number;
    /** 스트레스 금리 (%p) */
    stress: { metroOrRegulated: number; local: number };
    defaultRate: number;
  };
  didimdol: {
    source: string[];
    income: { base: number; firstOrTwoKids: number; newlywed: number; newlywedOnePerson: number };
    netAsset: number;
    price: { base: number; newlywedOrTwoKids: number };
    area: { base: number; eupmyeon: number };
    dti: number;
    maxYears: number;
    limit: { base: number; firstHome: number; newlywedOrTwoKids: number };
    ltv: { base: number; firstHomeLocal: number };
    rateTable: RateRow[];
    discount: { byKids: [number, number, number, number]; newlywedOrFirst: number; floor: number };
    /** 1인 소득 특례 적용 시 만기별 최고금리에 더하는 가산금리 */
    onePersonPenalty: number;
    effectiveFrom: { onePersonIncome: string };
  };
  newborn: {
    source: string[];
    income: { single: number; dualTotal: number; dualEach: number };
    netAsset: number;
    price: number;
    area: { base: number; eupmyeon: number };
    dti: number;
    maxYears: number;
    limit: number;
    ltv: { base: number; firstHomeLocal: number };
    defaultRate: number;
  };
  bogeum: {
    source: string;
    income: { base: number; newlywed: number; oneKid: number; multiKids: number; newlywedOnePerson: number };
    price: number;
    dti: number;
    /** 규제지역 LTV·DTI 차감 (%p). 생애최초·실수요자는 미차감 */
    regulatedCut: number;
    limit: { base: number; multiKids: number; firstHome: number };
    ltv: { base: number; firstHomeLocal: number };
    defaultRate: number;
    effectiveFrom: { onePersonIncome: string };
  };
}

const GYEONGGI_REGULATED = [
  "과천시", "광명시", "성남시 분당구", "성남시 수정구", "성남시 중원구",
  "수원시 영통구", "수원시 장안구", "수원시 팔달구", "안양시 동안구",
  "용인시 수지구", "의왕시", "하남시",
];

export const RULES: RuleSet = {
  asOf: "2026-11-12",
  regions: [
    { id: "seoul", name: "서울 (전 지역·규제지역)", metro: true, regulated: true },
    ...GYEONGGI_REGULATED.map((n, i) => ({ id: `gg${i}`, name: `경기 ${n} (규제지역)`, metro: true, regulated: true })),
    { id: "metro", name: "경기 기타·인천 (수도권 비규제)", metro: true, regulated: false },
    { id: "local", name: "지방 (비수도권)", metro: false, regulated: false },
  ],

  general: {
    source: "policy-1015",
    ltv: {
      regulated: 40,
      nonRegulated: 70,
      firstHomeMetroOrRegulated: 70,
      firstHomeLocal: 80,
      multiHomeRegulated: 0,
      multiHomeNonRegulated: 60,
    },
    cap: [
      { upTo: 150000, max: 60000 },
      { upTo: 250000, max: 40000 },
      { upTo: Infinity, max: 20000 },
    ],
    dsr: 40,
    // TODO: 지방 0.75%p는 스트레스 DSR 3단계 지방 유예 기준의 단순화. 금리 유형(변동/혼합/주기형)별 반영률 미적용.
    stress: { metroOrRegulated: 3.0, local: 0.75 },
    defaultRate: 4.2,
  },

  didimdol: {
    source: ["didimdol-official", "didimdol-one-person"],
    income: { base: 6000, firstOrTwoKids: 7000, newlywed: 8500, newlywedOnePerson: 6000 },
    netAsset: 51100,
    price: { base: 50000, newlywedOrTwoKids: 60000 },
    area: { base: 85, eupmyeon: 100 },
    dti: 60,
    maxYears: 30,
    limit: { base: 20000, firstHome: 24000, newlywedOrTwoKids: 32000 },
    ltv: { base: 70, firstHomeLocal: 80 },
    rateTable: [
      { upTo: 2000, byTerm: { 10: 2.85, 15: 2.95, 20: 3.05, 30: 3.10 } },
      { upTo: 4000, byTerm: { 10: 3.20, 15: 3.30, 20: 3.40, 30: 3.45 } },
      { upTo: 7000, byTerm: { 10: 3.55, 15: 3.65, 20: 3.75, 30: 3.80 } },
      { upTo: 8500, byTerm: { 10: 3.90, 15: 4.00, 20: 4.10, 30: 4.15 } },
    ],
    discount: { byKids: [0, 0.3, 0.5, 0.7], newlywedOrFirst: 0.2, floor: 1.5 },
    onePersonPenalty: 0.3,
    effectiveFrom: { onePersonIncome: "2026-10-19" },
  },

  newborn: {
    source: ["didimdol-official"],
    income: { single: 13000, dualTotal: 20000, dualEach: 13000 },
    netAsset: 51100,
    price: 90000,
    area: { base: 85, eupmyeon: 100 },
    dti: 60,
    maxYears: 30,
    limit: 40000,
    ltv: { base: 70, firstHomeLocal: 80 },
    // TODO: 소득 구간별 특례금리 표 확인 후 자동 계산으로 전환 (현재 연 1.8~4.5% 범위의 기본값)
    defaultRate: 2.5,
  },

  bogeum: {
    source: "bogeum-official",
    income: { base: 7000, newlywed: 8500, oneKid: 9000, multiKids: 10000, newlywedOnePerson: 7000 },
    price: 60000,
    dti: 60,
    regulatedCut: 10,
    limit: { base: 36000, multiKids: 40000, firstHome: 42000 },
    ltv: { base: 70, firstHomeLocal: 80 },
    // 매월 고시되는 고정금리. 사용자가 수정할 수 있는 기본값.
    defaultRate: 4.7,
    effectiveFrom: { onePersonIncome: "2026-10-19" },
  },
};
