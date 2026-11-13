import type { DashBoard, Profile } from '../../shared/api';
import { Avatar } from '../components/Avatar';
import {
  DASH_MAX_REWARD,
  DASH_MAX_ROUNDS,
  DASH_PAID_ROUNDS,
} from '../../shared/dash';
import { COIN } from '../../shared/economy';

export type DashResult = { score: number; reward: number };

type Props = {
  today: string;
  profile: Profile;
  board: DashBoard | null;
  last: DashResult | null;
  busy: boolean;
  onPlay: () => void;
};

export const PlayScreen = ({
  today,
  profile,
  board,
  last,
  busy,
  onPlay,
}: Props) => {
  const guest = profile.username === 'guest';
  const plays = profile.dash.date === today ? profile.dash.plays : 0;
  const best = profile.dash.date === today ? profile.dash.best : 0;
  const paidLeft = Math.max(0, DASH_PAID_ROUNDS - plays);
  const left = DASH_MAX_ROUNDS - plays;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6 max-w-[440px] mx-auto">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-[26px] font-extrabold">Snack Dash</h1>
        <p className="font-display text-[18px] font-extrabold">
          {COIN} {profile.badges}
        </p>
      </header>

      {last && (
        <section
          className="pop-in bib px-4 py-3 text-center"
          aria-label="Your last round"
        >
          <p className="text-[13px] font-extrabold text-ink-soft">
            Round {plays} done
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
        <p className="text-[14px] leading-snug">
          20 seconds, three lanes. Catch 🍬 🥤 💧 for 10 points and 🍰 for 30.
          Dodge 🚧 (−20) and 💦. Five snacks in a row double your points, ten
          triple them.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl bg-[var(--sky)] py-1.5">
            <p className="font-display text-[20px] font-extrabold leading-none tabular">
              {best}
            </p>
            <p className="text-[11px] font-extrabold text-ink-soft">
              best today
            </p>
          </div>
          <div className="rounded-xl bg-[var(--sky)] py-1.5">
            <p className="font-display text-[20px] font-extrabold leading-none tabular">
              {paidLeft}
            </p>
            <p className="text-[11px] font-extrabold text-ink-soft">
              paid rounds left
            </p>
          </div>
          <div className="rounded-xl bg-[var(--sky)] py-1.5">
            <p className="font-display text-[20px] font-extrabold leading-none tabular">
              {left}
            </p>
            <p className="text-[11px] font-extrabold text-ink-soft">
              rounds left
            </p>
          </div>
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
                ? `Play round ${plays + 1} (up to ${DASH_MAX_REWARD} ${COIN})`
                : `Play round ${plays + 1} for fun`}
        </button>
        <p className="mt-1 text-[11px] text-ink-soft">
          Everyone gets the same course for each round, and the server checks
          every score.
        </p>
      </section>

      <section
        className="rounded-2xl border-2 border-ink bg-white/80 px-2 py-2"
        aria-label="Today’s best Snack Dash scores"
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
