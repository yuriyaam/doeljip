/**
 * 화면에 보여줄 문구·값 계산. React 없이 테스트할 수 있게 순수 함수로 둬요.
 */
import { formatManwon as fmt, type Binding, type LoanId, type LoanResult, type NegoOption, type Profile } from "../engine";
import type { CheckResult } from "./derive";

/** 만원 단위 → "1,234,500원" (월 상환액 표시용) */
export const won = (man: number): string => `${Math.round(man * 10000).toLocaleString("ko-KR")}원`;

/** 대출 이름 아래 한 줄 설명. 금리 범위는 안내용 문구예요 (계산에는 쓰지 않아요). */
export const LOAN_SUB: Record<LoanId, string> = {
  general: "시중은행 · 변동/혼합형",
  didimdol: "주택도시기금 · 고정 연 2.85~4.15%",
  newborn: "주택도시기금 · 연 1.8~4.5% (소득·만기별)",
  bogeum: "한국주택금융공사 · 연 4%대 고정 (매월 고시)",
};

const BINDING_LABEL: Record<Binding, string> = {
  ltv: "LTV", cap: "금액 상한", dsr: "DSR", dti: "DTI", product: "상품 한도",
};

/** "한도를 묶는 규제: DSR" — 가능한 대출만 */
export function bindingText(r: LoanResult): string | null {
  if (!r.ok || !r.binding) return null;
  return `한도를 묶는 ${r.id === "general" ? "규제" : "기준"}: ${BINDING_LABEL[r.binding]}`;
}

/** 안 되는 대출의 이유 한 줄 */
export function noGoReason(r: LoanResult): string {
  const fails = r.reqs.filter((q) => q.ok === false);
  if (!fails.length) return "계산된 한도가 0원";
  return fails.map((q, i) => (i === 0 ? `${q.label} (${q.detail})` : q.label)).join(", ");
}

/** 요건 문구에 붙일 용어 검색용 텍스트 (1인 소득 특례가 적용된 요건이면 해당 용어도 찾게 해요) */
export function reqTermText(label: string, detail: string): string {
  return label + (detail.includes("1인 소득 특례") ? " 1인 소득 기준" : "");
}

const MARITAL_LABEL = { single: "미혼", engaged: "예비부부", newly: "신혼", married: "기혼" } as const;

/** 접힌 "내 조건"에 보여줄 요약 칩 */
export function profileSummary(p: Profile): string[] {
  const married = p.marital !== "single";
  return [
    married ? `부부합산 ${fmt(p.inc1 + p.inc2)}` : `연소득 ${fmt(p.inc1)}`,
    MARITAL_LABEL[p.marital],
    p.kids ? `자녀 ${p.kids}명` : "자녀 없음",
    ["무주택", "1주택", "2주택 이상"][Math.min(p.homes, 2)]!,
    p.firstHome && p.homes === 0 ? "생애최초" : null,
    p.newborn ? "2년 내 출산" : null,
    `현금 ${fmt(p.cash)}`,
    `순자산 ${fmt(p.netAsset)}`,
    p.existingAnnualPayment > 0 ? `기존 대출 연 ${fmt(p.existingAnnualPayment)}` : null,
  ].filter((x): x is string => x !== null);
}

/* ---------------- 결론 / 네고 문구 ---------------- */

export interface TextPart { text: string; bold?: boolean }

const b = (text: string): TextPart => ({ text, bold: true });
const t = (text: string): TextPart => ({ text });

/** 결론 아래 네고 팁. 추천이 없으면 "네고하면 가능", 있으면 월 상환액이 줄 때만 안내해요. */
export function conclusionTip(check: CheckResult): TextPart[] | null {
  const unlocks = check.nego.filter((n) => n.kind === "unlock");
  const cheapest = unlocks.slice().sort((x, y) => x.result.firstPayment - y.result.firstPayment)[0];
  if (!cheapest) return null;
  const { best } = check;
  const name = cheapest.result.name;
  if (!best) {
    return [t("매매가를 "), b(fmt(cheapest.discount)), t(` 네고해 ${fmt(cheapest.newPrice)}에 사면 `), b(name), t("로 가능해요.")];
  }
  const saving = best.firstPayment - cheapest.result.firstPayment;
  if (saving < 0.5) return null;
  const warn = cheapest.result.gap > 0 && best.gap <= 0 ? " (단, 부족 자금이 생겨요)" : "";
  return [t("매매가를 "), b(fmt(cheapest.discount)), t(" 네고하면 "), b(name), t("로 월 상환액이 "), b(won(saving)), t(` 줄어요${warn}.`)];
}

/** 대출 행 펼침 안의 네고 안내. 한도가 늘어나는(boost) 경우만 쓰여요. */
export function boostLine(n: NegoOption): TextPart[] {
  return [
    t("매매가를 "), b(fmt(n.discount)), t(` 낮춰 ${fmt(n.newPrice)}에 사면 한도가 `),
    b(fmt(n.limitIncrease)), t(` 늘어나요 (최대 ${fmt(n.result.limit)}).`),
  ];
}

/* ---------------- 비교표 ---------------- */

/** 기준 프로필 대비 이 프로필의 한도가 좋아졌는지/나빠졌는지 */
export function limitChange(base: LoanResult, other: LoanResult): "better" | "worse" | null {
  const a = base.ok ? base.limit : 0;
  const o = other.ok ? other.limit : 0;
  return o > a ? "better" : o < a ? "worse" : null;
}

/** 비교표 셀의 불가 사유 (첫 번째 미충족 요건) */
export function firstFailLabel(r: LoanResult): string {
  return r.reqs.find((q) => q.ok === false)?.label ?? "한도 0원";
}

/** 저장 목록 정렬용: 최근 저장한 순 */
export const byRecent = <T extends { savedAt: number }>(a: T, c: T): number => c.savedAt - a.savedAt;
