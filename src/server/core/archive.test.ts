import { describe, expect, it } from 'vitest';
import { fasterThan } from './archive';
import { createMemoryStore } from './store';

describe('fasterThan', () => {
  it('counts the faster runners with a binary search', async () => {
    const store = createMemoryStore();
    const times = Array.from({ length: 1000 }, (_, i) => 1500 + i * 0.7);
    await store.zAdd(
      'lb',
      ...times.map((t, i) => ({ member: `r${i}`, score: t }))
    );
    let reads = 0;
    const counting = {
      ...store,
      zRange: (...a: Parameters<typeof store.zRange>) => {
        reads++;
        return store.zRange(...a);
      },
    };
    for (const s of [1000, 1500, 1800.2, 2300, 9999]) {
      reads = 0;
      expect(await fasterThan(counting, 'lb', 1000, s)).toBe(
        times.filter((t) => t < s).length
      );
      expect(reads).toBeLessThanOrEqual(11);
    }
    expect(await fasterThan(store, 'empty', 0, 1800)).toBe(0);
  });
});
