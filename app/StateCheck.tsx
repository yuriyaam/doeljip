"use client";

import { formatManwon } from "../src/engine";
import { Button } from "./components/Button";
import { NumberField, TextField } from "./components/Field";
import { Panel } from "./components/Panel";
import styles from "./StateCheck.module.css";
import { useDoeljip } from "./useDoeljip";

/** 2단계 확인용 화면. 3단계에서 실제 화면으로 교체하고 지워요. */
export function StateCheck() {
  const { state, active, house, check, status, actions } = useDoeljip();
  const { best, nego, noGo } = check;

  return (
    <Panel title="2단계 확인용 (임시)">
      <p className={styles.line}>
        저장소: <b>{status === "loading" ? "불러오는 중" : status === "ready" ? "연결됨 (자동 저장)" : "사용 불가 (이 화면에서만 유지)"}</b>
      </p>

      <div className={styles.tabs}>
        {state.profiles.map((p) => (
          <Button key={p.id} variant={p.id === active.id ? "primary" : "ghost"} onClick={() => actions.switchProfile(p.id)}>
            {p.name}
          </Button>
        ))}
        <Button variant="link" onClick={actions.addProfile}>+ 복사해서 추가</Button>
      </div>

      <div className={styles.tabs}>
        <TextField label="프로필 이름" maxLength={20} value={active.name} onChange={actions.renameProfile} />
        <Button
          variant="link"
          danger
          disabled={state.profiles.length <= 1}
          title={state.profiles.length <= 1 ? "프로필은 최소 하나 있어야 해요" : undefined}
          onClick={() => {
            if (window.confirm(`‘${active.name}’ 프로필을 삭제할까요?`)) actions.deleteProfile();
          }}
        >
          이 프로필 삭제
        </Button>
      </div>

      <NumberField label="본인 연소득" unit="만원" step={100} value={active.profile.inc1} onChange={(v) => actions.updateProfile({ inc1: v })} />
      <NumberField label="매매가" unit="만원" step={100} value={house.price} onChange={(v) => actions.updateHouse({ price: v })} />
      <NumberField label="KB시세 (선택)" unit="만원" step={100} blankZero placeholder="모르면 비움" value={house.kb ?? 0} onChange={(v) => actions.updateHouse({ kb: v })} />

      <p className={styles.line}>
        추천: <b>{best ? `${best.name} · 한도 ${formatManwon(best.limit)}` : "받을 수 있는 대출 없음"}</b>
      </p>
      <p className={styles.line}>네고하면 달라지는 대출 {nego.length}개 · 안 되는 대출 {noGo.length}개 · 저장한 매물 {state.listings.length}개</p>

      <div className={styles.tabs}>
        <Button onClick={actions.saveListing}>이 매물 저장</Button>
        <Button variant="ghost" onClick={actions.newListing}>새 매물</Button>
      </div>
      <p className={styles.hint}>값을 바꾼 뒤 새로고침해도 그대로 남아야 해요.</p>
    </Panel>
  );
}
