import { app, BrowserWindow, ipcMain, session, dialog, globalShortcut, shell } from 'electron';
import path from 'node:path';
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { initialAudioState, emptyMeters, PAD_COUNT, type DeviceReport, type AudioState, type AudioCommand, type LocalTrack, type Meters,
  type SoundPad, type IntegrationStatus, type SavedConfig, type YouTubeCommand, type VideoBounds } from './shared';
import { validCommand } from './commands';
import { validAccelerator } from './hotkeys';
import { loadConfig, saveConfig } from './config';
import { integrationStatus } from './processes';
import { checkForUpdate, releasesUrl } from './updates';
import type { UpdateInfo } from './shared';
import { youtubeId } from './youtube-url';
import { YouTubeView } from './youtube-view';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('MicMix');
app.setAppUserModelId('com.micmix.desktop');
const diagnose = process.argv.includes('--diagnose');
// --smoke-<name> loads scripts/smoke-<name>.cjs in an isolated diagnostics profile.
const smokeName = process.argv.map(arg => /^--smoke-([a-z0-9-]+)$/.exec(arg)?.[1]).find(Boolean);
const smokeTest = smokeName !== undefined;
// Diagnostics use their own profile so they can run beside the user's open app.
if (diagnose || smokeTest) app.setPath('userData', process.env.MICMIX_USERDATA || path.join(app.getPath('temp'), 'micmix-diagnostics-' + process.pid));
else if (!app.requestSingleInstanceLock()) app.quit();
let ui: BrowserWindow | null = null;
let worker: BrowserWindow | null = null;
let youtube: YouTubeView | null = null;
let latest: DeviceReport | null = null;
let timeout: NodeJS.Timeout | undefined;
let audioState: AudioState = initialAudioState();
const localFiles = new Map<string, LocalTrack>();
async function registerFiles(paths: string[]) {
  if (!Array.isArray(paths) || paths.length > 200 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p) || !/\.(mp3|wav|flac|ogg)$/i.test(p))) {
    throw new Error('Choose up to 200 local mp3, wav, flac, or ogg files.');
  }
  const tracks: LocalTrack[] = [];
  for (const file of paths) {
    if (!(await stat(file)).isFile()) throw new Error('Not an audio file: ' + path.basename(file));
    const existing = [...localFiles.values()].find(t => t.url === pathToFileURL(file).href);
    tracks.push(existing ?? { id: randomUUID(), title: path.basename(file), url: pathToFileURL(file).href });
  }
  for (const track of tracks) localFiles.set(track.id, track);
  return tracks;
}

// Persistence: main owns config.json; the worker's state is mirrored into it after startup restore.
const configPath = () => path.join(app.getPath('userData'), 'config.json');
let config: SavedConfig;
let restored = false;
let saveTimer: NodeJS.Timeout | undefined;
function flushConfig() {
  clearTimeout(saveTimer); saveTimer = undefined;
  try { saveConfig(configPath(), config); } catch (error) { console.error('Could not save MicMix settings:', error); }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushConfig, 500); }

let commandId = 0;
const pending = new Map<number, { resolve(): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
function publishAudio(state: AudioState) {
  audioState = state;
  if (restored) { config.settings = state.settings; scheduleSave(); }
  if (ui && !ui.isDestroyed()) ui.webContents.send('audio:state', state);
}
function cancelPending(reason: string) {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(reason)); }
  pending.clear();
}
function runCommand(command: AudioCommand) {
  if (!worker || worker.isDestroyed() || worker.webContents.isDestroyed()) throw new Error('Audio worker unavailable. Restart MicMix.');
  if (command.type === 'stop') cancelPending('Audio operation cancelled.');
  const id = ++commandId;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      if (worker && !worker.isDestroyed()) worker.webContents.send('audio:command', ++commandId, { type: 'stop' });
      reject(new Error('Audio command timed out. Output stopped; check microphone permissions and retry.'));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    worker!.webContents.send('audio:command', id, command);
  });
}

