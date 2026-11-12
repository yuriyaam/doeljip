/**
 * 화면에서 쓰는 계산 묶음. 엔진 함수(evaluate, rankLoans, simulateNego)를 한 번에 부르고
 * 결과를 화면 구조(추천 → 비교표 → 안 되는 대출)에 맞게 나눠요.
 */
import {
  evaluate, rankLoans, simulateNego,
  type Evaluation, type House, type LoanResult, type NegoOption, type Profile, type Rates, type SortBy,
} from "../engine";
import type { ProfileEntry, Verdict } from "./types";

export interface CheckResult {
  evaluation: Evaluation;
  /** 가능한 대출, 추천 순 (부족 자금 없는 것 먼저) */
  ranked: LoanResult[];
  /** 추천 1순위. 가능한 대출이 없으면 null */
  best: LoanResult | null;
  /** 네고하면 달라지는 대출 (필요한 네고 금액이 적은 순) */
  nego: NegoOption[];
  /** 지금도 안 되고 네고해도 안 되는 대출 */
  noGo: LoanResult[];
}

export function computeCheck(
  profile: Profile, house: House, rates: Rates, sortBy: SortBy, negoMax: number,
): CheckResult {
  const evaluation = evaluate(profile, house, rates);
  const ranked = rankLoans(evaluation.results, sortBy);
  const nego = simulateNego(profile, house, rates, { max: negoMax });
  const unlocked = new Set(nego.filter((n) => n.kind === "unlock").map((n) => n.id));
  const noGo = evaluation.results.filter((r) => !r.ok && !unlocked.has(r.id));
  return { evaluation, ranked, best: ranked[0] ?? null, nego, noGo };
}

/** 저장 목록에 남길 요약 */
export function makeVerdict(check: CheckResult, house: House, profile: Profile): Verdict {
  const { best, ranked } = check;
  return {
    okCount: ranked.length,
    bestName: best ? best.name : null,
    bestLimit: best ? best.limit : 0,
    gap: best ? best.gap : house.price - profile.cash,
  };
}

export interface ProfileComparison {
  profile: ProfileEntry;
  results: LoanResult[];
}

/** 같은 매물을 프로필별로 판정 (조건별 비교용) */
export function compareProfiles(profiles: ProfileEntry[], house: House, rates: Rates): ProfileComparison[] {
  return profiles.map((p) => ({ profile: p, results: evaluate(p.profile, house, rates).results }));
}
