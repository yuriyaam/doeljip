# doeljip (될집)

집 매매 시 내 조건(소득, 혼인, 자녀, 주택 보유 등)과 매물(지역, 가격, 면적)로
일반 주담대·디딤돌·신생아 특례·보금자리론 가능 여부, 한도, 월 상환액을 판정하는 엔진이에요.
화면과 분리된 순수 TypeScript라 웹·앱·서버 어디서든 그대로 쓸 수 있어요.

## 구조

| 파일 | 역할 |
| --- | --- |
| `src/rules.ts` | 규칙 데이터 (LTV, 한도, 소득 기준, 금리표). 출처(`SOURCES`)와 확인일, 시행일 포함 |
| `src/engine.ts` | `evaluate()` 판정, `simulateNego()` 네고 시뮬레이션, `rankLoans()` 추천 순위 |
| `src/engine.test.ts` | 실제 사례 기반 테스트 41개 |

모든 금액 단위는 **만원**이에요 (6억원 = `60000`).

## 사용 예

```ts
import { evaluate, simulateNego, rankLoans } from "./src/engine";

const profile = {
  inc1: 5000, inc2: 4000, marital: "newly", kids: 0, homes: 0,
  cash: 20000, netAsset: 25000, firstHome: true, householder: true, newborn: false,
  existingAnnualPayment: 0, existingAnnualInterest: 0,
} as const;
const house = { regionId: "local", price: 62000, area: 84.9, years: 30, method: "annuity" } as const;

const { results } = evaluate(profile, house);       // 대출별 가능 여부·한도·요건
const best = rankLoans(results, "monthly")[0];      // 추천
const nego = simulateNego(profile, house);          // 네고하면 달라지는 대출
```

## 실행

```bash
npm install
npm test          # 테스트
npm run typecheck # 타입 검사
```

## 정책이 바뀌었을 때

1. `src/rules.ts`에서 해당 값을 고치고 `SOURCES`의 출처·확인일을 갱신해요.
2. `npm test`를 돌려 깨지는 테스트를 확인해요. 깨진 테스트는 "정책 변경으로 결과가 달라진 사례"예요.
3. 새 기준에 맞게 테스트 기대값을 고치고, 바뀐 규칙을 검증하는 테스트를 하나 추가해요.

## 아직 단순화된 부분 (TODO)

- 스트레스 금리: 지방 0.75%p, 금리 유형(변동·혼합·주기형)별 반영률 미적용
- 신생아 특례 금리: 소득 구간별 표 대신 기본값 사용
- 보금자리론 금리: 매월 고시값 대신 기본값 사용
- 신용점수, 아파트 외 주택의 LTV 차감, 취득세·중개보수 미반영