// Soundboard pad definitions live here; the worker decodes and plays them.
let pads: (SoundPad | null)[] = Array.from({ length: PAD_COUNT }, () => null);
function syncHotkeys() {
  globalShortcut.unregisterAll();
  for (const pad of pads) {
    if (!pad?.hotkey) continue;
    const slot = pad.slot;
    if (!globalShortcut.register(pad.hotkey, () => { void runCommand({ type: 'pad', slot }).catch(() => {}); })) {
      console.error('Hotkey unavailable:', pad.hotkey);
    }
  }
}
async function updatePads(next: (SoundPad | null)[]) {
  pads = next; config.pads = next; scheduleSave();
  syncHotkeys();
  await runCommand({ type: 'pads', pads });
}
async function assignPadFile(slot: number, file: string) {
  const [track] = await registerFiles([file]);
  const next = pads.slice();
  next[slot] = { slot, id: track.id, title: track.title, url: track.url, hotkey: pads[slot]?.hotkey ?? null };
  await updatePads(next);
}
function validSlot(slot: unknown): slot is number { return Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < PAD_COUNT; }

async function restore() {
  try { await runCommand({ type: 'settings', settings: config.settings }); } catch (error) { console.error(error); }
  const restoredPads: (SoundPad | null)[] = Array.from({ length: PAD_COUNT }, () => null);
  for (const pad of config.pads) {
    if (!pad) continue;
    try {
      const [track] = await registerFiles([fileURLToPath(pad.url)]);
      restoredPads[pad.slot] = { slot: pad.slot, id: track.id, title: track.title, url: track.url, hotkey: pad.hotkey };
    } catch { /* The clip file is gone; the pad becomes empty. */ }
  }
  pads = restoredPads; config.pads = pads; syncHotkeys();
  if (pads.some(Boolean)) await runCommand({ type: 'pads', pads }).catch(error => console.error(error));
  // The queue is deliberately NOT restored: every launch starts with an empty Music panel (user request).
  restored = true;
  config.queue = []; scheduleSave();
}

let integrations: IntegrationStatus = { discord: false, fivem: false };
let integrationTimer: NodeJS.Timeout | undefined;
async function pollIntegrations() {
  const next = await integrationStatus();
  if (next.discord !== integrations.discord || next.fivem !== integrations.fivem) {
    integrations = next;
    if (ui && !ui.isDestroyed()) ui.webContents.send('integrations:status', integrations);
  }
}

