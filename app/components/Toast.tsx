"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./Toast.module.css";

const ToastContext = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((m: string) => {
    setMessage(m);
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 1800);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={cx(styles.toast, on && styles.on)} role="status" aria-live="polite">{message}</div>
    </ToastContext.Provider>
  );
}

/** `const toast = useToast(); toast("저장했어요")` */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 ToastProvider 안에서 써야 해요.");
  return ctx;
}
