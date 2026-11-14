import { describe, expect, it } from 'vitest';
import { addDays } from './content';
import { TOUR, featuredDaysLeft, featuredStop, featuredUntil } from './tour';

describe('free stop of the week', () => {
  it('stays the same Monday to Sunday and changes on Monday', () => {
    const monday = '2026-11-16';
    const week = Array.from({ length: 7 }, (_, i) =>
      featuredStop(addDays(monday, i))
    );
    expect(new Set(week.map((s) => s.id)).size).toBe(1);
    expect(featuredStop(addDays(monday, 7)).id).not.toBe(week[0]!.id);
    expect(featuredUntil('2026-11-18')).toBe('2026-11-22');
    expect(featuredDaysLeft(monday)).toBe(7);
    expect(featuredDaysLeft('2026-11-22')).toBe(1);
  });

  it('visits every stop once before repeating', () => {
    const seen = Array.from(
      { length: TOUR.length },
      (_, w) => featuredStop(addDays('2026-11-09', w * 7)).id
    );
    expect(new Set(seen).size).toBe(TOUR.length);
    expect(featuredStop(addDays('2026-11-09', TOUR.length * 7)).id).toBe(
      seen[0]
    );
    // Dates before the first season still work.
    expect(TOUR).toContain(featuredStop('2026-01-01'));
  });
});
