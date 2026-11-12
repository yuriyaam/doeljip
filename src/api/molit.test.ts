import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "./errors";
import { jsonResponse, molitError, molitItem, molitResponse } from "./fixtures";
import { encodeKey, fetchMonth, normalizeItems, parseNumber, recentMonths, toTrade } from "./molit";

describe("값 읽기", () => {
  it("쉼표가 든 문자열과 숫자를 읽고, 못 읽으면 NaN", () => {
    expect(parseNumber("120,000")).toBe(120000);
    expect(parseNumber(45.879)).toBe(45.879);
    expect(parseNumber(" 7,500 ")).toBe(7500);
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber(" ")).toBeNaN();
    expect(parseNumber(null)).toBeNaN();
  });

  it("결과 1건은 객체, 0건은 빈 문자열, 여러 건은 배열로 와도 모두 배열로 만든다", () => {
    const one = molitItem();
    expect(normalizeItems(molitResponse(one, 1))).toEqual([one]);
    expect(normalizeItems(molitResponse([one, one], 2))).toHaveLength(2);
    expect(normalizeItems(molitResponse(undefined, 0))).toEqual([]);
    expect(normalizeItems({})).toEqual([]);
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems("깨짐")).toEqual([]);
  });
});

describe("거래 변환", () => {
  it("실제 응답 모양을 읽는다 (만원, ㎡, 번지 숫자화)", () => {
    expect(toTrade(molitItem())).toEqual({
      aptSeq: "11110-2464", aptNm: "경희궁자이(4단지)", sggCd: "11110", umdNm: "교북동",
      roadNm: "송월길", roadMain: 155, roadSub: 0, lotMain: 126, lotSub: 0,
      area: 84.97, price: 120000, floor: 14, buildYear: 2017, date: "2025-10-14",
      direct: false, canceled: false,
    });
  });

  it("해제 거래는 cdealType이 공백이 아닌 값, 정상 거래는 공백 한 칸", () => {
    expect(toTrade(molitItem({ cdealType: "O", cdealDay: "26.01.06" }))!.canceled).toBe(true);
    expect(toTrade(molitItem({ cdealType: " " }))!.canceled).toBe(false);
    expect(toTrade(molitItem({ cdealType: "" }))!.canceled).toBe(false);
  });

  it("직거래를 구분하고, 부번이 있는 번지를 읽는다", () => {
    const t = toTrade(molitItem({ dealingGbn: "직거래", bonbun: "0202", bubun: "0003", roadNmBubun: "00002" }))!;
    expect(t.direct).toBe(true);
    expect(t).toMatchObject({ lotMain: 202, lotSub: 3, roadSub: 2 });
  });

  it("날짜는 0을 채우고, 필수 값이 이상하면 null", () => {
    expect(toTrade(molitItem({ dealMonth: 3, dealDay: 5 }))!.date).toBe("2025-03-05");
    expect(toTrade(molitItem({ dealAmount: "" }))).toBeNull();
    expect(toTrade(molitItem({ dealAmount: "0" }))).toBeNull();
    expect(toTrade(molitItem({ excluUseAr: "넓음" }))).toBeNull();
    expect(toTrade(molitItem({ aptSeq: "" }))).toBeNull();
    expect(toTrade(molitItem({ dealYear: undefined }))).toBeNull();
  });
});

describe("조회 월", () => {
  it("이번 달부터 거꾸로 n개월, 연도를 넘긴다", () => {
    expect(recentMonths(new Date("2026-02-10T00:00:00Z"), 4)).toEqual(["202602", "202601", "202512", "202511"]);
  });

  it("한국 시간 기준이다 (UTC 2월 말일 15시 = KST 3월 1일 0시)", () => {
    expect(recentMonths(new Date("2026-02-28T15:00:00Z"), 1)).toEqual(["202603"]);
    expect(recentMonths(new Date("2026-02-28T14:59:00Z"), 1)).toEqual(["202602"]);
  });
});

