/** 외부 API 호출 실패. 종류에 따라 서버 라우트가 응답 코드를 정해요. */
export type UpstreamKind = "rate-limit" | "auth" | "upstream" | "bad-response";

export class UpstreamError extends Error {
  constructor(public kind: UpstreamKind, message: string, public source: "molit" | "kakao") {
    super(message);
    this.name = "UpstreamError";
  }
}
