"use client";

import { useState } from "react";
import { CompareTable } from "./CompareTable";
import { InfoProvider } from "./components/InfoPopover";
import { ToastProvider } from "./components/Toast";
import styles from "./DoeljipApp.module.css";
import { ListingPanel } from "./ListingPanel";
import { LoanTable } from "./LoanTable";
import { ProfilePanel } from "./ProfilePanel";
import { SavedListings } from "./SavedListings";
import { useDoeljip } from "./useDoeljip";
import { VerdictPanel } from "./VerdictPanel";

type Tab = "check" | "saved";

/** 화면 전체: 제목·탭 → (판정: 입력 | 결과) 또는 저장한 매물 */
export function DoeljipApp() {
  const app = useDoeljip();
  const { state, active, house, meta, check, comparison, status, actions } = app;
  const [tab, setTab] = useState<Tab>("check");

  return (
    <InfoProvider>
      <ToastProvider>
        <header className={styles.top}>
          <div>
            <h1>이 집, 대출 될까?</h1>
            <p className={styles.sub}>내 조건과 매물을 넣으면 대출별로 되는지, 왜 안 되는지, 매달 얼마인지 보여줘요.</p>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="화면">
            <button type="button" role="tab" id="tab-check" aria-controls="view-check" aria-selected={tab === "check"} onClick={() => setTab("check")}>
              판정
            </button>
            <button type="button" role="tab" id="tab-saved" aria-controls="view-saved" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>
              저장한 매물{state.listings.length ? ` (${state.listings.length})` : ""}
            </button>
          </div>
        </header>

        <div id="view-check" role="tabpanel" aria-labelledby="tab-check" hidden={tab !== "check"} className={styles.grid}>
          <form className={styles.inputs} autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <ProfilePanel profiles={state.profiles} active={active} actions={actions} />
            <ListingPanel house={house} meta={meta} status={status} actions={actions} />
          </form>
          <div>
            <VerdictPanel check={check} house={house} meta={meta} sortBy={state.sortBy} />
            <LoanTable check={check} house={house} sortBy={state.sortBy} actions={actions} />
            <CompareTable comparison={comparison} activeId={active.id} />
          </div>
        </div>

        <div id="view-saved" role="tabpanel" aria-labelledby="tab-saved" hidden={tab !== "saved"}>
          <SavedListings
            listings={state.listings}
            onOpen={(id) => {
              actions.openListing(id);
              setTab("check");
            }}
            onDelete={actions.deleteListing}
          />
        </div>
      </ToastProvider>
    </InfoProvider>
  );
}
