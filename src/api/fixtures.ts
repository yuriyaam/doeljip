/** 테스트용 픽스처. 필드 모양은 실제 국토부·카카오 응답에서 확인한 것을 따라요. */

/** 국토부 거래 1건 (JSON 응답의 item). 실제로는 숫자도 일부 문자열로 와요 (bonbun "0126", dealAmount "120,000"). */
export function molitItem(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aptDong: 401,
    aptNm: "경희궁자이(4단지)",
    aptSeq: "11110-2464",
    bonbun: "0126",
    bubun: "0000",
    buildYear: 2017,
    buyerGbn: "개인",
    cdealDay: " ",
    cdealType: " ",
    dealAmount: "120,000",
    dealDay: 14,
    dealMonth: 10,
    dealYear: 2025,
    dealingGbn: "중개거래",
    excluUseAr: 84.97,
    floor: 14,
    jibun: 126,
    roadNm: "송월길",
    roadNmBonbun: "00155",
    roadNmBubun: "00000",
    sggCd: 11110,
    slerGbn: "개인",
    umdCd: 18000,
    umdNm: "교북동",
    ...over,
  };
}

export function molitResponse(items: unknown, totalCount: number): unknown {
  return {
    response: {
      header: { resultCode: "000", resultMsg: "OK" },
      body: { items: items === undefined ? "" : { item: items }, numOfRows: 1000, pageNo: 1, totalCount },
    },
  };
}

export const molitError = (code: string, msg: string): unknown => ({
  response: { header: { resultCode: code, resultMsg: msg } },
});

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** 카카오 키워드 검색 문서 1건 */
export function kakaoPlace(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "1001",
    place_name: "경희궁자이4단지아파트",
    category_name: "부동산 > 주거시설 > 아파트",
    category_group_code: "",
    address_name: "서울 종로구 교북동 126",
    road_address_name: "서울 종로구 송월길 155",
    x: "126.96",
    y: "37.57",
    ...over,
  };
}
