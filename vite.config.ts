import { defineConfig } from 'vite';

// `base: './'` makes every asset URL relative, so the built site works when it is
// hosted from a subdirectory (e.g. https://user.github.io/dot-survival/).
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
