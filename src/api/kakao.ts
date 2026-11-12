/**
 * 카카오 로컬 API (서버에서 REST API 키로 호출).
 * 이용정책상 응답 결과를 저장·캐시하지 않아요. 단지를 찾는 순간에만 쓰고 버려요.
 */
import { UpstreamError } from "./errors";

const BASE = "https://dapi.kakao.com/v2/local";

export interface KakaoDeps {
  fetch: typeof fetch;
  key: string;
}

export interface Place {
  /** 카카오 장소 id (목록의 key 용도) */
  id: string;
  name: string;
  /** 지번 주소 (예: 서울 종로구 교북동 126) */
  address: string;
  /** 도로명 주소 (예: 서울 종로구 송월길 155). 없으면 "" */
  roadAddress: string;
}

type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");

/**
 * 아파트 단지만 남겨요. 같은 검색에 오피스텔, 정문, 경비실, 노인정 등이 섞여 나와요.
 * 카카오는 아파트에 category_group_code를 주지 않아서(빈 값) category_name으로만 구분할 수 있어요.
 * 아래에 "아파트 > 아파트 동"(예: 잠실엘스아파트 101동)이 따로 있어서, 정확히 일치하는 것만 단지로 봐요.
 */
export function isApartment(category: string): boolean {
  return category.trim() === "부동산 > 주거시설 > 아파트";
}

async function call(path: string, params: Record<string, string>, deps: KakaoDeps): Promise<unknown> {
  const url = `${BASE}/${path}?${new URLSearchParams(params).toString()}`;
  let res: Response;
  try {
    res = await deps.fetch(url, {
      headers: { Authorization: `KakaoAK ${deps.key}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new UpstreamError("upstream", "카카오 서버에 연결하지 못했어요", "kakao");
  }
  if (res.status === 401 || res.status === 403) throw new UpstreamError("auth", `카카오 인증 문제 (HTTP ${res.status})`, "kakao");
  if (res.status === 429) throw new UpstreamError("rate-limit", "카카오 호출 한도 초과", "kakao");
  if (!res.ok) throw new UpstreamError("upstream", `카카오 오류 (HTTP ${res.status})`, "kakao");
  try {
    return await res.json();
  } catch {
    throw new UpstreamError("bad-response", "카카오 응답을 읽지 못했어요", "kakao");
  }
}

const keywordDocs = (json: unknown): unknown[] => (isObj(json) && Array.isArray(json.documents) ? json.documents : []);

/**
 * 단지명으로 검색 → 아파트 후보 (최대 10개).
 * 카카오 키워드 검색은 병원·음식점 같은 장소를 먼저 주기도 해서("압구정현대" → 아파트 0건),
 * "검색어 + 아파트"로도 한 번 더 찾아 합쳐요. 보조 검색이 실패해도 원래 검색 결과는 보여줘요.
 */
export async function searchApartments(query: string, deps: KakaoDeps): Promise<Place[]> {
  const primary = call("search/keyword.json", { query, size: "15" }, deps);
  const secondary = query.includes("아파트")
    ? Promise.resolve(null)
    : call("search/keyword.json", { query: `${query} 아파트`, size: "15" }, deps).catch(() => null);
  const [first, second] = await Promise.all([primary, secondary]);

  const seen = new Set<string>();
  const out: Place[] = [];
  for (const d of [...keywordDocs(first), ...keywordDocs(second)]) {
    if (!isObj(d) || !isApartment(str(d.category_name))) continue;
    const id = str(d.id);
    const address = str(d.address_name);
    if (!id || !address || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: str(d.place_name), address, roadAddress: str(d.road_address_name) });
    if (out.length >= 10) break;
  }
  return out;
}

/** 지번 주소 → 시군구 코드 5자리 (법정동코드 10자리의 앞 5자리). 못 찾으면 null. */
export async function lookupSggCd(address: string, deps: KakaoDeps): Promise<string | null> {
  const json = await call("search/address.json", { query: address, size: "1" }, deps);
  const docs = isObj(json) && Array.isArray(json.documents) ? json.documents : [];
  const first = docs[0];
  const addr = isObj(first) && isObj(first.address) ? first.address : null;
  const bCode = addr ? str(addr.b_code) : "";
  return /^\d{10}$/.test(bCode) ? bCode.slice(0, 5) : null;
}
