/**
 * 서버 라우트 공통: 환경 변수 읽기, 의존성 만들기, 오류 → 응답 변환.
 * 키는 서버에서만 읽고 응답에 절대 담지 않아요.
 */
import { TtlCache } from "./cache";
import { UpstreamError } from "./errors";
import type { Deps } from "./service";
import type { Trade } from "./molit";

// 개발 중 핫 리로드로 모듈이 다시 불려도 캐시가 유지되게 전역에 둬요.
const g = globalThis as unknown as { __doeljipTradeCache?: TtlCache<Trade[]> };
const cache = (g.__doeljipTradeCache ??= new TtlCache<Trade[]>(300));

export class ConfigError extends Error {}

export function getDeps(): Deps {
  const molitKey = process.env.DATA_GO_KR_KEY;
  const kakaoKey = process.env.KAKAO_REST_KEY;
  if (!molitKey || !kakaoKey) throw new ConfigError("API 키가 설정되지 않았어요");
  return { fetch, now: () => new Date(), molitKey, kakaoKey, cache };
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const badRequest = (message: string) => json({ error: "bad-request", message }, 400);
export const ok = (body: unknown) => json(body, 200);

/** 오류를 사용자에게 보여줄 문구와 응답 코드로 바꿔요. 원인 상세는 서버 로그에만 남겨요. */
export function errorResponse(e: unknown): Response {
  if (e instanceof ConfigError) {
    console.error("[api] 설정 오류:", e.message);
    return json({ error: "not-configured", message: "서버 설정이 아직 안 끝났어요. 직접 입력으로 계속할 수 있어요." }, 503);
  }
  if (e instanceof UpstreamError) {
    console.error(`[api] ${e.source} ${e.kind}:`, e.message);
    if (e.kind === "rate-limit") {
      return json({ error: "rate-limit", message: "요청이 많아 잠시 후에 다시 시도해 주세요." }, 429);
    }
    return json({ error: "upstream", message: "외부 서비스에서 정보를 가져오지 못했어요. 직접 입력으로 계속할 수 있어요." }, 502);
  }
  console.error("[api] 예상하지 못한 오류:", e instanceof Error ? e.message : e);
  return json({ error: "internal", message: "문제가 생겼어요. 잠시 후에 다시 시도해 주세요." }, 500);
}
