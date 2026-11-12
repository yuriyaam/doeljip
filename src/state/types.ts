/**
 * 화면 상태 타입. 필드 이름은 엔진 타입(Profile, House, Rates)을 그대로 써요.
 * 금액 단위는 만원이에요.
 */
import type { House, Profile, Rates, SortBy } from "../engine";

export interface ProfileEntry {
  id: string;
  name: string;
  profile: Profile;
}

/** 매물 중 엔진 계산에는 안 쓰고 사람이 보려고 적는 값 */
export interface ListingMeta {
  name: string;
  memo: string;
  /** 매물 링크. 저장만 하고 서버에서 읽어오지 않아요. */
  url: string;
}

/** 저장 목록에 보여줄 판정 요약 */
export interface Verdict {
  okCount: number;
  bestName: string | null;
  bestLimit: number;
  /** 부족 자금. 양수면 모자람 */
  gap: number;
}

export interface SavedListing {
  id: string;
  house: House;
  meta: ListingMeta;
  verdict: Verdict;
  profileId: string | null;
  profileName: string;
  savedAt: number;
}

/** 지금 편집 중인 매물 (저장 전 초안 포함) */
export interface Draft {
  house: House;
  meta: ListingMeta;
  /** 저장된 매물을 열어 편집 중이면 그 id */
  listingId: string | null;
}

export interface AppState {
  profiles: ProfileEntry[];
  activeId: string;
  draft: Draft;
  rates: Rates;
  sortBy: SortBy;
  listings: SavedListing[];
}

/** 브라우저에 저장하는 모양. 형식을 바꾸면 version을 올리고 storage.ts의 migrate에 변환을 추가해요. */
export interface StoredData extends AppState {
  version: number;
}
