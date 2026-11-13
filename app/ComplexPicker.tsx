"use client";

import { useEffect, useRef, useState } from "react";
import { formatManwon as fmt } from "../src/engine";
import type { AreaGroup, ComplexSummary } from "../src/api/match";
import type { Place } from "../src/api/kakao";
import { RULES } from "../src/rules";
import {
  FETCH_FAILED_MESSAGE, NO_APARTMENT_MESSAGE, NO_REGION_MESSAGE, autoListingName, excludedNote, shouldReplaceName, tradeLine,
} from "../src/state/present";
import { Button } from "./components/Button";
import { CheckField, TextField } from "./components/Field";
import styles from "./ComplexPicker.module.css";
import { MAX_MONTHS, MIN_QUERY, useComplexSearch, type FoundTrades } from "./useComplexSearch";
import type { DoeljipActions } from "./useDoeljip";

interface Props {
  actions: DoeljipActions;
  /** 매물 이름. 이 칸 하나가 "단지 검색"과 "매물 이름"을 겸해요. */
  name: string;
}

const regionName = (id: string) => RULES.regions.find((r) => r.id === id)?.name ?? "";

/**
 * 단지명 한 칸: 이름을 입력하면 아래에 아파트 후보가 나오고, 고르면 지역·평형이 채워져요.
 * 후보를 고르지 않고 이름만 적어도 돼요 (별칭이나 오피스텔·빌라 이름).
 * 매매가는 자동으로 채우지 않고, 최근 거래가는 참고용으로만 보여줘요.
 * 아무것도 못 찾거나 실패해도 아래 직접 입력은 그대로 쓸 수 있어요.
 */
