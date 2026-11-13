import { useEffect, useState } from 'react';
import type { AvatarsResponse } from '../../shared/api';
import { request } from '../lib/api';

/**
 * Each player's own Reddit avatar. Lookups from everywhere on screen are batched
 * into one request; a player without an avatar, or an image that cannot load,
 * gets a coloured initial instead.
 */
const cache = new Map<string, string | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: number | null = null;

const flush = () => {
  timer = null;
  const names = [...waiting].slice(0, 50);
  names.forEach((n) => waiting.delete(n));
  if (names.length === 0) return;
  request<AvatarsResponse>(
    `/avatars?u=${names.map(encodeURIComponent).join(',')}`
  )
    .then((r) => {
      for (const n of names) cache.set(n, r.avatars[n] ?? null);
    })
    .catch(() => {
      for (const n of names) cache.set(n, null);
    })
    .finally(() => {
      listeners.forEach((l) => l());
      if (waiting.size > 0) timer = window.setTimeout(flush, 30);
    });
};

const want = (name: string) => {
  if (cache.has(name) || waiting.has(name)) return;
  waiting.add(name);
  timer ??= window.setTimeout(flush, 30);
};

const useAvatar = (name: string): string | null | undefined => {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    want(name);
    return () => {
      listeners.delete(l);
    };
  }, [name]);
  return cache.get(name);
};

const hue = (name: string) =>
  [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

type Props = { name: string; size?: number; ring?: boolean };

export const Avatar = ({ name, size = 28, ring = false }: Props) => {
  const url = useAvatar(name);
  const [broken, setBroken] = useState(false);
  const box = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
  } as const;
  const border = ring ? 'border-2 border-ink' : 'border border-ink/30';
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`rounded-full bg-white object-cover object-top ${border}`}
        style={box}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid place-items-center rounded-full font-display font-extrabold text-ink ${border}`}
      style={{
        ...box,
        background: `hsl(${hue(name)} 75% 82%)`,
        fontSize: size * 0.48,
      }}
    >
      {name
        .replace(/^[^a-z0-9]*/i, '')
        .charAt(0)
        .toUpperCase() || '?'}
    </span>
  );
};
