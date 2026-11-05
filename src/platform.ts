/**
 * Where is the game running? Used to show the right "get the app" help and to hide it once the game
 * is already an app. Also holds the download links, which all point at the latest GitHub release
 * (built by .github/workflows/release.yml with fixed file names, so these URLs never change).
 */
export const REPO_URL = 'https://github.com/Robertg761/blockspell';
/** Where the web version lives (GitHub Pages), for links that must open outside the native apps. */
export const PUBLIC_URL = 'https://robertg761.github.io/blockspell/';
export const RELEASES_URL = `${REPO_URL}/releases/latest`;
const dl = (file: string) => `${REPO_URL}/releases/latest/download/${file}`;

export const DOWNLOADS = {
  windows: { label: 'Windows', file: 'Blockspell-win-x64.exe', url: dl('Blockspell-win-x64.exe'), hint: 'Installer for Windows 10 and 11' },
  macArm: { label: 'macOS (Apple silicon)', file: 'Blockspell-mac-arm64.dmg', url: dl('Blockspell-mac-arm64.dmg'), hint: 'M1, M2, M3 and newer Macs' },
  macIntel: { label: 'macOS (Intel)', file: 'Blockspell-mac-x64.dmg', url: dl('Blockspell-mac-x64.dmg'), hint: 'Older Intel Macs' },
  linux: { label: 'Linux', file: 'Blockspell-linux-x86_64.AppImage', url: dl('Blockspell-linux-x86_64.AppImage'), hint: 'AppImage: make it executable and run it' },
  android: { label: 'Android', file: 'Blockspell-android.apk', url: dl('Blockspell-android.apk'), hint: 'APK: open it on your phone to install' },
} as const;

export type OS = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'other';

export interface PlatformInfo {
  os: OS;
  /** Running inside the Electron desktop app or the Capacitor Android app. */
  native: boolean;
  /** Running as an installed PWA (standalone window / home-screen icon). */
  standalone: boolean;
  /** Safari-like browser that has no install prompt (iOS and macOS Safari). */
  safari: boolean;
  /** Firefox on desktop: no PWA install support. */
  firefox: boolean;
}

export function detectPlatform(): PlatformInfo {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const touchMac = typeof navigator !== 'undefined' && /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports a Mac
  let os: OS = 'other';
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Windows/.test(ua)) os = 'windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'mac';
  else if (/Linux|X11|CrOS/.test(ua)) os = 'linux';
  const w = typeof window === 'undefined' ? ({} as Window & { Capacitor?: { isNativePlatform?: () => boolean } }) : (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } });
  const native = /Electron\//.test(ua) || !!w.Capacitor?.isNativePlatform?.();
  const standalone =
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true);
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS|FxiOS|EdgiOS|Android/.test(ua);
  const firefox = /Firefox\//.test(ua) && os !== 'android' && os !== 'ios';
  return { os, native, standalone, safari, firefox };
}
