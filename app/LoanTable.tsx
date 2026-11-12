"use client";

import { useEffect, useId, useState } from "react";
import { formatManwon as fmt, type House, type LoanId, type LoanResult, type NegoOption, type SortBy } from "../src/engine";
import type { CheckResult } from "../src/state/derive";
import { LOAN_SUB, bindingText, boostLine, noGoReason, won } from "../src/state/present";
import { AutoTerms } from "./components/InfoPopover";
import { Panel } from "./components/Panel";
import { RequirementList } from "./components/RequirementList";
import { cx } from "./lib/cx";
import styles from "./LoanTable.module.css";
import type { DoeljipActions } from "./useDoeljip";

interface Props {
  check: CheckResult;
  house: House;
  sortBy: SortBy;
  actions: DoeljipActions;
}

/** 대출 비교표: 가능한 대출(추천 표시) → 네고 시 가능한 대출(점선 행) → 안 되는 대출(펼치기) */
export function LoanTable({ check, house, sortBy, actions }: Props) {
  // 펼친 행을 기억해서, 값을 바꿔도 펼침이 유지돼요.
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string, open: boolean) =>
    setOpenKeys((cur) => {
      const next = new Set(cur);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const payLabel = house.method === "principal" ? "첫 달 상환액" : "월 상환액";
  const unlocks = check.nego.filter((n) => n.kind === "unlock");
  const boosts = new Map(check.nego.filter((n) => n.kind === "boost").map((n) => [n.id, n]));
  const empty = check.ranked.length === 0 && unlocks.length === 0;

  return (
    <Panel>
      <div className={styles.head}>
        <h2>대출 비교</h2>
        <div className={styles.seg} role="group" aria-label="정렬 기준">
          <button type="button" aria-pressed={sortBy === "monthly"} onClick={() => actions.setSort("monthly")}>월 상환액 순</button>
          <button type="button" aria-pressed={sortBy === "limit"} onClick={() => actions.setSort("limit")}>한도 순</button>
        </div>
      </div>

      <div className={styles.table}>
        <div className={cx(styles.row, styles.thead)} aria-hidden="true">
          <span>대출</span>
          <span className={styles.num}>한도</span>
          <span className={styles.num}>금리</span>
          <span className={styles.num}>{payLabel}</span>
          <span className={styles.num}>총 이자</span>
          <span className={styles.num}>부족 자금</span>
        </div>

        {empty && <p className={styles.empty}>지금 받을 수 있는 대출이 없어요. 아래에서 이유를 확인해 보세요.</p>}

        {check.ranked.map((r) => (
          <LoanRow
            key={r.id}
            shown={r}
            label={`${fmt(r.amount)} 대출 기준`}
            payLabel={payLabel}
            recommended={r === check.best}
            boost={boosts.get(r.id)}
            open={openKeys.has(r.id)}
            onToggle={(o) => toggle(r.id, o)}
            onRate={actions.setRate}
          />
        ))}

        {unlocks.map((n) => (
          <LoanRow
            key={`nego-${n.id}`}
            shown={n.result}
            label={`${fmt(n.discount)} 네고 시 (${fmt(n.newPrice)})`}
            payLabel={payLabel}
            ghostPrice={n.newPrice}
            open={openKeys.has(`nego-${n.id}`)}
            onToggle={(o) => toggle(`nego-${n.id}`, o)}
            onRate={actions.setRate}
          />
        ))}
      </div>

      {check.noGo.length > 0 && (
        <div className={styles.nogo}>
          <h3>안 되는 대출</h3>
          {check.noGo.map((r) => (
            <details
              key={r.id}
              className={styles.ng}
              open={openKeys.has(`no-${r.id}`)}
              onToggle={(e) => toggle(`no-${r.id}`, e.currentTarget.open)}
            >
              <summary>
                <span className={styles.chev} aria-hidden="true">▸</span>
                <span className={styles.txt}>
                  <b>{r.name}</b>
                  <span className={styles.why}>{noGoReason(r)}</span>
                </span>
                <span className={styles.more} aria-hidden="true" />
              </summary>
              <RequirementList reqs={r.reqs} className={styles.ngReq} />
            </details>
          ))}
        </div>
      )}

      <p className={styles.note}>
        정책대출과 일반 주담대는 같이 받을 수 없어서, 하나씩 골랐을 때를 비교해요. 행을 누르면 충족한 요건과 안 된 요건을 볼 수 있어요.{" "}
        {house.kb && house.kb > 0 ? "" : "KB시세를 비우면 매매가를 담보가치로 계산해요."}
      </p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

interface RowProps {
  shown: LoanResult;
  label: string;
  payLabel: string;
  recommended?: boolean;
  boost?: NegoOption;
  /** 네고 시 가능한 대출(점선 행)일 때의 네고 후 매매가 */
  ghostPrice?: number;
  open: boolean;
  onToggle: (open: boolean) => void;
  onRate: (loan: LoanId, rate: number | null) => void;
}

function LoanRow({ shown, label, payLabel, recommended, boost, ghostPrice, open, onToggle, onRate }: RowProps) {
  const detailId = useId();
  const ghost = ghostPrice !== undefined;
  const bind = bindingText(shown);

  return (
    <>
      <button
        type="button"
        className={cx(styles.row, styles.item, ghost && styles.ghost)}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => onToggle(!open)}
      >
        <span className={styles.nm}>
          <span className={styles.chev} aria-hidden="true">▸</span>
          <b>{shown.name}</b>
          {recommended && <span className={styles.pick}>추천</span>}
          <em>{label}</em>
          {!ghost && boost && <span className={styles.badge}>{fmt(boost.discount)} 네고 시 한도 +{fmt(boost.limitIncrease)}</span>}
        </span>
        <span className={styles.num} data-label="한도">{fmt(shown.limit)}</span>
        <span className={styles.num} data-label="금리">{shown.rate}%</span>
        <span className={styles.num} data-label={payLabel}>{won(shown.firstPayment)}</span>
        <span className={styles.num} data-label="총 이자">{fmt(shown.totalInterest)}</span>
        <span className={cx(styles.num, shown.gap > 0 && styles.bad)} data-label="부족 자금">
          {shown.gap > 0 ? fmt(shown.gap) : "충분"}
        </span>
      </button>

      <div id={detailId} className={styles.detail} hidden={!open}>
        <p className={styles.sub}>{LOAN_SUB[shown.id]}{ghost ? ` · 매매가 ${fmt(ghostPrice)} 기준` : ""}</p>
        {bind && (
          <p className={styles.bind}>
            {bind}
            <AutoTerms text={bind} />
          </p>
        )}
        <RateInput loan={shown} onCommit={(r) => onRate(shown.id, r)} />
        {boost && !ghost && <p className={styles.boost}>{boostLine(boost).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}</p>}
        <RequirementList reqs={shown.reqs} />
      </div>
    </>
  );
}

/** 금리 직접 입력. 입력을 마치면(포커스 이동·Enter) 반영하고, 비우면 자동(기본값)으로 돌아가요. */
function RateInput({ loan, onCommit }: { loan: LoanResult; onCommit: (rate: number | null) => void }) {
  const id = useId();
  const [text, setText] = useState(String(loan.rate));
  useEffect(() => setText(String(loan.rate)), [loan.rate]);

  const commit = () => {
    const t = text.trim();
    if (t === "") return onCommit(null);
    const v = parseFloat(t);
    if (Number.isFinite(v) && v >= 0 && v <= 20) {
      if (v !== loan.rate) onCommit(v);
    } else setText(String(loan.rate));
  };

  return (
    <p className={styles.rate}>
      <label htmlFor={id}>금리</label>
      <input
        id={id}
        type="number"
        step={0.05}
        min={0}
        max={20}
        value={text}
        aria-label={`${loan.name} 금리`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") setText(String(loan.rate));
        }}
      />
      %
      <small>{loan.rateAuto ? "소득·만기 기준 자동 (비우면 다시 자동)" : "직접 입력 (비우면 기본값)"}</small>
    </p>
  );
}
