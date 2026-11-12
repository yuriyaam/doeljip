import { describe, expect, it } from "vitest";
import {
  evaluate, simulateNego, rankLoans, didimdolAutoRate, formatManwon,
  type Profile, type House, type LoanId, type ReqCode,
} from "./engine";
import { RULES, SOURCES } from "./rules";

/* ---------- 테스트 헬퍼 ---------- */
const profile = (o: Partial<Profile> = {}): Profile => ({
  inc1: 5000, inc2: 0, marital: "single", kids: 0, homes: 0, cash: 20000, netAsset: 20000,
  firstHome: false, householder: true, newborn: false, existingAnnualPayment: 0, existingAnnualInterest: 0,
  ...o,
});
const house = (o: Partial<House> = {}): House => ({
  regionId: "local", price: 40000, area: 84.9, years: 30, method: "annuity", ...o,
});
const loan = (p: Profile, h: House, id: LoanId) => evaluate(p, h).results.find((r) => r.id === id)!;
const failed = (p: Profile, h: House, id: LoanId): ReqCode[] =>
  loan(p, h, id).reqs.filter((q) => q.ok === false).map((q) => q.code);

/* ================================================================== */
describe("일반 주택담보대출", () => {
  it("서울 8억, 신혼 부부합산 9천, 생애최초 → DSR이 한도를 묶음 (4억 4,100만원)", () => {
    const r = loan(profile({ inc1: 5000, inc2: 4000, marital: "newly", firstHome: true }), house({ regionId: "seoul", price: 80000 }), "general");
    expect(r.ok).toBe(true);
    expect(r.binding).toBe("dsr");
    expect(r.limit).toBe(44100);
  });

  it("규제지역 비생애최초는 LTV 40% (서울 5.5억 → 2억 2천)", () => {
    const r = loan(profile({ inc1: 7500 }), house({ regionId: "seoul", price: 55000 }), "general");
    expect(r.limit).toBe(22000);
    expect(r.binding).toBe("ltv");
  });

  it("수도권·규제지역 금액 상한: 15억 이하 6억 / 15억 초과 4억 / 25억 초과 2억", () => {
    const rich = profile({ inc1: 30000 });
    expect(loan(rich, house({ regionId: "seoul", price: 150000 }), "general").limit).toBe(60000);
    const r16 = loan(rich, house({ regionId: "seoul", price: 160000 }), "general");
    expect(r16.limit).toBe(40000);
    expect(r16.binding).toBe("cap");
    expect(loan(rich, house({ regionId: "seoul", price: 260000 }), "general").limit).toBe(20000);
  });

  it("지방은 금액 상한이 없음", () => {
    const r = loan(profile({ inc1: 30000 }), house({ regionId: "local", price: 200000 }), "general");
    expect(r.limit).toBe(140000); // LTV 70%
  });

  it("지방 생애최초는 LTV 80%", () => {
    const r = loan(profile({ inc1: 8000, firstHome: true }), house({ price: 40000 }), "general");
    expect(r.limit).toBe(32000);
    expect(r.binding).toBe("ltv");
  });

  it("수도권 다주택자는 구입 주담대 불가", () => {
    expect(failed(profile({ inc1: 20000, homes: 2 }), house({ regionId: "seoul", price: 80000 }), "general"))
      .toEqual(expect.arrayContaining(["ltv", "cap"]));
  });

  it("수도권 스트레스 금리(3%p)가 지방(0.75%p)보다 한도를 더 줄임", () => {
    const p = profile({ inc1: 4000 });
    const metro = loan(p, house({ regionId: "metro", price: 30000 }), "general");
    const local = loan(p, house({ regionId: "local", price: 30000 }), "general");
    expect(metro.binding).toBe("dsr");
    expect(metro.limit).toBe(19600);
    expect(local.limit).toBe(21000); // LTV 70%에 먼저 걸림
  });

  it("기존 대출 원리금이 DSR 한도를 줄임", () => {
    const r = loan(profile({ inc1: 4000, existingAnnualPayment: 600 }), house({ regionId: "metro", price: 30000 }), "general");
    expect(r.limit).toBe(12200);
  });

  it("KB시세가 매매가보다 낮으면 KB시세로 담보가치 계산", () => {
    const e = evaluate(profile({ inc1: 20000 }), house({ regionId: "seoul", price: 80000, kb: 70000 }));
    expect(e.context.value).toBe(70000);
    expect(e.results.find((r) => r.id === "general")!.limit).toBe(28000);
  });
});

