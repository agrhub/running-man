import { afterEach, describe, expect, it } from 'vitest';
import { setLang, tr, trServer } from './index';
import { VI } from './vi';
import { ES } from './es';

const holes = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  afterEach(async () => {
    await setLang('en');
  });

  it('shows English by default and fills in values', async () => {
    await setLang('en');
    expect(tr('Run today’s stage')).toBe('Run today’s stage');
    expect(tr('Day {n} of 7', { n: 3 })).toBe('Day 3 of 7');
  });

  it('translates to Vietnamese, and falls back to English for unknown text', async () => {
    await setLang('vi');
    expect(tr('Run today’s stage')).toBe('Chạy chặng hôm nay');
    expect(tr('Day {n} of 7', { n: 3 })).toBe('Ngày 3/7');
    expect(tr('Not a key yet')).toBe('Not a key yet');
  });

  it('reads server messages that carry values', async () => {
    await setLang('vi');
    expect(trServer('Day 4 check-in: +40 coins')).toBe(
      'Điểm danh ngày 4: +40 coin'
    );
    expect(trServer('Corgi loved that! Friendship 3.')).toBe(
      'Corgi thích lắm! Tình bạn 3.'
    );
    expect(trServer('Not enough coins yet. Keep running!')).toBe(
      'Chưa đủ coin. Chạy tiếp nhé!'
    );
  });

  it('translates to Spanish', async () => {
    await setLang('es');
    expect(tr('Run today’s stage')).toBe('Corre la etapa de hoy');
    expect(tr('Day {n} of 7', { n: 3 })).toBe('Día 3 de 7');
    expect(trServer('Quest done: +20 coins')).toBe(
      'Misión cumplida: +20 monedas'
    );
  });

  it('keeps every {value} in every Spanish text', () => {
    const bad = Object.entries(ES).filter(
      ([k, v]) => holes(k).join() !== holes(v).join()
    );
    expect(bad).toEqual([]);
  });

  it('keeps every {value} in every Vietnamese text', () => {
    const bad = Object.entries(VI).filter(
      ([k, v]) => holes(k).join() !== holes(v).join()
    );
    expect(bad).toEqual([]);
  });
});
