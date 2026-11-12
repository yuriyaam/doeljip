import { DEFAULT_MONTHS, MAX_MONTHS, complexTrades } from "../../../../src/api/service";
import { badRequest, errorResponse, getDeps, ok } from "../../../../src/api/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/complexes/trades?address=…&roadAddress=…&months=6&includeDirect=1
 * 카카오로 찾은 단지의 최근 실거래(국토부)를 평형별로 돌려줘요.
 * 해제된 거래는 항상 빼고, 직거래는 includeDirect=1일 때만 넣어요.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const address = (sp.get("address") ?? "").trim();
  const roadAddress = (sp.get("roadAddress") ?? "").trim();
  if (address.length < 4 || address.length > 100 || roadAddress.length > 100) {
    return badRequest("단지 주소가 올바르지 않아요.");
  }

  const monthsRaw = sp.get("months");
  const months = monthsRaw === null ? DEFAULT_MONTHS : Number(monthsRaw);
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
    return badRequest(`조회 기간은 1~${MAX_MONTHS}개월이에요.`);
  }

  try {
    const result = await complexTrades(
      { address, roadAddress, months, includeDirect: sp.get("includeDirect") === "1" },
      getDeps(),
    );
    return ok(result);
  } catch (e) {
    return errorResponse(e);
  }
}
