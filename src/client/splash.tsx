import './index.css';

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { SplashResponse } from '../shared/api';
import { dayInfo, toDateKey, type City } from '../shared/content';
import { hashString, mulberry32 } from '../shared/rng';
import { CrewBar } from './components/CrewBar';
import { request } from './lib/api';
import { applyCityTheme } from './lib/theme';

/** Skyline + a little SVG chibi: the feed card stays light, no 3D here. */
const Scene = ({ city }: { city: City }) => {
  const rand = mulberry32(hashString(city.id));
  const blocks = Array.from({ length: 14 }, (_, i) => ({
    x: i * 30 + rand() * 6,
    w: 22 + rand() * 12,
    h: 30 + rand() * 60,
    c: city.palette.buildings[i % city.palette.buildings.length] ?? '#fff',
  }));
  return (
    <svg
      viewBox="0 0 420 130"
      className="absolute inset-x-0 bottom-0 w-full"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      {blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={110 - b.h}
          width={b.w}
          height={b.h}
          rx={3}
          fill={b.c}
          stroke="#2a2340"
          strokeWidth={2}
        />
      ))}
      <rect x={0} y={108} width={420} height={22} fill={city.palette.road} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={i * 38}
          y={118}
          width={20}
          height={3}
          rx={1.5}
          fill={city.palette.roadLine}
        />
      ))}
      <g transform="translate(300 64)">
        <ellipse cx={4} cy={44} rx={16} ry={3} fill="#2a2340" opacity={0.2} />
        <rect
          x={-3}
          y={26}
          width={7}
          height={15}
          rx={3.5}
          fill="#3d3a5c"
          transform="rotate(25 0 26)"
        />
        <rect
          x={2}
          y={26}
          width={7}
          height={15}
          rx={3.5}
          fill="#3d3a5c"
          transform="rotate(-25 5 26)"
        />
        <rect
          x={-6}
          y={12}
          width={18}
          height={18}
          rx={8}
          fill={city.palette.accent}
          stroke="#2a2340"
          strokeWidth={2}
        />
        <circle
          cx={3}
          cy={2}
          r={14}
          fill="#ffe0c7"
          stroke="#2a2340"
          strokeWidth={2}
        />
        <path
          d="M-11 1 A14 14 0 0 1 17 1 Q9 -4 3 -3 Q-4 -2 -11 1 Z"
          fill="#2b2118"
        />
        <circle cx={10} cy={3} r={2} fill="#2a2340" />
        <circle cx={12} cy={8} r={2.4} fill="#ff9fb2" />
      </g>
      <g transform="translate(270 98)">
        <ellipse
          cx={0}
          cy={6}
          rx={12}
          ry={7}
          fill="#e9a052"
          stroke="#2a2340"
          strokeWidth={2}
        />
        <circle
          cx={12}
          cy={-1}
          r={6}
          fill="#e9a052"
          stroke="#2a2340"
          strokeWidth={2}
        />
        <path
          d="M8 -5 L9 -12 L13 -6 Z"
          fill="#e9a052"
          stroke="#2a2340"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <circle cx={15} cy={-2} r={1.4} fill="#2a2340" />
      </g>
    </svg>
  );
};

export const Splash = () => {
  const [data, setData] = useState<SplashResponse | null>(null);
  const dateKey = data?.dateKey ?? toDateKey(new Date());
  const day = useMemo(() => dayInfo(dateKey), [dateKey]);
  const closed = data !== null && data.dateKey !== data.today;

  useEffect(() => {
    applyCityTheme(day.city);
  }, [day]);

  useEffect(() => {
    request<SplashResponse>('/splash')
      .then(setData)
      .catch(() => undefined);
  }, []);

  const cta = closed
    ? 'See the results'
    : data?.ran
      ? 'See my result'
      : 'Run today’s stage';

  return (
    <div className="relative h-full overflow-hidden">
      <Scene city={day.city} />
      <div className="relative flex h-full flex-col gap-2 px-4 pt-3 pb-[132px] max-w-[460px] mx-auto">
        <p className="font-display text-[15px] font-extrabold text-[var(--accent)] [text-shadow:0_1.5px_0_#2a2340]">
          Chibi City Marathon
        </p>
        <div>
          <p className="text-[13px] font-extrabold text-ink-soft">
            {day.city.flag} Day {day.dayIndex + 1}: {day.city.name}, stage{' '}
            {day.stageIndex + 1} of 7
          </p>
          <h1 className="font-display text-[30px] font-extrabold leading-[1.02]">
            {day.stage.name}
          </h1>
          <p className="text-[13px] font-bold">
            {day.weather.icon} {day.weather.label}
            {data && data.streak > 0
              ? `, and you are on a ${data.streak}-day streak 🔥`
              : ''}
          </p>
        </div>
        {data && <CrewBar crew={data.crew} runners={data.totalRunners} />}
        <button
          type="button"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          className="chunky mt-auto self-start rounded-2xl bg-[var(--accent)] px-5 py-2.5 font-display text-[20px] font-extrabold text-white"
        >
          {cta}
        </button>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
