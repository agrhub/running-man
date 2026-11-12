import type { City } from '../../shared/content';
import type { Pace } from '../../shared/sim';

export const applyCityTheme = (city: City) => {
  const root = document.documentElement.style;
  root.setProperty('--accent', city.palette.accent);
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
