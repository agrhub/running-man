import { useMemo } from 'react';
import {
  LEG_LABEL,
  legAt,
  isTriathlon,
  type DayInfo,
} from '../../shared/content';
import {
  courseItems,
  isBooster,
  isPickup,
  isRoadLife,
  type ItemKind,
} from '../../shared/course';
import { hashString, mulberry32 } from '../../shared/rng';

type Props = {
  day: DayInfo;
  /** Water stops in the current plan; the others are drawn faded. */
  drinks: number[];
  /** Road life (people, traffic, animals) can be switched off by moderators. */
  life: boolean;
};

const W = 320;
const H = 190;

const BOOSTER_ICON: Partial<Record<ItemKind, string>> = {
  skates: '🛼',
  skateboard: '🛹',
  bike: '🚲',
};

/** Colour of a kilometre by its average grade. */
const gradeColor = (g: number) =>
  g <= -1 ? '#3fae6a' : g < 1 ? '#8c86ad' : g < 3 ? '#f0a030' : '#e0524f';

type Pt = { x: number; y: number };

/** A smooth line through the points (Catmull-Rom), sampled `n` times per span. */
const smooth = (pts: Pt[], n: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
};

/**
 * A race-day route map of the 6 km: the course drawn as a winding line coloured
 * by how steep each kilometre is, with the water stops, the landmark, the
 * boosters on the road, and how busy each kilometre is with obstacles and snacks.
 * Everything comes from the same seeded course the race uses, so the map is
 * exactly what you will run.
 */
