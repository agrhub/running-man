import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

/**
 * Builds the client for the local harness (`npm run dev:local`): same pages,
 * with `@devvit/web/client` swapped for a small browser mock.
 */
export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      '@devvit/web/client': fileURLToPath(
        new URL('./src/dev/devvit-client-mock.ts', import.meta.url)
      ),
    },
  },
  build: {
    outDir: '../../dist-harness/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        splash: fileURLToPath(
          new URL('./src/client/splash.html', import.meta.url)
        ),
        game: fileURLToPath(new URL('./src/client/game.html', import.meta.url)),
      },
    },
  },
});
