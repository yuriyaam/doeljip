import type { House, Profile } from "../engine";
import type { AppState, Draft, ListingMeta, ProfileEntry } from "./types";

export const DEFAULT_PROFILE: Profile = {
  inc1: 5000,
  inc2: 4000,
  marital: "newly",
  kids: 0,
  homes: 0,
  cash: 20000,
  netAsset: 25000,
  firstHome: true,
  householder: true,
  newborn: false,
  existingAnnualPayment: 0,
  existingAnnualInterest: 0,
};

/** kb가 0이면 KB시세를 모르는 걸로 보고 매매가로 담보가치를 계산해요 (엔진 규칙). */
export const DEFAULT_HOUSE: House = {
  regionId: "seoul",
  price: 80000,
  kb: 0,
  area: 84.9,
  eupmyeon: false,
  years: 30,
  method: "annuity",
};

export const DEFAULT_META: ListingMeta = { name: "", memo: "", url: "" };

/**
 * 네고 시뮬레이션이 살펴보는 최대 폭 = 매매가의 이 비율 (고객이 고르지 않아요).
 * 이 폭 안에서 불가였던 대출이 가능해지거나 한도가 늘어나면 알려줘요.
 * "현실적인 네고 폭"은 제품 가정이라, 바꾸려면 이 값만 고치세요.
 */
export const NEGO_MAX_RATIO = 0.05;

/** 매매가에 맞는 네고 검토 상한 (만원, 100만원 단위 내림) */
export function negoMaxFor(price: number): number {
  return Math.floor((price * NEGO_MAX_RATIO) / 100) * 100;
}

export function defaultDraft(): Draft {
  return { house: { ...DEFAULT_HOUSE }, meta: { ...DEFAULT_META }, listingId: null };
}

/** 처음 열었을 때 상태. 서버와 브라우저 첫 렌더가 같아야 하니 랜덤·시간 값을 쓰지 않아요. */
export function initialState(): AppState {
  const now: ProfileEntry = { id: "pf_now", name: "지금", profile: { ...DEFAULT_PROFILE } };
  const baby: ProfileEntry = {
    id: "pf_baby",
    name: "출산 후",
    profile: { ...DEFAULT_PROFILE, kids: 1, newborn: true },
  };
  return {
    profiles: [now, baby],
    activeId: now.id,
    draft: defaultDraft(),
    rates: {},
    sortBy: "monthly",
    listings: [],
  };
}
