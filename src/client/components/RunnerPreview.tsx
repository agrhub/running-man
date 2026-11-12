import { useEffect, useRef } from 'react';
import type { DayInfo } from '../../shared/content';
import type { Look } from '../../shared/economy';
import { RunWorld } from '../three/world';

type Props = {
  day: DayInfo;
  look: Look;
  bib: number | null;
  /** Shows the back of the runner (the bib) now and then. */
  showBack?: boolean;
};

/** A slowly swaying 3D preview of a runner and their pet. */
export const RunnerPreview = ({ day, look, bib, showBack = false }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const world = new RunWorld({
      canvas,
      city: day.city,
      stage: day.stage,
      runners: [{ name: 'me', look, bib, other: false }],
      preview: true,
    });
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      world.sway(t, reduce, showBack);
      world.frame(t, [{ name: 'me', km: 0, speed: 0.15 }], 'me');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      world.dispose();
    };
  }, [day, look, bib, showBack]);
  return (
    <canvas ref={ref} className="h-full w-full" aria-label="Your runner" />
  );
};
