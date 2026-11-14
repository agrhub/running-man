import { describe, expect, it } from 'vitest';
import { formatCountdown, secondsToNextStage } from './countdown';

describe('next stage countdown', () => {
  it('counts down to the next UTC midnight', () => {
    expect(secondsToNextStage(Date.UTC(2026, 10, 15, 23, 59, 30))).toBe(30);
    expect(secondsToNextStage(Date.UTC(2026, 10, 15, 0, 0, 0))).toBe(86400);
    expect(secondsToNextStage(Date.UTC(2026, 11, 31, 18, 0, 0))).toBe(6 * 3600);
  });
  it('formats hours, minutes and seconds', () => {
    expect(formatCountdown(5 * 3600 + 7 * 60 + 9)).toBe('5:07:09');
    expect(formatCountdown(59)).toBe('0:00:59');
  });
});
