"use client";

import { useEffect, useState } from "react";
import type { Place } from "../src/api/kakao";
import type { TradesResult } from "../src/api/service";
import { FETCH_FAILED_MESSAGE } from "../src/state/present";

export type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; places: Place[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export type FoundTrades = Extract<TradesResult, { found: true }>;

export type TradesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "no-region" }
  | { kind: "error"; message: string }
  | { kind: "ready"; result: FoundTrades };

const SEARCH_DELAY_MS = 400;
export const MIN_QUERY = 2;
export const DEFAULT_MONTHS = 6;
export const MAX_MONTHS = 24;

/** 서버가 준 메시지가 있으면 그대로, 없으면 기본 문구 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") return body.message;
  } catch {
    /* 본문이 JSON이 아님 */
  }
  return FETCH_FAILED_MESSAGE;
}

/**
 * 단지 검색(카카오) → 단지 선택 → 최근 거래(국토부) 상태 관리.
 * - 입력이 멈춘 뒤 0.4초 후에 검색하고, 새 입력이 오면 이전 요청은 취소해요.
 * - 어떤 단계가 실패해도 화면의 직접 입력은 그대로 쓸 수 있어요 (이 훅은 입력값을 건드리지 않아요).
 */
export function useComplexSearch(query: string, typing: boolean) {
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [place, setPlace] = useState<Place | null>(null);
  const [months, setMonths] = useState(DEFAULT_MONTHS);
  const [includeDirect, setIncludeDirect] = useState(false);
  const [trades, setTrades] = useState<TradesState>({ kind: "idle" });

  useEffect(() => {
    const q = query.trim();
    // 사용자가 이 칸에 직접 입력했을 때만 검색해요. 저장된 값을 불러오거나 자동으로 채운 이름으로는 검색하지 않아요.
    if (!typing || place || q.length < MIN_QUERY) {
      setSearch({ kind: "idle" });
      return;
    }
    setSearch({ kind: "loading" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/complexes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return setSearch({ kind: "error", message: await errorMessage(res) });
        const body = (await res.json()) as { complexes?: Place[] };
        const places = body.complexes ?? [];
        setSearch(places.length ? { kind: "results", places } : { kind: "empty" });
      } catch {
        if (!ctrl.signal.aborted) setSearch({ kind: "error", message: FETCH_FAILED_MESSAGE });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, place, typing]);

  useEffect(() => {
    if (!place) {
      setTrades({ kind: "idle" });
      return;
    }
    setTrades({ kind: "loading" });
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ address: place.address, roadAddress: place.roadAddress, months: String(months) });
    if (includeDirect) qs.set("includeDirect", "1");
    (async () => {
      try {
        const res = await fetch(`/api/complexes/trades?${qs}`, { signal: ctrl.signal });
        if (!res.ok) return setTrades({ kind: "error", message: await errorMessage(res) });
        const body = (await res.json()) as TradesResult;
        setTrades(body.found ? { kind: "ready", result: body } : { kind: "no-region" });
      } catch {
        if (!ctrl.signal.aborted) setTrades({ kind: "error", message: FETCH_FAILED_MESSAGE });
      }
    })();
    return () => ctrl.abort();
  }, [place, months, includeDirect]);

  return {
    search,
    place,
    selectPlace: (p: Place) => {
      setMonths(DEFAULT_MONTHS);
      setPlace(p);
    },
    clearPlace: () => setPlace(null),
    months,
    setMonths,
    includeDirect,
    setIncludeDirect,
    trades,
  };
}
