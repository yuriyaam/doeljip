import { describe, expect, it } from "vitest";
import { computeCheck, makeVerdict } from "./derive";
import { DEFAULT_HOUSE, DEFAULT_PROFILE, initialState } from "./defaults";
import { activeEntry, reducer } from "./reducer";
import {
  BACKUP_KEY, STORAGE_KEY, STORAGE_VERSION, loadStored, parseStored, saveStored, serialize,
} from "./storage";
import type { AppState } from "./types";

/* ---------- 메모리 저장소 (브라우저 localStorage 대신) ---------- */
function fakeStorage(init: Record<string, string> = {}, opts: { failSet?: boolean } = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => {
      if (opts.failSet) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
  };
}

const reduce = (s: AppState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, s);

describe("초기 상태", () => {
  it("호출할 때마다 같다 (서버·브라우저 첫 렌더가 같아야 함)", () => {
    expect(initialState()).toEqual(initialState());
  });

  it("프로필 '지금'과 '출산 후' 두 개, 활성은 '지금'", () => {
    const s = initialState();
    expect(s.profiles.map((p) => p.name)).toEqual(["지금", "출산 후"]);
    expect(activeEntry(s).name).toBe("지금");
    expect(s.profiles[1]!.profile).toMatchObject({ kids: 1, newborn: true });
  });
});

describe("저장 형식", () => {
  it("version이 들어가고, 저장했다가 읽으면 같다", () => {
    const s = reduce(initialState(), { type: "house/update", patch: { price: 71000 } });
    expect(JSON.parse(serialize(s)).version).toBe(STORAGE_VERSION);
    const r = parseStored(serialize(s));
    expect(r).toEqual({ ok: true, data: s });
  });

  it("없음 / 깨짐 / version 없음 / 더 새로운 version을 구분한다", () => {
    expect(parseStored(null)).toEqual({ ok: false, reason: "empty" });
    expect(parseStored("{깨짐")).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStored("[]")).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStored(JSON.stringify({ profiles: [] }))).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStored(JSON.stringify({ version: 0 }))).toEqual({ ok: false, reason: "corrupt" });
    expect(parseStored(JSON.stringify({ version: STORAGE_VERSION + 1 }))).toEqual({ ok: false, reason: "newer" });
  });

  it("이상한 값은 기본값으로 채운다", () => {
    const raw = JSON.stringify({
      version: 1,
      profiles: [
        { id: "a", name: "A", profile: { inc1: -5, inc2: "많음", marital: "???", kids: 2.7, homes: 9, firstHome: "yes" } },
        { id: "a", name: "중복" },
        { name: "id 없음" },
        "문자열",
      ],
      activeId: "없는 id",
      draft: { house: { regionId: "mars", price: "비쌈", years: 0, method: "x" }, listingId: "없는 매물" },
      rates: { general: 4.5, didimdol: null, newborn: -1, bogeum: 99, other: 3 },
      sortBy: "엉뚱",
      listings: [{ id: "" }, null, { id: "L1", house: {}, verdict: { okCount: "x" } }],
    });
    const r = parseStored(raw);
    if (!r.ok) throw new Error("읽혀야 해요");
    const s = r.data;
    expect(s.profiles).toHaveLength(1); // 중복·id 없음·문자열 제거
    expect(s.profiles[0]!.profile).toEqual({ ...DEFAULT_PROFILE, kids: 2 });
    expect(s.activeId).toBe("a");
    expect(s.draft.house).toEqual(DEFAULT_HOUSE);
    expect(s.draft.listingId).toBeNull();
    expect(s.rates).toEqual({ general: 4.5, didimdol: null }); // 음수·20 초과·모르는 키 제거
    expect(s.sortBy).toBe("monthly");
    expect(s.listings.map((l) => l.id)).toEqual(["L1"]);
    expect(s.listings[0]!.verdict.okCount).toBe(0);
  });

  it("프로필이 하나도 없으면 기본 프로필로 채운다", () => {
    const r = parseStored(JSON.stringify({ version: 1, profiles: [] }));
    if (!r.ok) throw new Error("읽혀야 해요");
    expect(r.data.profiles.map((p) => p.name)).toEqual(["지금", "출산 후"]);
  });
});

