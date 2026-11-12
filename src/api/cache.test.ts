import { describe, expect, it } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("유효 시간이 지나면 사라진다", () => {
    let t = 0;
    const c = new TtlCache<number>(10, () => t);
    c.set("a", 1, 1000);
    expect(c.get("a")).toBe(1);
    t = 999;
    expect(c.get("a")).toBe(1);
    t = 1000;
    expect(c.get("a")).toBeUndefined();
  });

  it("같은 키를 동시에 요청해도 loader는 한 번만 실행된다", async () => {
    const c = new TtlCache<number>();
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    };
    const [a, b, d] = await Promise.all([c.getOrLoad("k", 1000, loader), c.getOrLoad("k", 1000, loader), c.getOrLoad("k", 1000, loader)]);
    expect([a, b, d]).toEqual([42, 42, 42]);
    expect(calls).toBe(1);
    await c.getOrLoad("k", 1000, loader);
    expect(calls).toBe(1); // 캐시에서
  });

  it("실패는 저장하지 않아서 다음에 다시 시도한다", async () => {
    const c = new TtlCache<number>();
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("일시 오류");
      return 7;
    };
    await expect(c.getOrLoad("k", 1000, flaky)).rejects.toThrow("일시 오류");
    expect(await c.getOrLoad("k", 1000, flaky)).toBe(7);
    expect(calls).toBe(2);
  });

  it("개수가 넘치면 오래된 것부터 지운다", () => {
    const c = new TtlCache<number>(2);
    c.set("a", 1, 1000);
    c.set("b", 2, 1000);
    c.set("c", 3, 1000);
    expect(c.size).toBe(2);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("c")).toBe(3);
  });

  it("빈 배열 같은 falsy 값도 캐시한다", async () => {
    const c = new TtlCache<number[]>();
    let calls = 0;
    const load = async () => {
      calls++;
      return [] as number[];
    };
    await c.getOrLoad("k", 1000, load);
    await c.getOrLoad("k", 1000, load);
    expect(calls).toBe(1);
  });
});
