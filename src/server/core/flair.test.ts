import { describe, expect, it } from 'vitest';
import { freshProfile } from './game';
import { FLAIR_MAX, finisherCity, flairText } from './flair';

describe('runner flair', () => {
  it('needs a bib', () => {
    expect(flairText(freshProfile('a'))).toBeNull();
  });

  it('shows the bib, stages, stamps and the latest finished city', () => {
    const p = {
      ...freshProfile('a'),
      bib: 19,
      totalRuns: 12,
      tourStamps: ['giza', 'petra', 'fuji'],
      stagesBySeason: { '0': 5, '1': 3, '2': 6 },
    };
    const city = finisherCity(p);
    expect(city).not.toBeNull();
    expect(flairText(p)).toBe(
      `🏃 #0019 · 12 stages · 🛂 3 · 🏅 ${city} Finisher`
    );
  });

  it('never runs past Reddit’s limit and has no commas', () => {
    const p = {
      ...freshProfile('a'),
      bib: 123456789,
      totalRuns: 99999,
      tourStamps: Array.from({ length: 24 }, (_, i) => `s${i}`),
      stagesBySeason: Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [String(i), 7])
      ),
    };
    const text = flairText(p)!;
    expect(text.length).toBeLessThanOrEqual(FLAIR_MAX);
    expect(text).not.toContain(',');
    expect(text.startsWith('🏃 #123456789')).toBe(true);
  });
});
