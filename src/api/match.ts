/**
 * 카카오가 찾은 단지를 국토부 거래 데이터에서 찾아내고, 평형(전용면적)별로 묶어요.
 * 단지 이름은 서로 달라서(카카오 "경희궁자이4단지아파트" ↔ 국토부 "경희궁자이(4단지)") 이름으로는 못 맞춰요.
 * 도로명+건물번호가 가장 정확하고, 없으면 법정동+지번으로 맞춰요.
 */
import type { Trade } from "./molit";

export interface RoadAddr { road: string; main: number; sub: number }
export interface LotAddr { umd: string; main: number; sub: number }

const NUMBER = /^(\d+)(?:-(\d+))?$/;

/** "서울 종로구 송월길 155" → { road: "송월길", main: 155, sub: 0 } */
export function parseRoadAddress(addr: string): RoadAddr | null {
  const tokens = addr.trim().split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";
  const road = tokens[tokens.length - 2] ?? "";
  const m = NUMBER.exec(last);
  if (!m || !/(로|길)$/.test(road)) return null;
  return { road, main: Number(m[1]), sub: m[2] ? Number(m[2]) : 0 };
}

/** "서울 종로구 교북동 126-3" → { umd: "교북동", main: 126, sub: 3 }. 산 번지는 null. */
export function parseLotAddress(addr: string): LotAddr | null {
  const tokens = addr.trim().split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";
  const umd = tokens[tokens.length - 2] ?? "";
  const m = NUMBER.exec(last);
  if (!m || !umd || umd === "산" || NUMBER.test(umd)) return null;
  return { umd, main: Number(m[1]), sub: m[2] ? Number(m[2]) : 0 };
}

export interface MatchResult {
  trades: Trade[];
  by: "road" | "lot" | null;
}

/** 도로명 → 지번 순서로 맞춰봐요. 도로명으로 하나라도 맞으면 지번은 보지 않아요. */
export function matchTrades(trades: Trade[], addr: { roadAddress: string; address: string }): MatchResult {
  const road = addr.roadAddress ? parseRoadAddress(addr.roadAddress) : null;
  if (road) {
    const hit = trades.filter((t) => t.roadNm === road.road && t.roadMain === road.main && t.roadSub === road.sub);
    if (hit.length) return { trades: hit, by: "road" };
  }
  const lot = parseLotAddress(addr.address);
  if (lot) {
    const hit = trades.filter((t) => t.umdNm === lot.umd && t.lotMain === lot.main && t.lotSub === lot.sub);
    if (hit.length) return { trades: hit, by: "lot" };
  }
  return { trades: [], by: null };
}

/* ---------------- 평형별로 묶기 ---------------- */

export interface TradeView {
  date: string;
  /** 만원 */
  price: number;
  floor: number;
  direct: boolean;
}

export interface AreaGroup {
  /** 정수로 반올림한 전용면적 (84.97 → 85) */
  key: number;
  label: string;
  /** 가장 최근 거래의 정확한 전용면적. 판정(85㎡ 기준 등)에는 이 값을 써요. */
  area: number;
  count: number;
  /** 최근 거래 (최신순, 최대 5건) */
  recent: TradeView[];
}

export interface ComplexSummary {
  aptSeq: string;
  aptNm: string;
  umdNm: string;
  buildYear: number;
  roadNm: string;
  tradeCount: number;
  areas: AreaGroup[];
}

const byDateDesc = (a: Trade, b: Trade) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/** aptSeq(단지)별로 나누고, 각 단지를 전용면적별로 묶어요. 거래가 많은 단지가 먼저 와요. */
export function groupComplexes(trades: Trade[]): ComplexSummary[] {
  const bySeq = new Map<string, Trade[]>();
  for (const t of trades) {
    const list = bySeq.get(t.aptSeq);
    if (list) list.push(t);
    else bySeq.set(t.aptSeq, [t]);
  }

  const complexes: ComplexSummary[] = [];
  for (const [aptSeq, list] of bySeq) {
    const sorted = list.slice().sort(byDateDesc);
    const latest = sorted[0]!;

    const byKey = new Map<number, Trade[]>();
    for (const t of sorted) {
      const k = Math.round(t.area);
      const g = byKey.get(k);
      if (g) g.push(t);
      else byKey.set(k, [t]);
    }
    const areas: AreaGroup[] = [...byKey]
      .map(([key, g]) => ({
        key,
        label: `${key}㎡`,
        area: g[0]!.area, // 정렬돼 있어서 첫 거래가 가장 최근
        count: g.length,
        recent: g.slice(0, 5).map((t) => ({ date: t.date, price: t.price, floor: t.floor, direct: t.direct })),
      }))
      .sort((a, b) => a.key - b.key);

    complexes.push({
      aptSeq,
      aptNm: latest.aptNm,
      umdNm: latest.umdNm,
      buildYear: latest.buildYear,
      roadNm: latest.roadNm,
      tradeCount: list.length,
      areas,
    });
  }
  return complexes.sort((a, b) => b.tradeCount - a.tradeCount);
}
