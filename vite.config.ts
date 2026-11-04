import { defineConfig } from 'vite';
import { precachePlugin } from './scripts/pwa-plugin.mjs';

// `base: './'` keeps every asset URL relative so the built `dist/` folder can be
// served from any path (or any static file server) with no network access.
// The precache plugin adds dist/sw.js, the service worker that makes the game installable and offline-first.
export default defineConfig({
  base: './',
  plugins: [precachePlugin()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
  preview: { host: true },
});
