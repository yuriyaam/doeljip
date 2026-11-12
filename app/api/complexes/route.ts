import { searchComplexes } from "../../../src/api/service";
import { badRequest, errorResponse, getDeps, ok } from "../../../src/api/server";

export const dynamic = "force-dynamic";

/** GET /api/complexes?q=경희궁자이 → 아파트 단지 후보 (카카오). 결과는 저장·캐시하지 않아요. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return badRequest("단지명을 두 글자 이상 입력해 주세요.");
  if (q.length > 50) return badRequest("검색어가 너무 길어요.");
  try {
    const complexes = await searchComplexes(q, getDeps());
    return ok({ complexes });
  } catch (e) {
    return errorResponse(e);
  }
}
