/**
 * 단지 검색 / 최근 거래 조회. 서버 라우트가 이 함수들을 불러요.
 * 외부 호출(fetch), 현재 시각, 캐시를 밖에서 받아서 테스트하기 쉬워요.
 */
import { TtlCache } from "./cache";
import { lookupSggCd, searchApartments, type Place } from "./kakao";
import { groupComplexes, matchTrades, type ComplexSummary } from "./match";
import { fetchMonth, recentMonths, type Trade } from "./molit";
import { regionIdForSgg } from "./regions";

export interface Deps {
  fetch: typeof fetch;
  now: () => Date;
  molitKey: string;
  kakaoKey: string;
  /** 국토부 월별 거래 캐시 (카카오 결과는 캐시하지 않아요) */
  cache: TtlCache<Trade[]>;
}

const CURRENT_MONTH_TTL = 30 * 60 * 1000;
const PAST_MONTH_TTL = 6 * 60 * 60 * 1000;
const BATCH = 6;

export const DEFAULT_MONTHS = 6;
export const MAX_MONTHS = 24;

export function searchComplexes(query: string, deps: Deps): Promise<Place[]> {
  return searchApartments(query, { fetch: deps.fetch, key: deps.kakaoKey });
}

export interface TradesParams {
  /** 카카오가 준 지번 주소 */
  address: string;
  /** 카카오가 준 도로명 주소 ("" 가능) */
  roadAddress: string;
  months: number;
  includeDirect: boolean;
}

export type TradesResult =
  | { found: false; reason: "no-region"; sggCd: null }
  | {
      found: true;
      sggCd: string;
      /** RULES.regions의 id. 판정의 지역 선택에 그대로 써요. */
      regionId: string;
      monthsSearched: number;
      /** 해제·직거래로 걸러낸 건수 (매칭된 단지 기준) */
      excluded: { canceled: number; direct: number };
      matchedBy: "road" | "lot" | null;
      complexes: ComplexSummary[];
    };

/** 시군구의 최근 n개월 거래 (해제·직거래 포함, 캐시 사용) */
export async function loadTrades(sgg: string, months: string[], deps: Deps): Promise<Trade[]> {
  const nowYmd = recentMonths(deps.now(), 1)[0];
  const all: Trade[] = [];
  for (let i = 0; i < months.length; i += BATCH) {
    const batch = months.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((ymd) =>
        deps.cache.getOrLoad(`${sgg}:${ymd}`, ymd === nowYmd ? CURRENT_MONTH_TTL : PAST_MONTH_TTL, () =>
          fetchMonth(sgg, ymd, { fetch: deps.fetch, key: deps.molitKey }),
        ),
      ),
    );
    for (const r of results) all.push(...r);
  }
  return all;
}

export async function complexTrades(p: TradesParams, deps: Deps): Promise<TradesResult> {
  const sggCd = await lookupSggCd(p.address, { fetch: deps.fetch, key: deps.kakaoKey });
  if (!sggCd) return { found: false, reason: "no-region", sggCd: null };

  const months = recentMonths(deps.now(), Math.min(Math.max(1, p.months), MAX_MONTHS));
  const all = await loadTrades(sggCd, months, deps);

  // 먼저 단지를 찾고, 그 단지의 거래에서 해제·직거래를 걸러요 (건수는 그 단지 기준으로 세요).
  const matched = matchTrades(all, { roadAddress: p.roadAddress, address: p.address });
  const canceled = matched.trades.filter((t) => t.canceled).length;
  const live = matched.trades.filter((t) => !t.canceled);
  const direct = live.filter((t) => t.direct).length;
  const kept = p.includeDirect ? live : live.filter((t) => !t.direct);

  return {
    found: true,
    sggCd,
    regionId: regionIdForSgg(sggCd),
    monthsSearched: months.length,
    excluded: { canceled, direct: p.includeDirect ? 0 : direct },
    matchedBy: matched.by,
    complexes: groupComplexes(kept),
  };
}
