/**
 * 대출 판정 엔진. 화면과 분리된 순수 함수들이에요.
 * 모든 금액은 "만원" 단위예요.
 */
import { RULES, type Region, type RuleSet } from "./rules";

/* ------------------------------------------------------------------ */
/* 타입                                                                */
/* ------------------------------------------------------------------ */

export type Marital = "single" | "engaged" | "newly" | "married";

export interface Profile {
  /** 본인 연소득 */
  inc1: number;
  /** 배우자 연소득 (미혼이면 무시) */
  inc2: number;
  /** engaged: 3개월 내 결혼 예정, newly: 혼인 7년 이내, married: 7년 초과 */
  marital: Marital;
  kids: number;
  /** 0: 무주택, 1: 1주택(처분 조건), 2: 2주택 이상 */
  homes: 0 | 1 | 2;
  cash: number;
  /** 부부합산 순자산 */
  netAsset: number;
  firstHome: boolean;
  householder: boolean;
  /** 2년 내 출산(입양) */
  newborn: boolean;
  /** 기존 대출 연 원리금 (DSR) */
  existingAnnualPayment: number;
  /** 기존 대출 연 이자 (DTI) */
  existingAnnualInterest: number;
}

export interface House {
  regionId: string;
  price: number;
  /** KB시세. 없으면 매매가로 담보가치 계산 */
  kb?: number;
  /** 전용면적 ㎡ */
  area: number;
  /** 수도권 외 읍·면 지역 */
  eupmyeon?: boolean;
  years: number;
  method: "annuity" | "principal";
}

export type LoanId = "general" | "didimdol" | "newborn" | "bogeum";

/** 금리. null이면 자동 계산(디딤돌) 또는 규칙 기본값 사용 */
export type Rates = Partial<Record<LoanId, number | null>>;

export type ReqCode =
  | "homeless" | "homes" | "income" | "asset" | "price" | "area" | "term" | "newborn"
  | "ltv" | "cap" | "dsr" | "dsrNow" | "dtiNow" | "calc" | "regulatedCut";

export interface Requirement {
  code: ReqCode;
  /** true: 충족, false: 미충족, null: 정보 */
  ok: boolean | null;
  label: string;
  detail: string;
}

export type Binding = "ltv" | "cap" | "dsr" | "dti" | "product";

export interface LoanResult {
  id: LoanId;
  name: string;
  ok: boolean;
  /** 최대 대출 한도 */
  limit: number;
  /** 실제 대출액 = min(한도, 매매가 − 보유 현금) */
  amount: number;
  rate: number;
  rateAuto: boolean;
  /** 한도를 묶는 기준 (가능할 때만) */
  binding: Binding | null;
  /** 1인 소득 특례 적용 여부 */
  onePerson: boolean;
  reqs: Requirement[];
  /** 원리금균등: 월 상환액, 원금균등: 첫 달 상환액 */
  firstPayment: number;
  totalInterest: number;
  /** 부족 자금 (양수면 모자람) */
  gap: number;
}

export interface Context {
  region: Region;
  income: number;
  /** 담보가치 = min(매매가, KB시세) */
  value: number;
  need: number;
  married: boolean;
  newlywed: boolean;
  firstHome: boolean;
}

export interface Evaluation {
  context: Context;
  results: LoanResult[];
}

/* ------------------------------------------------------------------ */
/* 계산 유틸                                                           */
/* ------------------------------------------------------------------ */