describe("localStorage 접근", () => {
  it("저장했다가 불러온다", () => {
    const st = fakeStorage();
    const s = reduce(initialState(), { type: "profile/update", patch: { inc1: 6200 } });
    expect(saveStored(s, st)).toBe(true);
    expect(loadStored(st)).toEqual({ ok: true, data: s });
  });

  it("저장소가 없거나 쓰기에 실패하면 false/unavailable", () => {
    expect(saveStored(initialState(), null)).toBe(false);
    expect(loadStored(null)).toEqual({ ok: false, reason: "unavailable" });
    expect(saveStored(initialState(), fakeStorage({}, { failSet: true }))).toBe(false);
  });

  it("깨진 데이터는 지우지 않고 백업에 남긴다", () => {
    const st = fakeStorage({ [STORAGE_KEY]: "{깨짐" });
    expect(loadStored(st)).toEqual({ ok: false, reason: "corrupt" });
    expect(st.getItem(STORAGE_KEY)).toBe("{깨짐");
    expect(st.getItem(BACKUP_KEY)).toBe("{깨짐");
  });

  it("더 새로운 버전 데이터도 백업에 남기고, 기존 백업은 덮어쓰지 않는다", () => {
    const newer = JSON.stringify({ version: STORAGE_VERSION + 1, x: 1 });
    const st = fakeStorage({ [STORAGE_KEY]: newer, [BACKUP_KEY]: "먼저 백업" });
    expect(loadStored(st)).toEqual({ ok: false, reason: "newer" });
    expect(st.getItem(BACKUP_KEY)).toBe("먼저 백업");
  });

  it("비어 있으면 empty이고 백업을 만들지 않는다", () => {
    const st = fakeStorage();
    expect(loadStored(st)).toEqual({ ok: false, reason: "empty" });
    expect(st.getItem(BACKUP_KEY)).toBeNull();
  });
});

