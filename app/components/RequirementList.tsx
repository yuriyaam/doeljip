import type { Requirement } from "../../src/engine";
import { reqTermText } from "../../src/state/present";
import { cx } from "../lib/cx";
import { AutoTerms } from "./InfoPopover";
import styles from "./RequirementList.module.css";

/** 충족(✓)·미충족(✕)·참고(·) 요건 목록. 문구 속 용어에는 ⓘ 버튼이 붙어요. */
export function RequirementList({ reqs, className }: { reqs: Requirement[]; className?: string }) {
  return (
    <ul className={cx(styles.req, className)}>
      {reqs.map((q, i) => {
        const kind = q.ok === true ? styles.ok : q.ok === false ? styles.no : styles.info;
        return (
          <li key={`${q.code}-${i}`} className={kind}>
            <span className={styles.mark} aria-hidden="true">{q.ok === true ? "✓" : q.ok === false ? "✕" : "·"}</span>
            <span className={styles.label}>
              <span className="sr-only">{q.ok === true ? "충족: " : q.ok === false ? "미충족: " : "참고: "}</span>
              {q.label}
              <AutoTerms text={reqTermText(q.label, q.detail)} />
            </span>
            <span className={styles.detail}>{q.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}
