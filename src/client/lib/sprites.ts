import {
  HAIR_TONES,
  SKIN_TONES,
  itemById,
  type Look,
} from '../../shared/economy';

/** Colours of a player's runner, for the 2D mini games. */
export type RunnerPaint = {
  tee: string;
  hair: string;
  skin: string;
  bib: string;
};

export const runnerPaint = (look: Look, bib: number | null): RunnerPaint => ({
  tee: itemById(look.top)?.color ?? '#ff7a6b',
  hair: HAIR_TONES[look.hair] ?? '#2b2118',
  skin: SKIN_TONES[look.skin] ?? '#ffe0c7',
  bib: bib === null ? '' : String(bib).padStart(4, '0'),
});

const INK = '#2a2340';

/**
 * A chibi seen from the side, facing right, feet on `ground`. `phase` swings the
 * legs and arms; `pose` changes the shape for jumping, stumbling or throwing.
 */
export const drawSideRunner = (
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  p: RunnerPaint,
  phase: number,
  pose: 'run' | 'jump' | 'trip' | 'throw' | 'stand' = 'run',
  scale = 1
) => {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, scale);
  if (pose === 'trip') ctx.rotate(0.5);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  const swing = pose === 'run' ? Math.sin(phase) * 10 : pose === 'jump' ? 8 : 0;
  // legs
  for (const [dx, s] of [
    [-6, swing],
    [4, -swing],
  ] as const) {
    ctx.save();
    ctx.translate(dx, -24);
    ctx.rotate((s / 10) * 0.6);
    ctx.fillStyle = '#3d3a5c';
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-4, 16, 13, 7, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // body with the bib on the side
  ctx.fillStyle = p.tee;
  ctx.beginPath();
  ctx.roundRect(-15, -54, 30, 32, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-9, -47, 18, 12);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-9, -47, 18, 12);
  ctx.fillStyle = INK;
  ctx.font = '800 8px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.bib, 0, -40.5);
  ctx.lineWidth = 3;
  // arm
  ctx.save();
  ctx.translate(2, -48);
  ctx.rotate(
    pose === 'throw' ? -2.4 : pose === 'jump' ? -1.2 : (-swing / 10) * 0.8
  );
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.roundRect(-4, 0, 8, 18, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // head facing right
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(2, -72, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(2, -72, 19.5, Math.PI * 0.95, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(12, -70, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9fb2';
  ctx.beginPath();
  ctx.arc(10, -63, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** A small round pet seen from the side (colour picked by the pet id). */
export const drawPet = (
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  pet: string,
  phase: number,
  facing: 1 | -1 = 1
) => {
  const color =
    {
      corgi: '#f2a65a',
      cat: '#e9a46a',
      shiba: '#e8a35e',
      penguin: '#2a2340',
      bunny: '#f5f0ea',
      fox: '#f07a2b',
      panda: '#f7f7f7',
    }[pet] ?? '#f2a65a';
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(facing, 1);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  const hop = Math.abs(Math.sin(phase)) * 4;
  ctx.fillStyle = color;
  for (const dx of [-9, 7]) {
    ctx.beginPath();
    ctx.roundRect(dx, -9, 5, 9, 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, -14 - hop, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14, -24 - hop, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, -31 - hop);
  ctx.lineTo(13, -38 - hop);
  ctx.lineTo(16, -31 - hop);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(18, -25 - hop, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Sizes the canvas to its box at up to 2x and returns the CSS size. */
export const fitCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
) => {
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

export const popText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  age: number
) => {
  if (age > 0.9) return;
  ctx.globalAlpha = 1 - age / 0.9;
  ctx.font = '800 24px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, x, y - age * 50);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y - age * 50);
  ctx.globalAlpha = 1;
};
