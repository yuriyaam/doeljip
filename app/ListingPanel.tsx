"use client";

import { useMemo } from "react";
import type { House } from "../src/engine";
import { RULES } from "../src/rules";
import type { ListingMeta } from "../src/state/types";
import { ComplexPicker } from "./ComplexPicker";
import { Button } from "./components/Button";
import { CheckField, FieldRow, NumberField, SelectField, TextField } from "./components/Field";
import { Term } from "./components/InfoPopover";
import { Panel } from "./components/Panel";
import { useToast } from "./components/Toast";
import styles from "./ListingPanel.module.css";
import type { DoeljipActions, StorageStatus } from "./useDoeljip";

const REGION_OPTIONS = RULES.regions.map((r) => ({ value: r.id, label: r.name }));
const METHOD_OPTIONS = [
  { value: "annuity", label: "원리금균등" },
  { value: "principal", label: "원금균등" },
] as const;
const YEAR_CHOICES = [20, 30, 40];

const STORE_HINT: Record<StorageStatus, string> = {
  loading: "저장 공간 연결 중…",
  ready: "내 조건 프로필과 저장한 매물은 이 브라우저에만 저장돼요.",
  unavailable: "저장 공간을 쓸 수 없어 이 화면을 닫으면 저장한 매물이 사라져요.",
};

interface Props {
  house: House;
  meta: ListingMeta;
  status: StorageStatus;
  actions: DoeljipActions;
  /** 바뀌면 단지 찾기 상태를 처음으로 되돌려요 */
  resetKey: number;
  onNewListing: () => void;
}

export function ListingPanel({ house, meta, status, actions, resetKey, onNewListing }: Props) {
  const toast = useToast();

  // 저장돼 있던 값이 20/30/40이 아니어도 선택지에 보이게 해요.
  const yearOptions = useMemo(
    () => (YEAR_CHOICES.includes(house.years) ? YEAR_CHOICES : [...YEAR_CHOICES, house.years].sort((a, b) => a - b))
      .map((y) => ({ value: String(y), label: `${y}년` })),
    [house.years],
  );

  return (
    <Panel title="매물">
      {/* 저장한 매물을 열거나 새 매물을 시작하면 key가 바뀌어 단지 선택 상태가 초기화돼요 */}
      <ComplexPicker key={resetKey} actions={actions} name={meta.name} />
      <SelectField
        label="지역"
        info={<Term term="regulated" />}
        value={house.regionId}
        options={REGION_OPTIONS}
        onChange={(v) => actions.updateHouse({ regionId: v })}
      />
      <FieldRow>
        <NumberField label="매매가" unit="만원" step={100} value={house.price} onChange={(v) => actions.updateHouse({ price: v })} />
        <NumberField
          label="KB시세 (선택)"
          info={<Term term="kb" />}
          unit="만원"
          step={100}
          blankZero
          placeholder="모르면 비움"
          value={house.kb ?? 0}
          onChange={(v) => actions.updateHouse({ kb: v })}
        />
      </FieldRow>
      <FieldRow>
        <div>
          <NumberField label="전용면적" unit="㎡" step={0.01} value={house.area} onChange={(v) => actions.updateHouse({ area: v })} />
          <div className={styles.eup}>
            <CheckField label="읍·면 지역" checked={house.eupmyeon ?? false} onChange={(v) => actions.updateHouse({ eupmyeon: v })} />
          </div>
        </div>
        <SelectField
          label="상환 기간"
          value={String(house.years)}
          options={yearOptions}
          onChange={(v) => actions.updateHouse({ years: Number(v) })}
        />
      </FieldRow>
      <SelectField
        label="상환 방식"
        info={<Term term="method" />}
        value={house.method}
        options={METHOD_OPTIONS}
        onChange={(v) => actions.updateHouse({ method: v })}
      />
      <TextField
        label="매물 링크 (선택)"
        type="url"
        placeholder="네이버페이 부동산 등 매물 주소"
        maxLength={500}
        value={meta.url}
        onChange={(v) => actions.updateMeta({ url: v })}
        hint="주소만 저장해요. 서버에서 페이지를 읽어오지 않아요."
      />
      <TextField
        label="메모"
        placeholder="○○공인중개사 김실장, 남향, 수리 필요"
        maxLength={200}
        value={meta.memo}
        onChange={(v) => actions.updateMeta({ memo: v })}
      />
      <div className={styles.buttons}>
        <Button
          onClick={() => {
            actions.saveListing();
            toast(status === "unavailable" ? "저장했어요 (이 화면에서만 유지)" : "저장했어요");
          }}
        >
          이 매물 저장
        </Button>
        <Button variant="ghost" onClick={onNewListing}>새 매물</Button>
      </div>
      <p className={styles.store}>{STORE_HINT[status]}</p>
    </Panel>
  );
}
