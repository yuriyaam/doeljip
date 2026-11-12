import { describe, expect, it } from "vitest";
import { RULES } from "../rules";
import { GYEONGGI_REGULATED_SGG, regionIdForSgg } from "./regions";

describe("시군구 → 지역 구분", () => {
  it("경기 규제지역 12곳이 rules.ts의 규제지역과 빠짐없이 일치한다", () => {
    const fromRules = RULES.regions.filter((r) => r.id.startsWith("gg")).map((r) => r.name.replace(/^경기 | \(규제지역\)$/g, ""));
    expect(Object.values(GYEONGGI_REGULATED_SGG).sort()).toEqual(fromRules.slice().sort());
    expect(Object.keys(GYEONGGI_REGULATED_SGG)).toHaveLength(12);
  });

  it("규제지역 각 곳이 자기 id로 분류된다", () => {
    for (const [sgg, name] of Object.entries(GYEONGGI_REGULATED_SGG)) {
      const id = regionIdForSgg(sgg);
      const region = RULES.regions.find((r) => r.id === id)!;
      expect(region.name).toBe(`경기 ${name} (규제지역)`);
      expect(region.regulated).toBe(true);
    }
  });

  it("서울 전 구는 서울", () => {
    expect(regionIdForSgg("11110")).toBe("seoul");
    expect(regionIdForSgg("11710")).toBe("seoul");
  });

  it("경기 기타·인천은 수도권 비규제, 그 밖은 지방", () => {
    expect(regionIdForSgg("41113")).toBe("metro"); // 수원시 권선구
    expect(regionIdForSgg("41463")).toBe("metro"); // 용인시 기흥구
    expect(regionIdForSgg("28110")).toBe("metro"); // 인천 중구
    expect(regionIdForSgg("26350")).toBe("local"); // 부산 해운대구
    expect(regionIdForSgg("36110")).toBe("local"); // 세종
    expect(regionIdForSgg("50110")).toBe("local"); // 제주
  });

  it("반환한 id는 항상 판정 규칙에 있는 지역이다", () => {
    const ids = new Set(RULES.regions.map((r) => r.id));
    for (const sgg of ["11110", "41135", "41113", "28110", "26350", "99999"]) {
      expect(ids.has(regionIdForSgg(sgg))).toBe(true);
    }
  });
});