/* ================================================================== */
describe("디딤돌대출", () => {
  it("지방 4.5억, 미혼 5,500 생애최초 → 가능, 상품 한도 2.4억, 금리 3.80−0.2 = 3.60%", () => {
    const r = loan(profile({ inc1: 5500, firstHome: true }), house({ price: 45000 }), "didimdol");
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(24000);
    expect(r.binding).toBe("product");
    expect(r.rate).toBe(3.6);
    expect(r.rateAuto).toBe(true);
  });

  it("신혼 합산 9천(기준 8.5천 초과)이어도 1인 소득 6천 이하면 가능 + 금리 가산", () => {
    const r = loan(profile({ inc1: 5000, inc2: 4000, marital: "newly", firstHome: true }), house({ price: 55000 }), "didimdol");
    expect(r.ok).toBe(true);
    expect(r.onePerson).toBe(true);
    expect(r.rate).toBe(4.25); // 최고금리 4.15 + 0.3 − 신혼·생애최초 0.2
    expect(r.limit).toBe(32000);
  });

  it("혼인 7년 초과 부부는 1인 소득 특례 대상이 아님", () => {
    const r = loan(profile({ inc1: 5000, inc2: 4000, marital: "married", firstHome: true }), house({ price: 45000 }), "didimdol");
    expect(r.ok).toBe(false);
    expect(r.onePerson).toBe(false);
    expect(failed(profile({ inc1: 5000, inc2: 4000, marital: "married", firstHome: true }), house({ price: 45000 }), "didimdol")).toContain("income");
  });

  it("순자산 5.11억 초과면 불가", () => {
    expect(failed(profile({ netAsset: 60000 }), house({ price: 40000 }), "didimdol")).toContain("asset");
  });

  it("주택가격: 일반 5억 이하, 신혼은 6억 이하", () => {
    expect(failed(profile({ inc1: 5000 }), house({ price: 52000 }), "didimdol")).toContain("price");
    expect(loan(profile({ inc1: 4000, inc2: 1000, marital: "newly" }), house({ price: 52000 }), "didimdol").ok).toBe(true);
  });

  it("수도권 외 읍·면은 100㎡까지, 수도권은 읍·면이어도 85㎡", () => {
    expect(loan(profile(), house({ area: 90, eupmyeon: true }), "didimdol").ok).toBe(true);
    expect(failed(profile(), house({ regionId: "metro", area: 90, eupmyeon: true }), "didimdol")).toContain("area");
  });

  it("만기 40년은 불가", () => {
    expect(failed(profile(), house({ years: 40 }), "didimdol")).toContain("term");
  });

  it("2자녀 우대금리 0.5%p", () => {
    const r = loan(profile({ inc1: 4000, inc2: 2500, marital: "married", kids: 2 }), house({ price: 55000 }), "didimdol");
    expect(r.ok).toBe(true);
    expect(r.rate).toBe(3.3); // 4~7천 구간 30년 3.80 − 0.5
  });

  it("금리를 직접 입력하면 자동 계산 대신 사용", () => {
    const e = evaluate(profile(), house(), { didimdol: 3.0 });
    const r = e.results.find((x) => x.id === "didimdol")!;
    expect(r.rate).toBe(3.0);
    expect(r.rateAuto).toBe(false);
  });

  it("최저 소득 구간 + 3자녀·신혼 우대 = 2.85 − 0.7 − 0.2", () => {
    expect(didimdolAutoRate(RULES, { income: 1000, years: 10, kids: 3, newlywed: true, firstHome: true, onePerson: false })).toBe(1.95);
  });
});

/* ================================================================== */
describe("신생아 특례 디딤돌", () => {
  const nb = (o: Partial<Profile>) => profile({ marital: "newly", newborn: true, ...o });

  it("맞벌이 합산 1.9억, 각자 1.3억 이하 → 가능", () => {
    expect(loan(nb({ inc1: 12000, inc2: 7000 }), house({ regionId: "seoul", price: 80000 }), "newborn").ok).toBe(true);
  });

  it("맞벌이라도 한 명이 1.3억 초과면 불가", () => {
    expect(failed(nb({ inc1: 14000, inc2: 5000 }), house({ regionId: "seoul", price: 80000 }), "newborn")).toContain("income");
  });

  it("2년 내 출산이 아니면 불가", () => {
    expect(failed(nb({ newborn: false }), house(), "newborn")).toContain("newborn");
  });

  it("주택가격 9억 초과면 불가", () => {
    expect(failed(nb({}), house({ regionId: "seoul", price: 95000 }), "newborn")).toContain("price");
  });

  it("상품 한도는 4억", () => {
    const r = loan(nb({ inc1: 9000, inc2: 4000 }), house({ regionId: "seoul", price: 85000 }), "newborn");
    expect(r.limit).toBe(40000);
  });
});

