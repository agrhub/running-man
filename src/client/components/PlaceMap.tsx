import { useId } from 'react';
import { AREA_MAPS, WORLD_MAP } from '../lib/mapData';
import { onArea, onWorld } from '../lib/geo';

const OCEAN = '#bfe3f5';
const LAND = '#f4eedc';
const COAST = '#d5c9a6';
const INK = '#2a2340';

export type Pin = {
  at: [number, number];
  /** Short text inside the pin (a stage number), or none for a dot. */
  mark?: string;
  /** Shown beside the highlighted pin. */
  label?: string;
  tone: 'now' | 'done' | 'other';
  title: string;
};

const PIN_FILL = { now: '#ff5d8f', done: '#3fae6a', other: '#ffffff' };

const Pins = ({
  pins,
  place,
  r,
  w,
  path,
}: {
  pins: Pin[];
  place: (at: [number, number]) => { x: number; y: number };
  r: number;
  w: number;
  /** Join the pins in order with a dashed line. */
  path?: boolean | undefined;
}) => {
  const pts = pins.map((p) => place(p.at));
  const now = pins.findIndex((p) => p.tone === 'now');
  return (
    <>
      {path && pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={INK}
          strokeWidth={r * 0.28}
          strokeDasharray={`${r * 0.7} ${r * 0.55}`}
          opacity={0.55}
        />
      )}
      {pins.map((p, i) => {
        const pt = pts[i]!;
        const big = p.tone === 'now';
        const rr = big ? r * 1.35 : r;
        return (
          <g key={i}>
            <title>{p.title}</title>
            {big && (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={rr * 1.9}
                fill={PIN_FILL.now}
                opacity={0.25}
              />
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={rr}
              fill={PIN_FILL[p.tone]}
              stroke={INK}
              strokeWidth={r * 0.28}
            />
            {p.mark && (
              <text
                x={pt.x}
                y={pt.y + rr * 0.42}
                fontSize={rr * 1.15}
                fontWeight={800}
                textAnchor="middle"
                fill={p.tone === 'other' ? INK : '#fff'}
              >
                {p.mark}
              </text>
            )}
          </g>
        );
      })}
      {now >= 0 &&
        pins[now]!.label &&
        (() => {
          const pt = pts[now]!;
          const left = pt.x > w * 0.6;
          return (
            <text
              x={pt.x + (left ? -r * 2.4 : r * 2.4)}
              y={pt.y + r * 0.45}
              fontSize={r * 1.45}
              fontWeight={800}
              fill={INK}
              textAnchor={left ? 'end' : 'start'}
              stroke="#fff"
              strokeWidth={r * 0.5}
              paintOrder="stroke"
            >
              {pins[now]!.label}
            </text>
          );
        })()}
    </>
  );
};

/** The whole world with pins on the real places. */
export const WorldMap = ({
  pins,
  path,
  label,
}: {
  pins: Pin[];
  path?: boolean | undefined;
  label: string;
}) => (
  <svg
    viewBox={`0 0 ${WORLD_MAP.w} ${WORLD_MAP.h}`}
    className="block w-full h-auto rounded-xl border-2 border-ink"
    style={{ background: OCEAN }}
    role="img"
    aria-label={label}
  >
    <path d={WORLD_MAP.land} fill={LAND} stroke={COAST} strokeWidth={0.6} />
    <Pins pins={pins} place={onWorld} r={9} w={WORLD_MAP.w} path={path} />
  </svg>
);

/** A close map of a city or a region, with its real coastline, rivers and lakes. */
export const AreaMap = ({
  area,
  pins,
  path,
  label,
}: {
  area: string;
  pins: Pin[];
  path?: boolean | undefined;
  label: string;
}) => {
  const m = AREA_MAPS[area];
  const clip = useId();
  if (!m) return null;
  return (
    <svg
      viewBox={`0 0 ${m.w} ${m.h}`}
      className="block w-full h-auto rounded-xl border-2 border-ink"
      style={{ background: OCEAN }}
      role="img"
      aria-label={label}
    >
      <clipPath id={clip}>
        <rect width={m.w} height={m.h} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={m.land} fill={LAND} stroke={COAST} strokeWidth={0.8} />
        {(m.water ?? []).map((wt, i) =>
          wt.w === 0 ? (
            <path
              key={i}
              d={wt.d}
              fill={OCEAN}
              stroke={COAST}
              strokeWidth={0.6}
            />
          ) : (
            <path
              key={i}
              d={wt.d}
              fill="none"
              stroke={OCEAN}
              strokeWidth={wt.w}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        )}
        <Pins
          pins={pins}
          place={(at) => onArea(m, at)}
          r={6}
          w={m.w}
          path={path}
        />
      </g>
    </svg>
  );
};
