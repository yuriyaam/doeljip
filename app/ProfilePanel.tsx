"use client";

import { useEffect, useId, useState } from "react";
import type { Marital } from "../src/engine";
import { profileSummary } from "../src/state/present";
import type { ProfileEntry } from "../src/state/types";
import { Button } from "./components/Button";
import { CheckField, CheckGroup, FieldRow, NumberField, SelectField, TextField } from "./components/Field";
import { Term } from "./components/InfoPopover";
import { Panel } from "./components/Panel";
import { cx } from "./lib/cx";
import styles from "./ProfilePanel.module.css";
import type { DoeljipActions } from "./useDoeljip";

const MARITAL_OPTIONS = [
  { value: "single", label: "미혼" },
  { value: "engaged", label: "예비부부 (3개월 내)" },
  { value: "newly", label: "신혼 (7년 이내)" },
  { value: "married", label: "기혼 (7년 초과)" },
] as const satisfies ReadonlyArray<{ value: Marital; label: string }>;

const HOMES_OPTIONS = [
  { value: "0", label: "무주택" },
  { value: "1", label: "1주택 (처분 조건)" },
  { value: "2", label: "2주택 이상" },
] as const;

interface Props {
  profiles: ProfileEntry[];
  active: ProfileEntry;
  actions: DoeljipActions;
}

/** 내 조건 프로필: 탭으로 전환, 접힌 상태에선 요약 칩, 펼치면 입력 폼 */
export function ProfilePanel({ profiles, active, actions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const p = active.profile;

  // 이름 칸은 지우는 중에 "이름 없음"으로 바뀌지 않도록 입력 문자열을 따로 둬요.
  const [nameDraft, setNameDraft] = useState(active.name);
  // 프로필을 바꿀 때만 맞춰요. 이름이 바뀔 때마다 맞추면 지우는 순간 "이름 없음"으로 되돌아가요.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setNameDraft(active.name), [active.id]);

  const addAndEdit = () => {
    actions.addProfile();
    setExpanded(true);
  };

  return (
    <Panel
      title="내 조건"
      actions={
        <Button variant="link" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "접기" : "펼쳐서 수정"}
        </Button>
      }
    >
      <div className={styles.tabs} role="tablist" aria-label="조건 프로필">
        {profiles.map((pr) => (
          <button
            key={pr.id}
            type="button"
            role="tab"
            aria-selected={pr.id === active.id}
            className={styles.tab}
            onClick={() => actions.switchProfile(pr.id)}
          >
            {pr.name}
          </button>
        ))}
        <button type="button" className={cx(styles.tab, styles.add)} onClick={addAndEdit}>+ 복사해서 추가</button>
      </div>

      {!expanded && (
        <p className={styles.summary}>
          {profileSummary(p).map((s) => (
            <span key={s}>{s}</span>
          ))}
        </p>
      )}

      <div id={bodyId} hidden={!expanded} className={styles.body}>
        <div className={styles.nameRow}>
          <TextField
            label="프로필 이름"
            maxLength={20}
            value={nameDraft}
            onChange={(v) => {
              setNameDraft(v);
              actions.renameProfile(v);
            }}
            onBlur={() => !nameDraft.trim() && setNameDraft(active.name)}
          />
          <Button
            variant="link"
            danger
            className={styles.del}
            disabled={profiles.length <= 1}
            title={profiles.length <= 1 ? "프로필은 최소 하나 있어야 해요" : undefined}
            onClick={() => {
              if (window.confirm(`‘${active.name}’ 프로필을 삭제할까요?`)) actions.deleteProfile();
            }}
          >
            이 프로필 삭제
          </Button>
        </div>

        <FieldRow>
          <NumberField label="본인 연소득" unit="만원" step={100} value={p.inc1} onChange={(v) => actions.updateProfile({ inc1: v })} />
          <NumberField label="배우자 연소득" unit="만원" step={100} value={p.inc2} onChange={(v) => actions.updateProfile({ inc2: v })} />
        </FieldRow>
        <FieldRow>
          <SelectField label="혼인 상태" value={p.marital} options={MARITAL_OPTIONS} onChange={(v) => actions.updateProfile({ marital: v })} />
          <NumberField label="자녀 수" max={9} value={p.kids} onChange={(v) => actions.updateProfile({ kids: Math.min(9, Math.floor(v)) })} />
        </FieldRow>
        <FieldRow>
          <SelectField
            label="주택 보유"
            value={String(p.homes) as "0" | "1" | "2"}
            options={HOMES_OPTIONS}
            onChange={(v) => actions.updateProfile({ homes: Number(v) as 0 | 1 | 2 })}
          />
          <NumberField label="보유 현금" unit="만원" step={100} value={p.cash} onChange={(v) => actions.updateProfile({ cash: v })} />
        </FieldRow>
        <NumberField
          label="순자산 (부부합산, 부채 차감)"
          info={<Term term="asset" />}
          unit="만원"
          step={100}
          value={p.netAsset}
          onChange={(v) => actions.updateProfile({ netAsset: v })}
        />
        <CheckGroup>
          <CheckField label="생애최초" info={<Term term="first" />} checked={p.firstHome} onChange={(v) => actions.updateProfile({ firstHome: v })} />
          <CheckField label="세대주" info={<Term term="householder" />} checked={p.householder} onChange={(v) => actions.updateProfile({ householder: v })} />
          <CheckField label="2년 내 출산" checked={p.newborn} onChange={(v) => actions.updateProfile({ newborn: v })} />
        </CheckGroup>
        <FieldRow>
          <NumberField
            label="기존 대출 연 원리금"
            info={<Term term="existing" />}
            unit="만원"
            step={10}
            value={p.existingAnnualPayment}
            onChange={(v) => actions.updateProfile({ existingAnnualPayment: v })}
          />
          <NumberField label="그중 연 이자" unit="만원" step={10} value={p.existingAnnualInterest} onChange={(v) => actions.updateProfile({ existingAnnualInterest: v })} />
        </FieldRow>
        <p className={styles.hint}>신용대출·자동차 할부 등. DSR에는 원리금 전체, DTI에는 이자만 들어가요.</p>
      </div>
    </Panel>
  );
}