/* ================================================================== */
describe("보금자리론", () => {
  it("규제지역이어도 실수요자(무주택·6억 이하·7천 이하)는 LTV 미차감", () => {
    const r = loan(profile({ inc1: 6500 }), house({ regionId: "seoul", price: 55000 }), "bogeum");
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(36000);
    expect(r.binding).toBe("product");
    expect(r.reqs.some((q) => q.code === "regulatedCut")).toBe(false);
  });

  it("규제지역 1주택(처분 조건)은 LTV·DTI 10%p 차감 → LTV 60%", () => {
    const r = loan(profile({ inc1: 6500, homes: 1 }), house({ regionId: "seoul", price: 55000 }), "bogeum");
    expect(r.limit).toBe(33000);
    expect(r.binding).toBe("ltv");
    expect(r.reqs.some((q) => q.code === "regulatedCut")).toBe(true);
  });

  it("신혼 1자녀는 소득 기준 9천", () => {
    const r = loan(profile({ inc1: 5000, inc2: 4000, marital: "newly", kids: 1 }), house({ price: 50000 }), "bogeum");
    expect(r.ok).toBe(true);
    expect(r.onePerson).toBe(false);
  });

  it("신혼 합산 1.2억이어도 1인 7천 이하면 가능 (1인 소득으로 DTI)", () => {
    const r = loan(profile({ inc1: 8000, inc2: 4000, marital: "newly" }), house({ price: 50000 }), "bogeum");
    expect(r.ok).toBe(true);
    expect(r.onePerson).toBe(true);
    expect(r.reqs.find((q) => q.code === "calc")!.label).toContain("1인 소득 기준");
  });

  it("다자녀 가구 상품 한도 4억", () => {
    const r = loan(profile({ inc1: 6000, inc2: 3000, marital: "married", kids: 2 }), house({ price: 58000 }), "bogeum");
    expect(r.limit).toBe(40000);
  });

  it("다주택자는 불가", () => {
    expect(failed(profile({ homes: 2 }), house(), "bogeum")).toContain("homes");
  });
});

/* ================================================================== */
describe("네고 시뮬레이션", () => {
  const newlyweds = profile({ inc1: 5000, inc2: 4000, marital: "newly", firstHome: true });

  it("지방 6.2억 → 2,000만원 네고하면 디딤돌 가능 (6억 기준)", () => {
    const opts = simulateNego(newlyweds, house({ price: 62000 }));
    const d = opts.find((o) => o.id === "didimdol")!;
    expect(d.kind).toBe("unlock");
    expect(d.discount).toBe(2000);
    expect(d.newPrice).toBe(60000);
    expect(d.result.ok).toBe(true);
  });

  it("서울 15.5억 → 5,000만원 네고하면 금액 상한이 4억→6억으로 늘어남", () => {
    const opts = simulateNego(profile({ inc1: 30000 }), house({ regionId: "seoul", price: 155000 }));
    const g = opts.find((o) => o.id === "general")!;
    expect(g.kind).toBe("boost");
    expect(g.discount).toBe(5000);
    expect(g.limitIncrease).toBe(20000);
  });

  it("네고 범위를 넘으면 옵션이 없음", () => {
    const opts = simulateNego(newlyweds, house({ price: 62000 }), {}, { max: 1000 });
    expect(opts.find((o) => o.id === "didimdol")).toBeUndefined();
  });

  it("가격과 무관한 요건(출산)은 네고로 해결되지 않음", () => {
    const opts = simulateNego(newlyweds, house({ price: 62000 }));
    expect(opts.find((o) => o.id === "newborn")).toBeUndefined();
  });
});

/* ================================================================== */
describe("추천 순위", () => {
  // 지방 6억, 신혼, 현금 2억 → 필요 자금 4억
  const e = evaluate(profile({ inc1: 5000, inc2: 4000, marital: "newly", firstHome: true }), house({ price: 60000 }));

  it("부족 자금이 없는 대출을 먼저, 그다음 월 상환액 적은 순", () => {
    expect(rankLoans(e.results, "monthly").map((r) => r.id)).toEqual(["general", "didimdol", "bogeum"]);
  });

  it("한도 순 정렬", () => {
    expect(rankLoans(e.results, "limit").map((r) => r.id)).toEqual(["general", "bogeum", "didimdol"]);
  });
});

/* ================================================================== */
describe("유틸 · 규칙 데이터", () => {
  it("금액 표시", () => {
    expect(formatManwon(44100)).toBe("4억 4,100만원");
    expect(formatManwon(60000)).toBe("6억원");
    expect(formatManwon(2000)).toBe("2,000만원");
    expect(formatManwon(0)).toBe("0원");
  });

  it("규제지역은 서울 + 경기 12곳", () => {
    expect(RULES.regions.filter((r) => r.regulated)).toHaveLength(13);
  });

  it("모든 규칙 섹션의 출처가 SOURCES에 등록돼 있음", () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    const refs = [RULES.general.source, RULES.bogeum.source, ...RULES.didimdol.source, ...RULES.newborn.source];
    refs.forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it("디딤돌 금리표는 소득 구간이 오름차순", () => {
    const ups = RULES.didimdol.rateTable.map((r) => r.upTo);
    expect(ups).toEqual([...ups].sort((a, b) => a - b));
  });

  it("알 수 없는 지역이면 에러", () => {
    expect(() => evaluate(profile(), house({ regionId: "mars" }))).toThrow();
  });
});
