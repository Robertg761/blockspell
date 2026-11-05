// Blockspell desktop shell: a plain Electron window around the built game (../dist copied to ./app).
// The game is served from a private app:// scheme so it behaves like a normal secure web origin
// (localStorage, ES modules, WebAudio) with no web server and no network.
const { app, BrowserWindow, Menu, protocol, net, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'app');
const ORIGIN = 'app://blockspell';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// let music start without a click first, and keep the game running when the window is covered
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// headless / CI machines have no GPU: software WebGL so the smoke test can render
if (process.env.BLOCKSPELL_SOFTWARE_GL === '1') {
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

function serve(request) {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  // never serve anything outside the app folder
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#cfe6f7',
    title: 'Blockspell',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  // the game is one page: keep it there, and send any web link to the real browser
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(ORIGIN)) {
      e.preventDefault();
      if (/^https:\/\//.test(target)) void shell.openExternal(target);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.setTitle('Blockspell');
  win.webContents.on('page-title-updated', (e) => e.preventDefault());
  void win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Game', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'togglefullscreen' }, { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName('Blockspell');
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    protocol.handle('app', serve);
    // the game needs no permissions (no camera, location, notifications...)
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    buildMenu();
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
