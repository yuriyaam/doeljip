import { describe, expect, it } from "vitest";
import { GLOSSARY, termKeysFor } from "../glossary";
import { computeCheck } from "./derive";
import { DEFAULT_HOUSE, DEFAULT_PROFILE } from "./defaults";
import {
  LOAN_SUB, NO_APARTMENT_MESSAGE, autoListingName, bindingText, boostLine, conclusionTip, excludedNote, firstFailLabel,
  limitChange, negoPct, noGoReason, profileSummary, reqTermText, shouldReplaceName, tradeLine, won, type TextPart,
} from "./present";

const text = (parts: TextPart[] | null) => parts?.map((p) => p.text).join("");
const bold = (parts: TextPart[] | null) => parts?.filter((p) => p.bold).map((p) => p.text);

const newlyweds = { ...DEFAULT_PROFILE, inc1: 5000, inc2: 4000, marital: "newly" as const, firstHome: true };
const local = (price: number) => ({ ...DEFAULT_HOUSE, regionId: "local", price });

describe("금액 표시", () => {
  it("won: 만원 → 원 (천 단위 쉼표)", () => {
    expect(won(123.45)).toBe("1,234,500원");
    expect(won(0)).toBe("0원");
  });
});

describe("용어 설명", () => {
  it("요건 문구에서 용어를 찾는다 (최대 2개, 중복 없음)", () => {
    expect(termKeysFor("DSR 40% (스트레스 +3%p)")).toEqual(["dsr", "stress"]);
    expect(termKeysFor("LTV 40% DSR DTI")).toEqual(["ltv", "dsr"]);
    expect(termKeysFor("LTV LTV")).toEqual(["ltv"]);
    expect(termKeysFor("생애최초")).toEqual([]);
  });

  it("1인 소득 특례가 적용된 요건에는 그 설명도 붙는다", () => {
    expect(termKeysFor(reqTermText("소득 기준", "1인 소득 특례 적용"))).toEqual(["onePerson"]);
    expect(termKeysFor(reqTermText("소득 기준", "합산 9천"))).toEqual([]);
  });

  it("모든 용어에 제목과 설명이 있다", () => {
    for (const e of Object.values(GLOSSARY)) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.body.length).toBeGreaterThan(10);
    }
  });
});

describe("프로필 요약", () => {
  it("신혼 기본값: 부부합산, 신혼, 무주택, 생애최초가 보인다", () => {
    expect(profileSummary(DEFAULT_PROFILE)).toEqual([
      "부부합산 9,000만원", "신혼", "자녀 없음", "무주택", "생애최초", "현금 2억원", "순자산 2억 5,000만원",
    ]);
  });

  it("미혼은 본인 연소득, 1주택이면 생애최초를 숨기고, 기존 대출·출산을 보여준다", () => {
    const s = profileSummary({
      ...DEFAULT_PROFILE, marital: "single", homes: 1, kids: 2, newborn: true, existingAnnualPayment: 1200,
    });
    expect(s).toContain("연소득 5,000만원");
    expect(s).toContain("1주택");
    expect(s).toContain("자녀 2명");
    expect(s).toContain("2년 내 출산");
    expect(s).toContain("기존 대출 연 1,200만원");
    expect(s).not.toContain("생애최초");
  });
});

describe("대출 설명 문구", () => {
  const check = computeCheck(newlyweds, local(60000), {}, "monthly");

  it("모든 대출에 부제가 있다", () => {
    expect(Object.keys(LOAN_SUB).sort()).toEqual(["bogeum", "didimdol", "general", "newborn"]);
  });

  it("한도를 묶는 기준: 일반은 '규제', 정책대출은 '기준', 불가면 없음", () => {
    const general = check.evaluation.results.find((r) => r.id === "general")!;
    const didimdol = check.evaluation.results.find((r) => r.id === "didimdol")!;
    const newborn = check.evaluation.results.find((r) => r.id === "newborn")!;
    expect(bindingText(general)).toMatch(/^한도를 묶는 규제: /);
    expect(bindingText(didimdol)).toMatch(/^한도를 묶는 기준: /);
    expect(newborn.ok).toBe(false);
    expect(bindingText(newborn)).toBeNull();
  });

  it("안 되는 이유: 첫 요건은 사유 포함, 나머지는 이름만", () => {
    const newborn = check.evaluation.results.find((r) => r.id === "newborn")!;
    const fails = newborn.reqs.filter((q) => q.ok === false);
    expect(fails.length).toBeGreaterThan(0);
    const reason = noGoReason(newborn);
    expect(reason.startsWith(`${fails[0]!.label} (${fails[0]!.detail})`)).toBe(true);
    expect(firstFailLabel(newborn)).toBe(fails[0]!.label);
  });
});