export function monthlyPayment(principal: number, ratePct: number, years: number): number {
  if (principal <= 0) return 0;
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function principalFromMonthly(monthly: number, ratePct: number, years: number): number {
  if (monthly <= 0) return 0;
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? monthly * n : (monthly * (1 - Math.pow(1 + r, -n))) / r;
}

export function repayment(principal: number, ratePct: number, years: number, method: House["method"]) {
  if (principal <= 0) return { firstPayment: 0, totalInterest: 0 };
  const n = years * 12, r = ratePct / 100 / 12;
  if (method === "principal") return { firstPayment: principal / n + principal * r, totalInterest: (principal * r * (n + 1)) / 2 };
  const m = monthlyPayment(principal, ratePct, years);
  return { firstPayment: m, totalInterest: m * n - principal };
}

/** 100만원 단위로 내림 */
const floor100 = (v: number) => Math.max(0, Math.floor(v / 100) * 100);

export function formatManwon(man: number): string {
  if (!isFinite(man)) return "제한 없음";
  man = Math.round(man);
  if (man <= 0) return "0원";
  const eok = Math.floor(man / 10000), rest = man % 10000;
  if (eok && rest) return `${eok}억 ${rest.toLocaleString("ko-KR")}만원`;
  if (eok) return `${eok}억원`;
  return `${rest.toLocaleString("ko-KR")}만원`;
}
const fmt = formatManwon;
const pct = (v: number) => `${Math.round(v * 10) / 10}%`;

function lowest<T extends string>(pairs: [T, number][]): T {
  return pairs.slice().sort((a, b) => a[1] - b[1])[0]![0];
}

/* ------------------------------------------------------------------ */
/* 판정                                                                */
/* ------------------------------------------------------------------ */

export function evaluate(p: Profile, h: House, rates: Rates = {}, R: RuleSet = RULES): Evaluation {
  const region = R.regions.find((r) => r.id === h.regionId);
  if (!region) throw new Error(`알 수 없는 지역: ${h.regionId}`);

  const married = p.marital !== "single";
  const newlywed = p.marital === "engaged" || p.marital === "newly";
  const income = p.inc1 + (married ? p.inc2 : 0);
  const value = h.kb && h.kb > 0 ? Math.min(h.price, h.kb) : h.price;
  const firstHome = p.firstHome && p.homes === 0;
  const tight = region.metro || region.regulated;
  const need = Math.max(h.price - p.cash, 0);
  const onePersonIncome = married ? Math.min(p.inc1, p.inc2) : p.inc1;
  const context: Context = { region, income, value, need, married, newlywed, firstHome };
  const results: LoanResult[] = [];

  const finish = (partial: Omit<LoanResult, "firstPayment" | "totalInterest" | "gap">): LoanResult => {
    const pay = repayment(partial.amount, partial.rate, h.years, h.method);
    return { ...partial, ...pay, gap: h.price - p.cash - partial.amount };
  };

  /* --- 일반 주택담보대출 --- */
  {
    const G = R.general;
    const rate = rates.general ?? G.defaultRate;
    let ltv: number;
    if (p.homes >= 2) ltv = region.regulated ? G.ltv.multiHomeRegulated : G.ltv.multiHomeNonRegulated;
    else if (firstHome) ltv = tight ? G.ltv.firstHomeMetroOrRegulated : G.ltv.firstHomeLocal;
    else ltv = region.regulated ? G.ltv.regulated : G.ltv.nonRegulated;

    let cap = tight ? G.cap.find((c) => value <= c.upTo)!.max : Infinity;
    if (p.homes >= 2 && region.metro) cap = 0; // 수도권 다주택자 구입 주담대 금지

    const stress = tight ? G.stress.metroOrRegulated : G.stress.local;
    const dsrRoom = (income * G.dsr) / 100 - p.existingAnnualPayment;
    const byLtv = (value * ltv) / 100;
    const byDsr = principalFromMonthly(dsrRoom / 12, rate + stress, h.years);
    const limit = floor100(Math.min(byLtv, cap, byDsr));
    const amount = Math.min(limit, need);
    const dsrNow = income > 0 ? ((monthlyPayment(amount, rate + stress, h.years) * 12 + p.existingAnnualPayment) / income) * 100 : 0;

    const tags = [region.regulated ? "규제지역" : "비규제", firstHome ? "생애최초" : "", p.homes >= 2 ? "다주택" : ""].filter(Boolean).join("·");
    const reqs: Requirement[] = [
      { code: "ltv", ok: ltv > 0, label: `LTV ${ltv}% (${tags})`, detail: `담보가치 ${fmt(value)} → ${fmt(byLtv)}` },
      { code: "cap", ok: cap > 0, label: tight ? "수도권·규제지역 금액 상한" : "금액 상한", detail: tight ? `시가 ${fmt(value)} → 최대 ${fmt(cap)}` : "해당 없음" },
      { code: "dsr", ok: byDsr > 0, label: `DSR ${G.dsr}% (스트레스 +${stress}%p)`, detail: income > 0 ? `${rate}%+${stress}%p로 심사 → ${fmt(byDsr)}` : "소득 입력 필요" },
      { code: "dsrNow", ok: amount > 0 ? dsrNow <= G.dsr + 0.01 : null, label: "이 금액의 DSR", detail: amount > 0 ? `${pct(dsrNow)} / ${G.dsr}%` : "-" },
    ];
    results.push(finish({
      id: "general", name: "일반 주택담보대출", ok: limit > 0, limit, amount, rate, rateAuto: false, onePerson: false, reqs,
      binding: limit > 0 ? lowest<Binding>([["ltv", byLtv], ["cap", cap], ["dsr", byDsr]]) : null,
    }));
  }

  /* --- 정책대출 공통 --- */
  interface PolicyOpts {
    ltv?: number; dti?: number; dtiIncome?: number; rate: number; rateAuto?: boolean; maxYears?: number; onePerson?: boolean;
  }
  const policy = (
    id: LoanId, name: string, rule: { ltv: { base: number; firstHomeLocal: number }; dti: number },
    checks: Requirement[], productLimit: number, o: PolicyOpts,
  ) => {
    const ltv = o.ltv ?? (firstHome && !tight ? rule.ltv.firstHomeLocal : rule.ltv.base);
    const dti = o.dti ?? rule.dti;
    const dtiIncome = o.dtiIncome ?? income;
    const dtiRoom = (dtiIncome * dti) / 100 - p.existingAnnualInterest;
    const byLtv = (value * ltv) / 100;
    const byDti = principalFromMonthly(dtiRoom / 12, o.rate, h.years);
    if (o.maxYears && h.years > o.maxYears) {
      checks = [...checks, { code: "term", ok: false, label: "대출 만기", detail: `${h.years}년 / ${o.maxYears}년 이하만 가능` }];
    }
    const eligible = checks.every((c) => c.ok !== false);
    const limit = eligible ? floor100(Math.min(productLimit, byLtv, byDti)) : 0;
    const amount = Math.min(limit, need);
    const dtiNow = dtiIncome > 0 ? ((monthlyPayment(amount, o.rate, h.years) * 12 + p.existingAnnualInterest) / dtiIncome) * 100 : 0;
    const reqs: Requirement[] = [
      ...checks,
      { code: "calc", ok: null, label: `한도 계산 (LTV ${ltv}% · DTI ${dti}%${dtiIncome !== income ? " · 1인 소득 기준" : ""})`, detail: `상품 ${fmt(productLimit)} · LTV ${fmt(byLtv)} · DTI ${fmt(byDti)}` },
    ];
    if (amount > 0) reqs.push({ code: "dtiNow", ok: dtiNow <= dti + 0.01, label: "이 금액의 DTI", detail: `${pct(dtiNow)} / ${dti}%` });
    results.push(finish({
      id, name, ok: eligible && limit > 0, limit, amount, rate: o.rate, rateAuto: !!o.rateAuto, onePerson: !!o.onePerson, reqs,
      binding: eligible && limit > 0 ? lowest<Binding>([["product", productLimit], ["ltv", byLtv], ["dti", byDti]]) : null,
    }));
  };

  const homeless: Requirement = {
    code: "homeless",
    ok: p.homes === 0 && (p.householder || p.marital === "engaged"),
    label: "무주택 세대주",
    detail: p.homes !== 0 ? "주택 보유" : p.householder || p.marital === "engaged" ? "충족" : "세대주 아님",
  };
  const areaCheck = (a: { base: number; eupmyeon: number }): Requirement => {
    const lim = h.eupmyeon && !region.metro ? a.eupmyeon : a.base;
    return { code: "area", ok: h.area <= lim, label: "전용면적", detail: `${h.area}㎡ / ${lim}㎡ 이하` };
  };
  const assetCheck = (limit: number): Requirement => ({
    code: "asset", ok: p.netAsset <= limit, label: "순자산 (부부합산)", detail: `${fmt(p.netAsset)} / 기준 ${fmt(limit)}`,
  });

  /* --- 디딤돌 --- */
  {
    const D = R.didimdol;
    const twoKids = p.kids >= 2;
    let incLimit = D.income.base;
    if (firstHome || twoKids) incLimit = D.income.firstOrTwoKids;
    if (newlywed) incLimit = D.income.newlywed;
    const onePerson = newlywed && income > incLimit && onePersonIncome <= D.income.newlywedOnePerson;
    const priceLimit = newlywed || twoKids ? D.price.newlywedOrTwoKids : D.price.base;
    const productLimit = newlywed || twoKids ? D.limit.newlywedOrTwoKids : firstHome ? D.limit.firstHome : D.limit.base;

    const auto = didimdolAutoRate(R, { income, years: h.years, kids: p.kids, newlywed, firstHome, onePerson });
    const manual = rates.didimdol;
    policy("didimdol", "디딤돌대출", D, [
      homeless,
      {
        code: "income", ok: income <= incLimit || onePerson, label: "소득",
        detail: onePerson
          ? `합산 ${fmt(income)} 초과 → 1인 ${fmt(onePersonIncome)} / 기준 ${fmt(D.income.newlywedOnePerson)} (1인 소득 특례)`
          : `${married ? "부부합산" : "본인"} ${fmt(income)} / 기준 ${fmt(incLimit)}`,
      },
      assetCheck(D.netAsset),
      { code: "price", ok: value <= priceLimit, label: "주택가격", detail: `${fmt(value)} / 기준 ${fmt(priceLimit)}` },
      areaCheck(D.area),
    ], productLimit, {
      rate: manual ?? auto, rateAuto: manual == null, maxYears: D.maxYears, onePerson,
      dtiIncome: onePerson ? onePersonIncome : income,
    });
  }

  /* --- 신생아 특례 디딤돌 --- */
  {
    const N = R.newborn;
    const dual = married && p.inc1 > 0 && p.inc2 > 0;
    const incOk = income <= N.income.single || (dual && income <= N.income.dualTotal && Math.max(p.inc1, p.inc2) <= N.income.dualEach);
    policy("newborn", "신생아 특례 디딤돌", N, [
      { code: "newborn", ok: p.newborn, label: "2년 내 출산(입양)", detail: p.newborn ? "충족" : "해당 없음" },
      homeless,
      { code: "income", ok: incOk, label: "소득", detail: `합산 ${fmt(income)} / 기준 ${fmt(N.income.single)}${dual ? ` (맞벌이 ${fmt(N.income.dualTotal)}, 각자 ${fmt(N.income.dualEach)} 이하)` : ""}` },
      assetCheck(N.netAsset),
      { code: "price", ok: value <= N.price, label: "주택가격", detail: `${fmt(value)} / 기준 ${fmt(N.price)}` },
      areaCheck(N.area),
    ], N.limit, { rate: rates.newborn ?? N.defaultRate, maxYears: N.maxYears });
  }

  /* --- 보금자리론 --- */
  {
    const B = R.bogeum;
    let incLimit = B.income.base;
    if (newlywed) incLimit = B.income.newlywed;
    if (p.kids === 1) incLimit = Math.max(incLimit, B.income.oneKid);
    if (p.kids >= 2) incLimit = Math.max(incLimit, B.income.multiKids);
    const onePerson = newlywed && income > incLimit && onePersonIncome <= B.income.newlywedOnePerson;
    // 실수요자: 구입용도·무주택·6억 이하·합산 7천 이하 → 규제지역이어도 LTV·DTI 미차감
    const realDemand = p.homes === 0 && value <= B.price && income <= B.income.base;
    const cut = region.regulated && !firstHome && !realDemand ? B.regulatedCut : 0;
    const baseLtv = firstHome && !tight ? B.ltv.firstHomeLocal : B.ltv.base;
    const productLimit = firstHome ? B.limit.firstHome : p.kids >= 2 ? B.limit.multiKids : B.limit.base;
    const checks: Requirement[] = [
      { code: "homes", ok: p.homes <= 1, label: "무주택 또는 처분조건 1주택", detail: p.homes === 0 ? "무주택" : p.homes === 1 ? "1주택 (처분 조건)" : "다주택" },
      {
        code: "income", ok: income <= incLimit || onePerson, label: "소득",
        detail: onePerson
          ? `합산 ${fmt(income)} 초과 → 1인 ${fmt(onePersonIncome)} / 기준 ${fmt(B.income.newlywedOnePerson)} (1인 소득 특례)`
          : `${married ? "부부합산" : "본인"} ${fmt(income)} / 기준 ${fmt(incLimit)}`,
      },
      { code: "price", ok: value <= B.price, label: "주택가격", detail: `${fmt(value)} / 기준 ${fmt(B.price)}` },
    ];
    if (cut) checks.push({ code: "regulatedCut", ok: null, label: "규제지역 차감", detail: `LTV·DTI 각 ${cut}%p 차감` });
    policy("bogeum", "보금자리론", B, checks, productLimit, {
      rate: rates.bogeum ?? B.defaultRate, ltv: baseLtv - cut, dti: B.dti - cut, onePerson,
      dtiIncome: onePerson ? onePersonIncome : income,
    });
  }

  return { context, results };
}

/** 디딤돌 자동 금리: 소득 구간 × 만기 기본금리 − 우대 (1인 특례는 최고금리 + 가산) */
export function didimdolAutoRate(
  R: RuleSet,
  a: { income: number; years: number; kids: number; newlywed: boolean; firstHome: boolean; onePerson: boolean },
): number {
  const D = R.didimdol;
  const term = (a.years <= 10 ? 10 : a.years <= 15 ? 15 : a.years <= 20 ? 20 : 30) as 10 | 15 | 20 | 30;
  const table = D.rateTable;
  let rate: number;
  if (a.onePerson) rate = table[table.length - 1]!.byTerm[term] + D.onePersonPenalty;
  else rate = (table.find((t) => a.income <= t.upTo) ?? table[table.length - 1]!).byTerm[term];
  rate -= D.discount.byKids[Math.min(a.kids, 3)]!;
  if (a.newlywed || a.firstHome) rate -= D.discount.newlywedOrFirst;
  return Math.round(Math.max(rate, D.discount.floor) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* 네고 시뮬레이션                                                     */
/* ------------------------------------------------------------------ */

export interface NegoOption {
  id: LoanId;
  /** "unlock": 불가→가능, "boost": 가능하지만 한도 증가 */
  kind: "unlock" | "boost";
  /** 필요한 네고 금액 */
  discount: number;
  newPrice: number;
  /** 네고 후 판정 결과 */
  result: LoanResult;
  /** boost일 때 늘어나는 한도 */
  limitIncrease: number;
}

/**
 * 매매가를 step씩 낮춰가며 결과가 달라지는 최소 금액을 찾아요.
 * - 불가였던 대출이 가능해지는 경우 (unlock)
 * - 가능한 대출의 한도가 minBoost 이상 늘어나는 경우 (boost)
 */
export function simulateNego(
  p: Profile, h: House, rates: Rates = {},
  opts: { max?: number; step?: number; minBoost?: number } = {}, R: RuleSet = RULES,
): NegoOption[] {
  const { max = 5000, step = 100, minBoost = 1000 } = opts;
  const base = evaluate(p, h, rates, R).results;
  const found = new Map<LoanId, NegoOption>();
  for (let d = step; d <= max && d < h.price; d += step) {
    const next = evaluate(p, { ...h, price: h.price - d }, rates, R).results;
    for (const b of base) {
      if (found.has(b.id)) continue;
      const x = next.find((y) => y.id === b.id)!;
      if (!b.ok && x.ok) found.set(b.id, { id: b.id, kind: "unlock", discount: d, newPrice: h.price - d, result: x, limitIncrease: x.limit });
      else if (b.ok && x.limit - b.limit >= minBoost) found.set(b.id, { id: b.id, kind: "boost", discount: d, newPrice: h.price - d, result: x, limitIncrease: x.limit - b.limit });
    }
    if (found.size === base.length) break;
  }
  return [...found.values()].sort((a, b) => a.discount - b.discount);
}

/* ------------------------------------------------------------------ */
/* 추천                                                                */
/* ------------------------------------------------------------------ */

export type SortBy = "monthly" | "limit";

/** 가능한 대출을 정렬: 부족 자금이 없는 대출 먼저, 그다음 기준(월 상환액 적은 순 / 한도 큰 순) */
export function rankLoans(results: LoanResult[], sortBy: SortBy = "monthly"): LoanResult[] {
  const key = sortBy === "monthly"
    ? (a: LoanResult, b: LoanResult) => a.firstPayment - b.firstPayment
    : (a: LoanResult, b: LoanResult) => b.limit - a.limit;
  return results.filter((r) => r.ok).sort((a, b) => Number(a.gap > 0) - Number(b.gap > 0) || key(a, b));
}