export function ComplexPicker({ actions, name }: Props) {
  // 직접 입력 중일 때만 검색해요 (불러온 값·자동 입력으로는 검색하지 않음)
  const [typing, setTyping] = useState(false);
  const s = useComplexSearch(name, typing);
  const [seq, setSeq] = useState<string | null>(null);
  const [areaKey, setAreaKey] = useState<number | null>(null);
  /** 마지막으로 "자동으로" 들어간 이름(또는 검색할 때 입력한 글자). 이 이름일 때만 새 자동 이름으로 바꿔요. */
  const lastAutoName = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const result = s.trades.kind === "ready" ? s.trades.result : null;

  // 단지가 바뀌면 선택 초기화. 후보가 하나뿐이면 바로 고른 걸로 봐요.
  const only = result && result.complexes.length === 1 ? result.complexes[0]! : null;
  useEffect(() => {
    setSeq(only ? only.aptSeq : null);
    setAreaKey(null);
  }, [s.place?.id, only?.aptSeq]);

  // 단지를 찾으면 지역은 거래가 없어도 바로 설정해요 (대출 규제가 지역에 따라 달라서).
  const regionId = result?.regionId;
  useEffect(() => {
    if (regionId) actions.updateHouse({ regionId });
  }, [regionId, actions]);

  const complex: ComplexSummary | undefined = result?.complexes.find((c) => c.aptSeq === seq);
  const area = complex?.areas.find((a) => a.key === areaKey);

  const selectPlace = (p: Place) => {
    // 검색하려고 입력한 글자는 직접 지은 이름이 아니라서, 평형을 고를 때 자동 이름으로 바꿀 수 있게 기억해요.
    lastAutoName.current = name;
    setTyping(false);
    s.selectPlace(p);
  };

  const pickArea = (c: ComplexSummary, g: AreaGroup) => {
    setAreaKey(g.key);
    actions.updateHouse({ area: g.area });
    const next = autoListingName(c.aptNm, g.key);
    if (shouldReplaceName(name, lastAutoName.current)) {
      actions.updateMeta({ name: next });
      lastAutoName.current = next;
    }
  };

  const searchAgain = () => {
    s.clearPlace();
    // 자동으로 들어간 이름이면 비워서 바로 새로 입력할 수 있게 해요. 직접 쓴 이름은 그대로 둬요.
    if (shouldReplaceName(name, lastAutoName.current)) actions.updateMeta({ name: "" });
    lastAutoName.current = null;
    setTyping(false);
    wrapRef.current?.querySelector("input")?.focus();
  };

  const trimmedLength = name.trim().length;

  return (
    <div ref={wrapRef} className={styles.picker}>
      <TextField
        label="단지명"
        placeholder="단지 이름을 입력해요 (예: 잠실엘스)"
        maxLength={60}
        value={name}
        onChange={(v) => {
          actions.updateMeta({ name: v });
          setTyping(true);
        }}
        hint="아파트 단지를 찾아줘요. 찾지 않고 이름만 적어도 돼요. 오피스텔·빌라는 아래에 직접 입력해 주세요."
      />

      {!s.place ? (
        <>
          <div className={styles.status} aria-live="polite">
            {s.search.kind === "loading" && <span>찾는 중…</span>}
            {s.search.kind === "empty" && <span>{NO_APARTMENT_MESSAGE}</span>}
            {s.search.kind === "error" && <span>{s.search.message}</span>}
            {typing && trimmedLength > 0 && trimmedLength < MIN_QUERY && <span>두 글자 이상 입력하면 단지를 찾아드려요.</span>}
          </div>
          {s.search.kind === "results" && (
            <ul className={styles.list}>
              {s.search.places.map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles.item} onClick={() => selectPlace(p)}>
                    <b>{p.name}</b>
                    <small>{p.roadAddress || p.address}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className={styles.selected}>
            <div>
              <b>{s.place.name}</b>
              <small>{s.place.roadAddress || s.place.address}</small>
            </div>
            <Button variant="link" onClick={searchAgain}>다시 찾기</Button>
          </div>

          <div className={styles.status} aria-live="polite">
            {s.trades.kind === "loading" && <span>거래 내역을 불러오는 중…</span>}
            {s.trades.kind === "no-region" && <span>{NO_REGION_MESSAGE}</span>}
            {s.trades.kind === "error" && <span>{s.trades.message || FETCH_FAILED_MESSAGE}</span>}
          </div>

          {result && (
            <TradesView
              result={result}
              seq={seq}
              onSeq={(v) => {
                setSeq(v);
                setAreaKey(null);
              }}
              areaKey={areaKey}
              onArea={(g) => complex && pickArea(complex, g)}
              complex={complex}
              area={area}
              months={s.months}
              onMonths={s.setMonths}
              includeDirect={s.includeDirect}
              onIncludeDirect={s.setIncludeDirect}
              onPrice={(price) => actions.updateHouse({ price })}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface ViewProps {
  result: FoundTrades;
  seq: string | null;
  onSeq: (seq: string) => void;
  areaKey: number | null;
  onArea: (g: AreaGroup) => void;
  complex: ComplexSummary | undefined;
  area: AreaGroup | undefined;
  months: number;
  onMonths: (m: number) => void;
  includeDirect: boolean;
  onIncludeDirect: (v: boolean) => void;
  onPrice: (price: number) => void;
}

function TradesView({ result, seq, onSeq, areaKey, onArea, complex, area, months, onMonths, includeDirect, onIncludeDirect, onPrice }: ViewProps) {
  const note = excludedNote(result.excluded);

  return (
    <div className={styles.trades}>
      <p className={styles.region}>지역을 자동으로 설정했어요: <b>{regionName(result.regionId)}</b></p>

      {result.complexes.length === 0 ? (
        <>
          <p className={styles.empty}>최근 {result.monthsSearched}개월 동안 이 단지의 매매 거래가 없어요. 아래에서 직접 입력해 주세요.</p>
          {months < MAX_MONTHS && (
            <Button variant="ghost" onClick={() => onMonths(MAX_MONTHS)}>{MAX_MONTHS}개월로 다시 찾기</Button>
          )}
        </>
      ) : (
        <>
          {result.complexes.length > 1 && (
            <div role="radiogroup" aria-label="단지 선택" className={styles.group}>
              <p className={styles.label}>같은 주소에 단지가 여러 개예요. 단지를 골라 주세요.</p>
              {result.complexes.map((c) => (
                <button
                  key={c.aptSeq}
                  type="button"
                  role="radio"
                  aria-checked={c.aptSeq === seq}
                  className={styles.chip}
                  onClick={() => onSeq(c.aptSeq)}
                >
                  {c.aptNm} · 거래 {c.tradeCount}건
                </button>
              ))}
            </div>
          )}

          {complex && (
            <div role="radiogroup" aria-label="평형 선택" className={styles.group}>
              <p className={styles.label}>
                {complex.aptNm}{complex.buildYear ? ` · ${complex.buildYear}년 준공` : ""} — 평형(전용면적)을 골라 주세요.
              </p>
              {complex.areas.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  role="radio"
                  aria-checked={g.key === areaKey}
                  className={styles.chip}
                  onClick={() => onArea(g)}
                >
                  {g.label} · {g.count}건
                </button>
              ))}
            </div>
          )}

          {area && (
            <div className={styles.recent}>
              <p className={styles.label}>최근 거래 (참고용)</p>
              <ul>
                {area.recent.slice(0, 3).map((t, i) => (
                  <li key={`${t.date}-${i}`}>
                    <span>{tradeLine(t)}{t.direct ? " · 직거래" : ""}</span>
                    <Button variant="link" onClick={() => onPrice(t.price)} aria-label={`${fmt(t.price)}을 매매가에 넣기`}>
                      매매가에 넣기
                    </Button>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>실거래가는 시세가 아니에요. 층·동·거래 시점에 따라 달라요. 매매가는 직접 확인해서 입력해 주세요.</p>
            </div>
          )}
        </>
      )}

      {note && <p className={styles.hint}>{note}.</p>}
      <CheckField label="직거래도 포함해서 보기" checked={includeDirect} onChange={onIncludeDirect} />
    </div>
  );
}
