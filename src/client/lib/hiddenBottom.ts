/**
 * Reddit sizes the game's frame like `100vh`. In a mobile browser with a
 * bottom toolbar (Chrome on Android with the address bar at the bottom, for
 * one) the bottom of the frame then sits under the toolbar, hiding the tab
 * bar, the steering buttons and the bottom of every sheet.
 *
 * The frame cannot see the page around it, but an IntersectionObserver with
 * no root measures an element against the top-level viewport, even across
 * origins. A probe as tall as the frame tells us how much of its bottom is
 * off screen; that goes into `--hidden-bottom`, which the layout pads.
 */

/** Pixels hidden at the bottom of the frame, or 0 when that cannot be told. */
export const hiddenBottom = (
  frame: { top: number; bottom: number; height: number },
  visible: { top: number; bottom: number },
  intersecting: boolean
): number => {
  // The frame scrolled away (its top is off screen) is not a cut-off bottom.
  if (!intersecting || visible.top - frame.top > 1) return 0;
  const hidden = frame.bottom - visible.bottom;
  // A toolbar is a strip; more than a third of the frame is something else.
  return hidden > 1 && hidden < frame.height * 0.35 ? Math.round(hidden) : 0;
};

export const watchHiddenBottom = () => {
  if (typeof IntersectionObserver === 'undefined') return;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1px',
    height: '100%',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(probe);
  let last = -1;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      const px = hiddenBottom(
        entry.boundingClientRect,
        entry.intersectionRect,
        entry.isIntersecting
      );
      if (Math.abs(px - last) < 2) return;
      last = px;
      document.documentElement.style.setProperty('--hidden-bottom', `${px}px`);
    },
    // Steps of 1% catch the toolbar sliding in and out.
    { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }
  );
  io.observe(probe);
};
