/**
 * Installable, offline-first app: registers the service worker that scripts/pwa-plugin.mjs writes into dist/
 * (production builds only), tracks whether the whole game has been saved for offline play, and handles the
 * browser's "install app" prompt and "a new version is ready" updates. Everything here is optional: with no
 * service worker support (or in the dev server) the game just runs as a normal web page.
 */
import { detectPlatform } from './platform';

export interface PwaState {
  /** Every file is cached: the game now starts and plays with no network. */
  offlineReady: boolean;
  /** The browser offered to install the game as an app (Chrome, Edge, Android). */
  canInstall: boolean;
  /** A newer build has been downloaded and waits for a reload. */
  updateReady: boolean;
  /** Running as an installed app (standalone window). */
  installed: boolean;
  /** navigator.onLine, kept current. */
  online: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const listeners = new Set<(s: PwaState) => void>();
let deferred: BeforeInstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;

export const pwa = {
  state: {
    offlineReady: false,
    canInstall: false,
    updateReady: false,
    installed: typeof matchMedia === 'function' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  } as PwaState,

  /** Calls `fn` now and whenever something changes. Returns an unsubscribe function. */
  onChange(fn: (s: PwaState) => void): () => void {
    listeners.add(fn);
    fn(pwa.state);
    return () => listeners.delete(fn);
  },

  /** Shows the browser's install prompt (only after `canInstall`). */
  async install(): Promise<boolean> {
    if (!deferred) return false;
    const ev = deferred;
    deferred = null;
    set({ canInstall: false });
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === 'accepted') set({ installed: true });
    return outcome === 'accepted';
  },

  /** Activates the downloaded update and reloads into it. */
  applyUpdate(): void {
    if (waiting) waiting.postMessage('SKIP_WAITING');
    else location.reload();
  },
};

function set(patch: Partial<PwaState>): void {
  Object.assign(pwa.state, patch);
  for (const fn of [...listeners]) fn(pwa.state);
}

/** Registers the service worker. Call once at startup. */
export function registerPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => set({ installed: true, canInstall: false }));
  // the desktop and Android apps already carry every file; a service worker there would only risk stale copies
  if (detectPlatform().native) return;
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  // ?nosw keeps the service worker out of automation runs (it would also hide requests from the checks)
  if (new URLSearchParams(location.search).has('nosw')) return;

  const hadController = !!navigator.serviceWorker.controller;
  void navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const track = (sw: ServiceWorker | null) => {
        if (!sw) return;
        const check = () => {
          if (sw.state === 'installed' && hadController) {
            // an update finished downloading while an older version is in control
            waiting = sw;
            set({ updateReady: true });
          } else if (sw.state === 'activated') set({ offlineReady: true });
        };
        sw.addEventListener('statechange', check);
        check();
      };
      if (reg.active && !reg.installing && !reg.waiting) set({ offlineReady: true });
      track(reg.installing);
      track(reg.waiting);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // pick up new builds on long sessions too
      setInterval(() => void reg.update().catch(() => {}), 30 * 60 * 1000);
    })
    .catch(() => {
      /* no service worker (private mode, file://): the game still works online */
    });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}
