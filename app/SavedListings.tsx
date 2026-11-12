"use client";

import { formatManwon as fmt } from "../src/engine";
import { RULES } from "../src/rules";
import { byRecent } from "../src/state/present";
import type { SavedListing } from "../src/state/types";
import { Button } from "./components/Button";
import { Panel } from "./components/Panel";
import { useToast } from "./components/Toast";
import { cx } from "./lib/cx";
import styles from "./SavedListings.module.css";

interface Props {
  listings: SavedListing[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const regionName = (id: string) => RULES.regions.find((r) => r.id === id)?.name ?? "";

export function SavedListings({ listings, onOpen, onDelete }: Props) {
  const toast = useToast();

  return (
    <Panel title="저장한 매물">
      {listings.length === 0 ? (
        <p className={styles.empty}>아직 저장한 매물이 없어요. 판정 화면에서 ‘이 매물 저장’을 누르면 여기에 모여요.</p>
      ) : (
        <div className={styles.scroll}>
          <table>
            <thead>
              <tr>
                <th>매물</th><th>지역</th><th className={styles.r}>매매가</th><th>판정 조건</th>
                <th>판정</th><th className={styles.r}>최대 한도</th><th className={styles.r}>부족 자금</th><th>메모</th><th />
              </tr>
            </thead>
            <tbody>
              {listings.slice().sort(byRecent).map((l) => {
                const v = l.verdict;
                return (
                  <tr key={l.id}>
                    <td><Button variant="link" onClick={() => onOpen(l.id)}>{l.meta.name}</Button></td>
                    <td className={styles.region}>{regionName(l.house.regionId)}</td>
                    <td className={styles.r}>{fmt(l.house.price)}</td>
                    <td className={styles.clip}>{l.profileName}</td>
                    <td>
                      {v.okCount ? <span className={cx(styles.tag, styles.ok)}>{v.okCount}개 가능</span> : <span className={cx(styles.tag, styles.no)}>불가</span>}
                    </td>
                    <td className={styles.r}>{v.okCount ? fmt(v.bestLimit) : "-"}</td>
                    <td className={styles.r}>{v.gap > 0 ? fmt(v.gap) : "충분"}</td>
                    <td className={styles.clip}>{l.meta.memo}</td>
                    <td>
                      <Button
                        variant="link"
                        danger
                        onClick={() => {
                          if (!window.confirm(`‘${l.meta.name}’을(를) 삭제할까요?`)) return;
                          onDelete(l.id);
                          toast("삭제했어요");
                        }}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
