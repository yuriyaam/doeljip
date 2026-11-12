import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./Panel.module.css";

interface PanelProps {
  title?: string;
  /** 제목 오른쪽 영역 (접기 버튼 등) */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** 흰 배경 테두리 카드. 연달아 놓으면 위 간격이 자동으로 생겨요. */
export function Panel({ title, actions, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)}>
      {(title || actions) && (
        <div className={styles.head}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
