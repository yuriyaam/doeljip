/**
 * 브라우저 저장 (localStorage).
 * - 저장 데이터에는 version을 넣어요. 형식을 바꾸면 STORAGE_VERSION을 올리고 migrate()에 변환을 추가해요.
 * - 읽을 때 모든 필드를 검사해서, 빠지거나 이상한 값은 기본값으로 채워요 (손으로 고친 데이터, 옛 데이터 대비).
 * - 읽지 못한 데이터(깨짐, 더 새로운 버전)는 지우지 않고 백업 키에 남겨요.
 * - 서버 렌더링에서는 localStorage가 없으니, 호출하는 쪽에서 마운트 후에만 불러와요.
 */
import type { House, LoanId, Marital, Profile, Rates, SortBy } from "../engine";
import { RULES } from "../rules";
import { DEFAULT_HOUSE, DEFAULT_META, DEFAULT_PROFILE, defaultDraft, initialState } from "./defaults";
import type { AppState, Draft, ListingMeta, ProfileEntry, SavedListing, Verdict } from "./types";

export const STORAGE_KEY = "doeljip";
export const BACKUP_KEY = "doeljip.backup";
export const STORAGE_VERSION = 1;

export type LoadResult =
  | { ok: true; data: AppState }
  | { ok: false; reason: "empty" | "corrupt" | "newer" | "unavailable" };

/* ---------------- 저장소 접근 ---------------- */

/** 비공개 창·차단 설정이면 접근만 해도 예외가 나서, 항상 감싸요. */
export function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function serialize(state: AppState): string {
  return JSON.stringify({ version: STORAGE_VERSION, ...state });
}

export function saveStored(state: AppState, storage: Storage | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, serialize(state));
    return true;
  } catch {
    return false; // 용량 초과 등
  }
}

export function loadStored(storage: Storage | null = getStorage()): LoadResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const result = parseStored(raw);
  if (!result.ok && (result.reason === "corrupt" || result.reason === "newer") && raw !== null) {
    try {
      if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* 백업 실패는 무시 */
    }
  }
  return result;
}

/* ---------------- 읽기·변환 ---------------- */

export function parseStored(raw: string | null): LoadResult {
  if (raw === null) return { ok: false, reason: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (!isObj(json) || typeof json.version !== "number" || !Number.isInteger(json.version) || json.version < 1) {
    return { ok: false, reason: "corrupt" };
  }
  if (json.version > STORAGE_VERSION) return { ok: false, reason: "newer" };
  return { ok: true, data: sanitizeState(migrate(json, json.version)) };
}

/** 옛 버전 데이터를 현재 형식으로 올려요. 지금은 v1뿐이라 그대로 돌려줘요. */
function migrate(json: Record<string, unknown>, from: number): Record<string, unknown> {
  void from;
  // 예) if (from < 2) return migrate({ ...json, listings: upgradeV1ToV2(json.listings), version: 2 }, 2);
  return json;
}

/* ---------------- 값 검사 ---------------- */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, def: number, min = 0): number =>
  typeof x === "number" && Number.isFinite(x) && x >= min ? x : def;
const bool = (x: unknown, def: boolean): boolean => (typeof x === "boolean" ? x : def);
const str = (x: unknown, def: string, max = 200): string => (typeof x === "string" ? x.slice(0, max) : def);
const oneOf = <T extends string | number>(x: unknown, list: readonly T[], def: T): T =>
  list.includes(x as T) ? (x as T) : def;

const MARITAL: readonly Marital[] = ["single", "engaged", "newly", "married"];
const LOAN_IDS: readonly LoanId[] = ["general", "didimdol", "newborn", "bogeum"];
const SORTS: readonly SortBy[] = ["monthly", "limit"];