describe("리듀서", () => {
  it("프로필 수정은 활성 프로필에만 적용된다", () => {
    const s = reduce(initialState(), { type: "profile/update", patch: { cash: 31000 } });
    expect(s.profiles[0]!.profile.cash).toBe(31000);
    expect(s.profiles[1]!.profile.cash).toBe(DEFAULT_PROFILE.cash);
  });

  it("복사해서 추가하면 값이 같은 새 프로필이 활성이 된다", () => {
    const s = reduce(initialState(), { type: "profile/add", id: "pf_x" });
    expect(s.profiles).toHaveLength(3);
    expect(activeEntry(s)).toMatchObject({ id: "pf_x", name: "지금 복사" });
    expect(activeEntry(s).profile).toEqual(s.profiles[0]!.profile);
    expect(activeEntry(s).profile).not.toBe(s.profiles[0]!.profile);
  });

  it("이름을 비우면 '이름 없음', 마지막 하나는 삭제할 수 없다", () => {
    let s = reduce(initialState(), { type: "profile/rename", name: "  " });
    expect(activeEntry(s).name).toBe("이름 없음");
    s = reduce(s, { type: "profile/delete" });
    expect(s.profiles).toHaveLength(1);
    expect(reduce(s, { type: "profile/delete" }).profiles).toHaveLength(1);
  });

  it("금리를 null로 되돌리면 값이 지워진다 (자동·기본값)", () => {
    let s = reduce(initialState(), { type: "rate/set", loan: "didimdol", rate: 3.3 });
    expect(s.rates).toEqual({ didimdol: 3.3 });
    s = reduce(s, { type: "rate/set", loan: "didimdol", rate: null });
    expect(s.rates).toEqual({});
  });

  it("매물 저장: 판정 요약이 엔진 결과와 같고, 다시 저장해도 중복되지 않는다", () => {
    let s = reduce(
      initialState(),
      { type: "house/update", patch: { regionId: "local", price: 62000 } },
      { type: "meta/update", patch: { name: "  ○○ 84㎡ ", memo: "남향" } },
      { type: "listing/save", id: "L1", now: 1000 },
    );
    expect(s.listings).toHaveLength(1);
    const l = s.listings[0]!;
    const check = computeCheck(activeEntry(s).profile, s.draft.house, s.rates, s.sortBy, s.draft.meta.negoMax);
    expect(l.verdict).toEqual(makeVerdict(check, s.draft.house, activeEntry(s).profile));
    expect(l.verdict.okCount).toBeGreaterThan(0);
    expect(l.meta.name).toBe("○○ 84㎡");
    expect(l).toMatchObject({ profileId: "pf_now", profileName: "지금", savedAt: 1000 });
    expect(s.draft.listingId).toBe("L1");

    s = reduce(s, { type: "house/update", patch: { price: 60000 } }, { type: "listing/save", id: "다른id", now: 2000 });
    expect(s.listings).toHaveLength(1);
    expect(s.listings[0]).toMatchObject({ id: "L1", savedAt: 2000 });
    expect(s.listings[0]!.house.price).toBe(60000);
  });

  it("이름을 안 적고 저장하면 '이름 없는 매물'", () => {
    const s = reduce(initialState(), { type: "listing/save", id: "L1", now: 1 });
    expect(s.listings[0]!.meta.name).toBe("이름 없는 매물");
  });

  it("새 매물은 입력값을 비우고 지역·상환 조건은 이어간다", () => {
    const s = reduce(
      initialState(),
      { type: "house/update", patch: { regionId: "metro", years: 40, price: 55000, kb: 50000 } },
      { type: "meta/update", patch: { name: "A", memo: "m", url: "u", negoMax: 10000 } },
      { type: "listing/save", id: "L1", now: 1 },
      { type: "listing/new" },
    );
    expect(s.draft.listingId).toBeNull();
    expect(s.draft.house).toMatchObject({ regionId: "metro", years: 40, price: 0, kb: 0 });
    expect(s.draft.meta).toEqual({ name: "", memo: "", url: "", negoMax: 10000 });
    expect(s.listings).toHaveLength(1);
  });

  it("저장한 매물을 열면 매물 값과 당시 프로필이 돌아온다. 프로필이 없어졌으면 현재 프로필 유지", () => {
    let s = reduce(
      initialState(),
      { type: "profile/switch", id: "pf_baby" },
      { type: "house/update", patch: { price: 91000 } },
      { type: "listing/save", id: "L1", now: 1 },
      { type: "listing/new" },
      { type: "profile/switch", id: "pf_now" },
      { type: "listing/open", id: "L1" },
    );
    expect(s.activeId).toBe("pf_baby");
    expect(s.draft.house.price).toBe(91000);
    expect(s.draft.listingId).toBe("L1");

    s = reduce(s, { type: "profile/delete" }, { type: "listing/open", id: "L1" });
    expect(s.activeId).toBe("pf_now");
    expect(reduce(s, { type: "listing/open", id: "없음" })).toBe(s);
  });

  it("편집 중인 매물을 삭제하면 새 매물 상태가 된다", () => {
    const s = reduce(
      initialState(),
      { type: "listing/save", id: "L1", now: 1 },
      { type: "listing/delete", id: "L1" },
    );
    expect(s.listings).toHaveLength(0);
    expect(s.draft.listingId).toBeNull();
  });
});

describe("판정 묶음", () => {
  it("README 예시(지방 6.2억, 신혼 9천)는 추천이 있고, 안 되는 대출은 네고로 풀리는 것을 뺀다", () => {
    const check = computeCheck(
      { ...DEFAULT_PROFILE }, { ...DEFAULT_HOUSE, regionId: "local", price: 62000 }, {}, "monthly", 5000,
    );
    expect(check.best).not.toBeNull();
    expect(check.ranked[0]).toBe(check.best);
    const unlocked = new Set(check.nego.filter((n) => n.kind === "unlock").map((n) => n.id));
    for (const r of check.noGo) {
      expect(r.ok).toBe(false);
      expect(unlocked.has(r.id)).toBe(false);
    }
  });

  it("가능한 대출이 없으면 부족 자금은 매매가 − 보유 현금", () => {
    const p = { ...DEFAULT_PROFILE, inc1: 0, inc2: 0, cash: 1000 };
    const h = { ...DEFAULT_HOUSE, price: 50000 };
    const check = computeCheck(p, h, {}, "monthly", 0);
    expect(check.best).toBeNull();
    expect(makeVerdict(check, h, p)).toEqual({ okCount: 0, bestName: null, bestLimit: 0, gap: 49000 });
  });
});