describe("결론 네고 팁", () => {
  it("추천이 없을 때: 네고하면 가능한 대출을 알려준다 (지방 6.2억 → 2천만원 네고 시 디딤돌)", () => {
    // 실제 판정 결과에서 추천만 비워서(= 가능한 대출 없음) 해당 문구 분기를 확인해요.
    const c = { ...computeCheck(newlyweds, local(62000), {}, "monthly"), best: null };
    const tip = conclusionTip(c);
    expect(text(tip)).toMatch(/^매매가를 2,000만원\(3\.2%\) 네고해 6억원에 사면 디딤돌대출로 가능해요\.$/);
    expect(bold(tip)).toEqual(["2,000만원", "디딤돌대출"]);
  });

  it("추천이 있고 네고로 월 상환액이 줄면 줄어드는 금액을 보여준다", () => {
    const c = computeCheck(newlyweds, local(62000), {}, "monthly");
    const tip = conclusionTip(c);
    expect(c.best).not.toBeNull();
    expect(tip).not.toBeNull();
    expect(text(tip)).toMatch(/^매매가를 .+\(\d+(\.\d)?%\) 네고하면 .+로 월 상환액이 .+원 줄어요/);
    expect(bold(tip)).toHaveLength(3);
  });

  it("네고 옵션이 없으면 null", () => {
    expect(conclusionTip(computeCheck(DEFAULT_PROFILE, DEFAULT_HOUSE, {}, "monthly"))).toBeNull();
  });

  it("한도가 늘어나는 안내 (서울 15.5억 → 5천만원 네고 시 한도 +2억)", () => {
    const c = computeCheck({ ...DEFAULT_PROFILE, inc1: 30000 }, { ...DEFAULT_HOUSE, price: 155000 }, {}, "monthly");
    const boost = c.nego.find((n) => n.id === "general")!;
    expect(boost.kind).toBe("boost");
    expect(text(boostLine(boost))).toBe("매매가를 5,000만원(3.2%) 낮춰 15억원에 사면 한도가 2억원 늘어나요 (최대 6억원).");
  });
});

describe("단지 검색 문구", () => {
  it("결과가 없을 때 안내 문구는 정해진 그대로", () => {
    expect(NO_APARTMENT_MESSAGE).toBe("아파트 단지를 찾지 못했어요. 단지 이름을 다시 확인해 주세요");
  });

  it("이름 자동 입력: 비었거나 직전 자동 이름일 때만 바꾼다", () => {
    expect(autoListingName("잠실엘스", 85)).toBe("잠실엘스 85㎡");
    expect(shouldReplaceName("", null)).toBe(true);
    expect(shouldReplaceName("  ", null)).toBe(true);
    expect(shouldReplaceName("잠실엘스 60㎡", "잠실엘스 60㎡")).toBe(true);
    expect(shouldReplaceName("우리집 후보 1순위", "잠실엘스 60㎡")).toBe(false); // 직접 쓴 이름은 지킨다
    expect(shouldReplaceName("우리집 후보 1순위", null)).toBe(false);
  });

  it("최근 거래 한 줄: 날짜 · 가격 · 층", () => {
    expect(tradeLine({ date: "2026-10-22", price: 85000, floor: 12 })).toBe("2026-10-22 · 8억 5,000만원 · 12층");
    expect(tradeLine({ date: "2026-10-22", price: 85000, floor: 0 })).toBe("2026-10-22 · 8억 5,000만원");
    expect(tradeLine({ date: "2026-10-22", price: 9500, floor: -1 })).toBe("2026-10-22 · 9,500만원 · -1층");
  });

  it("걸러낸 거래 안내", () => {
    expect(excludedNote({ canceled: 0, direct: 0 })).toBeNull();
    expect(excludedNote({ canceled: 2, direct: 0 })).toBe("해제된 거래 2건은 뺐어요");
    expect(excludedNote({ canceled: 0, direct: 1 })).toBe("직거래 1건은 뺐어요");
    expect(excludedNote({ canceled: 2, direct: 1 })).toBe("해제된 거래 2건과 직거래 1건은 뺐어요");
  });
});

describe("네고 비율 표시", () => {
  it("매매가 대비 %를 소수 첫째 자리까지 보여준다", () => {
    expect(negoPct({ discount: 2000, newPrice: 60000 })).toBe("3.2%");
    expect(negoPct({ discount: 3000, newPrice: 77000 })).toBe("3.8%");
    expect(negoPct({ discount: 4000, newPrice: 76000 })).toBe("5%");
  });
});

describe("조건별 비교", () => {
  it("한도가 늘면 better, 줄면 worse, 같으면 null", () => {
    // 소득이 낮으면 DSR이 한도를 묶으니, 소득을 늘리면 한도가 커져요.
    const poor = { ...DEFAULT_PROFILE, inc1: 3000, inc2: 0 };
    const base = computeCheck(poor, local(60000), {}, "monthly").evaluation.results;
    const rich = computeCheck({ ...poor, inc2: 4000 }, local(60000), {}, "monthly").evaluation.results;
    const g = (rs: typeof base) => rs.find((r) => r.id === "general")!;
    expect(limitChange(g(base), g(rich))).toBe("better");
    expect(limitChange(g(rich), g(base))).toBe("worse");
    expect(limitChange(g(base), g(base))).toBeNull();
  });
});
