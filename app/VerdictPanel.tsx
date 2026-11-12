"use client";

import { useEffect, useRef, useState } from "react";
import { formatManwon as fmt, type House, type SortBy } from "../src/engine";
import type { CheckResult } from "../src/state/derive";
import { conclusionTip, won } from "../src/state/present";
import type { ListingMeta } from "../src/state/types";
import { Panel } from "./components/Panel";
import { cx } from "./lib/cx";
import styles from "./VerdictPanel.module.css";

interface Props {
  check: CheckResult;
  house: House;
  meta: ListingMeta;
  sortBy: SortBy;
}

/** 결론 한 줄: 가능/불가 도장, 추천 대출, 한도·월 상환액·부족 자금, 네고 팁 */
export function VerdictPanel({ check, house, meta, sortBy }: Props) {
  const { best } = check;
  const { context } = check.evaluation;
  const ok = best !== null;
  const tip = conclusionTip(check);

  // 가능↔불가가 바뀔 때만 도장 찍는 움직임을 보여줘요 (처음 열 때는 없음).
  const prevOk = useRef<boolean | null>(null);
  const [stamp, setStamp] = useState(false);
  useEffect(() => {
    if (prevOk.current !== null && prevOk.current !== ok) setStamp(true);
    prevOk.current = ok;
  }, [ok]);

  return (
    <Panel>
      <p className={styles.title}>{meta.name.trim() || "이름 없는 매물"}</p>
      <p className={styles.meta}>
        {context.region.name} · 매매가 {fmt(house.price)} · 전용 {house.area}㎡ · {context.married ? "부부합산" : "본인"} 소득 {fmt(context.income)}
      </p>

      <div className={styles.verdict}>
        <div key={String(ok)} className={cx(styles.seal, ok ? styles.ok : styles.no, stamp && styles.stamp)} aria-hidden="true">
          {ok ? "가능" : "불가"}
        </div>
        <div>
          <small>{best ? `추천 · ${sortBy === "monthly" ? "월 상환액 적은 순" : "한도 큰 순"}` : "지금 조건으로는"}</small>
          <b className={styles.main}>
            <span className="sr-only">{ok ? "가능: " : "불가: "}</span>
            {best ? best.name : "받을 수 있는 대출이 없어요"}
          </b>
          {best && (
            <div className={styles.nums}>
              <span>한도 <b>{fmt(best.limit)}</b></span>
              <span>{house.method === "principal" ? "첫 달" : "월"} <b>{won(best.firstPayment)}</b></span>
              <span>{best.gap > 0 ? <>부족 자금 <b className={styles.bad}>{fmt(best.gap)}</b></> : <>자금 <b>충분</b></>}</span>
            </div>
          )}
        </div>
      </div>

      {tip && (
        <p className={styles.nego}>
          {tip.map((part, i) => (part.bold ? <b key={i}>{part.text}</b> : <span key={i}>{part.text}</span>))}
        </p>
      )}
    </Panel>
  );
}
