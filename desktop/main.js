// OAB Studio – desktop app (Windows)
// Starts the OAB server (bundled Python) and shows the studio in its own window.
const { app, BrowserWindow, session, shell, dialog, desktopCapturer, Menu, ipcMain } = require('electron');
const { spawn, execFile, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8000;
const STUDIO = `http://127.0.0.1:${PORT}/studio`;
const DATA = path.join(app.getPath('appData'), 'OAB');            // %APPDATA%\OAB – settings, playlists, recordings
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
const SERVER_DIR = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, '..', 'server');
let win = null, server = null, quitting = false, ytWin = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function log(msg){ try { fs.appendFileSync(path.join(DATA, 'app.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch(e){} }

// first run: bring settings over from the old portable folder (OAB or Radio)
function importOldSettings(){
  if (fs.existsSync(path.join(DATA, 'config.json'))) return;
  const home = app.getPath('home');
  const spots = ['Desktop', 'Documents', 'Downloads', ''].flatMap(d => ['OAB', 'Radio'].map(n => path.join(home, d, n)))
    .concat(['C:\\OAB', 'C:\\Radio', 'D:\\OAB', 'D:\\Radio']);
  const src = spots.find(p => { try { return fs.existsSync(path.join(p, 'config.json')) && fs.existsSync(path.join(p, 'server.py')); } catch(e){ return false; } });
  if (!src) return;
  try {
    for (const f of ['config.json', 'playlists.json']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(DATA, f));
    for (const d of ['data', 'recordings']) if (fs.existsSync(path.join(src, d))) fs.cpSync(path.join(src, d), path.join(DATA, d), { recursive: true });
    log('imported settings from ' + src);
  } catch(e){ log('import failed: ' + e.message); }
}

function ping(){ return new Promise(res => { const r = http.get(`http://127.0.0.1:${PORT}/api/status`, x => { x.resume(); res(x.statusCode === 200); }); r.on('error', () => res(false)); r.setTimeout(800, () => { r.destroy(); res(false); }); }); }

async function startServer(){
  if (await ping()) { log('a server is already running on port ' + PORT); return true; }
  const py = path.join(RES, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
  const script = path.join(SERVER_DIR, 'server.py');
  const out = fs.openSync(path.join(DATA, 'server.log'), 'a');
  server = spawn(fs.existsSync(py) ? py : (process.platform === 'win32' ? 'python' : 'python3'), ['-u', script], {
    cwd: DATA, windowsHide: true, stdio: ['ignore', out, out],
    env: Object.assign({}, process.env, { OAB_DATA: DATA, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', RADIO_PORT: String(PORT) })
  });
  server.on('exit', code => { log('server exited ' + code); server = null; if (!quitting && win) dialog.showErrorBox('OAB Studio', 'The OAB server stopped (code ' + code + ').\nSee ' + path.join(DATA, 'server.log')); });
  for (let i = 0; i < 60; i++) { if (await ping()) return true; await new Promise(r => setTimeout(r, 250)); }
  return false;
}

function permissions(){
  const s = session.defaultSession;
  const allow = new Set(['media', 'display-capture', 'hid', 'serial', 'clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen', 'speaker-selection']);
  s.setPermissionRequestHandler((wc, perm, cb) => cb(allow.has(perm)));
  s.setPermissionCheckHandler((wc, perm) => allow.has(perm));
  s.setDevicePermissionHandler(d => d.deviceType === 'hid' || d.deviceType === 'serial');
  // LINE IN "computer sound": the whole screen + Windows loopback audio
  // LINE IN: the OAB YouTube window (muted on the PC, heard only through OAB) – else the whole computer sound
  s.setDisplayMediaRequestHandler((req, cb) => {
    if (ytWin && !ytWin.isDestroyed()) { const f = ytWin.webContents.mainFrame; return cb({ video: f, audio: f }); }
    desktopCapturer.getSources({ types: ['screen'] }).then(src => cb(src[0] ? { video: src[0], audio: 'loopback' } : {})).catch(() => cb({}));
  }, { useSystemPicker: false });
  s.on('select-hid-device', (e, d, cb) => { e.preventDefault(); cb(d.deviceList && d.deviceList[0] ? d.deviceList[0].deviceId : ''); });
  s.on('select-serial-port', (e, list, wc, cb) => { e.preventDefault(); cb(list && list[0] ? list[0].portId : ''); });
}

// ---------- YouTube window: plays only through OAB (LINE IN), never straight to the speakers ----------
function openYouTube(){
  if (ytWin && !ytWin.isDestroyed()) { if (ytWin.isMinimized()) ytWin.restore(); ytWin.focus(); return true; }
  ytWin = new BrowserWindow({ width: 1200, height: 800, title: 'OAB – YouTube (plays through OAB LINE IN)', icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true, backgroundColor: '#0F0F0F', webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  ytWin.removeMenu();
  ytWin.webContents.setAudioMuted(true);                       // silent on the PC – OAB takes the sound
  ytWin.webContents.on('did-navigate', () => { if (ytWin) ytWin.webContents.setAudioMuted(true); });
  ytWin.webContents.setWindowOpenHandler(({ url }) => { ytWin.loadURL(url); return { action: 'deny' }; });
  ytWin.on('page-title-updated', (e, t) => { e.preventDefault(); ytWin.setTitle('OAB – ' + t); });
  ytWin.on('closed', () => { ytWin = null; });
  ytWin.loadURL(process.env.OAB_YT_URL || 'https://www.youtube.com/');
  return true;
}
ipcMain.handle('yt-open', () => openYouTube());

// ---------- all computer sound through OAB (Windows default playback -> VB-Audio "CABLE Input") ----------
const PS1 = app.isPackaged ? path.join(process.resourcesPath, 'scripts', 'audio-route.ps1') : path.join(__dirname, 'scripts', 'audio-route.ps1');
const PREV = () => path.join(DATA, 'audio-prev.json');
function ps(args){ return new Promise(res => {
  if (process.platform !== 'win32') return res({ error: 'windows only' });
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, ...args], { windowsHide: true, timeout: 20000, encoding: 'utf8' }, (err, out) => {
    if (err) { log('audio-route: ' + err.message); return res({ error: err.message }); }
    try { res(JSON.parse(String(out).trim())); } catch(e){ res({ error: 'bad output: ' + String(out).slice(0, 200) }); } });
}); }
function restoreDefaultSync(){
  try { if (!fs.existsSync(PREV())) return; const p = JSON.parse(fs.readFileSync(PREV(), 'utf8'));
    if (process.platform === 'win32' && p.id) execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, 'set', p.id], { windowsHide: true, timeout: 15000 });
    fs.unlinkSync(PREV()); log('playback device restored: ' + p.name);
  } catch(e){ log('restore failed: ' + e.message); }
}
ipcMain.handle('pc-devices', () => ps(['list']));
ipcMain.handle('pc-route', async (e, on) => {
  if (!on) { restoreDefaultSync(); return { ok: true }; }
  const l = await ps(['list']); if (l.error) return l;
  const devs = l.devices || [], cable = devs.find(d => /CABLE Input/i.test(d.name));
  if (!cable) return { error: 'nocable' };
  let prev = null; try { prev = JSON.parse(fs.readFileSync(PREV(), 'utf8')); } catch(e){}
  if (!prev) { const cur = devs.find(d => d.default && d.id !== cable.id) || devs.find(d => d.id !== cable.id); if (!cur) return { error: 'noreal' }; prev = { id: cur.id, name: cur.name }; fs.writeFileSync(PREV(), JSON.stringify(prev)); }
  const r = await ps(['set', cable.id]); if (r.error || !r.ok) return { error: r.error || ('set failed ' + r.code) };
  log('playback device -> ' + cable.name + ' (was ' + prev.name + ')');
  return { ok: true, prevName: prev.name, cableName: cable.name };
});
ipcMain.handle('pc-route-target', async () => { let prev = null; try { prev = JSON.parse(fs.readFileSync(PREV(), 'utf8')); } catch(e){}
  if (prev) return { name: prev.name }; const l = await ps(['list']); if (l.error) return l; const d = (l.devices || []).find(x => x.default) || {}; return { name: d.name || '', cable: (l.devices || []).some(x => /CABLE Input/i.test(x.name)) }; });
ipcMain.handle('yt-is-open', () => !!(ytWin && !ytWin.isDestroyed()));
ipcMain.handle('yt-close', () => { if (ytWin && !ytWin.isDestroyed()) ytWin.close(); return true; });

function createWindow(){
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 650, show: false, title: 'OAB Studio', backgroundColor: '#0D0E11',
    icon: path.join(__dirname, 'build', 'icon.ico'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', preload: path.join(__dirname, 'preload.js') }
  });
  win.removeMenu();
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://127.0.0.1:${PORT}`) && !url.startsWith(`http://localhost:${PORT}`)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F12' && i.control && i.shift) win.webContents.openDevTools({ mode: 'detach' }); });
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL(STUDIO);
  win.on('closed', () => { win = null; if (ytWin && !ytWin.isDestroyed()) ytWin.destroy(); });
}

function checkUpdates(){
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', info => {
      dialog.showMessageBox(win, { type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, title: 'OAB Studio update',
        message: `OAB Studio ${info.version} is ready.`, detail: 'Restart now to install it (do it when you are not live).' })
        .then(r => { if (r.response === 0) { quitting = true; autoUpdater.quitAndInstall(); } });
    });
    autoUpdater.on('error', e => log('update: ' + (e && e.message)));
    autoUpdater.checkForUpdates().catch(e => log('update: ' + e.message));
  } catch(e){ log('updater not available: ' + e.message); }
}

app.whenReady().then(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  restoreDefaultSync();                      // after a crash: give Windows its own speakers back
  importOldSettings();
  permissions();
  const ok = await startServer();
  if (!ok) { dialog.showErrorBox('OAB Studio', 'The OAB server did not start.\nIf the old OAB (start-oab.bat) is open, close it and try again.\nLog: ' + path.join(DATA, 'server.log')); }
  createWindow();
  if (app.isPackaged) setTimeout(checkUpdates, 8000);
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { quitting = true; if (server) { try { server.kill(); } catch(e){} } app.quit(); });
app.on('will-quit', () => { restoreDefaultSync(); if (server) { try { server.kill(); } catch(e){} } });