describe("인증키 인코딩", () => {
  it("디코딩된 키는 한 번 인코딩하고, 이미 인코딩된 키는 다시 인코딩하지 않는다", () => {
    expect(encodeKey("ab+c/d==")).toBe("ab%2Bc%2Fd%3D%3D");
    expect(encodeKey("ab%2Bc%2Fd%3D%3D")).toBe("ab%2Bc%2Fd%3D%3D");
    expect(encodeKey("abc123")).toBe("abc123");
  });
});

describe("한 달 거래 조회", () => {
  const deps = (fetchImpl: typeof fetch) => ({ fetch: fetchImpl, key: "k+ey" });

  it("요청 주소: 시군구·월·JSON·인코딩된 키", async () => {
    const f = vi.fn(async () => jsonResponse(molitResponse([molitItem()], 1)));
    const trades = await fetchMonth("11110", "202510", deps(f as unknown as typeof fetch));
    expect(trades).toHaveLength(1);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("LAWD_CD=11110");
    expect(url).toContain("DEAL_YMD=202510");
    expect(url).toContain("_type=json");
    expect(url).toContain("serviceKey=k%2Bey");
  });

  it("건수가 한 페이지를 넘으면 다음 페이지도 가져온다", async () => {
    const pages: number[] = [];
    const f = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("pageNo"));
      pages.push(page);
      return jsonResponse(molitResponse([molitItem({ aptSeq: `s-${page}` })], 2500));
    });
    const trades = await fetchMonth("11710", "202510", deps(f as unknown as typeof fetch));
    expect(pages).toEqual([1, 2, 3]);
    expect(trades.map((t) => t.aptSeq)).toEqual(["s-1", "s-2", "s-3"]);
  });

  it("0건이면 빈 배열", async () => {
    const f = async () => jsonResponse(molitResponse(undefined, 0));
    expect(await fetchMonth("11110", "203001", deps(f as unknown as typeof fetch))).toEqual([]);
  });

  it("읽을 수 없는 거래는 건너뛴다", async () => {
    const f = async () => jsonResponse(molitResponse([molitItem(), molitItem({ dealAmount: "" })], 2));
    expect(await fetchMonth("11110", "202510", deps(f as unknown as typeof fetch))).toHaveLength(1);
  });

  const failWith = async (f: () => Promise<Response>) => {
    try {
      await fetchMonth("11110", "202510", deps(f as unknown as typeof fetch));
    } catch (e) {
      return e as UpstreamError;
    }
    throw new Error("실패해야 해요");
  };

  it("오류 코드를 종류별로 나눈다 (한도 / 인증 / 그 외)", async () => {
    expect((await failWith(async () => jsonResponse(molitError("22", "LIMIT")))).kind).toBe("rate-limit");
    expect((await failWith(async () => jsonResponse(molitError("23", "LIMIT")))).kind).toBe("rate-limit");
    expect((await failWith(async () => jsonResponse(molitError("30", "KEY")))).kind).toBe("auth");
    expect((await failWith(async () => jsonResponse(molitError("31", "EXPIRED")))).kind).toBe("auth");
    expect((await failWith(async () => jsonResponse(molitError("99", "?")))).kind).toBe("upstream");
  });

  it("XML 오류 본문도 종류를 알아본다", async () => {
    const xml = (code: string) => async () =>
      new Response(`<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>${code}</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`);
    expect((await failWith(xml("SERVICE_KEY_IS_NOT_REGISTERED_ERROR"))).kind).toBe("auth");
    expect((await failWith(xml("LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"))).kind).toBe("rate-limit");
    expect((await failWith(xml("UNKNOWN"))).kind).toBe("bad-response");
  });

  it("연결 실패는 upstream 오류, 오류 메시지에 인증키를 싣지 않는다", async () => {
    const e = await failWith(async () => {
      throw new Error("ECONNRESET k+ey");
    });
    expect(e.kind).toBe("upstream");
    expect(e.message).not.toContain("k+ey");
  });
});
