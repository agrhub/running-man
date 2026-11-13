import { describe, expect, it } from 'vitest';
import {
  holidayBanner,
  holidayMultiplier,
  isChristmasRun,
  isHolidaySeason,
} from './festive';

describe('holiday season', () => {
  it('runs through December, with the Christmas Run on the 25th', () => {
    expect(isHolidaySeason('2026-11-30')).toBe(false);
    expect(isHolidaySeason('2026-12-01')).toBe(true);
    expect(isHolidaySeason('2026-12-31')).toBe(true);
    expect(isChristmasRun('2026-12-25')).toBe(true);
    expect(isChristmasRun('2026-12-24')).toBe(false);
    expect(holidayMultiplier('2026-12-25')).toBe(2);
    expect(holidayMultiplier('2026-12-08')).toBe(1);
    expect(holidayBanner('2026-11-13')).toBeNull();
    expect(holidayBanner('2026-12-08')).toMatch(/Holiday season/);
    expect(holidayBanner('2026-12-25')).toMatch(/Christmas Run/);
  });
});
