import { useState } from 'react';
import type { FriendRow, RunRecord } from '../../shared/api';
import {
  CHALLENGE_REWARD,
  MAX_CHALLENGES,
  cleanUsername,
  type Challenge,
} from '../../shared/challenge';
import { formatTime } from '../../shared/sim';
import { tr } from '../i18n';

/** On the plan screen: the runners who called you out today. */
export const ChallengedBy = ({ challenges }: { challenges: Challenge[] }) => {
  if (!challenges.length) return null;
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-[#fff4cf] px-3 py-2"
      aria-label={tr('Challenges for you')}
    >
      <p className="font-display text-[16px] font-extrabold">
        🏁 {tr('You have been challenged!')}
      </p>
      <ul className="text-[13px] font-bold">
        {challenges.map((c) => (
          <li key={c.from}>
            {tr('u/{name} ran {time}. Beat it for +{n} coins.', {
              name: c.from,
              time: formatTime(c.seconds),
              n: CHALLENGE_REWARD,
            })}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** On the result screen: how your run went against your challengers. */
export const ChallengeResults = ({ run }: { run: RunRecord }) => {
  if (!run.challenges?.length) return null;
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
      aria-label={tr('Challenge results')}
    >
      <h2 className="font-display text-[17px] font-extrabold">
        🏁 {tr('Challenges')}
      </h2>
      <ul className="text-[13px] font-bold">
        {run.challenges.map((c) => (
          <li key={c.from}>
            {c.beaten
              ? `✅ ${tr('You beat u/{name} ({time})', { name: c.from, time: formatTime(c.seconds) })}`
              : `❌ ${tr('u/{name} was faster ({time})', { name: c.from, time: formatTime(c.seconds) })}`}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** On the result screen: call out a friend (or any redditor) to beat your time. */
export const ChallengeBox = ({
  run,
  friends,
  busy,
  onChallenge,
}: {
  run: RunRecord;
  friends: FriendRow[];
  busy: boolean;
  onChallenge: (username: string) => void;
}) => {
  const [name, setName] = useState('');
  const done = run.challenged ?? [];
  const left = MAX_CHALLENGES - done.length;
  const valid = cleanUsername(name);
  const suggest = friends
    .filter(
      (f) =>
        f.seconds === null &&
        !done.some((d) => d.toLowerCase() === f.username.toLowerCase())
    )
    .slice(0, 6);
  return (
    <section
      className="rounded-2xl border-2 border-ink bg-white/80 px-3 py-2"
      aria-label={tr('Challenge a friend')}
    >
      <h2 className="font-display text-[17px] font-extrabold">
        🏁 {tr('Challenge a friend')}
      </h2>
      <p className="text-[12px] leading-snug text-ink-soft">
        {tr(
          'Mention someone in a comment on today’s post. If they beat {time}, they win {n} coins.',
          { time: formatTime(run.seconds), n: CHALLENGE_REWARD }
        )}
      </p>
      {done.length > 0 && (
        <p className="mt-1 text-[12px] font-bold">
          {tr('Challenged: {names}', {
            names: done.map((d) => `u/${d}`).join(', '),
          })}
        </p>
      )}
      {left > 0 ? (
        <>
          {suggest.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggest.map((f) => (
                <button
                  key={f.username}
                  type="button"
                  disabled={busy}
                  onClick={() => onChallenge(f.username)}
                  className="chunky rounded-full bg-[#e3f6ff] px-2.5 py-0.5 text-[12px] font-extrabold"
                >
                  u/{f.username}
                </button>
              ))}
            </div>
          )}
          <form
            className="mt-1.5 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              onChallenge(valid);
              setName('');
            }}
          >
            <label className="sr-only" htmlFor="challenge-name">
              {tr('Reddit username')}
            </label>
            <input
              id="challenge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="u/username"
              autoComplete="off"
              autoCapitalize="off"
              className="min-w-0 flex-1 rounded-full border-2 border-ink bg-white px-3 py-1 text-[14px]"
            />
            <button
              type="submit"
              disabled={busy || !valid}
              className="chunky rounded-full bg-[var(--accent)] px-3 py-1 text-[14px] font-extrabold text-white"
            >
              {tr('Challenge')}
            </button>
          </form>
          <p className="mt-1 text-[11px] text-ink-soft">
            {tr('{n} left today', { n: left })}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[12px] font-bold">
          {tr('That is all your challenges for today.')}
        </p>
      )}
    </section>
  );
};
