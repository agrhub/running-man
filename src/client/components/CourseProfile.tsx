import type { Stage } from '../../shared/content';
import type { KmSplit } from '../../shared/sim';
import { PACE_COLOR } from '../lib/theme';

type Props = {
  stage: Stage;
  /** Simulated splits for the current plan; draws the stamina line. */
  splits: KmSplit[];
  drinks: number[];
};

const W = 320;
const H = 104;
const PAD_X = 8;
const TOP = 14;
const BOTTOM = 84;

/** Elevation profile of the 6 km stage with the projected stamina line on top. */
export const CourseProfile = ({ stage, splits, drinks }: Props) => {
  const elev = [0];
  stage.grades.forEach((g, i) => elev.push((elev[i] ?? 0) + g * 10));
  const min = Math.min(...elev);
  const max = Math.max(...elev, min + 40);
  const x = (km: number) => PAD_X + (km / 6) * (W - PAD_X * 2);
  const y = (e: number) =>
    BOTTOM - 8 - ((e - min) / (max - min)) * (BOTTOM - TOP - 30);
  const ground = elev.map((e, i) => `${x(i)},${y(e)}`).join(' ');
  const stamina = [100, ...splits.map((s) => s.stamina)];
  const sy = (s: number) => TOP + (1 - s / 100) * (BOTTOM - TOP - 4);
  const walkKm = splits.find((s) => s.walked > 0)?.km;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Course profile for ${stage.name}`}
    >
      {splits.map((s, i) => (
        <rect
          key={s.km}
          x={x(i) + 1}
          y={BOTTOM}
          width={x(1) - x(0) - 2}
          height={6}
          rx={3}
          fill={PACE_COLOR[s.pace]}
        />
      ))}
      <polygon
        points={`${x(0)},${BOTTOM} ${ground} ${x(6)},${BOTTOM}`}
        fill="var(--accent)"
        opacity={0.16}
      />
      <polyline
        points={ground}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <polyline
        points={stamina.map((s, i) => `${x(i)},${sy(s)}`).join(' ')}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={2.5}
        strokeDasharray="5 4"
        strokeLinecap="round"
      />
      {stamina.map((s, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={sy(s)}
          r={s <= 0 ? 4.5 : 3}
          fill={s <= 0 ? 'var(--color-push)' : 'var(--color-gold)'}
          stroke="#2a2340"
          strokeWidth={1.2}
        />
      ))}
      {stage.waterAfterKm.map((km) => (
        <text
          key={km}
          x={x(km)}
          y={BOTTOM - 2}
          textAnchor="middle"
          fontSize={13}
          opacity={drinks.includes(km) ? 1 : 0.3}
        >
          💧
        </text>
      ))}
      <text
        x={x(stage.landmark.km)}
        y={y(elev[Math.round(stage.landmark.km)] ?? 0) - 6}
        textAnchor="middle"
        fontSize={12}
      >
        📍
      </text>
      {walkKm !== undefined && (
        <text
          x={x(walkKm - 0.5)}
          y={TOP + 2}
          textAnchor="middle"
          fontSize={10}
          fontWeight={800}
          fill="var(--color-push)"
        >
          walking!
        </text>
      )}
      {[0, 1, 2, 3, 4, 5, 6].map((km) => (
        <text
          key={km}
          x={x(km)}
          y={H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="#5d5574"
          fontWeight={700}
        >
          {km}
        </text>
      ))}
    </svg>
  );
};
