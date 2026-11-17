import { describe, expect, it } from 'vitest';
import { hiddenBottom } from './hiddenBottom';

describe('hidden bottom of the frame', () => {
  const frame = { top: 0, bottom: 844, height: 844 };
  it('measures the strip under a bottom toolbar', () => {
    expect(hiddenBottom(frame, { top: 0, bottom: 780 }, true)).toBe(64);
  });
  it('is zero when the whole frame shows', () => {
    expect(hiddenBottom(frame, { top: 0, bottom: 844 }, true)).toBe(0);
  });
  it('ignores a frame scrolled off the top or mostly off screen', () => {
    expect(hiddenBottom(frame, { top: 100, bottom: 844 }, true)).toBe(0);
    expect(hiddenBottom(frame, { top: 0, bottom: 300 }, true)).toBe(0);
    expect(hiddenBottom(frame, { top: 0, bottom: 0 }, false)).toBe(0);
  });
});
