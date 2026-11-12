"use client";

import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { GLOSSARY, termKeysFor, type TermKey } from "../../src/glossary";
import { InfoButton } from "./InfoButton";
import styles from "./InfoPopover.module.css";

interface Open { term: TermKey; owner: string; anchor: HTMLElement }
interface Ctx { openId: string | null; toggle: (term: TermKey, owner: string, anchor: HTMLElement) => void }

const InfoContext = createContext<Ctx | null>(null);
const MOBILE_MAX = 560;

/** ⓘ 설명 팝오버를 하나만 띄우는 공급자. 앱 맨 위에 한 번 감싸요. */
export function InfoProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [pos, setPos] = useState({ left: 12, top: 12 });
  const popRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const toggle = useCallback<Ctx["toggle"]>((term, owner, anchor) => {
    setOpen((cur) => (cur?.owner === owner ? null : { term, owner, anchor }));
  }, []);

  const close = useCallback((refocus: boolean) => {
    setOpen((cur) => {
      if (cur && refocus) cur.anchor.focus({ preventScroll: true });
      return null;
    });
  }, []);

  // 버튼 아래(공간이 없으면 위)에 놓아요. 모바일은 CSS가 아래 시트로 덮어써요.
  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const r = open.anchor.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = popRef.current;
    const left = Math.min(Math.max(12, r.left - 16), window.innerWidth - w - 12);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    setPos({ left, top });
    closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("[data-popover]") || t?.closest("[data-info-btn]")) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const onScroll = () => window.innerWidth > MOBILE_MAX && close(false);
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const value = useMemo<Ctx>(() => ({ openId: open?.owner ?? null, toggle }), [open?.owner, toggle]);
  const entry = open ? GLOSSARY[open.term] : null;

  return (
    <InfoContext.Provider value={value}>
      {children}
      {entry && (
        <div
          ref={popRef}
          className={styles.pop}
          style={{ left: pos.left, top: pos.top }}
          role="dialog"
          aria-labelledby={titleId}
          data-popover
        >
          <div className={styles.head}>
            <h4 id={titleId}>{entry.title}</h4>
            <button ref={closeRef} type="button" className={styles.x} aria-label="닫기" onClick={() => close(true)}>✕</button>
          </div>
          <p>{entry.body}</p>
        </div>
      )}
    </InfoContext.Provider>
  );
}

/** 용어 옆 ⓘ 버튼. 누르면 그 용어 설명이 떠요. */
export function Term({ term }: { term: TermKey }) {
  const ctx = useContext(InfoContext);
  const owner = useId();
  if (!ctx) throw new Error("Term은 InfoProvider 안에서 써야 해요.");
  return (
    <InfoButton
      data-info-btn
      title={GLOSSARY[term].title}
      expanded={ctx.openId === owner}
      onClick={(e) => ctx.toggle(term, owner, e.currentTarget)}
    />
  );
}

/** 문구 속 용어를 찾아 ⓘ 버튼을 붙여요 (요건·한도 문구용). */
export function AutoTerms({ text }: { text: string }) {
  return (
    <>
      {termKeysFor(text).map((k) => (
        <Term key={k} term={k} />
      ))}
    </>
  );
}
