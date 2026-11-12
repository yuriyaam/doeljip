/**
 * 메모리 캐시 (유효 시간 + 같은 요청 합치기).
 * 국토부 거래 데이터(공공데이터)에만 써요. 카카오 결과는 이용정책상 저장하지 않아요.
 */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  private inflight = new Map<string, Promise<V>>();

  constructor(private max = 300, private now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.store.delete(key);
    this.store.set(key, { value, expires: this.now() + ttlMs });
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** 캐시에 있으면 돌려주고, 없으면 loader를 한 번만 실행해요. 실패는 저장하지 않아요. */
  async getOrLoad(key: string, ttlMs: number, loader: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const p = loader()
      .then((v) => {
        this.set(key, v, ttlMs);
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  get size(): number {
    return this.store.size;
  }
}
