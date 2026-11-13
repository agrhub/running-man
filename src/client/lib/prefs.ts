import { useEffect, useState } from 'react';

/**
 * Per-player comfort options, kept in this browser only: calmer motion (no
 * flashes, less falling snow and rain), bigger steering buttons, steering on
 * one side for one-thumb play, and vibration.
 */
export type Hand = 'both' | 'left' | 'right';

export type Prefs = {
  calm: boolean;
  bigControls: boolean;
  hand: Hand;
  vibration: boolean;
};

const KEY = 'rm-prefs';

const systemCalm = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const read = (): Prefs => {
  const base: Prefs = {
    calm: typeof window !== 'undefined' && systemCalm(),
    bigControls: false,
    hand: 'both',
    vibration: true,
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Prefs>;
    return {
      calm: typeof saved.calm === 'boolean' ? saved.calm : base.calm,
      bigControls:
        typeof saved.bigControls === 'boolean'
          ? saved.bigControls
          : base.bigControls,
      hand:
        saved.hand === 'left' || saved.hand === 'right' ? saved.hand : 'both',
      vibration: typeof saved.vibration === 'boolean' ? saved.vibration : true,
    };
  } catch {
    return base;
  }
};

let current: Prefs = typeof window === 'undefined' ? read() : read();
const listeners = new Set<(p: Prefs) => void>();

const apply = (p: Prefs) => {
  if (typeof document === 'undefined') return;
  if (p.calm) document.documentElement.dataset.calm = '1';
  else delete document.documentElement.dataset.calm;
};
apply(current);

export const prefs = () => current;

export const setPrefs = (patch: Partial<Prefs>) => {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit.
  }
  apply(current);
  listeners.forEach((l) => l(current));
};

export const usePrefs = (): Prefs => {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
};
