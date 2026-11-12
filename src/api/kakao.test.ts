import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "./errors";
import { jsonResponse, kakaoPlace } from "./fixtures";
import { isApartment, lookupSggCd, searchApartments } from "./kakao";

const deps = (f: unknown) => ({ fetch: f as typeof fetch, key: "secret-key" });

describe("아파트 구분", () => {
  it("카테고리가 '부동산 > 주거시설 > 아파트'인 것만 아파트", () => {
    expect(isApartment("부동산 > 주거시설 > 아파트")).toBe(true);
    expect(isApartment("부동산 > 주거시설 > 오피스텔")).toBe(false);
    expect(isApartment("부동산 > 주거시설 > 빌라,주택")).toBe(false);
    expect(isApartment("부동산 > 주거시설 > 아파트 > 아파트 동")).toBe(false); // 동 단위 항목은 단지가 아님
    expect(isApartment("가정,생활 > 백화점 > 현대백화점")).toBe(false);
    expect(isApartment("교통,수송 > 입출구")).toBe(false);
    expect(isApartment("")).toBe(false);
  });
});

describe("단지 검색", () => {
  it("아파트만 남기고, 중복을 없애고, 인증 헤더로 호출한다", async () => {
    const f = vi.fn(async () =>
      jsonResponse({
        documents: [
          kakaoPlace({ id: "1" }),
          kakaoPlace({ id: "2", place_name: "경희궁자이4단지오피스텔", category_name: "부동산 > 주거시설 > 오피스텔" }),
          kakaoPlace({ id: "3", place_name: "경희궁자이 경비실", category_name: "서비스,산업 > 관리,운영 > 건물관리사무소" }),
          kakaoPlace({ id: "1" }), // 중복
          kakaoPlace({ id: "4", address_name: "" }), // 주소 없음
          kakaoPlace({ id: "5", place_name: "경희궁자이3단지아파트", road_address_name: "" }),
        ],
      }),
    );
    const places = await searchApartments("경희궁자이", deps(f));
    expect(places.map((p) => p.id)).toEqual(["1", "5"]);
    expect(places[0]).toEqual({
      id: "1", name: "경희궁자이4단지아파트", address: "서울 종로구 교북동 126", roadAddress: "서울 종로구 송월길 155",
    });
    expect(places[1]!.roadAddress).toBe("");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("search/keyword.json");
    expect(url).toContain(encodeURIComponent("경희궁자이"));
    expect((init.headers as Record<string, string>).Authorization).toBe("KakaoAK secret-key");
  });

  it("최대 10개까지만", async () => {
    const documents = Array.from({ length: 15 }, (_, i) => kakaoPlace({ id: String(i) }));
    expect(await searchApartments("자이", deps(async () => jsonResponse({ documents })))).toHaveLength(10);
  });

  it("검색어 + '아파트'로도 찾아 합친다 (원래 결과가 먼저, 중복 제거)", async () => {
    const f = vi.fn(async (input: string) => {
      const q = new URL(input).searchParams.get("query");
      return jsonResponse({
        documents:
          q === "압구정현대"
            ? [kakaoPlace({ id: "x", place_name: "압구정현대이비인후과", category_name: "의료,건강 > 병원" })]
            : [kakaoPlace({ id: "a1", place_name: "현대아파트" }), kakaoPlace({ id: "a2", place_name: "현대65동아파트" })],
      });
    });
    const places = await searchApartments("압구정현대", deps(f));
    expect(places.map((p) => p.id)).toEqual(["a1", "a2"]);
    const queries = f.mock.calls.map((c) => new URL(String((c as unknown[])[0])).searchParams.get("query"));
    expect(queries).toEqual(["압구정현대", "압구정현대 아파트"]);
  });

  it("검색어에 이미 '아파트'가 있으면 한 번만 찾는다", async () => {
    const f = vi.fn(async () => jsonResponse({ documents: [kakaoPlace()] }));
    await searchApartments("은마아파트", deps(f));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("보조 검색이 실패해도 원래 검색 결과는 돌려준다", async () => {
    const f = vi.fn(async (input: string) => {
      if (new URL(input).searchParams.get("query")!.endsWith("아파트")) throw new Error("boom");
      return jsonResponse({ documents: [kakaoPlace({ id: "ok" })] });
    });
    expect((await searchApartments("경희궁자이", deps(f))).map((p) => p.id)).toEqual(["ok"]);
  });

  it("결과가 없거나 모양이 이상하면 빈 배열", async () => {
    expect(await searchApartments("없는단지", deps(async () => jsonResponse({ documents: [] })))).toEqual([]);
    expect(await searchApartments("없는단지", deps(async () => jsonResponse({})))).toEqual([]);
  });
});

describe("시군구 코드 찾기", () => {
  const addr = (b_code: unknown) => ({ documents: [{ address: { b_code } }] });

  it("법정동코드 10자리의 앞 5자리", async () => {
    expect(await lookupSggCd("서울 종로구 행촌동 211", deps(async () => jsonResponse(addr("1111018100"))))).toBe("11110");
  });

  it("찾지 못하거나 코드가 이상하면 null", async () => {
    expect(await lookupSggCd("없는 주소", deps(async () => jsonResponse({ documents: [] })))).toBeNull();
    expect(await lookupSggCd("x", deps(async () => jsonResponse(addr("")))) ).toBeNull();
    expect(await lookupSggCd("x", deps(async () => jsonResponse(addr("1111"))))).toBeNull();
    expect(await lookupSggCd("x", deps(async () => jsonResponse({ documents: [{ road_address: {} }] })))).toBeNull();
  });
});

describe("오류", () => {
  const kind = async (status: number) => {
    try {
      await searchApartments("자이", deps(async () => jsonResponse({}, status)));
    } catch (e) {
      return (e as UpstreamError).kind;
    }
    return null;
  };

  it("인증(401·403) / 한도(429) / 그 외를 나눈다", async () => {
    expect(await kind(401)).toBe("auth");
    expect(await kind(403)).toBe("auth");
    expect(await kind(429)).toBe("rate-limit");
    expect(await kind(500)).toBe("upstream");
  });

  it("연결 실패 메시지에 키를 싣지 않는다", async () => {
    try {
      await searchApartments("자이", deps(async () => { throw new Error("fail secret-key"); }));
    } catch (e) {
      expect((e as UpstreamError).kind).toBe("upstream");
      expect((e as Error).message).not.toContain("secret-key");
      return;
    }
    throw new Error("실패해야 해요");
  });
});
