"use client";

import { useEffect, useId, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import styles from "./Field.module.css";

/* ---------- 공통 라벨 틀 ---------- */

interface FieldFrameProps {
  label: string;
  /** 라벨 옆 ⓘ 버튼 등 */
  info?: ReactNode;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

function FieldFrame({ label, info, hint, htmlFor, className, children }: FieldFrameProps) {
  return (
    <div className={cx(styles.field, className)}>
      <span className={styles.label}>
        <label htmlFor={htmlFor}>{label}</label>
        {info}
      </span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

type CommonProps = Pick<FieldFrameProps, "label" | "info" | "hint" | "className">;

/* ---------- 숫자 입력 (단위 표시) ---------- */

interface NumberFieldProps extends CommonProps {
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** true면 0일 때 칸을 비워서 보여줘요 (선택 입력용, 예: KB시세) */
  blankZero?: boolean;
}

const parseNum = (s: string) => Math.max(0, parseFloat(s) || 0);

/**
 * 숫자 칸. 값은 항상 number(0 이상)로 올려요.
 * 지우는 중에 "0"이 튀어나오지 않도록 입력 문자열을 따로 들고 있어요.
 */
export function NumberField({
  label, info, hint, className, value, onChange, unit, min = 0, max, step, placeholder, blankZero,
}: NumberFieldProps) {
  const id = useId();
  const show = (v: number) => (blankZero && v === 0 ? "" : String(v));
  const [text, setText] = useState(() => show(value));

  // 바깥에서 값이 바뀌면(프로필 전환 등) 입력 문자열도 맞춰요.
  useEffect(() => {
    setText((t) => (parseNum(t) === value ? t : show(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <FieldFrame label={label} info={info} hint={hint} htmlFor={id} className={className}>
      <span className={styles.unit}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseNum(e.target.value));
          }}
        />
        {unit && <i>{unit}</i>}
      </span>
    </FieldFrame>
  );
}

/* ---------- 글자 입력 ---------- */

interface TextFieldProps extends CommonProps, Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id"> {
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, info, hint, className, value, onChange, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} info={info} hint={hint} htmlFor={id} className={className}>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </FieldFrame>
  );
}

/* ---------- 선택 ---------- */

interface SelectFieldProps<V extends string> extends CommonProps {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<{ value: V; label: string }>;
}

export function SelectField<V extends string>({ label, info, hint, className, value, onChange, options }: SelectFieldProps<V>) {
  const id = useId();
  return (
    <FieldFrame label={label} info={info} hint={hint} htmlFor={id} className={className}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldFrame>
  );
}

/* ---------- 체크 ---------- */

interface CheckFieldProps {
  label: string;
  info?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckField({ label, info, checked, onChange }: CheckFieldProps) {
  const id = useId();
  return (
    <span className={styles.check}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
      {info}
    </span>
  );
}

/** 입력칸을 나란히 놓는 2열 줄 */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

/** 체크박스 묶음 */
export function CheckGroup({ children }: { children: ReactNode }) {
  return <div className={styles.checks}>{children}</div>;
}
