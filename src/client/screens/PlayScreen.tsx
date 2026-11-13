import type { DashBoard, Profile } from '../../shared/api';
import { Avatar } from '../components/Avatar';
import {
  DASH_MAX_REWARD,
  DASH_MAX_ROUNDS,
  DASH_PAID_ROUNDS,
} from '../../shared/dash';
import {
  ARCADE_MAX_REWARD,
  ARCADE_MAX_ROUNDS,
  ARCADE_PAID_ROUNDS,
} from '../../shared/arcade';
import { COIN } from '../../shared/economy';
import { GAME_INFO, PLAY_GAMES } from '../lib/games';

export type DashResult = { score: number; reward: number };
export type { PlayGame } from '../lib/games';
import type { PlayGame } from '../lib/games';

type Props = {
  today: string;
  profile: Profile;
  game: PlayGame;
  board: DashBoard | null;
  last: DashResult | null;
  busy: boolean;
  onSelect: (game: PlayGame) => void;
  onPlay: () => void;
};

const dayOf = (p: Profile, g: PlayGame, today: string) => {
  const d = g === 'dash' ? p.dash : p.arcade[g];
  return d && d.date === today ? d : { plays: 0, best: 0 };
};

export const PlayScreen = ({
  today,
  profile,
  game,
  board,
  last,
  busy,
  onSelect,
  onPlay,
}: Props) => {
  const guest = profile.username === 'guest';
  const info = GAME_INFO[game];
  const { plays, best } = dayOf(profile, game, today);
  const paid = game === 'dash' ? DASH_PAID_ROUNDS : ARCADE_PAID_ROUNDS;
  const max = game === 'dash' ? DASH_MAX_ROUNDS : ARCADE_MAX_ROUNDS;
  const reward = game === 'dash' ? DASH_MAX_REWARD : ARCADE_MAX_REWARD;
  const paidLeft = Math.max(0, paid - plays);
  const left = max - plays;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-[26px] font-extrabold">Play</h1>
        <p className="font-display text-[18px] font-extrabold">
          {COIN} {profile.badges}
        </p>
      </header>

      <div
        className="grid grid-cols-2 gap-1.5"
        role="tablist"
        aria-label="Mini games"
      >
        {PLAY_GAMES.map((g) => {
          const on = g === game;
          const d = dayOf(profile, g, today);
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(g)}
              className={`flex items-center gap-2 rounded-2xl border-2 px-2 py-1.5 text-left ${on ? 'border-ink bg-white shadow-[0_3px_0_#2a2340]' : 'border-ink/25 bg-white/60'}`}
            >
              <span className="text-[24px]" aria-hidden>
                {GAME_INFO[g].icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-extrabold leading-tight">
                  {GAME_INFO[g].name}
                </span>
                <span className="block text-[11px] font-bold text-ink-soft">
                  {d.plays > 0 ? `best ${d.best} today` : 'not played today'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {last && (
        <section
          className="pop-in bib px-4 py-3 text-center"
          aria-label="Your last round"
        >
          <p className="text-[13px] font-extrabold text-ink-soft">
            {info.name}: round {plays} done
          </p>
          <p className="font-display text-[44px] font-extrabold leading-none text-[var(--accent)]">
            {last.score}
          </p>
          <p className="text-[14px] font-extrabold">
            {last.reward > 0
              ? `+${last.reward} ${COIN} coins`
              : 'Just for fun: no coins this round'}
          </p>
        </section>
      )}

      <section className="rounded-2xl border-2 border-ink bg-white/85 px-3 py-3">
        <h2 className="font-display text-[20px] font-extrabold leading-tight">
          {info.icon} {info.name}
        </h2>
        <p className="mt-1 text-[14px] leading-snug">{info.rules}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {[
            [best, 'best today'],
            [paidLeft, 'paid rounds left'],
            [left, 'rounds left'],
          ].map(([n, label]) => (
            <div key={label} className="rounded-xl bg-[var(--sky)] py-1.5">
              <p className="font-display text-[20px] font-extrabold leading-none tabular">
                {n}
              </p>
              <p className="text-[11px] font-extrabold text-ink-soft">
                {label}
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || guest || left <= 0}
          onClick={onPlay}
          className="chunky mt-3 w-full rounded-2xl bg-[var(--accent)] py-2.5 font-display text-[20px] font-extrabold text-white"
        >
          {guest
            ? 'Log in to play'
            : left <= 0
              ? 'Back tomorrow for more'
              : paidLeft > 0
                ? `Play round ${plays + 1} (up to ${reward} ${COIN})`
                : `Play round ${plays + 1} for fun`}
        </button>
        <p className="mt-1 text-[11px] text-ink-soft">
          Everyone gets the same course for each round, and the server checks
          every score.
        </p>
      </section>

      <section
        className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2"
        aria-label={`Today’s best ${info.name} scores`}
      >
        <h2 className="px-2 font-display text-[19px] font-extrabold">
          Today’s best
        </h2>
        {!board || board.rows.length === 0 ? (
          <p className="px-2 text-[13px] text-ink-soft">
            No scores yet. Be the first!
          </p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1">
            {board.rows.map((r) => (
              <li
                key={r.username}
                className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[14px] ${r.username === profile.username ? 'bg-[var(--sky)] font-extrabold' : ''}`}
              >
                <span className="w-7 text-center font-display font-extrabold">
                  {r.rank === 1
                    ? '🥇'
                    : r.rank === 2
                      ? '🥈'
                      : r.rank === 3
                        ? '🥉'
                        : r.rank}
                </span>
                <Avatar name={r.username} size={24} />
                <span className="flex-1 truncate">u/{r.username}</span>
                <span className="font-display font-semibold tabular">
                  {r.score}
                </span>
              </li>
            ))}
            {board.mine &&
              !board.rows.some((r) => r.username === board.mine?.username) && (
                <li className="px-2 text-[13px] text-ink-soft">
                  You are #{board.mine.rank} with {board.mine.score}.
                </li>
              )}
          </ol>
        )}
      </section>
    </div>
  );
};
