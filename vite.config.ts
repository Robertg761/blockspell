import { defineConfig } from 'vite';

// `base: './'` keeps every asset URL relative so the built `dist/` folder can be
// served from any path (or any static file server) with no network access.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
  preview: { host: true },
});
