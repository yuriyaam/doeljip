"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { House, LoanId, Profile, SortBy } from "../src/engine";
import { computeCheck, compareProfiles, type CheckResult, type ProfileComparison } from "../src/state/derive";
import { initialState } from "../src/state/defaults";
import { activeEntry, reducer } from "../src/state/reducer";
import { loadStored, saveStored } from "../src/state/storage";
import type { ListingMeta, ProfileEntry } from "../src/state/types";

/**
 * loading: 아직 브라우저 저장소를 읽기 전 (서버 렌더링과 첫 렌더가 이 상태, 기본값을 보여줘요)
 * ready: 읽기 끝, 변경하면 자동 저장
 * unavailable: 저장소를 못 써서 이 화면에서만 유지
 */
export type StorageStatus = "loading" | "ready" | "unavailable";

const SAVE_DELAY_MS = 400;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useDoeljip() {
  // 첫 렌더는 항상 기본 상태 → 서버 HTML과 같아서 하이드레이션 불일치가 없어요.
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [status, setStatus] = useState<StorageStatus>("loading");

  // 마운트 후에 한 번만 저장소를 읽어요.
  useEffect(() => {
    const r = loadStored();
    if (r.ok) dispatch({ type: "hydrate", state: r.data });
    setStatus(!r.ok && r.reason === "unavailable" ? "unavailable" : "ready");
  }, []);

  // 읽기가 끝난 뒤의 변경만 저장해요 (읽기 전에 저장하면 기존 데이터를 덮어써요).
  useEffect(() => {
    if (status === "loading") return;
    const t = setTimeout(() => setStatus(saveStored(state) ? "ready" : "unavailable"), SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [state, status]);

  const active: ProfileEntry = activeEntry(state);
  const { house, meta } = state.draft;

  const check: CheckResult = useMemo(
    () => computeCheck(active.profile, house, state.rates, state.sortBy, meta.negoMax),
    [active.profile, house, state.rates, state.sortBy, meta.negoMax],
  );

  const comparison: ProfileComparison[] = useMemo(
    () => (state.profiles.length > 1 ? compareProfiles(state.profiles, house, state.rates) : []),
    [state.profiles, house, state.rates],
  );

  const actions = useMemo(
    () => ({
      updateProfile: (patch: Partial<Profile>) => dispatch({ type: "profile/update", patch }),
      switchProfile: (id: string) => dispatch({ type: "profile/switch", id }),
      addProfile: () => dispatch({ type: "profile/add", id: newId("pf") }),
      renameProfile: (name: string) => dispatch({ type: "profile/rename", name }),
      deleteProfile: () => dispatch({ type: "profile/delete" }),
      updateHouse: (patch: Partial<House>) => dispatch({ type: "house/update", patch }),
      updateMeta: (patch: Partial<ListingMeta>) => dispatch({ type: "meta/update", patch }),
      setRate: (loan: LoanId, rate: number | null) => dispatch({ type: "rate/set", loan, rate }),
      setSort: (sortBy: SortBy) => dispatch({ type: "sort/set", sortBy }),
      saveListing: () => dispatch({ type: "listing/save", id: newId("listing"), now: Date.now() }),
      newListing: () => dispatch({ type: "listing/new" }),
      openListing: (id: string) => dispatch({ type: "listing/open", id }),
      deleteListing: (id: string) => dispatch({ type: "listing/delete", id }),
    }),
    [],
  );

  return { state, active, house, meta, check, comparison, status, actions };
}
