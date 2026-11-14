import { describe, expect, it } from 'vitest';
import { CITIES } from '../../shared/content';
import { TOUR } from '../../shared/tour';
import { readableAccent, whiteContrast } from './theme';

describe('readable accent', () => {
  it('gives white button text at least 3:1 on every city and tour colour', () => {
    const accents = [
      ...CITIES.map((c) => c.palette.accent),
      ...TOUR.map((t) => t.palette.accent),
      '#ff5d8f',
    ];
    for (const a of accents) {
      expect(whiteContrast(readableAccent(a))).toBeGreaterThanOrEqual(3);
      expect(whiteContrast(readableAccent(a, 4.5))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves colours that already pass alone', () => {
    expect(readableAccent('#2f4bdb')).toBe('#2f4bdb');
  });
});
