import { RULES, SOURCES } from "../src/rules";
import { DoeljipApp } from "./DoeljipApp";
import styles from "./page.module.css";

export default function Page() {
  return (
    <main className={styles.wrap}>
      <DoeljipApp />

      <footer className={styles.footer}>
        <p>
          정책대출 요건과 규제는 아래 출처 기준이고, 규칙 기준일은 {RULES.asOf}이에요. 스트레스 금리 지방 0.75%p,
          금리 유형별 반영률, 신용점수, 아파트 외 주택 LTV 차감, 취득세·중개보수, 은행별 심사는 단순화했거나 반영하지
          않았어요. 실제 가능 여부는 주택도시기금·한국주택금융공사·은행에서 꼭 확인하세요.
        </p>
        <ul>
          {SOURCES.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> (확인 {s.checkedAt})
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
