export type ZMember = { member: string; score: number };

/**
 * The subset of Devvit's Redis client the game uses. Devvit's `redis` satisfies
 * it directly; `createMemoryStore` implements it for tests and local play.
 */
export type Store = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<unknown>;
  incrBy(key: string, value: number): Promise<number>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  hMGet(key: string, fields: string[]): Promise<(string | null)[]>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  zAdd(key: string, ...members: ZMember[]): Promise<unknown>;
  zRange(
    key: string,
    start: number,
    stop: number,
    options: { by: 'rank' }
  ): Promise<ZMember[]>;
  zRank(key: string, member: string): Promise<number | undefined>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
};

export const createMemoryStore = (): Store => {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, Map<string, number>>();

  const hash = (key: string): Map<string, string> => {
    let h = hashes.get(key);
    if (!h) {
      h = new Map();
      hashes.set(key, h);
    }
    return h;
  };
  const zset = (key: string): Map<string, number> => {
    let z = zsets.get(key);
    if (!z) {
      z = new Map();
      zsets.set(key, z);
    }
    return z;
  };
  const sorted = (key: string): ZMember[] =>
    [...zset(key).entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));

  return {
    get: async (key) => strings.get(key),
    set: async (key, value) => {
      strings.set(key, value);
      return 'OK';
    },
    incrBy: async (key, value) => {
      const next = Number(strings.get(key) ?? '0') + value;
      strings.set(key, String(next));
      return next;
    },
    hGet: async (key, field) => hash(key).get(field),
    hSet: async (key, fieldValues) => {
      const h = hash(key);
      for (const [f, v] of Object.entries(fieldValues)) h.set(f, v);
      return Object.keys(fieldValues).length;
    },
    hMGet: async (key, fields) => fields.map((f) => hash(key).get(f) ?? null),
    hGetAll: async (key) => Object.fromEntries(hash(key)),
    hIncrBy: async (key, field, value) => {
      const h = hash(key);
      const next = Number(h.get(field) ?? '0') + value;
      h.set(field, String(next));
      return next;
    },
    zAdd: async (key, ...members) => {
      const z = zset(key);
      for (const m of members) z.set(m.member, m.score);
      return members.length;
    },
    zRange: async (key, start, stop) => {
      const all = sorted(key);
      const end = stop < 0 ? all.length + stop : stop;
      return all.slice(start, end + 1);
    },
    zRank: async (key, member) => {
      const idx = sorted(key).findIndex((m) => m.member === member);
      return idx < 0 ? undefined : idx;
    },
    zScore: async (key, member) => zset(key).get(member),
    zCard: async (key) => zset(key).size,
  };
};
