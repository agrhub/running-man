import type { City } from '../../shared/content';
import type { Pace } from '../../shared/sim';

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const luminance = ([r, g, b]: readonly number[]) =>
  0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
/** Contrast ratio of white text on a colour. */
export const whiteContrast = (hex: string) =>
  1.05 / (luminance(rgb(hex)) + 0.05);

/**
 * The accent darkened just enough that white text on it reaches 3:1, the
 * WCAG minimum for the large bold text on the game's buttons.
 */
export const readableAccent = (hex: string, ratio = 3): string => {
  let [r, g, b] = rgb(hex);
  const ink = [42, 35, 64];
  for (let i = 0; i < 40 && whiteContrast(toHex(r, g, b)) < ratio + 0.05; i++) {
    r = Math.round(r + (ink[0]! - r) * 0.06);
    g = Math.round(g + (ink[1]! - g) * 0.06);
    b = Math.round(b + (ink[2]! - b) * 0.06);
  }
  return toHex(r, g, b);
};
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const applyCityTheme = (city: City) => {
  const root = document.documentElement.style;
  root.setProperty('--accent', readableAccent(city.palette.accent));
  // Smaller white text (under 19 px bold) needs 4.5:1.
  root.setProperty('--accent-ink', readableAccent(city.palette.accent, 4.5));
  root.setProperty('--sky', city.palette.sky);
  root.setProperty('--sky-low', city.palette.skyLow);
};

export const PACE_COLOR: Record<Pace, string> = {
  easy: 'var(--color-easy)',
  steady: 'var(--color-steady)',
  push: 'var(--color-push)',
};

export const PACE_HINT: Record<Pace, string> = {
  easy: 'Easy saves stamina',
  steady: 'Steady is balanced',
  push: 'Push is fast but tiring',
};
