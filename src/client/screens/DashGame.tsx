import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  DASH_STEP,
  DASH_STEPS,
  DASH_TRAVEL,
  dashCourse,
  dashMultiplier,
  startDash,
  stepDash,
  type DashKind,
  type DashLane,
  type DashMove,
} from '../../shared/dash';
import {
  HAIR_TONES,
  SKIN_TONES,
  itemById,
  type Look,
} from '../../shared/economy';
import { sfx } from '../lib/sound';
import { tr } from '../i18n';

type Props = {
  dateKey: string;
  round: number;
  look: Look;
  bib: number | null;
  onDone: (moves: DashMove[], score: number) => void;
};

const EMOJI: Record<DashKind, string> = {
  candy: '🍬',
  soda: '🥤',
  bottle: '💧',
  cake: '🍰',
  cone: '🚧',
  puddle: '💦',
};

type Pop = { x: number; y: number; text: string; color: string; born: number };

/** Snack Dash on a 2D canvas: the road runs to the horizon, you run at the bottom. */
export const DashGame = ({ dateKey, round, look, bib, onDone }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laneRef = useRef<DashLane>(0);
  const doneRef = useRef(onDone);
  const [hud, setHud] = useState({ score: 0, combo: 0, left: 20, count: 3 });

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const steer = (dir: -1 | 1) => {
    const next = laneRef.current + dir;
    laneRef.current = (next < -1 ? -1 : next > 1 ? 1 : next) as DashLane;
  };
  const steerRef = useRef(steer);
  useEffect(() => {
    steerRef.current = steer;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        steerRef.current(-1);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        steerRef.current(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const course = dashCourse(dateKey, round);
    const state = startDash();
    const gone = new Set<number>();
    const pops: Pop[] = [];
    const tee = itemById(look.top)?.color ?? '#ff7a6b';
    const hair = HAIR_TONES[look.hair] ?? '#2b2118';
    const skin = SKIN_TONES[look.skin] ?? '#ffe0c7';
    const bibText = bib === null ? '' : String(bib).padStart(4, '0');
    let countdown = 2.4;
    let lastCount = 0;
    let acc = 0;
    let last = -1;
    let t = 0;
    let playerX = 0;
    let raf = 0;
    let reported = false;
    let lastHud = 0;

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    const draw = (stepF: number) => {
      const { w, h } = size();
      const horizon = h * 0.3;
      const runnerY = h * 0.8;
      const cx = w / 2;
      const roadTop = w * 0.12;
      const roadBottom = w * 1.05;
      const half = (y: number) =>
        (roadTop + ((y - horizon) / (h - horizon)) * (roadBottom - roadTop)) /
        2;

      // Sky and grass
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#ffd0dc');
      sky.addColorStop(1, '#ffeede');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = '#9fdc8a';
      ctx.fillRect(0, horizon, w, h - horizon);
      // Road
      ctx.fillStyle = '#4a4668';
      ctx.beginPath();
      ctx.moveTo(cx - roadTop / 2, horizon);
      ctx.lineTo(cx + roadTop / 2, horizon);
      ctx.lineTo(cx + roadBottom / 2, h);
      ctx.lineTo(cx - roadBottom / 2, h);
      ctx.closePath();
      ctx.fill();
      // Lane dashes, scrolling toward you
      ctx.fillStyle = '#ffd6df';
      for (const side of [-1, 1]) {
        for (let k = 0; k < 14; k++) {
          const p = ((k + ((stepF * 0.25) % 1)) / 14) ** 1.7;
          const y = horizon + p * (h - horizon);
          const x = cx + side * (half(y) / 3);
          const len = 4 + p * 26;
          ctx.fillRect(x - 1 - p * 2, y, 2 + p * 4, len);
        }
      }
      // Distant skyline
      ctx.fillStyle = 'rgba(42,35,64,0.12)';
      for (let k = 0; k < 9; k++) {
        const bw = w / 9;
        ctx.fillRect(
          k * bw + 4,
          horizon - 18 - ((k * 37) % 30),
          bw - 8,
          18 + ((k * 37) % 30)
        );
      }

      // Roadside: trees and spectators scrolling past
      for (const side of [-1, 1]) {
        for (let k = 0; k < 8; k++) {
          const p = ((k + ((stepF * 0.125) % 1)) / 8) ** 1.7;
          const y = horizon + p * (h - horizon);
          const x = cx + side * (half(y) + 10 + p * 34);
          const r = 4 + p * 24;
          if ((k + (side > 0 ? 1 : 0)) % 2 === 0) {
            ctx.fillStyle = '#6fbf6a';
            ctx.beginPath();
            ctx.arc(x, y - r, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#8a5a3c';
            ctx.fillRect(x - r * 0.12, y - r * 0.2, r * 0.24, r * 0.5);
          } else {
            const colors = ['#ff7a6b', '#6bb6ff', '#ffc83d', '#a78bfa'];
            ctx.fillStyle = colors[k % colors.length] ?? '#ff7a6b';
            ctx.fillRect(x - r * 0.3, y - r * 1.1, r * 0.6, r * 0.7);
            ctx.fillStyle = '#f6cfa8';
            ctx.beginPath();
            ctx.arc(x, y - r * 1.3, r * 0.28, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Items: far ones first
      const items = course
        .filter(
          (i) =>
            !gone.has(i.id) &&
            stepF >= i.hitStep - DASH_TRAVEL &&
            stepF <= i.hitStep + 4
        )
        .sort((a, b) => b.hitStep - a.hitStep);
      for (const it of items) {
        const p = Math.min(1.15, 1 - (it.hitStep - stepF) / DASH_TRAVEL);
        const y = horizon + p ** 1.6 * (runnerY - horizon);
        const x = cx + it.lane * (half(y) * 0.66);
        const s = 10 + p * 38;
        ctx.globalAlpha = Math.min(1, p * 4);
        // Name the colour emoji fonts: a plain serif can pick a pale outline glyph.
        ctx.font = `${s}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(EMOJI[it.kind], x, y);
        ctx.globalAlpha = 1;
      }

      // Runner from behind
      playerX += (laneRef.current - playerX) * 0.3;
      const px = cx + playerX * (half(runnerY) * 0.66);
      const bob = Math.abs(Math.sin(t * 14)) * 4;
      ctx.fillStyle = 'rgba(42,35,64,0.18)';
      ctx.beginPath();
      ctx.ellipse(px, runnerY + 6, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2a2340';
      const swing = Math.sin(t * 14) * 7;
      const top = runnerY - bob;
      // legs and white shoes, stepping
      for (const [dx, sw] of [
        [-11, swing],
        [3, -swing],
      ] as const) {
        ctx.fillStyle = '#3d3a5c';
        ctx.fillRect(px + dx, top - 22 + Math.max(0, sw) * 0.4, 8, 20);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(px + dx - 1, top - 4 + Math.max(0, sw) * 0.4, 10, 6, 3);
        ctx.fill();
        ctx.stroke();
      }
      // arms swinging
      ctx.fillStyle = skin;
      for (const [side, sw] of [
        [-1, -swing],
        [1, swing],
      ] as const) {
        ctx.beginPath();
        ctx.roundRect(px + side * 21 - 4, top - 48 + sw * 0.5, 8, 18, 4);
        ctx.fill();
        ctx.stroke();
      }
      // body in your shirt, with the race bib on the back
      ctx.fillStyle = tee;
      ctx.beginPath();
      ctx.roundRect(px - 17, top - 52, 34, 32, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 10, top - 46, 20, 14);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - 10, top - 46, 20, 14);
      ctx.fillStyle = '#2a2340';
      ctx.font = '800 9px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bibText, px, top - 38.5);
      ctx.lineWidth = 3;
      // head from behind: skin with your hair over it
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(px, top - 68, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(px, top - 68, 19.5, Math.PI * 0.72, Math.PI * 2.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pops: "+10", "-20"
      for (const pop of pops) {
        const age = t - pop.born;
        if (age > 0.9) continue;
        ctx.globalAlpha = 1 - age / 0.9;
        ctx.font = '800 24px "Baloo 2", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = pop.color;
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y - age * 50);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      if (last < 0) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      if (countdown > 0) {
        countdown -= dt;
        const n = Math.ceil(Math.max(0, countdown) / 0.8);
        if (n !== lastCount && n > 0) sfx.countdown();
        if (n === 0 && lastCount > 0) sfx.go();
        lastCount = n;
      } else if (!state.done) {
        acc += dt;
        while (acc >= DASH_STEP && !state.done) {
          acc -= DASH_STEP;
          const events = stepDash(state, course, laneRef.current);
          for (const e of events) {
            if (e.kind === 'miss') continue;
            gone.add(e.item.id);
            const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
            const x = w / 2 + e.item.lane * w * 0.3;
            if (e.kind === 'catch') {
              sfx.snack();
              pops.push({
                x,
                y: h * 0.62,
                text: `+${e.points}`,
                color: '#ff4f81',
                born: t,
              });
            } else {
              if (e.item.kind === 'puddle') sfx.splash();
              else sfx.stumble();
              pops.push({
                x,
                y: h * 0.62,
                text: e.points < 0 ? `${e.points}` : tr('Splash!'),
                color: '#2a2340',
                born: t,
              });
            }
          }
        }
        if (state.done) sfx.finish();
      }
      const stepF = state.step + (countdown > 0 ? 0 : acc / DASH_STEP);
      draw(stepF);
      if (now - lastHud > 80 || state.done) {
        lastHud = now;
        setHud({
          score: state.score,
          combo: state.combo,
          left: Math.max(
            0,
            Math.ceil((DASH_STEPS - state.step) * DASH_STEP * 10) / 10
          ),
          count: Math.ceil(Math.max(0, countdown) / 0.8),
        });
      }
      if (state.done && !reported) {
        reported = true;
        window.setTimeout(() => doneRef.current(state.moves, state.score), 900);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dateKey, round, look, bib]);

  // Swipe or tap a side of the road
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 28) steer(dx < 0 ? -1 : 1);
  };

  const mult = dashMultiplier(hud.combo);
  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label={tr('Snack Dash')}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="bib px-3 py-1.5">
          <p className="font-display text-[26px] font-extrabold leading-none tabular">
            {hud.score}
          </p>
          <p className="text-[12px] font-extrabold text-ink-soft">
            {tr('points')}
          </p>
        </div>
        <div className="bib px-3 py-1.5 text-right">
          <p className="font-display text-[26px] font-extrabold leading-none tabular">
            {hud.left.toFixed(1)}s
          </p>
          <p className="text-[12px] font-extrabold text-ink-soft">
            {hud.combo > 0
              ? `${tr('combo {n}', { n: hud.combo })}${mult > 1 ? ` · x${mult}` : ''}`
              : 'round ' + (round + 1)}
          </p>
        </div>
      </div>
      {hud.count > 0 && (
        <p
          key={hud.count}
          className="stamp pointer-events-none absolute inset-x-0 top-[34%] text-center font-display text-[84px] font-extrabold text-[var(--accent)] [text-shadow:0_4px_0_#2a2340]"
        >
          {hud.count}
        </p>
      )}
      {hud.count > 0 && (
        <p className="pointer-events-none absolute inset-x-6 bottom-[104px] mx-auto max-w-[320px] rounded-xl bg-ink px-3 py-2 text-center text-[13px] font-bold text-white">
          {tr(
            'Catch 🍬🥤💧🍰, dodge 🚧 and 💦. Snacks in a row build a combo.'
          )}
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between p-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            steer(-1);
          }}
          className="chunky h-16 w-20 rounded-2xl bg-white font-display text-[30px] font-extrabold"
          aria-label={tr('Move left')}
        >
          ◀
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            steer(1);
          }}
          className="chunky h-16 w-20 rounded-2xl bg-white font-display text-[30px] font-extrabold"
          aria-label={tr('Move right')}
        >
          ▶
        </button>
      </div>
    </div>
  );
};
