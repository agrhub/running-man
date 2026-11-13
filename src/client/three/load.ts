/**
 * The 3D world (three.js and the procedural city) is the biggest part of the
 * app. It loads on demand; `preloadWorld` starts the download early, while the
 * player reads the plan, so the race still starts at once.
 */
let pending: Promise<typeof import('./world')> | null = null;

export const loadWorld = () => (pending ??= import('./world'));

export const preloadWorld = () => {
  void loadWorld().catch(() => {
    pending = null;
  });
};
