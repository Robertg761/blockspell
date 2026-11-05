import { DOWNLOADS, RELEASES_URL, detectPlatform, type OS } from '../platform';
import { pwa } from '../pwa';
import { h } from './dom';
import './panels.css';

/** The ⬇ panel: every way to put Blockspell on a computer or phone, with the one for this device first. */
export function getAppPanel(onBack: () => void): HTMLElement {
  const p = detectPlatform();
  const card = (title: string, emoji: string, body: (Node | string)[], primary = false) =>
    h(`div.get-card${primary ? '.primary' : ''}`, {}, [h('div.get-title', {}, [h('span.get-emoji', { text: emoji }), title, primary ? h('span.get-badge', { text: 'for this device' }) : null]), ...body]);
  const link = (text: string, url: string, hint?: string) =>
    h('a.btn.secondary.get-dl', { href: url, target: '_blank', rel: 'noopener', title: hint }, [text]);

  // ---- install from the browser (works on the page you're on right now)
  const installBody: (Node | string)[] = [];
  const installBtn = h('button.btn.get-install', { type: 'button', text: '⬇ Install Blockspell' });
  installBtn.addEventListener('click', () => void pwa.install());
  const note = (t: string) => h('p.get-note', { text: t });
  if (p.os === 'ios') installBody.push(note('Tap the Share button in Safari, then “Add to Home Screen”. Blockspell opens full screen like an app and keeps working with no signal.'));
  else if (p.safari && p.os === 'mac') installBody.push(note('In Safari choose File → Add to Dock. Chrome and Edge show an install icon in the address bar instead.'));
  else if (p.firefox) installBody.push(note('Firefox can’t install web apps. Use the desktop download below, or open Blockspell in Chrome or Edge to install it from there.'));
  else if (p.os === 'android') installBody.push(note('Tap ⋮ in Chrome, then “Install app” (or “Add to Home screen”). Or use the APK below.'));
  else installBody.push(note('Chrome and Edge: click the install icon at the right of the address bar, or ⋮ → “Install Blockspell”.'));
  const installNow = h('div.get-now');
  pwa.onChange((s) => installNow.replaceChildren(...(s.canInstall ? [installBtn] : s.installed ? [h('p.get-note', { text: '✓ Already installed on this device.' })] : [])));
  installBody.unshift(installNow);

  const desktop = card(
    'Desktop app',
    '🖥',
    [
      h('p.get-note', { text: 'A normal app for your computer. It has the whole game inside, so it never needs the internet.' }),
      h('div.get-dls', {}, [
        link('Windows', DOWNLOADS.windows.url, DOWNLOADS.windows.hint),
        link('macOS (Apple silicon)', DOWNLOADS.macArm.url, DOWNLOADS.macArm.hint),
        link('macOS (Intel)', DOWNLOADS.macIntel.url, DOWNLOADS.macIntel.hint),
        link('Linux', DOWNLOADS.linux.url, DOWNLOADS.linux.hint),
      ]),
      h('p.get-note.small', { text: 'The apps are not code-signed. Windows: “More info → Run anyway”. macOS: right-click the app → Open. Linux: chmod +x the file.' }),
    ],
    ['windows', 'mac', 'linux', 'other'].includes(p.os),
  );
  const android = card(
    'Android app',
    '🤖',
    [
      h('p.get-note', { text: 'An APK you install yourself. Your phone will ask to allow installs from your browser the first time.' }),
      h('div.get-dls', {}, [link('Download the APK', DOWNLOADS.android.url, DOWNLOADS.android.hint)]),
    ],
    p.os === 'android',
  );
  const browser = card('Install from your browser', '🌐', installBody, p.os === 'ios' || p.os === 'android');

  const order: Record<OS, HTMLElement[]> = {
    ios: [browser, desktop],
    android: [browser, android, desktop],
    windows: [desktop, browser, android],
    mac: [desktop, browser, android],
    linux: [desktop, browser, android],
    other: [desktop, browser, android],
  };

  return h('div.panel.getapp', {}, [
    h('h2', { text: '⬇ Get Blockspell' }),
    h('p.get-lede', { text: 'Download it once and play anywhere, even on a plane. The whole game fits on your device, with nothing to fetch later.' }),
    ...order[p.os],
    h('details.get-how', {}, [
      h('summary', { text: 'How does it work offline?' }),
      h('p', { text: 'Blockspell is a web page that saves itself. The first time you open it, your browser keeps a copy of every file (the game, its sounds and its 3D models are all generated from code, so there are no big downloads). After that it starts from that copy, so the Wi-Fi can be off. The desktop and Android apps just carry the same files inside the app.' }),
      h('p', { text: 'Your progress lives on the device you play on. Use ⚙ Settings → Save a backup to move it to another one.' }),
    ]),
    h('p.get-note.small', {}, ['All downloads are on the ', h('a', { href: RELEASES_URL, target: '_blank', rel: 'noopener', text: 'latest release' }), ' page.']),
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: onBack })]),
  ]);
}
