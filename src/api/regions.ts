/**
 * 시군구 코드(법정동코드 앞 5자리) → 판정에 쓰는 지역 구분(RULES.regions의 id).
 * 규제지역 목록(경기 12곳)은 src/rules.ts의 GYEONGGI_REGULATED와 이름이 같아야 해요.
 * 규제지역이 바뀌면 rules.ts와 이 표를 같이 고쳐요 (regions.test.ts가 어긋나면 알려줘요).
 */
import { RULES } from "../rules";

export const GYEONGGI_REGULATED_SGG: Readonly<Record<string, string>> = {
  "41290": "과천시",
  "41210": "광명시",
  "41135": "성남시 분당구",
  "41131": "성남시 수정구",
  "41133": "성남시 중원구",
  "41117": "수원시 영통구",
  "41111": "수원시 장안구",
  "41115": "수원시 팔달구",
  "41173": "안양시 동안구",
  "41465": "용인시 수지구",
  "41430": "의왕시",
  "41450": "하남시",
};

/** 시군구 코드로 지역 구분 id를 정해요. 서울 → 서울, 경기 규제 12곳 → 각 id, 경기 기타·인천 → metro, 그 외 → local */
export function regionIdForSgg(sgg: string): string {
  if (sgg.startsWith("11")) return "seoul";
  const name = GYEONGGI_REGULATED_SGG[sgg];
  if (name) {
    const region = RULES.regions.find((r) => r.name === `경기 ${name} (규제지역)`);
    if (region) return region.id;
  }
  if (sgg.startsWith("41") || sgg.startsWith("28")) return "metro";
  return "local";
}
