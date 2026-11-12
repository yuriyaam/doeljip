/**
 * 국토교통부 아파트 매매 실거래가 상세 자료 (data.go.kr 15126468).
 * - 시군구 코드(LAWD_CD 5자리) + 계약월(DEAL_YMD)로만 조회돼요. 단지명 검색은 안 돼요.
 * - 금액은 만원 단위, 면적은 전용면적 ㎡예요.
 * 응답 모양은 실제 호출로 확인했어요 (src/api/molit.test.ts 픽스처 참고).
 */
import { UpstreamError } from "./errors";

const BASE = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export interface Trade {
  /** 단지 고유 id (예: 11110-2464). 단지명은 겹칠 수 있어서 이걸로 구분해요. */
  aptSeq: string;
  aptNm: string;
  sggCd: string;
  umdNm: string;
  /** 도로명 (예: 송월길)과 건물 본번·부번 */
  roadNm: string;
  roadMain: number;
  roadSub: number;
  /** 지번 본번·부번 */
  lotMain: number;
  lotSub: number;
  /** 전용면적 ㎡ */
  area: number;
  /** 거래금액 (만원) */
  price: number;
  floor: number;
  buildYear: number;
  /** 계약일 YYYY-MM-DD */
  date: string;
  direct: boolean;
  /** 계약이 해제(취소)된 거래 */
  canceled: boolean;
}

type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);

/** "120,000" 같은 쉼표 문자열이나 숫자를 숫자로. 못 읽으면 NaN. */
export function parseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.replace(/,/g, "").trim();
    return t === "" ? NaN : Number(t);
  }
  return NaN;
}

const intOr0 = (v: unknown): number => {
  const n = parseNumber(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** 응답에서 거래 목록 꺼내기. 결과가 0건이면 items가 ""로, 1건이면 배열이 아닌 객체로 와요. */
export function normalizeItems(json: unknown): Raw[] {
  if (!isObj(json)) return [];
  const response = json.response;
  const body = isObj(response) ? response.body : undefined;
  const items = isObj(body) ? body.items : undefined;
  if (!isObj(items)) return []; // "" 또는 없음
  const item = items.item;
  if (Array.isArray(item)) return item.filter(isObj);
  return isObj(item) ? [item] : [];
}

/** 필수 값이 없거나 이상하면 null (그 거래는 건너뛰어요). */
export function toTrade(raw: Raw): Trade | null {
  const price = parseNumber(raw.dealAmount);
  const area = parseNumber(raw.excluUseAr);
  const y = parseNumber(raw.dealYear);
  const m = parseNumber(raw.dealMonth);
  const d = parseNumber(raw.dealDay);
  const aptSeq = text(raw.aptSeq);
  const aptNm = text(raw.aptNm);
  if (!aptSeq || !aptNm) return null;
  if (![price, area, y, m, d].every(Number.isFinite) || price <= 0 || area <= 0) return null;
  const pad = (n: number) => String(Math.trunc(n)).padStart(2, "0");
  return {
    aptSeq,
    aptNm,
    sggCd: text(raw.sggCd),
    umdNm: text(raw.umdNm),
    roadNm: text(raw.roadNm),
    roadMain: intOr0(raw.roadNmBonbun),
    roadSub: intOr0(raw.roadNmBubun),
    lotMain: intOr0(raw.bonbun),
    lotSub: intOr0(raw.bubun),
    area,
    price,
    floor: intOr0(raw.floor),
    buildYear: intOr0(raw.buildYear),
    date: `${Math.trunc(y)}-${pad(m)}-${pad(d)}`,
    direct: text(raw.dealingGbn) === "직거래",
    canceled: text(raw.cdealType) !== "",
  };
}

/** 최근 n개월의 계약월(YYYYMM), 이번 달부터. 한국 시간 기준이에요. */
export function recentMonths(now: Date, n: number): string[] {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  let y = kst.getUTCFullYear();
  let m = kst.getUTCMonth() + 1;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export interface MolitDeps {
  fetch: typeof fetch;
  key: string;
}

/** 이미 인코딩된 키(%가 있음)든 디코딩된 키든 한 번만 인코딩해서 보내요. */
export function encodeKey(key: string): string {
  return encodeURIComponent(key.includes("%") ? decodeURIComponent(key) : key);
}

function classify(code: string, msg: string): UpstreamError {
  if (code === "22" || code === "23") return new UpstreamError("rate-limit", `국토부 호출 한도 초과 (${code})`, "molit");
  if (["20", "30", "31"].includes(code)) return new UpstreamError("auth", `국토부 인증키 문제 (${code} ${msg})`, "molit");
  return new UpstreamError("upstream", `국토부 오류 (${code} ${msg})`, "molit");
}

/** 한 시군구·한 달의 거래 전체 (페이지를 넘기며 모두 가져와요). 해제·직거래도 그대로 포함해요. */
export async function fetchMonth(sgg: string, ymd: string, deps: MolitDeps): Promise<Trade[]> {
  const trades: Trade[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${BASE}?serviceKey=${encodeKey(deps.key)}&LAWD_CD=${encodeURIComponent(sgg)}` +
      `&DEAL_YMD=${encodeURIComponent(ymd)}&pageNo=${page}&numOfRows=${PAGE_SIZE}&_type=json`;
    let res: Response;
    try {
      res = await deps.fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      throw new UpstreamError("upstream", "국토부 서버에 연결하지 못했어요", "molit");
    }
    const body = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      // 오류는 JSON이 아닌 XML로 올 수 있어요 (예: SERVICE_KEY_IS_NOT_REGISTERED_ERROR)
      if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/.test(body)) throw classify("22", "limit");
      if (/SERVICE_KEY|SERVICE_ACCESS_DENIED/.test(body)) throw classify("30", "key");
      throw new UpstreamError("bad-response", `국토부 응답을 읽지 못했어요 (HTTP ${res.status})`, "molit");
    }
    const header = isObj(json) && isObj(json.response) && isObj(json.response.header) ? json.response.header : {};
    const code = text(header.resultCode);
    if (code !== "000") throw classify(code || "?", text(header.resultMsg));

    for (const raw of normalizeItems(json)) {
      const t = toTrade(raw);
      if (t) trades.push(t);
    }
    const bodyObj = isObj(json) && isObj(json.response) && isObj(json.response.body) ? json.response.body : {};
    const total = parseNumber(bodyObj.totalCount);
    if (!Number.isFinite(total) || page * PAGE_SIZE >= total) break;
  }
  return trades;
}
