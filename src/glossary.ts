/** ⓘ 버튼으로 보여주는 용어 설명. 문구는 해요체, 짧고 구체적으로 써요. */

export interface GlossaryEntry {
  /** 팝오버 제목 */
  title: string;
  body: string;
}

export const GLOSSARY = {
  ltv: { title: "LTV (주택담보인정비율)", body: "집의 담보가치 대비 빌릴 수 있는 최대 비율이에요. 8억 집에 LTV 40%면 최대 3억 2천만원까지예요. 담보가치는 보통 KB시세나 감정가 기준이라 매매가와 다를 수 있어요." },
  dsr: { title: "DSR (총부채원리금상환비율)", body: "1년 동안 갚는 모든 대출(새 주담대, 신용대출, 할부, 학자금 등)의 원금과 이자를 합친 금액이 연소득의 몇 %인지예요. 은행 주담대는 40% 이하여야 해서, 소득이 적거나 다른 대출이 많으면 LTV보다 먼저 한도를 막아요." },
  dti: { title: "DTI (총부채상환비율)", body: "새 주담대의 1년 원리금에 다른 대출의 이자만 더해 연소득으로 나눈 비율이에요. DSR보다 느슨하고, 디딤돌·보금자리론 같은 정책대출은 DTI 60% 이내로 심사해요." },
  stress: { title: "스트레스 금리", body: "앞으로 금리가 오를 수 있다고 가정하고 DSR을 계산할 때 실제 금리에 더하는 가산금리예요. 실제로 내는 이자는 아니지만, 심사용 금리가 높아지니 받을 수 있는 한도가 줄어요. 수도권·규제지역 주담대는 3%p가 붙어요." },
  cap: { title: "금액 상한", body: "수도권·규제지역에서 집을 살 때 받을 수 있는 주담대의 최대 금액이에요. 시가 15억 이하는 6억, 15억 초과~25억은 4억, 25억 초과는 2억이에요. LTV로 계산한 금액이 더 커도 이 금액을 넘을 수 없어요." },
  productLimit: { title: "상품 한도", body: "정책대출마다 정해진 최대 대출 금액이에요. 예를 들어 디딤돌은 일반 2억, 생애최초 2.4억, 신혼·2자녀 이상 3.2억까지예요." },
  regulated: { title: "규제지역", body: "투기과열지구·조정대상지역을 말해요. 2025년 10·15 대책으로 서울 전역과 경기 12곳이 지정됐어요. 이 지역에서는 LTV가 40%로 낮아지고 대출 금액 상한도 적용돼요." },
  kb: { title: "KB시세", body: "KB부동산이 발표하는 아파트 시세로, 은행이 담보가치를 정할 때 주로 써요. 매매가보다 낮으면 낮은 쪽을 기준으로 한도가 계산될 수 있어요. 모르면 비워두세요. 매매가로 대신 계산해요." },
  first: { title: "생애최초", body: "본인과 배우자 모두 지금까지 집을 가져본 적이 없는 경우예요. LTV, 대출 한도, 금리에서 우대를 받을 수 있어요." },
  householder: { title: "세대주", body: "주민등록상 세대를 대표하는 사람이에요. 정책대출은 대부분 무주택 세대주여야 받을 수 있어요. 예비부부는 별도 기준이 있어요." },
  asset: { title: "순자산", body: "부부의 부동산, 예금, 자동차 등 자산에서 대출 같은 부채를 뺀 금액이에요. 디딤돌과 신생아 특례는 2026년 기준 5.11억원 이하여야 해요." },
  existing: { title: "기존 대출 연 원리금", body: "지금 갚고 있는 신용대출, 자동차 할부, 학자금 대출 등의 1년치 원금과 이자예요. DSR 계산에 모두 들어가고, DTI에는 이자만 들어가요." },
  method: { title: "상환 방식", body: "원리금균등은 매달 같은 금액(원금+이자)을 갚아요. 원금균등은 매달 같은 원금에 줄어드는 이자를 더해 갚아서 처음 부담은 크지만 총 이자는 더 적어요." },
  onePerson: { title: "1인 소득 특례", body: "신혼부부의 합산 소득이 기준을 넘어도, 부부 중 한 명의 소득이 기준 이하(디딤돌 6천만원, 보금자리론 7천만원)면 그 사람 이름으로 정책대출을 받을 수 있어요. 이때 DTI도 그 한 명의 소득으로 계산해요. 2026년 10월 19일부터 시행됐어요." },
  bogeumCut: { title: "규제지역 차감", body: "보금자리론은 집이 규제지역에 있으면 LTV와 DTI를 각각 10%p 낮춰요. 단, 생애최초이거나 실수요자(무주택, 6억 이하, 합산소득 7천 이하)면 깎지 않아요." },
} as const satisfies Record<string, GlossaryEntry>;

export type TermKey = keyof typeof GLOSSARY;

/** 문구 속 낱말 → 용어. 앞에 있는 것부터 매칭해요. */
const TERM_MATCH: ReadonlyArray<readonly [string, TermKey]> = [
  ["LTV", "ltv"], ["DSR", "dsr"], ["DTI", "dti"], ["스트레스", "stress"], ["금액 상한", "cap"],
  ["상품 한도", "productLimit"], ["순자산", "asset"], ["세대주", "householder"],
  ["규제지역 차감", "bogeumCut"], ["1인 소득 기준", "onePerson"],
];

/** 요건·한도 문구에 어떤 용어 설명 버튼을 붙일지. 한 문구에 최대 2개. */
export function termKeysFor(text: string, max = 2): TermKey[] {
  const keys: TermKey[] = [];
  for (const [word, key] of TERM_MATCH) {
    if (text.includes(word) && !keys.includes(key)) keys.push(key);
  }
  return keys.slice(0, max);
}
