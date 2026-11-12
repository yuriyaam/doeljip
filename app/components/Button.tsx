import type { ButtonHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: 채운 버튼, ghost: 테두리만, link: 글자만 */
  variant?: "primary" | "ghost" | "link";
  /** 삭제처럼 되돌리기 어려운 동작 */
  danger?: boolean;
}

export function Button({ variant = "primary", danger, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.btn, styles[variant], danger && styles.danger, className)} {...rest} />;
}
