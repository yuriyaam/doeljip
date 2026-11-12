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

export const DEFAULT_META: ListingMeta = { name: "", memo: "", url: "", negoMax: 5000 };

export const NEGO_MAX_OPTIONS = [3000, 5000, 10000] as const;

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
