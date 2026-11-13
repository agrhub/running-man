import type { LeaderRow, WeeklyBoard } from '../../shared/api';
import { Avatar } from './Avatar';
import { formatTime } from '../../shared/sim';

type Props = {
  rows: LeaderRow[];
  me: string;
  myRank: number | null;
  canCheer: boolean;
  onCheer?: (username: string) => void;
};

const medal = (rank: number) =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;

export const Leaderboard = ({ rows, me, myRank, canCheer, onCheer }: Props) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-soft">No one has run this stage yet.</p>
    );
  }
  const meVisible = rows.some((r) => r.username === me);
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((r) => (
        <li
          key={r.username}
          className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[14px] ${r.username === me ? 'bg-[var(--sky)] font-extrabold' : ''}`}
        >
          <span className="w-7 text-center font-display font-extrabold tabular">
            {medal(r.rank)}
          </span>
          <Avatar name={r.username} size={24} />
          <span className="flex-1 truncate">u/{r.username}</span>
          <span className="tabular font-display font-semibold">
            {formatTime(r.seconds)}
          </span>
          {onCheer && canCheer && r.username !== me && (
            <button
              type="button"
              className="chunky rounded-full bg-gold px-2 text-[12px] font-extrabold"
              onClick={() => onCheer(r.username)}
              aria-label={`Cheer for ${r.username}`}
            >
              👏
            </button>
          )}
        </li>
      ))}
      {!meVisible && myRank !== null && (
        <li className="px-2 text-[13px] text-ink-soft">You are #{myRank}.</li>
      )}
    </ol>
  );
};

/** This week's standings: most stages first, then the lowest total time. */
export const WeeklyStandings = ({
  board,
  me,
}: {
  board: WeeklyBoard;
  me: string;
}) => {
  if (board.rows.length === 0) {
    return (
      <p className="px-2 text-sm text-ink-soft">
        No one has run this week yet.
      </p>
    );
  }
  const meVisible = board.rows.some((r) => r.username === me);
  return (
    <ol className="flex flex-col gap-1">
      {board.rows.map((r) => (
        <li
          key={r.username}
          className={`flex items-center gap-2 rounded-xl px-2 py-1 text-[14px] ${r.username === me ? 'bg-[var(--sky)] font-extrabold' : ''}`}
        >
          <span className="w-7 text-center font-display font-extrabold tabular">
            {medal(r.rank)}
          </span>
          <Avatar name={r.username} size={24} />
          <span className="flex-1 truncate">u/{r.username}</span>
          <span className="text-[12px] font-extrabold text-ink-soft tabular">
            {r.stages} {r.stages === 1 ? 'stage' : 'stages'}
          </span>
          <span className="w-[62px] text-right tabular font-display font-semibold">
            {formatTime(r.seconds)}
          </span>
        </li>
      ))}
      {!meVisible && board.mine && (
        <li className="px-2 text-[13px] text-ink-soft">
          You are #{board.mine.rank} with {board.mine.stages}{' '}
          {board.mine.stages === 1 ? 'stage' : 'stages'}.
        </li>
      )}
    </ol>
  );
};
