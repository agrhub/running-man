import { ARCADE_IDS, ARCADE_INFO, type ArcadeId } from '../../shared/arcade';

export type PlayGame = 'dash' | ArcadeId;

export const PLAY_GAMES: PlayGame[] = ['dash', ...ARCADE_IDS];

export const GAME_INFO: Record<
  PlayGame,
  { name: string; icon: string; rules: string }
> = {
  dash: {
    name: 'Snack Dash',
    icon: '🍰',
    rules:
      '20 seconds, three lanes. Catch 🍬 🥤 💧 for 10 points and 🍰 for 30. Dodge 🚧 (−20) and 💦. Five snacks in a row double your points, ten triple them.',
  },
  ...ARCADE_INFO,
};