const audioUrl = pathToFileURL(path.join(__dirname, 'audio.html')).href;
const uiUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
function isWorker(contents: Electron.WebContents | null) {
  return !!worker && contents === worker.webContents && contents.getURL() === audioUrl;
}
function fromUi(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  return event.sender === ui?.webContents && event.senderFrame?.url === uiUrl;
}
function fromWorker(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  return isWorker(event.sender) && event.senderFrame?.url === audioUrl;
}
function publish(report: DeviceReport) {
  latest = report;
  if (ui && !ui.isDestroyed()) ui.webContents.send('devices:report', report);
}
function protect(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
// Update notice: one request to GitHub's releases API, then a link in the UI. Nothing is downloaded.
let update: UpdateInfo | null = null;
let updateTimer: NodeJS.Timeout | null = null;
function publishUpdate() { if (ui && !ui.isDestroyed()) ui.webContents.send('update:status', update); }
async function runUpdateCheck() {
  try { update = await checkForUpdate(); } catch { update = null; }
  publishUpdate();
}
function scheduleUpdateCheck() {
  if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
  // Only packaged builds phone GitHub, so development runs and smoke checks stay offline.
  if (!config.updateCheck || !(app.isPackaged || process.env.MICMIX_UPDATE_CHECK === '1')) return;
  const tick = () => { void runUpdateCheck(); updateTimer = setTimeout(tick, 6 * 60 * 60 * 1000); };
  updateTimer = setTimeout(tick, 8000);
}
app.whenReady().then(async () => {
  config = loadConfig(configPath());
  const audioSession = session.fromPartition('micmix-audio');
  audioSession.setPermissionCheckHandler((contents, permission) =>
    isWorker(contents) && (permission === 'media' || permission === 'speaker-selection' || permission === 'display-capture'));
  audioSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(isWorker(contents) && (permission === 'speaker-selection' || permission === 'display-capture' ||
      (permission === 'media' && 'mediaTypes' in details &&
        details.mediaTypes?.every(type => type === 'audio') === true))));
  audioSession.setDisplayMediaRequestHandler((request, callback) => {
    const frame = youtube?.frame();
    if (!worker || !isWorker(worker.webContents) || request.frame !== worker.webContents.mainFrame || !frame) { callback({}); return; }
    // Capture only this BrowserView, never system loopback or another window.
    callback({ video: frame, audio: frame, enableLocalEcho: false });
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ipcMain.handle('youtube:track', (event, url: string) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    if (typeof url !== 'string' || url.length > 2048) throw new Error('Paste a YouTube video link.');
    const videoId = youtubeId(url);
    const track: LocalTrack = { id: randomUUID(), title: 'YouTube · ' + videoId, url: 'https://www.youtube.com/watch?v=' + videoId, youtubeId: videoId };
    localFiles.set(track.id, track); return track;
  });
  ipcMain.handle('youtube:control', (event, command: YouTubeCommand) => {
    if (!fromWorker(event)) throw new Error('Unauthorized');
    if (!youtube || !command || !['load', 'play', 'pause', 'seek'].includes(command.type)) throw new Error('YouTube player unavailable.');
    return youtube.command(command);
  });
  ipcMain.on('youtube:event', (event, data) => { if (data && typeof data === 'object') youtube?.event(event, data); });
  ipcMain.on('youtube:bounds', (event, bounds: VideoBounds | null) => {
    if (!fromUi(event)) return;
    if (bounds === null) { youtube?.bounds(null); return; }
    if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key as keyof VideoBounds]))) return;
    const [width, height] = ui!.getContentSize();
    if (bounds.x < 0 || bounds.y < 0 || bounds.width < 0 || bounds.height < 0 || bounds.x + bounds.width > width + 1 || bounds.y + bounds.height > height + 1) { youtube?.bounds(null); return; }
    youtube?.bounds({ x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) });
  });
  ipcMain.handle('files:pick', async event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    const result = await dialog.showOpenDialog(ui!, { properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg'] }] });
    return result.canceled ? [] : registerFiles(result.filePaths);
  });
  ipcMain.handle('files:drop', (event, paths: string[]) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    return registerFiles(paths);
  });
  ipcMain.handle('clips:read', async (event, id: string) => {
    if (!fromWorker(event)) throw new Error('Unauthorized');
    const track = typeof id === 'string' ? localFiles.get(id) : undefined;
    if (!track || track.youtubeId) throw new Error('Unknown clip.');
    const file = fileURLToPath(track.url);
    if ((await stat(file)).size > 30 * 1024 * 1024) throw new Error('Soundboard clips must be under 30 MB.');
    return readFile(file);
  });
  ipcMain.handle('pads:assign', async (event, slot: number) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    if (!validSlot(slot)) throw new Error('Invalid pad.');
    const result = await dialog.showOpenDialog(ui!, { properties: ['openFile'], title: 'Choose a soundboard clip',
      filters: [{ name: 'Audio clips', extensions: ['mp3', 'wav', 'flac', 'ogg'] }] });
    if (!result.canceled && result.filePaths[0]) await assignPadFile(slot, result.filePaths[0]);
  });
  ipcMain.handle('pads:hotkey', async (event, slot: number, hotkey: string | null) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    if (!validSlot(slot) || !pads[slot]) throw new Error('Choose a clip for this pad first.');
    if (hotkey !== null) {
      if (!validAccelerator(hotkey)) throw new Error('Use Ctrl, Alt or Shift plus a key, or an F-key or numpad key.');
      const taken = pads.find(pad => pad && pad.slot !== slot && pad.hotkey === hotkey);
      if (taken) throw new Error('Pad ' + (taken.slot + 1) + ' already uses that hotkey.');
      globalShortcut.unregisterAll();
      const ok = globalShortcut.register(hotkey, () => {});
      globalShortcut.unregisterAll();
      if (!ok) { syncHotkeys(); throw new Error('Windows or another app already uses that shortcut. Try a different one.'); }
    }
    const next = pads.slice();
    next[slot] = { ...pads[slot]!, hotkey };
    await updatePads(next);
  });
  ipcMain.handle('pads:clear', async (event, slot: number) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    if (!validSlot(slot)) throw new Error('Invalid pad.');
    const next = pads.slice(); next[slot] = null;
    await updatePads(next);
  });
  ipcMain.handle('config:get', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    return { setupDone: config.setupDone, micLabel: config.micLabel, monitorLabel: config.monitorLabel, updateCheck: config.updateCheck, appVersion: app.getVersion() };
  });
  ipcMain.handle('config:devices', (event, micLabel: string | null, monitorLabel: string | null) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    const label = (value: unknown) => typeof value === 'string' && value.length <= 300 ? value : null;
    config.micLabel = label(micLabel) ?? config.micLabel; config.monitorLabel = label(monitorLabel) ?? config.monitorLabel;
    scheduleSave();
  });
  ipcMain.handle('config:setup-done', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    config.setupDone = true; flushConfig();
  });
  ipcMain.handle('integrations:get', event => { if (!fromUi(event)) throw new Error('Unauthorized'); return integrations; });
  ipcMain.handle('update:get', event => { if (!fromUi(event)) throw new Error('Unauthorized'); return update; });
  ipcMain.handle('update:open', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    const url = update?.url ?? releasesUrl;
    if (!url) throw new Error('No release page configured.');
    return shell.openExternal(url);
  });
  ipcMain.handle('config:update-check', (event, enabled: boolean) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    config.updateCheck = enabled === true; scheduleSave();
    if (!config.updateCheck) { update = null; publishUpdate(); }
    scheduleUpdateCheck();
  });
  ipcMain.handle('open:vbcable', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    return shell.openExternal('https://vb-audio.com/Cable/');
  });
  ipcMain.handle('open:donate', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    // VB-CABLE is donationware; the download page carries VB-Audio's donate link.
    return shell.openExternal('https://vb-audio.com/Cable/');
  });

  ipcMain.handle('audio:get-state', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    return audioState;
  });
  ipcMain.handle('audio:command', (event, command: AudioCommand) => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    // Pad definitions are owned by main; the UI edits them through pads:* handlers.
    if (!validCommand(command) || command.type === 'pads') throw new Error('Invalid audio command');
    if (command.type === 'enqueue') command = { type: 'enqueue', tracks: command.tracks.map(track => {
      const registered = localFiles.get(track.id);
      if (!registered) throw new Error('Choose this file with Add files or drag and drop first.');
      return registered;
    }) };
    return runCommand(command);
  });
  ipcMain.on('audio:reply', (event, id: number, error: string | null) => {
    if (!fromWorker(event)) return;
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(id);
    if (error) entry.reject(new Error(error)); else entry.resolve();
  });
  ipcMain.on('audio:state', (event, state: AudioState) => { if (fromWorker(event)) publishAudio(state); });
  ipcMain.on('audio:meters', (event, meters: Meters) => {
    if (fromWorker(event) && ui && !ui.isDestroyed()) ui.webContents.send('audio:meters', meters);
  });
  app.on('second-instance', () => { if (ui) { if (ui.isMinimized()) ui.restore(); ui.show(); ui.focus(); } });

  ipcMain.handle('devices:get', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    return latest;
  });
  ipcMain.handle('devices:refresh', event => {
    if (!fromUi(event)) throw new Error('Unauthorized');
    if (!worker || worker.isDestroyed()) throw new Error('Audio worker unavailable. Restart MicMix.');
    worker.webContents.send('audio:scan');
  });
  ipcMain.on('audio:report', (event, report: DeviceReport) => {
    if (!fromWorker(event)) return;
    publish(report);
    console.log('\nMicMix: actual Electron audio endpoints at ' + report.scannedAt);
    console.table(report.devices.map(device => ({ kind: device.kind, label: device.label || '(label unavailable)', deviceId: device.deviceId })));
    console.log('AudioContext.setSinkId:', report.setSinkIdSupported);
    if (report.error) console.error(report.error);
    const cableInput = report.devices.some(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label));
    const cableOutput = report.devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label));
    console.log('CABLE Input:', cableInput, '| CABLE Output:', cableOutput);
    if (diagnose) {
      clearTimeout(timeout);
      void mkdir(path.join(app.getAppPath(), 'artifacts'), { recursive: true })
        .then(() => writeFile(path.join(app.getAppPath(), 'artifacts', 'devices.json'),
          JSON.stringify({ versions: process.versions, ...report, cableInput, cableOutput }, null, 2)))
        .then(() => app.exit(report.error ? 1 : cableInput && cableOutput ? 0 : 2))
        .catch(error => { console.error(error); app.exit(1); });
    }
  });
  worker = new BrowserWindow({
    show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'),
      session: audioSession, contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, additionalArguments: ['--audio-worker'] }
  });
  protect(worker);
  worker.webContents.on('render-process-gone', (_event, details) => {
    youtube?.pause();
    cancelPending('Audio worker stopped. Restart MicMix.');
    publishAudio({ ...audioState, status: 'off', micId: null, monitorId: null, tone: false, playing: false, activePads: [], error: 'Audio worker stopped. Restart MicMix.' });
    if (ui && !ui.isDestroyed()) ui.webContents.send('audio:meters', emptyMeters);
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Audio worker stopped: ' + details.reason + '. Restart MicMix.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  });
  if (!diagnose) {
    ui = new BrowserWindow({ width: 1400, height: 920, minWidth: 960, minHeight: 680,
      title: 'MicMix', backgroundColor: '#071126', autoHideMenuBar: true, icon: path.join(__dirname, 'brand', 'icon.png'),
      titleBarStyle: 'hidden', titleBarOverlay: { color: '#071126', symbolColor: '#c9d0dc', height: 40 },
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    protect(ui);
    youtube = new YouTubeView(ui, update => { if (worker && !worker.isDestroyed()) worker.webContents.send('audio:youtube', update); });
    ui.webContents.on('render-process-gone', () => {
      youtube?.pause();
      if (worker && !worker.isDestroyed()) worker.webContents.send('audio:command', ++commandId, { type: 'stop' });
    });
    ui.on('closed', () => { ui = null; app.quit(); });
    await ui.loadFile(path.join(__dirname, 'index.html'));
    ui.show();
    ui.focus();
    scheduleUpdateCheck();
  }
  timeout = setTimeout(() => {
    if (latest) return;
    console.error('Device scan timed out. Check Windows microphone access.');
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Device scan timed out. Check Windows microphone access and rescan.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  }, 20000);
  await worker.loadURL(audioUrl);
  await restore();
  void pollIntegrations();
  integrationTimer = setInterval(() => { void pollIntegrations(); }, 5000);
  if (smokeTest && ui) {
    const deadline = Date.now() + 20000;
    while (!latest && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (!latest) throw new Error('Smoke check timed out waiting for devices.');
    const smoke = require(path.join(app.getAppPath(), 'scripts', 'smoke-' + smokeName + '.cjs'));
    await smoke(ui, worker, app.getAppPath(), registerFiles, youtube, { assignPadFile, configPath, flushConfig, userData: app.getPath('userData') });
    app.quit();
  }
}).catch(error => { console.error(error); app.exit(1); });
app.on('before-quit', () => {
  clearTimeout(timeout); clearInterval(integrationTimer);
  globalShortcut.unregisterAll(); youtube?.close(); cancelPending('MicMix is closing.');
  if (config) flushConfig();
});
