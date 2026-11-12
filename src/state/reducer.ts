/**
 * 화면 상태 리듀서. 순수 함수라서 시간·랜덤 값은 액션으로 받아요 (테스트하기 쉽게).
 */
import type { House, LoanId, Profile, SortBy } from "../engine";
import { computeCheck, makeVerdict } from "./derive";
import { defaultDraft } from "./defaults";
import type { AppState, ListingMeta, SavedListing } from "./types";

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "profile/update"; patch: Partial<Profile> }
  | { type: "profile/switch"; id: string }
  | { type: "profile/add"; id: string }
  | { type: "profile/rename"; name: string }
  | { type: "profile/delete" }
  | { type: "house/update"; patch: Partial<House> }
  | { type: "meta/update"; patch: Partial<ListingMeta> }
  | { type: "rate/set"; loan: LoanId; rate: number | null }
  | { type: "sort/set"; sortBy: SortBy }
  | { type: "listing/save"; id: string; now: number }
  | { type: "listing/new" }
  | { type: "listing/open"; id: string }
  | { type: "listing/delete"; id: string };

export function activeEntry(s: AppState) {
  return s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0]!;
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "hydrate":
      return a.state;

    case "profile/update":
      return mapActive(s, (p) => ({ ...p, profile: { ...p.profile, ...a.patch } }));

    case "profile/switch":
      return s.profiles.some((p) => p.id === a.id) ? { ...s, activeId: a.id } : s;

    case "profile/add": {
      const cur = activeEntry(s);
      const copy = { id: a.id, name: `${cur.name} 복사`.slice(0, 20), profile: { ...cur.profile } };
      return { ...s, profiles: [...s.profiles, copy], activeId: copy.id };
    }

    case "profile/rename":
      return mapActive(s, (p) => ({ ...p, name: a.name.trim().slice(0, 20) || "이름 없음" }));

    case "profile/delete": {
      if (s.profiles.length <= 1) return s;
      const profiles = s.profiles.filter((p) => p.id !== s.activeId);
      return { ...s, profiles, activeId: profiles[0]!.id };
    }

    case "house/update":
      return { ...s, draft: { ...s.draft, house: { ...s.draft.house, ...a.patch } } };

    case "meta/update":
      return { ...s, draft: { ...s.draft, meta: { ...s.draft.meta, ...a.patch } } };

    case "rate/set": {
      const rates = { ...s.rates };
      if (a.rate === null) delete rates[a.loan];
      else rates[a.loan] = a.rate;
      return { ...s, rates };
    }

    case "sort/set":
      return { ...s, sortBy: a.sortBy };

    case "listing/save": {
      const cur = activeEntry(s);
      const { house, meta } = s.draft;
      const check = computeCheck(cur.profile, house, s.rates, s.sortBy, meta.negoMax);
      const id = s.draft.listingId ?? a.id;
      const saved: SavedListing = {
        id,
        house: { ...house },
        meta: { ...meta, name: meta.name.trim() || "이름 없는 매물" },
        verdict: makeVerdict(check, house, cur.profile),
        profileId: cur.id,
        profileName: cur.name,
        savedAt: a.now,
      };
      return {
        ...s,
        listings: [...s.listings.filter((l) => l.id !== id), saved],
        draft: { house: saved.house, meta: saved.meta, listingId: id },
      };
    }

    case "listing/new":
      // 새 매물은 입력값만 비워요. 지역·상환 조건은 직전 값을 이어가요.
      return {
        ...s,
        draft: {
          house: { ...defaultDraft().house, ...pick(s.draft.house, ["regionId", "years", "method"]), price: 0 },
          meta: { name: "", memo: "", url: "", negoMax: s.draft.meta.negoMax },
          listingId: null,
        },
      };

    case "listing/open": {
      const l = s.listings.find((x) => x.id === a.id);
      if (!l) return s;
      const keep = l.profileId && s.profiles.some((p) => p.id === l.profileId);
      return {
        ...s,
        activeId: keep ? l.profileId! : s.activeId,
        draft: { house: { ...l.house }, meta: { ...l.meta }, listingId: l.id },
      };
    }

    case "listing/delete":
      return {
        ...s,
        listings: s.listings.filter((l) => l.id !== a.id),
        draft: s.draft.listingId === a.id ? { ...s.draft, listingId: null } : s.draft,
      };
  }
}

function mapActive(s: AppState, f: (p: AppState["profiles"][number]) => AppState["profiles"][number]): AppState {
  return { ...s, profiles: s.profiles.map((p) => (p.id === s.activeId ? f(p) : p)) };
}

function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = o[k];
  return out;
}
