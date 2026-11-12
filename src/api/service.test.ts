import { describe, expect, it } from "vitest";
import { TtlCache } from "./cache";
import { jsonResponse, kakaoPlace, molitItem, molitResponse } from "./fixtures";
import type { Trade } from "./molit";
import { complexTrades, searchComplexes, type Deps } from "./service";

/** 주소로 카카오를, 월로 국토부를 흉내 내는 가짜 서버 */
function fakeServer(opts: { b_code?: string; byMonth?: Record<string, unknown[]> } = {}) {
  const calls = { kakaoKeyword: 0, kakaoAddress: 0, molit: [] as string[] };
  const f = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("search/keyword.json")) {
      calls.kakaoKeyword++;
      return jsonResponse({ documents: [kakaoPlace()] });
    }
    if (url.pathname.endsWith("search/address.json")) {
      calls.kakaoAddress++;
      return jsonResponse({ documents: opts.b_code === "" ? [] : [{ address: { b_code: opts.b_code ?? "1111018100" } }] });
    }
    const ymd = url.searchParams.get("DEAL_YMD")!;
    calls.molit.push(ymd);
    const items = opts.byMonth?.[ymd] ?? [];
    return jsonResponse(molitResponse(items.length ? items : undefined, items.length));
  };
  return { f: f as unknown as typeof fetch, calls };
}

const NOW = new Date("2025-11-15T03:00:00Z"); // KST 11월 15일
const mk = (f: typeof fetch, cache = new TtlCache<Trade[]>()): Deps => ({
  fetch: f, now: () => NOW, molitKey: "m", kakaoKey: "k", cache,
});
const params = { address: "서울 종로구 교북동 126", roadAddress: "서울 종로구 송월길 155", months: 3, includeDirect: false };

describe("단지 검색", () => {
  it("카카오 후보를 그대로 돌려준다", async () => {
    const s = fakeServer();
    const places = await searchComplexes("경희궁자이", mk(s.f));
    expect(places).toHaveLength(1); // 두 검색이 같은 단지를 줘도 중복 없이 1개
    expect(s.calls.kakaoKeyword).toBe(2); // 원래 검색어 + "검색어 아파트"
  });
});

describe("최근 거래 조회", () => {
  it("시군구 코드를 찾고, 최근 n개월을 조회해 평형별로 돌려준다", async () => {
    const s = fakeServer({
      byMonth: {
        "202511": [molitItem({ dealMonth: 11, dealDay: 3, dealAmount: "130,000" })],
        "202510": [molitItem({ dealAmount: "120,000" }), molitItem({ aptSeq: "11110-2446", roadNmBonbun: "00035", roadNm: "경교장길" })],
      },
    });
    const r = await complexTrades(params, mk(s.f));
    expect(r.found).toBe(true);
    if (!r.found) return;
    expect(r.sggCd).toBe("11110");
    expect(r.regionId).toBe("seoul");
    expect(r.monthsSearched).toBe(3);
    expect(r.matchedBy).toBe("road");
    expect(s.calls.molit.sort()).toEqual(["202509", "202510", "202511"]);
    expect(r.complexes).toHaveLength(1); // 3단지(경교장길) 거래는 제외
    expect(r.complexes[0]!.areas[0]!.recent.map((t) => t.price)).toEqual([130000, 120000]);
  });

  it("해제된 거래는 빼고 건수를 알려준다", async () => {
    const s = fakeServer({
      byMonth: { "202510": [molitItem(), molitItem({ cdealType: "O", cdealDay: "25.11.01" }), molitItem({ cdealType: "O" })] },
    });
    const r = await complexTrades(params, mk(s.f));
    if (!r.found) throw new Error("found");
    expect(r.excluded).toEqual({ canceled: 2, direct: 0 });
    expect(r.complexes[0]!.tradeCount).toBe(1);
  });

  it("직거래는 기본으로 빼고, 옵션을 주면 포함한다", async () => {
    const byMonth = { "202510": [molitItem(), molitItem({ dealingGbn: "직거래", dealAmount: "90,000" })] };
    const without = await complexTrades(params, mk(fakeServer({ byMonth }).f));
    const withDirect = await complexTrades({ ...params, includeDirect: true }, mk(fakeServer({ byMonth }).f));
    if (!without.found || !withDirect.found) throw new Error("found");
    expect(without.excluded.direct).toBe(1);
    expect(without.complexes[0]!.tradeCount).toBe(1);
    expect(withDirect.excluded.direct).toBe(0);
    expect(withDirect.complexes[0]!.tradeCount).toBe(2);
    expect(withDirect.complexes[0]!.areas[0]!.recent.some((t) => t.direct)).toBe(true);
  });

  it("해제된 직거래는 해제로만 센다", async () => {
    const s = fakeServer({ byMonth: { "202510": [molitItem(), molitItem({ dealingGbn: "직거래", cdealType: "O" })] } });
    const r = await complexTrades(params, mk(s.f));
    if (!r.found) throw new Error("found");
    expect(r.excluded).toEqual({ canceled: 1, direct: 0 });
  });

  it("단지를 못 찾으면 빈 목록 (오류가 아님)", async () => {
    // 도로명도 지번도 다른 거래만 있는 경우
    const s = fakeServer({ byMonth: { "202510": [molitItem({ roadNm: "다른길", bonbun: "0999", umdNm: "다른동" })] } });
    const r = await complexTrades(params, mk(s.f));
    if (!r.found) throw new Error("found");
    expect(r.complexes).toEqual([]);
    expect(r.matchedBy).toBeNull();
  });

  it("시군구를 못 찾으면 국토부를 부르지 않는다", async () => {
    const s = fakeServer({ b_code: "" });
    const r = await complexTrades(params, mk(s.f));
    expect(r).toEqual({ found: false, reason: "no-region", sggCd: null });
    expect(s.calls.molit).toEqual([]);
  });

  it("같은 시군구·월은 캐시해서 두 번째부터 국토부를 부르지 않는다. 카카오는 매번 부른다", async () => {
    const s = fakeServer({ byMonth: { "202510": [molitItem()] } });
    const deps = mk(s.f);
    await complexTrades(params, deps);
    const first = s.calls.molit.length;
    await complexTrades(params, deps);
    expect(first).toBe(3);
    expect(s.calls.molit).toHaveLength(3);
    expect(s.calls.kakaoAddress).toBe(2);
  });

  it("조회 기간은 1~24개월로 맞춘다", async () => {
    const s = fakeServer();
    const r = await complexTrades({ ...params, months: 99 }, mk(s.f));
    if (!r.found) throw new Error("found");
    expect(r.monthsSearched).toBe(24);
    expect(s.calls.molit).toHaveLength(24);
  });

  it("경기 규제지역 단지는 해당 지역 id로 분류한다", async () => {
    const s = fakeServer({ b_code: "4113510900" }); // 성남시 분당구
    const r = await complexTrades(params, mk(s.f));
    if (!r.found) throw new Error("found");
    expect(r.sggCd).toBe("41135");
    expect(r.regionId).not.toBe("metro");
    expect(r.regionId.startsWith("gg")).toBe(true);
  });
});