export const RouteMap = ({ day, drinks, life }: Props) => {
  const tri = isTriathlon(day);
  const { stage } = day;

  const items = useMemo(
    () =>
      courseItems(day.dateKey, stage, day.weather.id, {
        city: day.city.id,
        time: day.time,
        triathlon: tri,
        life,
      }),
    [day, stage, tri, life]
  );

  const path = useMemo(() => {
    // Seven nodes (km 0 to 6) snake up the map; the stage name sets the bends.
    const rand = mulberry32(hashString(`route:${stage.name}`));
    const nodes: Pt[] = [];
    for (let km = 0; km <= 6; km++) {
      const side = km % 2 === 0 ? 0.22 : 0.78;
      nodes.push({
        x: 30 + (W - 60) * (side + (rand() - 0.5) * 0.3),
        y: H - 18 - (km / 6) * (H - 40) + (rand() - 0.5) * 8,
      });
    }
    return smooth(nodes, 16);
  }, [stage.name]);

  /** A point on the line at a distance in km. */
  const at = (km: number): Pt => {
    const f = Math.max(0, Math.min(6, km)) * 16;
    const i = Math.floor(f);
    const a = path[Math.min(i, path.length - 1)]!;
    const b = path[Math.min(i + 1, path.length - 1)]!;
    const t = f - i;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  const perKm = Array.from({ length: 6 }, (_, k) => {
    const inKm = items.filter((it) => it.km >= k && it.km < k + 1);
    return {
      hazards: inKm.filter(
        (it) =>
          it.kind === 'cone' ||
          it.kind === 'puddle' ||
          it.kind === 'cups' ||
          isRoadLife(it.kind)
      ).length,
      snacks: inKm.filter((it) => isPickup(it.kind)).length,
    };
  });
  const boosters = items.filter((it) => isBooster(it.kind));
  /** A point beside the line: `side` 1 is left of the running direction. */
  const beside = (km: number, dist: number, side: 1 | -1): Pt => {
    const p = at(km);
    const a = at(km - 0.05);
    const b = at(km + 0.05);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: p.x + (dy / len) * dist * side,
      y: p.y - (dx / len) * dist * side,
    };
  };
  const onLine = at(stage.landmark.km);
  const lmSide: 1 | -1 = onLine.y > H / 2 ? 1 : -1;
  const lm = beside(stage.landmark.km, 16, lmSide);
  const lmLeft = lm.x > W / 2;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto rounded-xl border-2 border-ink bg-[#f4f1ff]"
        role="img"
        aria-label={`Route map of ${stage.name}: ${stage.landmark.name} at km ${stage.landmark.km}, water after km ${stage.waterAfterKm.join(' and ')}, ${boosters.length} boosters on the road.`}
      >
        {/* Course, one coloured span per kilometre, over a dark casing. */}
        <polyline
          points={path.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#2a2340"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {stage.grades.map((g, k) => (
          <polyline
            key={k}
            points={path
              .slice(k * 16, k * 16 + 17)
              .map((p) => `${p.x},${p.y}`)
              .join(' ')}
            fill="none"
            stroke={tri && k === 0 ? '#3aa0e6' : gradeColor(g)}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Landmark, labelled on the open side of the map. */}
        <g>
          <line
            x1={onLine.x}
            y1={onLine.y}
            x2={lm.x}
            y2={lm.y}
            stroke="#2a2340"
            strokeWidth={1.5}
          />
          <circle
            cx={lm.x}
            cy={lm.y}
            r={7}
            fill="#ffd36e"
            stroke="#2a2340"
            strokeWidth={2}
          />
          <text
            x={lm.x}
            y={lm.y + 3.5}
            fontSize={9}
            textAnchor="middle"
            aria-hidden
          >
            ★
          </text>
          <text
            x={lm.x + (lmLeft ? -11 : 11)}
            y={lm.y + 4}
            fontSize={10}
            fontWeight={800}
            fill="#2a2340"
            textAnchor={lmLeft ? 'end' : 'start'}
            stroke="#f4f1ff"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {stage.landmark.name}
          </text>
        </g>

        {/* Water stations: full when your plan drinks there. */}
        {stage.waterAfterKm.map((w) => {
          const p = beside(w, 13, lmSide === 1 ? -1 : 1);
          return (
            <text
              key={`w${w}`}
              x={p.x}
              y={p.y + 5}
              textAnchor="middle"
              fontSize={13}
              opacity={drinks.includes(w) ? 1 : 0.35}
            >
              💧
            </text>
          );
        })}

        {/* Boosters lying on the road. */}
        {boosters.map((b, i) => {
          const p = beside(b.km, 13, lmSide === 1 ? -1 : 1);
          return (
            <text
              key={`b${i}`}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={12}
            >
              {BOOSTER_ICON[b.kind]}
            </text>
          );
        })}

        {/* Kilometre marks, start and finish. */}
        {[1, 2, 3, 4, 5].map((km) => {
          const p = at(km);
          return (
            <g key={km}>
              <circle
                cx={p.x}
                cy={p.y}
                r={6.5}
                fill="#fff"
                stroke="#2a2340"
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y + 3.5}
                fontSize={9}
                fontWeight={800}
                textAnchor="middle"
                fill="#2a2340"
              >
                {km}
              </text>
            </g>
          );
        })}
        {(() => {
          const s = at(0);
          const f = at(6);
          return (
            <>
              <circle
                cx={s.x}
                cy={s.y}
                r={8}
                fill="#3fae6a"
                stroke="#2a2340"
                strokeWidth={2}
              />
              <text
                x={s.x}
                y={s.y + 3.5}
                fontSize={9}
                fontWeight={800}
                textAnchor="middle"
                fill="#fff"
              >
                GO
              </text>
              <text x={f.x - 8} y={f.y + 6} fontSize={17}>
                🏁
              </text>
            </>
          );
        })()}
      </svg>

      {/* What each kilometre holds. */}
      <ol className="mt-1.5 grid grid-cols-6 gap-1 text-center text-[10px] font-bold leading-tight">
        {perKm.map((k, i) => (
          <li
            key={i}
            className="rounded-lg border-2 border-ink/15 bg-white px-0.5 py-0.5"
          >
            <span
              className="block font-extrabold"
              style={{
                color:
                  tri && i === 0 ? '#3aa0e6' : gradeColor(stage.grades[i]!),
              }}
            >
              {tri ? `${LEG_LABEL[legAt(true, i)].icon} ` : ''}km {i + 1}
            </span>
            <span className="block" aria-label={`${k.hazards} obstacles`}>
              ⚠️{k.hazards}
            </span>
            <span className="block" aria-label={`${k.snacks} snacks`}>
              🍬{k.snacks}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-1 text-[11px] leading-snug text-ink-soft">
        <span style={{ color: '#3fae6a' }}>■</span> downhill{' '}
        <span style={{ color: '#8c86ad' }}>■</span> flat{' '}
        <span style={{ color: '#f0a030' }}>■</span> climb{' '}
        <span style={{ color: '#e0524f' }}>■</span> steep · 💧 water · 🛼🛹🚲
        boosters · ★ {stage.landmark.name}
      </figcaption>
    </figure>
  );
};
