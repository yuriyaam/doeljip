import { formatManwon as fmt } from "../src/engine";
import type { ProfileComparison } from "../src/state/derive";
import { firstFailLabel, limitChange, won } from "../src/state/present";
import { cx } from "./lib/cx";
import styles from "./CompareTable.module.css";

interface Props {
  /** 프로필이 2개 이상일 때만 채워져요. 비어 있으면 안내 문구를 보여줘요. */
  comparison: ProfileComparison[];
  activeId: string;
}

/** 같은 매물을 프로필(조건)별로 나란히 비교. 접어 두고 맨 아래에 놓아요. */
export function CompareTable({ comparison, activeId }: Props) {
  const base = comparison.find((c) => c.profile.id === activeId) ?? comparison[0];

  return (
    <details className={styles.wrap}>
      <summary>{comparison.length ? `조건별 비교 (프로필 ${comparison.length}개)` : "조건별 비교"}</summary>

      {!base ? (
        <p className={styles.note}>
          ‘+ 복사해서 추가’로 “혼인신고 후”, “출산 후” 같은 조건을 만들면 이 매물을 조건별로 나란히 비교해요.
        </p>
      ) : (
        <>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>대출</th>
                  {comparison.map((c) => (
                    <th key={c.profile.id} className={cx(c.profile.id === base.profile.id && styles.act)}>{c.profile.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {base.results.map((b, i) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    {comparison.map((c) => {
                      const r = c.results[i]!;
                      const change = c.profile.id === base.profile.id ? null : limitChange(b, r);
                      return (
                        <td key={c.profile.id} className={cx(change === "better" && styles.better, change === "worse" && styles.worse)}>
                          {r.ok ? (
                            <>
                              <span className={cx(styles.tag, styles.tagOk)}>가능</span> {fmt(r.limit)}
                              <small>월 {won(r.firstPayment)}</small>
                            </>
                          ) : (
                            <>
                              <span className={cx(styles.tag, styles.tagNo)}>불가</span>
                              <small>{firstFailLabel(r)}</small>
                            </>
                          )}
                          {change && <span className="sr-only">{change === "better" ? " (선택한 프로필보다 좋아짐)" : " (선택한 프로필보다 나빠짐)"}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>색칠된 칸은 지금 선택한 프로필(굵게)과 결과가 다른 곳이에요. 초록은 더 좋아짐, 빨강은 나빠짐.</p>
        </>
      )}
    </details>
  );
}
