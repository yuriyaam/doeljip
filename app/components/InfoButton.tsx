import type { ComponentProps } from "react";
import { cx } from "../lib/cx";
import styles from "./InfoButton.module.css";

interface InfoButtonProps extends Omit<ComponentProps<"button">, "children" | "title"> {
  /** 용어 이름 (스크린리더용). 예: "LTV (주택담보인정비율)" */
  title: string;
  expanded?: boolean;
}

/** ⓘ 버튼. 용어 설명을 여는 건 `Term`(InfoPopover)이 연결해요. */
export function InfoButton({ title, expanded = false, className, type = "button", ...rest }: InfoButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.ib, className)}
      aria-label={`${title} 설명 보기`}
      aria-expanded={expanded}
      {...rest}
    >
      i
    </button>
  );
}
