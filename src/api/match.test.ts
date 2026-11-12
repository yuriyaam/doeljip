import { describe, expect, it } from "vitest";
import { molitItem } from "./fixtures";
import { groupComplexes, matchTrades, parseLotAddress, parseRoadAddress } from "./match";
import { toTrade, type Trade } from "./molit";

const trade = (over: Record<string, unknown> = {}): Trade => toTrade(molitItem(over))!;

describe("주소 읽기", () => {
  it("도로명 주소: 도로명과 건물 본번·부번", () => {
    expect(parseRoadAddress("서울 종로구 송월길 155")).toEqual({ road: "송월길", main: 155, sub: 0 });
    expect(parseRoadAddress("서울 종로구 종로66길 28-2")).toEqual({ road: "종로66길", main: 28, sub: 2 });
    expect(parseRoadAddress("서울 송파구 올림픽로 435")).toEqual({ road: "올림픽로", main: 435, sub: 0 });
  });

  it("도로명 주소가 아니면 null", () => {
    expect(parseRoadAddress("")).toBeNull();
    expect(parseRoadAddress("서울 종로구 교북동 126")).toBeNull(); // 동 이름은 도로명이 아님
    expect(parseRoadAddress("서울 종로구 송월길")).toBeNull(); // 번호 없음
  });

  it("지번 주소: 법정동과 본번·부번", () => {
    expect(parseLotAddress("서울 종로구 교북동 126")).toEqual({ umd: "교북동", main: 126, sub: 0 });
    expect(parseLotAddress("서울 종로구 숭인동 202-3")).toEqual({ umd: "숭인동", main: 202, sub: 3 });
  });

  it("산 번지·번호 없음은 null", () => {
    expect(parseLotAddress("경기 가평군 설악면 산 12-3")).toBeNull();
    expect(parseLotAddress("서울 종로구 교북동")).toBeNull();
    expect(parseLotAddress("")).toBeNull();
  });
});

describe("국토부 거래에서 단지 찾기", () => {
  const g4 = trade(); // 송월길 155, 교북동 126
  const g3 = trade({ aptNm: "경희궁자이(3단지)", aptSeq: "11110-2446", roadNmBonbun: "00035", roadNm: "경교장길", bonbun: "0233", umdNm: "평동" });
  const all = [g4, g3];

  it("도로명+건물번호로 정확히 맞춘다 (이름이 달라도)", () => {
    const r = matchTrades(all, { roadAddress: "서울 종로구 송월길 155", address: "서울 종로구 교북동 126" });
    expect(r.by).toBe("road");
    expect(r.trades.map((t) => t.aptSeq)).toEqual(["11110-2464"]);
  });

  it("건물번호가 다르면 맞추지 않는다 (송월길 130 ≠ 송월길 155)", () => {
    const r = matchTrades(all, { roadAddress: "서울 종로구 송월길 130", address: "서울 종로구 행촌동 211" });
    expect(r).toEqual({ trades: [], by: null });
  });

  it("도로명이 없으면 법정동+지번으로 맞춘다", () => {
    const r = matchTrades(all, { roadAddress: "", address: "서울 종로구 평동 233" });
    expect(r.by).toBe("lot");
    expect(r.trades[0]!.aptSeq).toBe("11110-2446");
  });

  it("도로명으로 못 찾으면 지번으로 한 번 더 찾는다", () => {
    const r = matchTrades(all, { roadAddress: "서울 종로구 없는길 1", address: "서울 종로구 교북동 126" });
    expect(r.by).toBe("lot");
    expect(r.trades[0]!.aptSeq).toBe("11110-2464");
  });

  it("부번도 구분한다 (126-3 ≠ 126)", () => {
    const r = matchTrades(all, { roadAddress: "", address: "서울 종로구 교북동 126-3" });
    expect(r.by).toBeNull();
  });
});

describe("평형별로 묶기", () => {
  it("단지(aptSeq)별로 나누고 거래가 많은 단지가 먼저 온다. 같은 이름이라도 aptSeq가 다르면 다른 단지", () => {
    const list = [
      trade({ aptNm: "현대", aptSeq: "11710-32" }),
      trade({ aptNm: "현대", aptSeq: "11710-85" }),
      trade({ aptNm: "현대", aptSeq: "11710-85", dealDay: 2 }),
    ];
    const c = groupComplexes(list);
    expect(c.map((x) => [x.aptSeq, x.tradeCount])).toEqual([["11710-85", 2], ["11710-32", 1]]);
  });

  it("전용면적을 정수로 반올림해 묶고, 정확한 면적은 가장 최근 거래 값을 쓴다", () => {
    const [c] = groupComplexes([
      trade({ excluUseAr: 84.9, dealDay: 1, dealAmount: "100,000" }),
      trade({ excluUseAr: 84.97, dealDay: 20, dealAmount: "110,000" }),
      trade({ excluUseAr: 59.99, dealDay: 5, dealAmount: "80,000" }),
    ]);
    expect(c!.areas.map((a) => [a.key, a.label, a.count])).toEqual([[60, "60㎡", 1], [85, "85㎡", 2]]);
    expect(c!.areas[1]!.area).toBe(84.97);
  });

  it("최근 거래는 최신순으로 최대 5건", () => {
    const list = Array.from({ length: 8 }, (_, i) => trade({ dealDay: i + 1, dealAmount: String(100000 + i * 1000) }));
    const area = groupComplexes(list)[0]!.areas[0]!;
    expect(area.count).toBe(8);
    expect(area.recent).toHaveLength(5);
    expect(area.recent.map((r) => r.date)).toEqual([
      "2025-10-08", "2025-10-07", "2025-10-06", "2025-10-05", "2025-10-04",
    ]);
    expect(area.recent[0]).toEqual({ date: "2025-10-08", price: 107000, floor: 14, direct: false });
  });

  it("거래가 없으면 빈 배열", () => {
    expect(groupComplexes([])).toEqual([]);
  });
});