export function sanitizeProfile(x: unknown): Profile {
  const o = isObj(x) ? x : {};
  const d = DEFAULT_PROFILE;
  return {
    inc1: num(o.inc1, d.inc1),
    inc2: num(o.inc2, d.inc2),
    marital: oneOf(o.marital, MARITAL, d.marital),
    kids: Math.floor(num(o.kids, d.kids)),
    homes: oneOf(o.homes, [0, 1, 2] as const, d.homes),
    cash: num(o.cash, d.cash),
    netAsset: num(o.netAsset, d.netAsset),
    firstHome: bool(o.firstHome, d.firstHome),
    householder: bool(o.householder, d.householder),
    newborn: bool(o.newborn, d.newborn),
    existingAnnualPayment: num(o.existingAnnualPayment, d.existingAnnualPayment),
    existingAnnualInterest: num(o.existingAnnualInterest, d.existingAnnualInterest),
  };
}

export function sanitizeHouse(x: unknown): House {
  const o = isObj(x) ? x : {};
  const d = DEFAULT_HOUSE;
  const regionIds = RULES.regions.map((r) => r.id);
  return {
    regionId: oneOf(o.regionId, regionIds, d.regionId),
    price: num(o.price, d.price),
    kb: num(o.kb, 0),
    area: num(o.area, d.area),
    eupmyeon: bool(o.eupmyeon, false),
    years: num(o.years, d.years, 1),
    method: oneOf(o.method, ["annuity", "principal"] as const, d.method),
  };
}

export function sanitizeMeta(x: unknown): ListingMeta {
  const o = isObj(x) ? x : {};
  return {
    name: str(o.name, DEFAULT_META.name, 60),
    memo: str(o.memo, DEFAULT_META.memo, 200),
    url: str(o.url, DEFAULT_META.url, 500),
  };
}

function sanitizeRates(x: unknown): Rates {
  const o = isObj(x) ? x : {};
  const out: Rates = {};
  for (const id of LOAN_IDS) {
    const v = o[id];
    if (v === null) out[id] = null;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 20) out[id] = v;
  }
  return out;
}

function sanitizeVerdict(x: unknown): Verdict {
  const o = isObj(x) ? x : {};
  return {
    okCount: Math.floor(num(o.okCount, 0)),
    bestName: typeof o.bestName === "string" ? o.bestName : null,
    bestLimit: num(o.bestLimit, 0),
    gap: num(o.gap, 0, -Infinity),
  };
}

function sanitizeListing(x: unknown): SavedListing | null {
  if (!isObj(x) || typeof x.id !== "string" || !x.id) return null;
  return {
    id: x.id,
    house: sanitizeHouse(x.house),
    meta: sanitizeMeta(x.meta),
    verdict: sanitizeVerdict(x.verdict),
    profileId: typeof x.profileId === "string" ? x.profileId : null,
    profileName: str(x.profileName, "", 20),
    savedAt: num(x.savedAt, 0),
  };
}

function sanitizeProfiles(x: unknown): ProfileEntry[] {
  const seen = new Set<string>();
  const out: ProfileEntry[] = [];
  if (Array.isArray(x)) {
    for (const p of x) {
      if (!isObj(p) || typeof p.id !== "string" || !p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, name: str(p.name, "이름 없음", 20) || "이름 없음", profile: sanitizeProfile(p.profile) });
    }
  }
  return out;
}

function sanitizeDraft(x: unknown, listingIds: Set<string>): Draft {
  if (!isObj(x)) return defaultDraft();
  return {
    house: sanitizeHouse(x.house),
    meta: sanitizeMeta(x.meta),
    listingId: typeof x.listingId === "string" && listingIds.has(x.listingId) ? x.listingId : null,
  };
}

export function sanitizeState(o: Obj): AppState {
  const base = initialState();
  const profiles = sanitizeProfiles(o.profiles);
  const finalProfiles = profiles.length ? profiles : base.profiles;
  const listings = (Array.isArray(o.listings) ? o.listings : [])
    .map(sanitizeListing)
    .filter((l): l is SavedListing => l !== null);
  return {
    profiles: finalProfiles,
    activeId: finalProfiles.some((p) => p.id === o.activeId) ? (o.activeId as string) : finalProfiles[0]!.id,
    draft: sanitizeDraft(o.draft, new Set(listings.map((l) => l.id))),
    rates: sanitizeRates(o.rates),
    sortBy: oneOf(o.sortBy, SORTS, base.sortBy),
    listings,
  };
}
